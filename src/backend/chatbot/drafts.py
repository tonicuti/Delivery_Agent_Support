"""Customer message drafts: draft only, a dispatcher edits and sends it; it never promises a new time."""

from contextlib import closing
from datetime import datetime
import json
from pathlib import Path
import re

from .. import queries
from ..db import connect
from ..features import _utc_text
from ..ollama import OLLAMA_ENDPOINT, QWEN_MODEL, Transport, ollama_transport
from .prompts import BUDGET_SECONDS, LANGUAGES, MAX_DRAFT_CHARS

DRAFT_MAX_TOKENS = 220


class ChatUnavailable(RuntimeError):
    """The local model could not be reached or returned an unusable reply."""


def draft_customer_message(db_path: Path, order_id: int, language: str, *, now: datetime,
                           transport: Transport | None = None,
                           endpoint: str = OLLAMA_ENDPOINT) -> dict:
    if language not in LANGUAGES:
        raise ValueError(f"language must be one of {', '.join(LANGUAGES)}")
    with closing(connect(db_path, readonly=True)) as db:
        detail = queries.order_detail(db, order_id, now)
    if detail is None:
        raise LookupError(f"order {order_id} does not exist")
    if detail["promised_to_utc"] is None:
        raise ValueError("check the order first so there is a promise to refer to")
    facts = {"order_reference": detail["external_order_id"], "promised_until_utc": detail["promised_to_utc"],
             "hours_remaining": detail["hours_remaining"]}
    prompt = (
        f"Write a short, polite message in {LANGUAGES[language]} (at most 70 words) from a building-materials "
        "retailer to a customer whose delivery may arrive after the promised time. Say we are working on it "
        "and will confirm as soon as we know more. Do not state a new delivery time, a cause, compensation, "
        "or any internal detail. Plain text only, no subject line. Facts as JSON: "
        + json.dumps(facts))
    payload = {"model": QWEN_MODEL, "prompt": prompt, "stream": False, "think": False,
               "options": {"temperature": 0.2, "num_predict": DRAFT_MAX_TOKENS}}
    try:
        response = (transport or ollama_transport(endpoint))("generate", payload, BUDGET_SECONDS)
    except (OSError, ValueError, KeyError) as exc:
        raise ChatUnavailable(str(exc)) from exc
    message = re.sub(r"<think>.*?</think>", "", str(response.get("response", "")), flags=re.S).strip()
    if not message or len(message) > MAX_DRAFT_CHARS:
        raise ChatUnavailable("the model returned no usable draft")
    return {"language": language, "message": message, "facts": facts,
            "requires_human_review": True, "as_of": _utc_text(now)}
