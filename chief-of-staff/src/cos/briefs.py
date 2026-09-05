"""The proactive jobs — M2 (morning) and M3 (pre-meeting).

These are prompts, not code. The agent already has every tool it needs; a brief is a
standing instruction about what to go and read. Keeping them as text means tuning a
brief is editing a string, not shipping a release.
"""

from __future__ import annotations

MORNING = """Write my morning brief. Work in this order:

1. `calendar(days=1)` — everything left today.
2. `jira_search` — issues assigned to me that are not Done, ordered by updated desc.
   Then a second search for issues on my projects that moved in the last 24 hours.
3. `confluence_search` — pages in my spaces modified in the last 24 hours.
4. `github_review_queue()` — PRs waiting on me. These block other people, so they
   outrank anything that only blocks me.
5. `mail(limit=25)` — flag anything unread or flagged that plausibly needs me.

Then give me ONE screen, in this shape:

**Today** — meetings with times, and for each, one line on why it matters.
**Blocking someone else** — PRs awaiting my review, and anyone waiting on my reply.
Ranked by how long they have been waiting.
**Needs me** — things that will slip if I don't touch them today. Ranked.
**Moved overnight** — what changed while I was asleep, with source links.
**Nothing to do about** — one line, so I know you looked and dismissed it.

Rules: cite every claim (issue key, page title, sender). If a source is unavailable,
say so explicitly under a **Blind spots** heading rather than omitting it silently.
If a section is genuinely empty, write "nothing" — do not pad it."""

PRE_MEETING = """Brief me on my next meeting. Steps:

1. `calendar(days=1)` and take the next event that has not started.
2. For each attendee who is not me: check `memory` for what I already know, then
   `mail` for our recent threads.
3. Search Jira and Confluence for the meeting's subject and any project it names.
4. For any Jira key that comes up, `github_for_jira(key)` — if we are going to discuss
   a ticket, I want to know whether the code is merged, in review, or not started.
   The Jira status and the PR state disagree more often than anyone admits.

Then, in under 150 words:

**{subject}** — {time}, {attendees}
**Why we're meeting** — from the invite and the thread that caused it.
**What changed since last time** — with source links. Where a Jira status and its
PRs disagree, say so explicitly; that gap is usually the most useful thing in the brief.
**What I owe them** — open commitments from memory/commitments.md.
**Three things to know walking in** — the actual payload. Specific, sourced.

If you cannot establish why the meeting exists, say that in one line. A brief that
admits a gap is more useful than one that invents a reason."""

COMMITMENTS = """Scan for commitments I have made and not yet closed out.

1. `mail(limit=40)` — look for me promising something: "I'll", "I will", "let me",
   "I'll get you", with a date or implied deadline.
2. `jira_search` for issues assigned to me with a due date in the next 14 days.
3. `github_review_queue()` and `github_my_prs()` — a review I have not done is a
   commitment to someone else, and my own PR sitting open for two weeks is one too.
4. Read memory/commitments.md for what is already tracked.

Output two lists:

**Already tracked, due soon** — from the ledger, with days remaining.
**Candidates I found** — new commitments, each with the exact quote and source.

Do NOT write to memory. These are candidates for me to confirm — an extracted
commitment I have not confirmed is a guess, and guesses do not go in the ledger.
If you found nothing, say so. Do not manufacture commitments to fill the list."""

ALL = {"morning": MORNING, "meeting": PRE_MEETING, "commitments": COMMITMENTS}
