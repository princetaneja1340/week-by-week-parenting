"""Memory is plain markdown on disk. No vector store, no third-party service.

At this scale (one person, a handful of files) the whole memory fits comfortably in
context, and a file I can open and edit in a text editor is worth more than a
retrieval system I can't inspect.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from .config import MEMORY_DIR

# Order matters: this is the order they appear in the system prompt.
FILES = ("profile.md", "people.md", "projects.md", "commitments.md", "mistakes.md")


def load() -> str:
    """Concatenate every memory file into one block for the system prompt."""
    parts: list[str] = []
    for name in FILES:
        path = MEMORY_DIR / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8").strip()
        if text:
            parts.append(f"<memory file=\"{name}\">\n{text}\n</memory>")
    return "\n\n".join(parts)


def log_mistake(what_i_got_wrong: str, what_was_true: str, root_cause: str = "") -> Path:
    """Rule 5. Append a correction to the mistakes ledger."""
    path = MEMORY_DIR / "mistakes.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(
            "# Mistakes\n\n| Date | What I got wrong | What was actually true | Root cause |\n|---|---|---|---|\n",
            encoding="utf-8",
        )
    today = dt.date.today().isoformat()
    row = f"| {today} | {_cell(what_i_got_wrong)} | {_cell(what_was_true)} | {_cell(root_cause)} |\n"
    with path.open("a", encoding="utf-8") as fh:
        fh.write(row)
    return path


def append(filename: str, text: str) -> Path:
    """Append a block to a memory file. Used for confirmed commitments and notes."""
    if filename not in FILES:
        raise ValueError(f"Unknown memory file: {filename}. Known: {', '.join(FILES)}")
    path = MEMORY_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write("\n" + text.rstrip() + "\n")
    return path


def _cell(text: str) -> str:
    """Markdown table cells can't contain raw pipes or newlines."""
    return text.replace("|", "\\|").replace("\n", " ").strip()
