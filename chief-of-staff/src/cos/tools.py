"""Tool surface exposed to Claude.

Every tool is read-only except `save_draft` and the two memory writes, which write to
local disk only. Nothing here can transmit anything.

Tools return strings rather than raising when a connector is unconfigured. That is
deliberate: rule 4 says the assistant must be able to say "I don't have access to
that", and it can only say it if the tool tells it so instead of crashing the turn.
"""

from __future__ import annotations

import json
from typing import Any

from anthropic import beta_tool

from . import drafts, memory
from .config import AtlassianSettings, GraphSettings

_UNAVAILABLE_ATLASSIAN = (
    "Atlassian is not configured (ATLASSIAN_SITE / ATLASSIAN_EMAIL / "
    "ATLASSIAN_API_TOKEN missing from .env). Tell Prince you cannot see Jira or "
    "Confluence right now — do not guess at their contents."
)
_UNAVAILABLE_GRAPH = (
    "Microsoft 365 is not connected (MS_CLIENT_ID missing, or not signed in — "
    "`cos login`). Tell Prince you cannot see Outlook, Calendar or Teams right now — "
    "do not guess at their contents."
)

# Connectors are built once per process and reused across tool calls.
_atlassian: Any = None
_graph: Any = None


def _get_atlassian() -> Any:
    global _atlassian
    if _atlassian is None:
        from .connectors.atlassian import Atlassian

        _atlassian = Atlassian()
    return _atlassian


def _get_graph() -> Any:
    global _graph
    if _graph is None:
        from .connectors.graph import Graph

        _graph = Graph()
    return _graph


def _dump(value: Any) -> str:
    return json.dumps(value, indent=2, default=str, ensure_ascii=False)


def _guard(available: bool, message: str, fn, *args, **kwargs) -> str:
    if not available:
        return message
    try:
        return _dump(fn(*args, **kwargs))
    except Exception as exc:  # surfaced to the model, not swallowed
        return f"Tool failed: {type(exc).__name__}: {exc}"


# ---------------------------------------------------------------- Jira


@beta_tool
def jira_search(jql: str, limit: int = 25) -> str:
    """Search Jira issues with JQL.

    Args:
        jql: A JQL query, e.g. 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'.
        limit: Maximum issues to return (default 25, max 100).
    """
    return _guard(
        AtlassianSettings.available(),
        _UNAVAILABLE_ATLASSIAN,
        lambda: _get_atlassian().jira_search(jql, limit),
    )


@beta_tool
def jira_issue(key: str) -> str:
    """Fetch one Jira issue in full, including its description.

    Args:
        key: The issue key, e.g. 'PAY-1423'.
    """
    return _guard(
        AtlassianSettings.available(),
        _UNAVAILABLE_ATLASSIAN,
        lambda: _get_atlassian().jira_issue(key),
    )


# ---------------------------------------------------------- Confluence


@beta_tool
def confluence_search(cql: str, limit: int = 15) -> str:
    """Search Confluence with CQL.

    Args:
        cql: A CQL query, e.g. 'text ~ "onboarding funnel" AND lastModified > now("-14d")'.
        limit: Maximum results to return (default 15, max 50).
    """
    return _guard(
        AtlassianSettings.available(),
        _UNAVAILABLE_ATLASSIAN,
        lambda: _get_atlassian().confluence_search(cql, limit),
    )


@beta_tool
def confluence_page(page_id: str) -> str:
    """Fetch the full text of one Confluence page.

    Args:
        page_id: The numeric page id, from a confluence_search result.
    """
    return _guard(
        AtlassianSettings.available(),
        _UNAVAILABLE_ATLASSIAN,
        lambda: _get_atlassian().confluence_page(page_id),
    )


# --------------------------------------------------------- Microsoft 365


@beta_tool
def calendar(days: int = 1) -> str:
    """Prince's calendar from now forward, with attendees and agendas.

    Args:
        days: How many days ahead to look (default 1 = the rest of today).
    """
    return _guard(
        GraphSettings.available(),
        _UNAVAILABLE_GRAPH,
        lambda: _get_graph().calendar(days),
    )


@beta_tool
def mail(query: str = "", limit: int = 20) -> str:
    """Prince's Outlook mail. Omit the query for the most recent messages.

    Args:
        query: Optional search term, e.g. a person's name or a project.
        limit: Maximum messages to return (default 20, max 50).
    """
    return _guard(
        GraphSettings.available(),
        _UNAVAILABLE_GRAPH,
        lambda: _get_graph().mail_search(query or None, limit),
    )


@beta_tool
def teams_chats(limit: int = 15) -> str:
    """Prince's recent Teams conversations, most recently active first.

    Args:
        limit: Maximum chats to return (default 15, max 50).
    """
    return _guard(
        GraphSettings.available(),
        _UNAVAILABLE_GRAPH,
        lambda: _get_graph().teams_recent(limit),
    )


# ------------------------------------------------------ drafts & memory


@beta_tool
def save_draft(kind: str, to: str, subject: str, body: str) -> str:
    """Save something for Prince to review and send himself. You cannot send anything.

    Args:
        kind: One of 'email', 'teams', 'jira-comment', 'confluence-comment', 'note'.
        to: Who it is addressed to.
        subject: A one-line subject.
        body: The full draft text.
    """
    try:
        path = drafts.create(kind, to, subject, body)
        return f"Draft saved to {path.name}. Prince reviews it with: cos drafts"
    except Exception as exc:
        return f"Could not save draft: {type(exc).__name__}: {exc}"


@beta_tool
def log_mistake(what_i_got_wrong: str, what_was_actually_true: str, root_cause: str = "") -> str:
    """Record a correction Prince gave you. Call this whenever he corrects a factual error.

    Args:
        what_i_got_wrong: The claim you made that was wrong.
        what_was_actually_true: The correct fact.
        root_cause: Why you got it wrong, if you can tell.
    """
    try:
        memory.log_mistake(what_i_got_wrong, what_was_actually_true, root_cause)
        return "Logged to memory/mistakes.md. It will be in front of me next session."
    except Exception as exc:
        return f"Could not log the mistake: {type(exc).__name__}: {exc}"


@beta_tool
def remember(filename: str, text: str) -> str:
    """Append a durable fact to memory. Only for things worth carrying across sessions.

    Args:
        filename: One of 'profile.md', 'people.md', 'projects.md', 'commitments.md'.
        text: The markdown block to append.
    """
    try:
        path = memory.append(filename, text)
        return f"Appended to {path.name}."
    except Exception as exc:
        return f"Could not write memory: {type(exc).__name__}: {exc}"


ALL = [
    jira_search,
    jira_issue,
    confluence_search,
    confluence_page,
    calendar,
    mail,
    teams_chats,
    save_draft,
    log_mistake,
    remember,
]
