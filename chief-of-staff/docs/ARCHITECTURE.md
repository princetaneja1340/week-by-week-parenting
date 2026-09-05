# Architecture

```
                    ┌─────────────────────────────┐
   CLI (P0) ───────▶│                             │
   Teams (P2) ─────▶│      cos.agent.Agent        │
                    │   SDK tool runner loop       │
                    └──────────┬──────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
  system prompt           tool surface            draft queue
  (cached prefix)         (cos.tools)             (drafts/)
        │                      │                      │
  persona.md            ┌──────┴──────┐          awaiting-review
  memory/*.md           │             │          markdown files
                   Atlassian      MS Graph
                   (P0, token)   (P1, device code)
                   read-only     read-only
```

## Why these choices

**Markdown memory, not a vector store.** One person's profile, people, projects, and
commitments is a few thousand tokens. It fits in the cached system prefix, so retrieval
quality is 100% by construction and there is no index to go stale. A file I can open in
a text editor beats an embedding I can't inspect. Revisit if memory exceeds ~30k tokens.

**Prompt caching on the system prefix.** `persona.md + memory/*.md` is byte-stable
within a session, so it sits before the cache breakpoint; the current timestamp — which
changes every request — sits after it. Getting that order backwards would invalidate
the cache on every turn, which is the single most common way to quietly triple the bill.

**SDK tool runner, not a hand-written loop.** There is no per-turn control flow here
that the runner's defaults don't cover. The one thing it doesn't handle is `pause_turn`,
so `Agent.ask` mirrors the message history and restarts the runner on a paused turn
(capped at 5).

**Device-code auth for Graph.** No redirect URI, no client secret, no web server —
so a self-service app registration is sufficient. Tokens cache to `.cos_cache/msal.json`
at mode 0600, git-ignored.

**Basic auth for Atlassian.** An API token from `id.atlassian.com` needs no admin
approval. This is the whole reason P0 ships before P1.

## How "draft, never send" is enforced

Three independent layers, because a rule with one enforcement point is a rule with one bug:

1. **No send path exists.** Nothing in `cos.connectors` creates, updates, or transmits
   anything. There is no function for a prompt injection to reach.
2. **Write scopes are rejected at config load.** `GraphSettings.load()` raises if
   `MS_SCOPES` contains `.Send` or `.ReadWrite` — you cannot even acquire a token that
   could send. (Tested.)
3. **The persona states it as structural.** So the model doesn't invent a workaround
   or apologise for a capability it doesn't have.

## Failure modes and how they surface

| Failure | Behaviour |
|---|---|
| Atlassian not configured | Tool returns a message telling the model to say it can't see Jira — not an exception. Rule 4 depends on this. |
| Graph not signed in | Same shape: `cos login` is named in the tool result. |
| Tool raises mid-turn | Caught in `_guard`, returned as `Tool failed: <type>: <msg>`. The model sees the real error and can tell you about it. |
| Turn pauses (`pause_turn`) | Runner restarts with mirrored history, up to 5 times, then says so. |

The consistent principle: **an unavailable source is reported, never silently omitted.**
A brief that quietly drops Jira because the token expired is worse than no brief — it
looks complete and isn't.

## What P2 (Teams) actually needs

Not a rewrite. `Agent` and the tool surface are surface-agnostic; the CLI is ~180 lines
of presentation. Teams needs:

1. Azure Bot Service registration + a messaging endpoint (public HTTPS).
2. A Teams app manifest, sideloaded or admin-published.
3. `BotFrameworkAdapter` calling `Agent.ask` and streaming back.
4. Admin consent for the bot in Zeta's tenant. **This is the long pole** — steps 1–3 are
   about a day's work.
