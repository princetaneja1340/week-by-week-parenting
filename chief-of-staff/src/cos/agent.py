"""The agent loop.

Uses the SDK's tool runner rather than a hand-written loop — the tools are plain
functions and there is no control flow between turns that the runner's defaults don't
already cover.

The system prompt is [persona + memory], in that order, with a cache breakpoint after
it. Both are stable across a session, so every turn after the first reads them from
cache instead of re-billing them.
"""

from __future__ import annotations

import datetime as dt
from typing import Iterator

import anthropic

from . import memory, tools
from .config import CONFIG_DIR, Settings

MAX_TOKENS = 16000
# The runner does not auto-resume a paused turn; cap restarts so a stuck server tool
# cannot loop forever.
MAX_RESTARTS = 5


def system_prompt(settings: Settings) -> list[dict]:
    persona = (CONFIG_DIR / "persona.md").read_text(encoding="utf-8")
    persona = persona.replace("{name}", settings.name)
    stable = f"{persona}\n\n# What I know about Prince\n\n{memory.load()}"
    return [
        # Stable prefix — cached.
        {"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}},
        # Volatile suffix — after the breakpoint, so it never invalidates the cache.
        {"type": "text", "text": f"Current time: {dt.datetime.now().astimezone().isoformat(timespec='minutes')}"},
    ]


class Agent:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings.load()
        self.client = anthropic.Anthropic()
        self.messages: list[dict] = []

    def ask(self, prompt: str) -> Iterator[str]:
        """Send one turn. Yields assistant text as it is produced across the loop."""
        self.messages.append({"role": "user", "content": prompt})

        restarts = 0
        while True:
            runner = self.client.beta.messages.tool_runner(
                model=self.settings.model,
                max_tokens=MAX_TOKENS,
                system=system_prompt(self.settings),
                thinking={"type": "adaptive"},
                output_config={"effort": self.settings.effort},
                tools=tools.ALL,
                messages=self.messages,
            )

            last = None
            for message in runner:
                last = message
                # The runner keeps its own history and does not expose it, so mirror it
                # here — this is what makes a pause_turn restart resumable.
                self.messages.append({"role": "assistant", "content": message.content})
                for block in message.content:
                    if block.type == "text" and block.text:
                        yield block.text

                response = runner.generate_tool_call_response()
                if response is not None:
                    self.messages.append(response)

            if last is None or last.stop_reason != "pause_turn":
                return

            restarts += 1
            if restarts > MAX_RESTARTS:
                yield "\n[stopped: the turn stayed paused after 5 restarts]"
                return
