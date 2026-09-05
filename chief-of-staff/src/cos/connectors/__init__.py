"""Connectors are read-only by construction.

There is no method anywhere in this package that creates, updates, or sends anything.
That is the enforcement mechanism for the PRD's "draft, never send" rule — a bug or a
prompt injection cannot talk the assistant into sending, because there is nothing to call.
"""
