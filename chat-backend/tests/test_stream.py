"""
Integration tests for the AG-UI SSE bridge.
Uses a mock ADK runner so no LM Studio or core-backend is required.
"""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agui_bridge import stream_agent_response
from google.adk import Agent
from google.genai.types import Content, Part


def make_mock_agent() -> Agent:
    agent = MagicMock(spec=Agent)
    agent.name = "test_agent"
    return agent


def _text_event(text: str):
    """Build a minimal ADK Event carrying a text part."""
    event = MagicMock()
    part = MagicMock()
    part.text = text
    part.function_call = None
    part.function_response = None
    event.content = MagicMock()
    event.content.parts = [part]
    return event


def _tool_call_event(name: str, args: dict, call_id: str = "tc1"):
    event = MagicMock()
    fc = MagicMock()
    fc.name = name
    fc.args = args
    fc.id = call_id
    part = MagicMock()
    part.text = None
    part.function_call = fc
    part.function_response = None
    event.content = MagicMock()
    event.content.parts = [part]
    return event


def _tool_result_event(name: str, response: dict, call_id: str = "tc1"):
    event = MagicMock()
    fr = MagicMock()
    fr.name = name
    fr.response = response
    fr.id = call_id
    part = MagicMock()
    part.text = None
    part.function_call = None
    part.function_response = fr
    event.content = MagicMock()
    event.content.parts = [part]
    return event


async def _collect_sse(agent, message: str, thread_id: str) -> list[dict]:
    """Run stream_agent_response and collect all parsed SSE payloads."""
    async def mock_run_async(**kwargs):
        yield _text_event("Hello!")
        yield _tool_call_event("list_events", {})
        yield _tool_result_event("list_events", {"events": []})

    with patch("app.agui_bridge.Runner") as MockRunner, \
         patch("app.agui_bridge.InMemorySessionService") as MockSvc:

        mock_svc_instance = AsyncMock()
        MockSvc.return_value = mock_svc_instance
        mock_svc_instance.create_session = AsyncMock()

        mock_runner_instance = MagicMock()
        MockRunner.return_value = mock_runner_instance
        mock_runner_instance.run_async = mock_run_async

        response = await stream_agent_response(agent, message, thread_id)
        events = []
        async for chunk in response.body_iterator:
            text = chunk.decode() if isinstance(chunk, bytes) else chunk
            for line in text.split("\n"):
                line = line.strip()
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
        return events


def test_stream_starts_and_finishes():
    agent = make_mock_agent()
    events = asyncio.get_event_loop().run_until_complete(
        _collect_sse(agent, "hello", "thread-1")
    )
    types = [e["type"] for e in events]
    assert "RUN_STARTED" in types
    assert "RUN_FINISHED" in types


def test_stream_text_message_events():
    agent = make_mock_agent()
    events = asyncio.get_event_loop().run_until_complete(
        _collect_sse(agent, "hi", "thread-2")
    )
    types = [e["type"] for e in events]
    assert "TEXT_MESSAGE_START" in types
    assert "TEXT_MESSAGE_CONTENT" in types
    assert "TEXT_MESSAGE_END" in types


def test_stream_tool_call_events():
    agent = make_mock_agent()
    events = asyncio.get_event_loop().run_until_complete(
        _collect_sse(agent, "list events", "thread-3")
    )
    types = [e["type"] for e in events]
    assert "TOOL_CALL_START" in types
    assert "TOOL_CALL_ARGS" in types
    assert "TOOL_CALL_END" in types
    assert "TOOL_CALL_RESULT" in types


def test_stream_tool_call_name_present():
    agent = make_mock_agent()
    events = asyncio.get_event_loop().run_until_complete(
        _collect_sse(agent, "list events", "thread-4")
    )
    tool_start = next(e for e in events if e["type"] == "TOOL_CALL_START")
    assert tool_start["toolCallName"] == "list_events"
