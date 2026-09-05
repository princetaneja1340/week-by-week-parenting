"""The draft queue — M5.

The "draft, never send" rule is enforced by the absence of a send path, not by a flag.
Nothing in this codebase can transmit a message. This module is where output that
*would* be sent goes to wait for a human.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

from .config import DRAFTS_DIR


@dataclass(frozen=True)
class Draft:
    path: Path
    kind: str
    to: str
    subject: str
    created: str

    @property
    def slug(self) -> str:
        return self.path.stem


def create(kind: str, to: str, subject: str, body: str) -> Path:
    """Write a draft to the queue and return its path.

    kind: 'email' | 'teams' | 'jira-comment' | 'confluence-comment' | 'note'
    """
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now()
    stamp = now.strftime("%Y%m%d-%H%M%S")
    path = DRAFTS_DIR / f"{stamp}-{kind}-{_slugify(subject)}.md"
    path.write_text(
        "---\n"
        f"kind: {kind}\n"
        f"to: {to}\n"
        f"subject: {subject}\n"
        f"created: {now.isoformat(timespec='seconds')}\n"
        "status: awaiting-review\n"
        "---\n\n"
        f"{body.strip()}\n",
        encoding="utf-8",
    )
    return path


def listing() -> list[Draft]:
    """Every draft awaiting review, newest first."""
    if not DRAFTS_DIR.exists():
        return []
    out: list[Draft] = []
    for path in sorted(DRAFTS_DIR.glob("*.md"), reverse=True):
        meta = _front_matter(path)
        out.append(
            Draft(
                path=path,
                kind=meta.get("kind", "?"),
                to=meta.get("to", "?"),
                subject=meta.get("subject", path.stem),
                created=meta.get("created", "?"),
            )
        )
    return out


def read(slug: str) -> str:
    matches = [p for p in DRAFTS_DIR.glob("*.md") if slug in p.stem]
    if not matches:
        raise FileNotFoundError(f"No draft matching {slug!r}.")
    if len(matches) > 1:
        names = ", ".join(p.stem for p in matches)
        raise ValueError(f"{slug!r} matches several drafts: {names}")
    return matches[0].read_text(encoding="utf-8")


def _front_matter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    _, _, rest = text.partition("---\n")
    block, _, _ = rest.partition("\n---")
    meta: dict[str, str] = {}
    for line in block.splitlines():
        key, sep, value = line.partition(":")
        if sep:
            meta[key.strip()] = value.strip()
    return meta


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (slug or "untitled")[:50]
