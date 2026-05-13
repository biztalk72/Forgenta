"""Guardrail service: input filtering, output PII redaction, rate limiting, audit logging."""

import json
import logging
import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

_LOG_DIR = os.getenv("AUDIT_LOG_DIR", "logs")
_LOG_FILE = os.path.join(_LOG_DIR, "audit.jsonl")


def _audit(event: dict) -> None:
    os.makedirs(_LOG_DIR, exist_ok=True)
    entry = {"ts": datetime.now(timezone.utc).isoformat(), **event}
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as exc:
        logger.warning("Audit log write failed: %s", exc)


# ---------------------------------------------------------------------------
# In-memory stats (resets on restart)
# ---------------------------------------------------------------------------

_stats: dict[str, int] = {
    "total_requests": 0,
    "blocked_input": 0,
    "rate_limited": 0,
    "pii_redactions": 0,
}


def get_stats() -> dict:
    return dict(_stats)


# ---------------------------------------------------------------------------
# Input filter — prompt injection & jailbreak patterns
# ---------------------------------------------------------------------------

_INPUT_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore\s+(previous|all|above|prior)\s+instructions?",
        r"forget\s+(everything|all|previous|prior|your)\s+instructions?",
        r"you\s+are\s+now\s+(a\s+)?(?:different|new|evil|DAN|jailbroken|unrestricted)",
        r"act\s+as\s+(if\s+you\s+(have\s+no|are\s+without)\s+restrictions?|DAN\b)",
        r"\bDAN\s*mode\b",
        r"\bdeveloper\s+mode\b",
        r"prompt\s+injection",
        r"system\s+prompt\s*(leak|reveal|show|print|output)",
        r"reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions?|training\s+data)",
        r"<\s*script[\s>]",                        # XSS injection
        r"\{\{.*\}\}",                             # template injection
        r"role\s*:\s*system",                      # role override
        r"disregard\s+(all|any|previous|prior)",
        r"you\s+have\s+no\s+restrictions?",
        r"bypass\s+(safety|filter|restriction|guardrail)",
    ]
]


def check_input(text: str, user_id: Optional[str], ip: str) -> tuple[bool, str]:
    """
    Returns (allowed, reason).
    Also handles rate limiting and audit logging.
    """
    _stats["total_requests"] += 1

    # Rate limit first
    key = user_id or ip
    if not _rate_limiter.is_allowed(key):
        _stats["rate_limited"] += 1
        _audit({
            "type": "rate_limited",
            "user": user_id,
            "ip": ip,
            "input_preview": text[:120],
        })
        return False, "rate_limit"

    # Input pattern check
    for pattern in _INPUT_PATTERNS:
        if pattern.search(text):
            _stats["blocked_input"] += 1
            reason = f"blocked_pattern:{pattern.pattern[:40]}"
            _audit({
                "type": "blocked_input",
                "user": user_id,
                "ip": ip,
                "pattern": pattern.pattern[:80],
                "input_preview": text[:120],
            })
            return False, reason

    # Allowed — log the request
    _audit({
        "type": "request",
        "user": user_id,
        "ip": ip,
        "input_preview": text[:120],
    })
    return True, "ok"


# ---------------------------------------------------------------------------
# Output filter — PII redaction
# ---------------------------------------------------------------------------

_PII_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
    (re.compile(r"\b(?:\+82[\s\-]?)?0\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{4}\b"), "[PHONE]"),
    (re.compile(r"\b\d{6}[\s\-][1-4]\d{6}\b"), "[RESIDENT_NO]"),
    (re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b"), "[CARD_NO]"),
    (re.compile(r"\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b"), "[SSN]"),
]


def filter_output(text: str, user_id: Optional[str], ip: str) -> str:
    """Redact PII from LLM output. Returns filtered text."""
    result = text
    redacted = False
    for pattern, replacement in _PII_RULES:
        new_result, n = pattern.subn(replacement, result)
        if n:
            result = new_result
            redacted = True
            _stats["pii_redactions"] += n

    if redacted:
        _audit({
            "type": "pii_redacted",
            "user": user_id,
            "ip": ip,
            "output_preview": result[:120],
        })

    return result


# ---------------------------------------------------------------------------
# Rate limiter — sliding window per key (user_id or IP)
# ---------------------------------------------------------------------------

class _SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 20, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        bucket = self._buckets[key]
        cutoff = now - self.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            return False
        bucket.append(now)
        return True


_rate_limiter = _SlidingWindowRateLimiter(
    max_requests=int(os.getenv("RATE_LIMIT_REQUESTS", "20")),
    window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
)
