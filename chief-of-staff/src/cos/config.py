"""Configuration and paths. Everything is resolved relative to the repo root so the
CLI works from any directory."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
MEMORY_DIR = ROOT / "memory"
DRAFTS_DIR = ROOT / "drafts"

load_dotenv(ROOT / ".env")


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"{name} is not set. Copy .env.example to .env and fill it in."
        )
    return value


@dataclass(frozen=True)
class Settings:
    name: str
    model: str
    effort: str

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            name=os.getenv("COS_NAME", "Sundari").strip() or "Sundari",
            model=os.getenv("COS_MODEL", "claude-opus-5").strip(),
            effort=os.getenv("COS_EFFORT", "high").strip(),
        )


@dataclass(frozen=True)
class AtlassianSettings:
    site: str
    email: str
    token: str

    @classmethod
    def load(cls) -> "AtlassianSettings":
        return cls(
            site=_require("ATLASSIAN_SITE").rstrip("/"),
            email=_require("ATLASSIAN_EMAIL"),
            token=_require("ATLASSIAN_API_TOKEN"),
        )

    @classmethod
    def available(cls) -> bool:
        return all(
            os.getenv(k, "").strip()
            for k in ("ATLASSIAN_SITE", "ATLASSIAN_EMAIL", "ATLASSIAN_API_TOKEN")
        )


@dataclass(frozen=True)
class GraphSettings:
    tenant_id: str
    client_id: str
    scopes: list[str]

    @classmethod
    def load(cls) -> "GraphSettings":
        raw = os.getenv("MS_SCOPES", "User.Read Calendars.Read Mail.Read Chat.Read")
        scopes = [s for s in raw.split() if s]
        forbidden = [s for s in scopes if ".Send" in s or ".ReadWrite" in s]
        if forbidden:
            # Hard rule from the PRD: read-only scopes, enforced in code.
            raise RuntimeError(
                f"Refusing to request write scopes: {', '.join(forbidden)}. "
                "This assistant drafts and never sends."
            )
        return cls(
            tenant_id=os.getenv("MS_TENANT_ID", "common").strip() or "common",
            client_id=_require("MS_CLIENT_ID"),
            scopes=scopes,
        )

    @classmethod
    def available(cls) -> bool:
        return bool(os.getenv("MS_CLIENT_ID", "").strip())
