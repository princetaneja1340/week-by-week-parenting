"""Microsoft Graph — Outlook mail, Calendar, and Teams chat. Read-only.

Auth is MSAL device-code flow against a public-client app registration. Device code is
deliberate: it needs no redirect URI, no client secret, and no web server, so the app
registration a user can make for themselves is enough. The token cache is a local file.

If Zeta's tenant blocks user consent for these delegated scopes, this connector will
fail at first login with AADSTS65001 and the fix is one IT ticket, not a code change.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

import httpx
import msal

from ..config import ROOT, GraphSettings

GRAPH = "https://graph.microsoft.com/v1.0"
CACHE_PATH = ROOT / ".cos_cache" / "msal.json"
TIMEOUT = httpx.Timeout(30.0)


class GraphAuthError(RuntimeError):
    """Raised when we have no usable token and interactive login is required."""


class Graph:
    def __init__(self, settings: GraphSettings | None = None) -> None:
        self.settings = settings or GraphSettings.load()
        self._cache = msal.SerializableTokenCache()
        if CACHE_PATH.exists():
            self._cache.deserialize(CACHE_PATH.read_text(encoding="utf-8"))
        self._app = msal.PublicClientApplication(
            self.settings.client_id,
            authority=f"https://login.microsoftonline.com/{self.settings.tenant_id}",
            token_cache=self._cache,
        )
        self._client = httpx.Client(timeout=TIMEOUT)

    # ---- auth ----

    def login(self) -> str:
        """Interactive device-code login. Prints the code for the user to enter."""
        flow = self._app.initiate_device_flow(scopes=self.settings.scopes)
        if "user_code" not in flow:
            raise GraphAuthError(f"Could not start device flow: {json.dumps(flow)}")
        print(flow["message"], flush=True)
        result = self._app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise GraphAuthError(
                f"Login failed: {result.get('error_description', result)}"
            )
        self._persist()
        return result["access_token"]

    def _token(self) -> str:
        accounts = self._app.get_accounts()
        if accounts:
            result = self._app.acquire_token_silent(
                self.settings.scopes, account=accounts[0]
            )
            if result and "access_token" in result:
                self._persist()
                return result["access_token"]
        raise GraphAuthError("Not signed in to Microsoft 365. Run: cos login")

    def _persist(self) -> None:
        if self._cache.has_state_changed:
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CACHE_PATH.write_text(self._cache.serialize(), encoding="utf-8")
            CACHE_PATH.chmod(0o600)

    def _get(self, path: str, **params: Any) -> dict:
        response = self._client.get(
            f"{GRAPH}{path}",
            params={k: v for k, v in params.items() if v is not None},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        response.raise_for_status()
        return response.json()

    # ---- me ----

    def me(self) -> dict:
        data = self._get("/me", **{"$select": "displayName,mail,jobTitle,officeLocation"})
        return {
            "name": data.get("displayName"),
            "mail": data.get("mail"),
            "title": data.get("jobTitle"),
        }

    # ---- calendar ----

    def calendar(self, days: int = 1) -> list[dict]:
        """Events from now to `days` ahead, expanded across recurrences."""
        start = dt.datetime.now(dt.timezone.utc)
        end = start + dt.timedelta(days=days)
        data = self._get(
            "/me/calendarView",
            startDateTime=start.isoformat(),
            endDateTime=end.isoformat(),
            **{
                "$orderby": "start/dateTime",
                "$top": 50,
                "$select": "subject,start,end,attendees,organizer,location,bodyPreview,onlineMeeting,webLink",
            },
        )
        return [self._flatten_event(e) for e in data.get("value", [])]

    def _flatten_event(self, event: dict) -> dict:
        organizer = ((event.get("organizer") or {}).get("emailAddress") or {})
        attendees = [
            {
                "name": (a.get("emailAddress") or {}).get("name"),
                "email": (a.get("emailAddress") or {}).get("address"),
                "response": (a.get("status") or {}).get("response"),
            }
            for a in event.get("attendees", [])
        ]
        return {
            "subject": event.get("subject"),
            "start": (event.get("start") or {}).get("dateTime"),
            "end": (event.get("end") or {}).get("dateTime"),
            "organizer": organizer.get("name"),
            "organizer_email": organizer.get("address"),
            "attendees": attendees,
            "location": (event.get("location") or {}).get("displayName"),
            "preview": (event.get("bodyPreview") or "")[:500],
            "url": event.get("webLink"),
        }

    # ---- mail ----

    def mail_search(self, query: str | None = None, limit: int = 20) -> list[dict]:
        """Recent mail, optionally filtered by a Graph `$search` term."""
        params: dict[str, Any] = {
            "$top": min(limit, 50),
            "$select": "subject,from,receivedDateTime,bodyPreview,isRead,flag,webLink",
        }
        if query:
            # $search and $orderby are mutually exclusive in Graph.
            params["$search"] = f'"{query}"'
        else:
            params["$orderby"] = "receivedDateTime desc"
        data = self._get("/me/messages", **params)
        return [self._flatten_message(m) for m in data.get("value", [])]

    def _flatten_message(self, message: dict) -> dict:
        sender = ((message.get("from") or {}).get("emailAddress") or {})
        return {
            "subject": message.get("subject"),
            "from": sender.get("name"),
            "from_email": sender.get("address"),
            "received": message.get("receivedDateTime"),
            "unread": not message.get("isRead", True),
            "flagged": ((message.get("flag") or {}).get("flagStatus")) == "flagged",
            "preview": (message.get("bodyPreview") or "")[:800],
            "url": message.get("webLink"),
        }

    # ---- teams ----

    def teams_recent(self, limit: int = 15) -> list[dict]:
        """Recent Teams chats. Message bodies need Chat.Read and are fetched per-chat."""
        data = self._get("/me/chats", **{"$top": min(limit, 50), "$orderby": "lastMessagePreview/createdDateTime desc"})
        out: list[dict] = []
        for chat in data.get("value", []):
            preview = chat.get("lastMessagePreview") or {}
            body = (preview.get("body") or {}).get("content", "")
            out.append(
                {
                    "id": chat.get("id"),
                    "topic": chat.get("topic") or "(direct message)",
                    "type": chat.get("chatType"),
                    "last_at": preview.get("createdDateTime"),
                    "last_message": _strip(body)[:400],
                    "url": chat.get("webUrl"),
                }
            )
        return out

    def close(self) -> None:
        self._client.close()


def _strip(html: str) -> str:
    import re

    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()
