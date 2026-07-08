#!/usr/bin/env python3
"""Shadow's voice. Stop hook: speaks a short, cleaned version of the last reply.

Reads the hook JSON from stdin, pulls the final assistant message out of the
transcript, strips it down to plain prose, and pipes the first sentence or two
through macOS `say`. Silently no-ops on any error so it can never block a turn.
"""
import json
import re
import subprocess
import sys

# How much to actually speak. Long monologues get tedious; keep it brief.
MAX_CHARS = 240


def last_assistant_text(transcript_path):
    text = ""
    with open(transcript_path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") != "assistant":
                continue
            content = entry.get("message", {}).get("content", [])
            parts = [b.get("text", "") for b in content if b.get("type") == "text"]
            if parts:
                text = "\n".join(parts)  # keep the latest assistant turn
    return text


def to_speech(md):
    # Drop fenced code blocks and markdown tables entirely.
    md = re.sub(r"```.*?```", " ", md, flags=re.DOTALL)
    lines = [ln for ln in md.splitlines() if "|" not in ln]
    md = "\n".join(lines)
    # Markdown link -> just the visible text.
    md = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", md)
    # Strip headings, emphasis, inline code, list bullets, blockquotes.
    md = re.sub(r"[`*_#>]", "", md)
    md = re.sub(r"^\s*[-+]\s+", "", md, flags=re.MULTILINE)
    # Strip non-spoken symbols / emoji.
    md = re.sub(r"[^\w\s.,!?;:'\-]", " ", md)
    md = re.sub(r"\s+", " ", md).strip()
    if len(md) > MAX_CHARS:
        cut = md[:MAX_CHARS]
        # Prefer to end on a sentence boundary.
        m = re.search(r"^(.*[.!?])\s", cut + " ")
        md = m.group(1) if m else cut
    return md.strip()


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    path = data.get("transcript_path")
    if not path:
        return
    try:
        spoken = to_speech(last_assistant_text(path))
    except Exception:
        return
    if not spoken:
        return
    # Veena = macOS Indian-English female voice.
    subprocess.run(["say", "-v", "Veena", spoken], check=False)


if __name__ == "__main__":
    main()
