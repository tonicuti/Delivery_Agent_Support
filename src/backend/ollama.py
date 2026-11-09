"""Shared local-model settings and the HTTP transport used by both the agent and the chatbot."""

import json
import os
from typing import Callable, Iterator
from urllib.request import Request, urlopen

QWEN_MODEL = "qwen3:1.7b"
# Overridable so a container can reach Ollama on another host or compose service.
OLLAMA_ENDPOINT = os.environ.get("OLLAMA_ENDPOINT", "http://127.0.0.1:11434/api/generate")

Transport = Callable[[str, dict, float], "dict | Iterator[dict]"]


def ollama_transport(endpoint: str) -> Transport:
    """Return send(kind, payload, timeout): a dict for plain calls, an iterator of dicts when streaming."""
    base = endpoint.rsplit("/api/", 1)[0]

    def send(kind: str, payload: dict, timeout: float):
        request = Request(f"{base}/api/{kind}", data=json.dumps(payload).encode("utf-8"),
                          headers={"Content-Type": "application/json"}, method="POST")
        response = urlopen(request, timeout=max(1.0, timeout))
        if not payload.get("stream"):
            with response:
                return json.load(response)

        def lines() -> Iterator[dict]:
            with response:
                for raw in response:
                    if raw.strip():
                        yield json.loads(raw)

        return lines()

    return send
