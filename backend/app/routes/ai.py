import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, request

from ..utils.auth import login_required
from ..utils.responses import error, success

ai_bp = Blueprint("ai", __name__)


def _extract_text(payload):
    if payload.get("output_text"):
        return payload["output_text"].strip()

    parts = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                parts.append(content["text"])

    return "\n".join(parts).strip()


@ai_bp.post("/ai-test")
@login_required
def ai_test():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()

    if not message:
        return error("Message is required.", ["Please type a question for Booklify AI."], 400)

    if len(message) > 500:
        return error("Message is too long.", ["Please keep your question under 500 characters."], 400)

    api_key = current_app.config.get("OPENAI_API_KEY")
    if not api_key:
        return error(
            "AI is not configured yet.",
            ["Add OPENAI_API_KEY on the server before using this feature."],
            503,
        )

    body = {
        "model": current_app.config.get("OPENAI_MODEL", "gpt-4o-mini"),
        "instructions": (
            "You are Booklify AI, a concise booking assistant for local businesses. "
            "Help users find categories, compare options, and understand booking steps. "
            "Do not claim to make real bookings; tell users to use the app booking button."
        ),
        "input": message,
        "max_output_tokens": 180,
    }

    openai_request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(openai_request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        current_app.logger.warning("OpenAI request failed: %s", detail)
        return error("AI request failed.", ["Please check the server API key and model settings."], 502)
    except json.JSONDecodeError:
        current_app.logger.warning("OpenAI returned a response that was not valid JSON.")
        return error("AI response was not readable.", ["Please try again in a moment."], 502)
    except (URLError, TimeoutError):
        return error("AI request timed out.", ["Please try again in a moment."], 504)
    except Exception:
        current_app.logger.exception("Unexpected AI route error.")
        return error("AI is unavailable right now.", ["Please try again in a moment."], 500)

    answer = _extract_text(result)

    if not answer:
        return error("AI did not return an answer.", ["Please try asking in a different way."], 502)

    return success("AI response generated.", {"answer": answer})

