"""GitHub — pull requests, reviews, and what actually shipped. Read-only.

Auth is a personal access token, which is self-service like the Atlassian token, so
this lands in P0 rather than waiting on an app registration.

The env vars are COS_GITHUB_* rather than the conventional GITHUB_*: a bare
GITHUB_TOKEN is injected by GitHub Actions and much local tooling, and silently
authenticating as a CI runner is a failure that would look exactly like success.

The PM-relevant view of GitHub is not the code. It is: what is blocked on me, what is
in flight for a ticket I own, and what actually reached production. Those three
questions shape the methods below.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from ..config import GitHubSettings

TIMEOUT = httpx.Timeout(30.0)
# Scopes on a classic PAT that would let this connector write. We never use them, but
# a token that carries them is a larger blast radius than this tool needs.
WRITE_SCOPES = ("repo:status", "write:", "delete:", "admin:", "workflow")


class GitHub:
    def __init__(self, settings: GitHubSettings | None = None) -> None:
        self.settings = settings or GitHubSettings.load()
        self._client = httpx.Client(
            timeout=TIMEOUT,
            headers={
                "Authorization": f"Bearer {self.settings.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        self._scope_warning: str | None = None

    def _get(self, path: str, **params: Any) -> Any:
        response = self._client.get(
            f"{self.settings.api}{path}",
            params={k: v for k, v in params.items() if v is not None},
        )
        # Classic PATs report their scopes on every response. Surface an over-broad
        # token once rather than silently holding write access we never use.
        scopes = response.headers.get("x-oauth-scopes", "")
        if scopes and self._scope_warning is None:
            granted = [s.strip() for s in scopes.split(",") if s.strip()]
            broad = [s for s in granted if any(s.startswith(w) for w in WRITE_SCOPES)]
            self._scope_warning = (
                f"Note: this GitHub token carries write scopes ({', '.join(broad)}). "
                "Nothing here uses them, but a read-only fine-grained token would be tighter."
                if broad
                else ""
            )
        response.raise_for_status()
        return response.json()

    def _org_filter(self) -> str:
        return f" org:{self.settings.org}" if self.settings.org else ""

    # ---- who am I ----

    def me(self) -> dict:
        data = self._get("/user")
        return {"login": data.get("login"), "name": data.get("name")}

    # ---- the three questions ----

    def review_queue(self, limit: int = 20) -> dict:
        """Open PRs waiting on my review. This is what I am blocking."""
        return self._search(
            f"is:pr is:open review-requested:@me{self._org_filter()}", limit
        )

    def my_pull_requests(self, limit: int = 20) -> dict:
        """My own open PRs, oldest first — the ones going stale are the interesting ones."""
        return self._search(
            f"is:pr is:open author:@me{self._org_filter()} sort:created-asc", limit
        )

    def for_jira_key(self, key: str, limit: int = 20) -> dict:
        """Every PR referencing a Jira key. The bridge between the ticket and the code.

        Zeta convention puts the key in the branch name or PR title (PAY-1423), so a
        free-text search across PRs finds the work in flight for a ticket.
        """
        if not re.fullmatch(r"[A-Z][A-Z0-9]+-\d+", key.strip().upper()):
            return {"error": f"{key!r} does not look like a Jira key (e.g. PAY-1423)."}
        return self._search(f"is:pr {key.strip().upper()}{self._org_filter()}", limit)

    def search(self, query: str, limit: int = 20) -> dict:
        """Raw GitHub search over issues and PRs, scoped to the org when one is set."""
        return self._search(f"{query}{self._org_filter()}", limit)

    def _search(self, query: str, limit: int) -> dict:
        data = self._get(
            "/search/issues",
            q=query,
            per_page=min(limit, 50),
            advanced_search="true",
        )
        return {
            "query": query,
            "total": data.get("total_count", 0),
            "results": [self._flatten(i) for i in data.get("items", [])],
            "note": self._scope_warning or None,
        }

    def _flatten(self, item: dict) -> dict:
        pr = item.get("pull_request") or {}
        return {
            "title": item.get("title"),
            "number": item.get("number"),
            "repo": _repo_from_url(item.get("repository_url", "")),
            "author": (item.get("user") or {}).get("login"),
            "state": "merged" if pr.get("merged_at") else item.get("state"),
            "draft": item.get("draft", False),
            "created": item.get("created_at"),
            "updated": item.get("updated_at"),
            "comments": item.get("comments"),
            "url": item.get("html_url"),
        }

    def pull_request(self, repo: str, number: int) -> dict:
        """One PR in full, with its review state — for 'why is this stuck?'."""
        data = self._get(f"/repos/{repo}/pulls/{number}")
        reviews = self._get(f"/repos/{repo}/pulls/{number}/reviews", per_page=50)
        return {
            "title": data.get("title"),
            "number": data.get("number"),
            "repo": repo,
            "author": (data.get("user") or {}).get("login"),
            "state": "merged" if data.get("merged") else data.get("state"),
            "draft": data.get("draft"),
            "created": data.get("created_at"),
            "updated": data.get("updated_at"),
            "mergeable_state": data.get("mergeable_state"),
            "changed_files": data.get("changed_files"),
            "additions": data.get("additions"),
            "deletions": data.get("deletions"),
            "body": (data.get("body") or "")[:2000],
            "reviews": [
                {
                    "by": (r.get("user") or {}).get("login"),
                    "state": r.get("state"),
                    "at": r.get("submitted_at"),
                }
                for r in reviews
            ],
            "url": data.get("html_url"),
        }

    def shipped(self, repo: str, days: int = 7, limit: int = 20) -> dict:
        """What merged recently — the honest answer to 'did it ship?'."""
        import datetime as dt

        since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
        return self._search(f"is:pr is:merged repo:{repo} merged:>={since}", limit)

    def close(self) -> None:
        self._client.close()


def _repo_from_url(url: str) -> str:
    """https://api.github.com/repos/zeta/payments -> zeta/payments"""
    parts = url.rstrip("/").split("/repos/")
    return parts[-1] if len(parts) > 1 else url
