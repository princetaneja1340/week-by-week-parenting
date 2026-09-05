"""Jira + Confluence over the REST API.

Auth is an Atlassian API token (id.atlassian.com -> Security -> API tokens), which is
self-service — no admin approval. This is why P0 ships today.
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from ..config import AtlassianSettings

TIMEOUT = httpx.Timeout(30.0)


class Atlassian:
    def __init__(self, settings: AtlassianSettings | None = None) -> None:
        self.settings = settings or AtlassianSettings.load()
        token = f"{self.settings.email}:{self.settings.token}".encode()
        self._client = httpx.Client(
            timeout=TIMEOUT,
            headers={
                "Authorization": f"Basic {base64.b64encode(token).decode()}",
                "Accept": "application/json",
            },
        )

    def _get(self, path: str, **params: Any) -> dict:
        response = self._client.get(f"{self.settings.site}{path}", params=params)
        response.raise_for_status()
        return response.json()

    # ---- Jira ----

    def jira_search(self, jql: str, limit: int = 25) -> list[dict]:
        """Run a JQL query. Returns flattened issues with a browse URL for citation."""
        data = self._get(
            "/rest/api/3/search/jql",
            jql=jql,
            maxResults=min(limit, 100),
            fields="summary,status,assignee,priority,updated,duedate,project",
        )
        return [self._flatten_issue(i) for i in data.get("issues", [])]

    def jira_issue(self, key: str) -> dict:
        data = self._get(
            f"/rest/api/3/issue/{key}",
            fields="summary,status,assignee,priority,updated,duedate,project,description",
        )
        return self._flatten_issue(data)

    def _flatten_issue(self, issue: dict) -> dict:
        fields = issue.get("fields") or {}
        assignee = fields.get("assignee") or {}
        status = fields.get("status") or {}
        priority = fields.get("priority") or {}
        project = fields.get("project") or {}
        return {
            "key": issue.get("key"),
            "summary": fields.get("summary"),
            "status": status.get("name"),
            "assignee": assignee.get("displayName"),
            "priority": priority.get("name"),
            "updated": fields.get("updated"),
            "due": fields.get("duedate"),
            "project": project.get("key"),
            "url": f"{self.settings.site}/browse/{issue.get('key')}",
        }

    # ---- Confluence ----

    def confluence_search(self, cql: str, limit: int = 15) -> list[dict]:
        """Run a CQL query against Confluence content."""
        data = self._get("/wiki/rest/api/search", cql=cql, limit=min(limit, 50))
        out: list[dict] = []
        for result in data.get("results", []):
            content = result.get("content") or {}
            out.append(
                {
                    "id": content.get("id"),
                    "title": result.get("title") or content.get("title"),
                    "type": content.get("type"),
                    "space": (result.get("resultGlobalContainer") or {}).get("title"),
                    "last_modified": result.get("lastModified"),
                    "excerpt": _strip(result.get("excerpt", "")),
                    "url": self.settings.site + "/wiki" + (result.get("url") or ""),
                }
            )
        return out

    def confluence_page(self, page_id: str) -> dict:
        data = self._get(
            f"/wiki/api/v2/pages/{page_id}", **{"body-format": "storage"}
        )
        body = ((data.get("body") or {}).get("storage") or {}).get("value", "")
        return {
            "id": data.get("id"),
            "title": data.get("title"),
            "space_id": data.get("spaceId"),
            "version": (data.get("version") or {}).get("number"),
            "body": _strip(body),
            "url": f"{self.settings.site}/wiki/pages/{data.get('id')}",
        }

    def close(self) -> None:
        self._client.close()


def _strip(html: str, limit: int = 8000) -> str:
    """Confluence returns storage-format XHTML. Crude tag strip is enough for grounding —
    the model needs the prose, not the markup."""
    import re

    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;?", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]
