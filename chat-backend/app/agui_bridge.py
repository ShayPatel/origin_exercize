"""
Custom AG-UI SSE bridge.

Translates Google ADK Runner events into AG-UI protocol SSE lines so the
frontend @ag-ui/client can parse them without a third-party middleware package.

AG-UI event types used:
  RUN_STARTED, RUN_FINISHED, RUN_ERROR
  TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END
  TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT
"""
import json
import uuid
from typing import AsyncGenerator

from fastapi.responses import StreamingResponse
from google.adk import Agent, Runner
from google.adk.events import Event
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _translate_event(
    event: Event, run_id: str
) -> AsyncGenerator[str, None]:
    """Yield AG-UI SSE strings for a single ADK Event."""
    if not event.content or not event.content.parts:
        return

    for part in event.content.parts:
        # ── Text output ──────────────────────────────────────────────────────
        # Skip thought parts: ADK converts reasoning_content from thinking
        # models (Qwen, DeepSeek-R1) into Part(text=..., thought=True).
        # These are internal chain-of-thought and must not become chat bubbles.
        # Also strip whitespace to drop the "\n\n" that precedes tool calls.
        if part.text and not getattr(part, "thought", False) and part.text.strip():
            text = part.text.strip()
            msg_id = str(uuid.uuid4())
            yield _sse({"type": "TEXT_MESSAGE_START", "messageId": msg_id, "role": "assistant"})
            yield _sse({"type": "TEXT_MESSAGE_CONTENT", "messageId": msg_id, "delta": text})
            yield _sse({"type": "TEXT_MESSAGE_END", "messageId": msg_id})

        # ── Tool call (LLM → tool) ────────────────────────────────────────
        elif part.function_call:
            fc = part.function_call
            call_id = fc.id or str(uuid.uuid4())
            args_json = json.dumps(dict(fc.args)) if fc.args else "{}"
            yield _sse({"type": "TOOL_CALL_START", "toolCallId": call_id, "toolCallName": fc.name})
            yield _sse({"type": "TOOL_CALL_ARGS", "toolCallId": call_id, "delta": args_json})
            yield _sse({"type": "TOOL_CALL_END", "toolCallId": call_id})

        # ── Tool result (tool → LLM) ──────────────────────────────────────
        elif part.function_response:
            fr = part.function_response
            call_id = fr.id or str(uuid.uuid4())
            content_str = json.dumps(fr.response) if fr.response else "{}"
            yield _sse(
                {
                    "type": "TOOL_CALL_RESULT",
                    # AG-UI EventSchemas requires messageId, toolCallId, content, role.
                    # Extra field toolCallName passes through Zod for widget routing.
                    "messageId": str(uuid.uuid4()),
                    "toolCallId": call_id,
                    "toolCallName": fr.name,
                    "role": "tool",
                    "content": content_str,
                }
            )


async def stream_agent_response(
    agent: Agent, user_message: str, thread_id: str
) -> StreamingResponse:
    """
    Run the agent and return a StreamingResponse that emits AG-UI SSE events.
    Each call creates a fresh InMemorySessionService so sessions are stateless
    per HTTP request (suitable for this local-first setup).
    """
    run_id = str(uuid.uuid4())

    async def event_generator():
        yield _sse({"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id})
        try:
            session_svc = InMemorySessionService()
            await session_svc.create_session(
                app_name="event-mgmt", user_id="user", session_id=thread_id
            )
            runner = Runner(
                app_name="event-mgmt",
                agent=agent,
                session_service=session_svc,
            )
            new_message = Content(role="user", parts=[Part(text=user_message)])
            async for adk_event in runner.run_async(
                user_id="user",
                session_id=thread_id,
                new_message=new_message,
            ):
                async for chunk in _translate_event(adk_event, run_id):
                    yield chunk

            yield _sse(
                {
                    "type": "RUN_FINISHED",
                    "threadId": thread_id,
                    "runId": run_id,
                    "outcome": {"type": "success"},
                }
            )
        except Exception as exc:
            yield _sse({"type": "RUN_ERROR", "message": str(exc)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")
