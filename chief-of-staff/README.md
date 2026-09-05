# Chief of Staff

A personal AI chief of staff, wired into the tools I actually work in: **Outlook,
Calendar, Teams, Jira, Confluence**.

It **drafts, and never sends.** That isn't a setting — there is no send path in the
codebase.

> Full product thinking in [`docs/PRD.md`](docs/PRD.md). System design and the
> enforcement argument in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What it does

| | Capability | Status |
|---|---|---|
| **M1** | Ask anything across Jira, Confluence, Calendar, Mail — every answer cited | Built |
| **M2** | Morning brief: what's on today, what moved overnight, what needs me | Built |
| **M3** | Pre-meeting brief: attendees, why we're meeting, three things to know | Built |
| **M4** | Commitment ledger — suggest-only, I confirm each one | Built |
| **M5** | Draft queue — anything sendable waits for me | Built |

M2–M4 need Microsoft 365 connected (see Setup). M1 and M5 work with Atlassian alone.

## Quickstart

```bash
python3 -m venv .venv && .venv/bin/pip install -e .
cp .env.example .env      # fill it in
cos status                # what's connected, what isn't
```

Then:

```bash
cos ask "what moved on PAY this week?"
cos chat                  # interactive, memory across turns
cos brief morning
cos brief meeting         # brief me on my next meeting
cos brief commitments     # what did I promise and not close out?
cos drafts                # what's waiting for me to send
cos login                 # sign in to Microsoft 365
```

## Setup

### Atlassian — works today, no approvals

1. [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) → Security → **Create API token**
2. Put the token, your email, and your site URL in `.env`

That's P0. Jira and Confluence Q&A works immediately.

### Microsoft 365 — one app registration

1. Entra ID → **App registrations** → New registration
2. Platform: **Mobile and desktop applications**; enable **Allow public client flows**
3. API permissions → Microsoft Graph → **Delegated**: `User.Read`, `Calendars.Read`,
   `Mail.Read`, `Chat.Read` — all read-only
4. Copy the Application (client) ID and tenant ID into `.env`, then `cos login`

If step 4 fails with `AADSTS65001`, the tenant requires admin consent for these scopes —
that's one IT ticket, and everything in P0 keeps working meanwhile.

**Write scopes are rejected at startup.** Adding `Mail.Send` or `Calendars.ReadWrite`
to `MS_SCOPES` raises before a token is ever requested.

### Teams as the surface

Not built. Needs Azure Bot Service and admin consent — see ARCHITECTURE.md §P2. The
agent and tools are surface-agnostic, so this is an adapter, not a rewrite.

## Making it yours

Two files do most of the personalisation:

- **`config/persona.md`** — the ground rules. Be fast, be accurate, be warm, know the
  limits, count your own mistakes. Edit the voice here.
- **`memory/profile.md`** — who you are, what you own, what to surface unprompted, and
  what to never surface. **Fill this in first.** An assistant with an empty profile is
  a search box; the profile is what makes it a chief of staff.

`memory/mistakes.md` grows on its own — every correction you give gets logged and read
back at the start of the next session.

## The rules it runs on

1. **Be fast** — lead with the answer.
2. **Be accurate** — cite the source, or don't make the claim.
3. **Be warm** — a sharp colleague, not a support ticket.
4. **Know the limits** — "I don't have access to that" is a correct answer.
5. **Count your mistakes** — logged to `memory/mistakes.md`, read every session.

Rules 4 and 5 are the ones that matter.
