# PRD — Chief of Staff

**Owner:** Prince Taneja · **Status:** Draft v0.1 · **Surface:** Microsoft Teams (target), CLI (v0)

---

## 1. Problem

I lose the first ten minutes of every meeting reassembling context I already had.
The context exists — it's scattered across Outlook, Teams, Jira, Confluence, and
GitHub — but
retrieving it costs more than the meeting is worth, so I walk in cold and wing it.

Every assistant I've tried is a **query box**: it answers when asked. The value isn't
in answering. It's in **arriving pre-loaded** — knowing what's on my calendar in 40
minutes, who's in the room, what they last shipped, and what I promised them in March.

**First-principles framing:** an assistant's value = (context it holds) × (proactivity
it applies) × (trust I place in it). Most products optimise the first term only. All
three are multiplicative — a zero anywhere is a zero.

## 2. Job to be Done

> When I'm about to walk into a meeting, start my day, or get pinged about a project,
> **help me be the most-informed person in the room** — without me having to go dig.

Adjacent jobs deliberately **out of scope** (see Non-Goals): drafting on my behalf and
sending it, running my inbox, attending meetings for me.

## 3. Target user

n=1. Me. Senior PM at Zeta.

This is a deliberate constraint, not a limitation. A single-user assistant can hold
opinionated memory about *one* person's projects, people, and commitments — which is
precisely what makes it feel like a chief of staff rather than a chatbot. Generalising
to n>1 is a **Future** decision that forces schema, auth, and privacy work with no V1 payoff.

## 4. North Star & guardrails

| Metric | Definition | V1 target |
|---|---|---|
| **North Star** | Proactive briefs *acted on* per week — a brief I open **and** that changes what I do next (thumbs-up, or I use a draft it produced) | **15/wk** by week 4 |
| Guardrail — **Trust** | % of factual claims in briefs that survive spot-check | **≥ 95%** |
| Guardrail — **Noise** | % of proactive pings I dismiss without opening | **≤ 20%** |
| Health | Daily active days / week | 5/5 |

**Why not "messages per day".** The reference post cites 400+ msgs/day. Volume is a
symptom, not a goal — an assistant I have to re-ask five times generates volume and
destroys trust. Optimising for messages would build the wrong product.

**Trust is the metric that kills this project if ignored.** One confidently wrong
attendee name or Jira status and I stop reading the briefs entirely. Hence §7.

## 5. Ground rules (the "day one" contract)

Codified in `config/persona.md`, loaded into every system prompt:

1. **Be fast** — a brief that arrives after the meeting starts is worth zero.
2. **Be accurate** — cite the source (Jira key, message ID, page URL) for every claim.
3. **Be warm** — talk like a sharp colleague, not a support ticket.
4. **Know the limits** — say "I don't have access to that" or "I'm not confident".
   Never fill a gap with a plausible guess.
5. **Count your own mistakes** — every correction I issue is logged to
   `memory/mistakes.md` and re-read at the start of every session.

Rules 4 and 5 are the ones that matter. 1–3 are table stakes.

## 6. Scope

### Must-Have (V1)

| # | Capability | Definition of done |
|---|---|---|
| **M1** | **Ask-anything over my corpus** | NL Q&A grounded in Jira, Confluence, GitHub, Calendar, Mail. Every answer cites sources. |
| **M2** | **Morning brief** | 07:30 daily: today's calendar, Jira assigned/watched that moved, Confluence pages that changed, mail needing me. One screen. |
| **M3** | **Pre-meeting brief** | T-15 min per meeting: attendees + what I know about them, the thread that caused this meeting, linked Jira/Confluence, my open commitments to those people. |
| **M4** | **Commitment ledger** | Extracts "I'll do X by Y" from mail/meetings into `memory/commitments.md`. Nudges *before* they're due, not after. |
| **M5** | **Draft queue** | Anything that would be sent lands in `drafts/` for approval. Enforced structurally — no connector has a send path. |
| **M6** | **Ticket-to-code bridge** | For any Jira key, the PRs in flight for it and their review state. Flags where Jira status and GitHub disagree. |

### Nice-to-Have (Future)

- Teams as the chat surface (needs org app registration — see §8)
- Voice / phone-native input
- Writing to Jira & Confluence after approval
- Meeting transcription and auto-summary
- Learned prioritisation ("you always skip these emails")
- Multi-user

### Non-Goals (explicit, V1)

- **Sending anything.** Not email, not Teams messages, not Jira comments. Not behind a flag.
- **Autonomous action.** Every write is a draft.
- **Being a search engine.** If it can't ground an answer in a source, it says so.
- **Anyone but me.** No accounts, no tenancy, no sharing.

## 7. Hard rules (non-negotiable)

- **Draft, never send.** Enforced in code, not config: connectors expose read methods only.
- **Read-only OAuth scopes.** `Calendars.Read`, `Mail.Read`, `Chat.Read`. No `.Send`, no `.ReadWrite`.
- **Cite or abstain.** No claim about my world without a source link. "I don't know" is valid, and often correct.
- **Local memory.** Memory lives in git-ignored markdown on my machine. No third-party memory store.

