"""CLI — the P0 surface. Teams replaces this in P2; everything below it stays."""

from __future__ import annotations

import argparse
import sys

from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table

from . import briefs, drafts
from .config import AtlassianSettings, GitHubSettings, GraphSettings, Settings

console = Console()


def _agent():
    from .agent import Agent

    return Agent()


def _stream(agent, prompt: str) -> None:
    chunks: list[str] = []
    with console.status("[dim]thinking…[/dim]", spinner="dots"):
        for chunk in agent.ask(prompt):
            chunks.append(chunk)
    console.print(Markdown("".join(chunks)))


def cmd_ask(args: argparse.Namespace) -> int:
    _stream(_agent(), " ".join(args.question))
    return 0


def cmd_brief(args: argparse.Namespace) -> int:
    _stream(_agent(), briefs.ALL[args.kind])
    return 0


def cmd_chat(_: argparse.Namespace) -> int:
    settings = Settings.load()
    agent = _agent()
    console.print(f"[bold]{settings.name}[/bold] — ctrl-d to exit\n")
    while True:
        try:
            prompt = console.input("[bold cyan]› [/bold cyan]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print()
            return 0
        if not prompt:
            continue
        _stream(agent, prompt)
        console.print()


def cmd_drafts(args: argparse.Namespace) -> int:
    if args.slug:
        try:
            console.print(Markdown(drafts.read(args.slug)))
        except (FileNotFoundError, ValueError) as exc:
            console.print(f"[red]{exc}[/red]")
            return 1
        return 0

    items = drafts.listing()
    if not items:
        console.print("[dim]No drafts awaiting review.[/dim]")
        return 0
    table = Table(title="Awaiting your review")
    table.add_column("id", style="cyan", no_wrap=True)
    table.add_column("kind")
    table.add_column("to")
    table.add_column("subject")
    for draft in items:
        table.add_row(draft.slug[:15], draft.kind, draft.to, draft.subject)
    console.print(table)
    console.print("\n[dim]Read one with: cos drafts <id>[/dim]")
    return 0


def cmd_login(_: argparse.Namespace) -> int:
    from .connectors.graph import Graph, GraphAuthError

    try:
        graph = Graph()
        graph.login()
        console.print(f"[green]Signed in as[/green] {graph.me()['mail']}")
        return 0
    except GraphAuthError as exc:
        console.print(f"[red]{exc}[/red]")
        return 1


def cmd_status(_: argparse.Namespace) -> int:
    settings = Settings.load()
    table = Table(title=f"{settings.name} — connector status")
    table.add_column("surface")
    table.add_column("state")
    table.add_column("unblocks")

    atlassian_ok = AtlassianSettings.available()
    table.add_row(
        "Jira + Confluence",
        "[green]configured[/green]" if atlassian_ok else "[yellow]not configured[/yellow]",
        "P0 — ask-anything",
    )

    github_ok = GitHubSettings.available()
    github_who = ""
    if github_ok:
        try:
            from .connectors.github import GitHub

            gh = GitHub()
            github_who = f" as {gh.me()['login']}"
        except Exception:
            github_who = " [red](token rejected)[/red]"
    table.add_row(
        "GitHub",
        f"[green]configured[/green]{github_who}" if github_ok else "[yellow]not configured[/yellow]",
        "P0 — review queue, code in flight",
    )

    graph_ok = GraphSettings.available()
    signed_in = False
    if graph_ok:
        try:
            from .connectors.graph import Graph

            Graph().me()
            signed_in = True
        except Exception:
            signed_in = False
    state = (
        "[green]signed in[/green]"
        if signed_in
        else "[yellow]configured, run: cos login[/yellow]"
        if graph_ok
        else "[yellow]not configured[/yellow]"
    )
    table.add_row("Outlook + Calendar + Teams", state, "P1 — briefs, commitments")
    table.add_row("Teams as a chat surface", "[dim]not built[/dim]", "P2 — needs IT")
    console.print(table)
    console.print(f"\n[dim]model: {settings.model} · effort: {settings.effort}[/dim]")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="cos", description="Your chief of staff.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("ask", help="Ask one question and exit")
    p.add_argument("question", nargs="+")
    p.set_defaults(func=cmd_ask)

    p = sub.add_parser("chat", help="Interactive session with memory across turns")
    p.set_defaults(func=cmd_chat)

    p = sub.add_parser("brief", help="Run a standing brief")
    p.add_argument("kind", choices=sorted(briefs.ALL))
    p.set_defaults(func=cmd_brief)

    p = sub.add_parser("drafts", help="Review what is waiting for you to send")
    p.add_argument("slug", nargs="?")
    p.set_defaults(func=cmd_drafts)

    p = sub.add_parser("login", help="Sign in to Microsoft 365")
    p.set_defaults(func=cmd_login)

    p = sub.add_parser("status", help="What is connected and what is not")
    p.set_defaults(func=cmd_status)

    args = parser.parse_args()
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
