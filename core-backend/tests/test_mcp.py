"""
In-process MCP tool tests using fastmcp.Client.
These call the tool functions directly (without network) via the in-memory transport.
"""
import asyncio
from datetime import datetime, timedelta
import pytest
from fastmcp import Client
from app.mcp_server import mcp
from app.database import engine
from sqlmodel import SQLModel, Session


@pytest.fixture(autouse=True)
def reset_db():
    """Recreate tables in the shared engine before each test."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def _list_events():
    async with Client(mcp) as client:
        result = await client.call_tool("list_events", {})
        return result


async def _create_event(name="MCP Test", days=60, capacity=10):
    event_date = (datetime.utcnow() + timedelta(days=days)).isoformat()
    async with Client(mcp) as client:
        result = await client.call_tool(
            "create_event",
            {"name": name, "description": "test", "event_date": event_date, "capacity": capacity},
        )
        return result


def test_list_events_empty():
    result = run(_list_events())
    assert result is not None


def test_create_event_returns_event():
    result = run(_create_event())
    # result is a list of Content objects from fastmcp
    assert result is not None


def test_register_and_unregister():
    async def _run():
        async with Client(mcp) as client:
            event_date = (datetime.utcnow() + timedelta(days=60)).isoformat()
            created = await client.call_tool(
                "create_event",
                {"name": "Reg Test", "description": "", "event_date": event_date, "capacity": 5},
            )
            event_id = created.data["id"]

            reg = await client.call_tool(
                "register_user",
                {"event_id": event_id, "user_id": "test_user"},
            )
            assert reg.data["user_id"] == "test_user"

            unreg = await client.call_tool(
                "unregister_user",
                {"event_id": event_id, "user_id": "test_user"},
            )
            assert unreg.data["success"] is True

    run(_run())


def test_update_capacity():
    async def _run():
        async with Client(mcp) as client:
            event_date = (datetime.utcnow() + timedelta(days=60)).isoformat()
            created = await client.call_tool(
                "create_event",
                {"name": "Cap Test", "description": "", "event_date": event_date, "capacity": 10},
            )
            event_id = created.data["id"]

            updated = await client.call_tool(
                "update_event_capacity",
                {"event_id": event_id, "new_capacity": 25},
            )
            assert updated.data["capacity"] == 25
            assert updated.data["spots_remaining"] == 25

    run(_run())