## 8. Sequencing — gated by access, not by ambition

You asked for all four jobs in V1. They're all in scope, but they don't unblock at the
same time — two of the four surfaces need approvals I don't control. Sequencing by
**access cost** rather than by value avoids a month of waiting on IT with nothing to show.

| Phase | Unlocks | Approval needed | Ships |
|---|---|---|---|
| **P0 — today** | M1 + M5 + M6 over Jira, Confluence & GitHub. CLI surface. | **None** — Atlassian and GitHub tokens are both self-service | Now |
| **P1 — +1 app reg** | M2, M3, M4. Outlook + Calendar via MS Graph. | Entra ID app registration, delegated read scopes. Self-consent if the tenant allows it, else one IT ticket | Days |
| **P2 — +IT** | Teams as the surface. | Azure Bot Service + Teams app manifest + admin consent | Weeks |

**P0 is not a toy, and GitHub makes it less of one.** Jira + Confluence + GitHub covers
most of "what changed on my projects" *and* "is it actually done" — and it proves the
interaction model before any approval lands. If P1 never clears security review, P0
still runs every day.

**Claude chat history** (from your data-access answer) has no API. It's export-only —
drop the export into `memory/` and it's indexed like any other source. Flagged here so
it doesn't sit on the roadmap as a phantom integration.

## 9. Prioritisation — RICE

Reach = interactions/week. Impact: 0.25 minimal → 3 massive. Effort in person-weeks.

| Feature | Reach | Impact | Confidence | Effort | **RICE** |
|---|---|---|---|---|---|
| **M6** Ticket-to-code bridge | 8 | 2 | 85% | 0.4 | **34.0** |
| **M1** Ask-anything | 15 | 1 | 90% | 0.5 | **27.0** |
| **M3** Pre-meeting brief | 20 | 2 | 70% | 1.5 | **18.7** |
| **M2** Morning brief | 5 | 2 | 90% | 0.5 | **18.0** |
| **M4** Commitment ledger | 10 | 3 | 50% | 2.0 | **7.5** |

**M6 tops the table at 34.0**, which surprised me until I wrote out the reach. The
question "Jira says Done — is it really?" comes up several times a week, currently costs
a Slack round-trip to an engineer, and the answer is two API calls away once both
connectors exist. High confidence (85%) because it is retrieval, not inference: the PR
either exists and is merged, or it doesn't. Effort is 0.4 weeks because it is one method
over connectors already built. **Cheap, frequent, and verifiable is the profile that
wins RICE**, and it is why M6 shipped in the same pass as the connector rather than
going on the backlog.

**Read the rest of the table against your instinct.** Pre-meeting briefs are the
emotional core of this thing — they're what makes it feel like a chief of staff. But
M3 sits fourth, because **M1 and M6 are nearly free** once the connectors exist, and
they're the fastest way to find out whether retrieval quality is good enough to trust
at all. Ship M1 and M6 as the quality probe; M3 is the payoff.

**M4 scores lowest and is the most dangerous.** Commitment extraction is an inference
task with a silent failure mode — a missed commitment looks identical to no commitment.
Confidence is 50% for a reason. Build it last, in suggest-only mode where each
extracted commitment is confirmed.

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Entra app registration blocked by Zeta security | **High** — kills P1/P2 | P0 delivers standalone value with zero approvals |
| Retrieval quality too low → briefs are noise | **High** — kills trust | Cite-or-abstain; measure Trust guardrail from day 1 |
| Corporate data leaving the tenant via API calls | **High** — policy | Read-only scopes, local memory, no third-party stores. Clear with security *before* P1. |
| GitHub token over-scoped, or reaching personal repos | Medium | Fine-grained read-only token recommended; `COS_GITHUB_ORG` scopes every query; write scopes on a classic PAT are reported. Env var namespaced so an ambient CI token is never picked up. |
| I stop reading the briefs (habit fails) | Medium | Noise guardrail ≤20%; kill any brief type dismissed 3 weeks running |
| Commitment extraction misses things silently | Medium | Suggest-only mode; never claim the ledger is complete |

## 11. Open questions

1. Does Zeta's tenant allow **user consent** for delegated Graph scopes, or is admin
   consent required? This single answer decides whether P1 is days or weeks.
2. Is there a Zeta policy on corporate data transiting a third-party LLM API? Needs an
   answer *before* Outlook content is in scope, not after.
3. Which is the real hero — morning brief or pre-meeting brief? Run both for two weeks
   and let the North Star decide, rather than arguing about it now.
4. Is Zeta on github.com under an org, or GitHub Enterprise Server? Both are supported
   via `COS_GITHUB_API`, but Enterprise Server may sit behind a VPN the assistant needs
   network access to.
5. Does Zeta's GitHub org enforce SSO on personal access tokens? If so the token needs
   an explicit SSO authorisation step — self-service, but it fails confusingly without it.
