#!/usr/bin/env python3
"""Bulk machine-translate every non-English UI string still equal to its
English value. Preserves placeholders, inline code, bold markers, and
HTML-ish tags during the translation roundtrip.

Run from repo root:  python3 tools/translate_pass.py
"""

from __future__ import annotations

import json
import os
import re
import signal
import sys
import time
from typing import Iterable

from deep_translator import GoogleTranslator

LOCALE_DIR = "translation"
EN_PATH = os.path.join(LOCALE_DIR, "en.json")

# Tokens we must never let the translator alter.
PLACEHOLDER_RE = re.compile(r"\{[^{}]*\}")
INLINE_CODE_RE = re.compile(r"`[^`]+`")
BOLD_RE = re.compile(r"\*\*[^*]+\*\*")
HTML_TAG_RE = re.compile(r"</?[A-Za-z][^>]*>")
URL_RE = re.compile(r"https?://[^\s)]+")


def looks_like_code(value: str) -> bool:
    """Skip translation for embedded JS code blocks. Heuristic but safe:
    the user-facing UI strings never contain these tokens, while the
    template / code-example values do."""
    if not value:
        return False
    if value.count("\n") >= 2:
        return True
    code_markers = (
        "function ",
        "helpers.",
        "events.",
        "h.getDomainHelper",
        "ev.preventDefault",
        "=>",
        "const ",
        "return ",
        "registerWebChangedEvent",
        "registerTickEvent",
    )
    return any(m in value for m in code_markers)


def protect(value: str) -> tuple[str, list[str]]:
    """Replace protected substrings with sentinels and return both the
    sentinelized text and the original substrings in order."""
    spans: list[str] = []

    def stash(match: re.Match[str]) -> str:
        spans.append(match.group(0))
        # We use angle-bracket tags because Google Translate is trained
        # to preserve XML/HTML-ish tags as-is.
        return f"<x{len(spans) - 1}/>"

    # Order matters: longest / most-specific patterns first so an outer
    # match doesn't gobble an inner one of a different shape.
    out = value
    for pattern in (URL_RE, HTML_TAG_RE, INLINE_CODE_RE, BOLD_RE, PLACEHOLDER_RE):
        out = pattern.sub(stash, out)
    return out, spans


def restore(translated: str, spans: list[str]) -> str:
    out = translated
    for i, original in enumerate(spans):
        # Translators sometimes inject whitespace or capitalize the
        # tag — match flexibly.
        out = re.sub(rf"<\s*x\s*{i}\s*/?>", lambda _: original, out, flags=re.IGNORECASE)
    return out


class TimeoutError(Exception):
    pass


def with_timeout(seconds: int, fn, *args, **kwargs):
    def handler(signum, frame):
        raise TimeoutError()
    old = signal.signal(signal.SIGALRM, handler)
    signal.alarm(seconds)
    try:
        return fn(*args, **kwargs)
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)


def translate_batch(translator: GoogleTranslator, texts: list[str], retries: int = 1) -> list[str]:
    """Translate a batch with a tight per-call timeout. We accept a few
    fallbacks rather than blocking for minutes on a flaky network."""
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return with_timeout(15, translator.translate_batch, texts)
        except Exception as e:
            last_err = e
            time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f"translate_batch failed after retries: {last_err}")


def chunk(seq: list, n: int) -> Iterable[list]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def write_locale(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def translate_locale(lang: str, path: str, en: dict, current: dict) -> tuple[dict, dict]:
    """Translate every value in `current` that is still equal to the
    matching English value. Returns (new_dict, stats)."""
    skipped_code = 0
    fallback = 0
    success = 0
    pending_keys: list[str] = []
    pending_protected: list[str] = []
    pending_spans: list[list[str]] = []

    for key, en_val in en.items():
        if key not in current:
            continue
        if not isinstance(en_val, str) or not isinstance(current[key], str):
            continue
        if current[key] != en_val:
            continue  # already translated
        if looks_like_code(en_val):
            skipped_code += 1
            continue
        if en_val.strip() == "":
            continue
        protected, spans = protect(en_val)
        pending_keys.append(key)
        pending_protected.append(protected)
        pending_spans.append(spans)

    if not pending_keys:
        return current, {"translated": 0, "skipped_code": skipped_code, "fallback": 0, "total_pending": 0}

    print(f"  [{lang}] translating {len(pending_keys)} strings...", flush=True)
    translator = GoogleTranslator(source="en", target=lang)

    out = dict(current)
    BATCH = 10  # smaller batches dodge Google Translate's aggressive
                # rate-limiter on the unofficial endpoint
    for chunk_idx, batch_keys in enumerate(chunk(pending_keys, BATCH)):
        start = chunk_idx * BATCH
        end = start + len(batch_keys)
        batch_proto = pending_protected[start:end]
        batch_spans = pending_spans[start:end]
        translated = None
        try:
            translated = translate_batch(translator, batch_proto)
        except Exception as e:
            # Per-item fallback: a slow but reliable single-string call
            # often succeeds where the batch endpoint had silently
            # rate-limited. We swallow secondary failures and accept
            # them as untranslated.
            translated = []
            for one in batch_proto:
                try:
                    one_out = with_timeout(10, translator.translate, one)
                except Exception:
                    one_out = None
                translated.append(one_out)
                time.sleep(0.25)
        if translated is None or len(translated) != len(batch_keys):
            fallback += len(batch_keys)
            continue
        for k, t, spans in zip(batch_keys, translated, batch_spans):
            if not t:
                fallback += 1
                continue
            restored = restore(t, spans)
            if re.search(r"<x\d+/?>", restored, flags=re.IGNORECASE):
                fallback += 1
                continue
            out[k] = restored
            success += 1

        # Persist after every chunk so an interrupt keeps the progress.
        write_locale(path, out)
        # Gentle pacing between batches so Google Translate's
        # unofficial endpoint stops slamming the door on us.
        time.sleep(0.5)

    return out, {"translated": success, "skipped_code": skipped_code, "fallback": fallback, "total_pending": len(pending_keys)}


def main() -> int:
    if not os.path.isfile(EN_PATH):
        print(f"missing {EN_PATH}", file=sys.stderr)
        return 1
    with open(EN_PATH, encoding="utf-8") as f:
        en = json.load(f)

    locales = sorted(
        fn[:-5]
        for fn in os.listdir(LOCALE_DIR)
        if fn.endswith(".json") and fn != "en.json"
    )

    grand = {"translated": 0, "skipped_code": 0, "fallback": 0}
    for lang in locales:
        path = os.path.join(LOCALE_DIR, f"{lang}.json")
        with open(path, encoding="utf-8") as f:
            current = json.load(f)

        t0 = time.time()
        try:
            new, stats = translate_locale(lang, path, en, current)
        except Exception as e:
            print(f"  [{lang}] FAILED: {e!r}", flush=True)
            continue
        dt = time.time() - t0

        write_locale(path, new)
        print(
            f"  [{lang}] +{stats['translated']} translated, "
            f"{stats['skipped_code']} code-skipped, "
            f"{stats['fallback']} fallback / {stats['total_pending']} pending in {dt:.1f}s",
            flush=True,
        )
        for k in ("translated", "skipped_code", "fallback"):
            grand[k] += stats.get(k, 0)

    print(f"\nDONE. translated={grand['translated']}, skipped_code={grand['skipped_code']}, fallback={grand['fallback']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
