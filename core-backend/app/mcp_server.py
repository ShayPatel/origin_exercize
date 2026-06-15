from datetime import datetime
from uuid import UUID
from fastmcp import FastMCP
from sqlmodel import Session
from app.database import engine
from app.models import EventCreate, RegistrationCreate
from app.services import EventService

mcp = FastMCP(name="event-management")


@mcp.tool()
def list_events() -> list[dict]:
    """List all events ordered by date."""
    with Session(engine) as session:
        events = EventService.list_events(session)
        return [e.model_dump(mode="json") for e in events]


@mcp.tool()
def get_event(event_id: str) -> dict | None:
    """Get a single event by its UUID."""
    with Session(engine) as session:
        try:
            event = EventService.get_event(session, UUID(event_id))
            return event.model_dump(mode="json")
        except Exception:
            return None


@mcp.tool()
def create_event(name: str, description: str, event_date: str, capacity: int) -> dict:
    """Create a new event. event_date must be an ISO 8601 datetime string."""
    with Session(engine) as session:
        event_in = EventCreate(
            name=name,
            description=description,
            event_date=datetime.fromisoformat(event_date),
            capacity=capacity,
        )
        event = EventService.create_event(session, event_in)
        return event.model_dump(mode="json")


@mcp.tool()
def register_user(event_id: str, user_id: str) -> dict:
    """Register a user for an event. Enforces capacity, uniqueness, and date constraints."""
    with Session(engine) as session:
        reg_in = RegistrationCreate(event_id=UUID(event_id), user_id=user_id)
        reg = EventService.register_user(session, reg_in)
        return reg.model_dump(mode="json")


@mcp.tool()
def unregister_user(event_id: str, user_id: str) -> dict:
    """Cancel a user's registration for an event."""
    with Session(engine) as session:
        return EventService.unregister_user(session, UUID(event_id), user_id)


@mcp.tool()
def update_event_capacity(event_id: str, new_capacity: int) -> dict:
    """Update the capacity of an event. Cannot reduce below current registration count."""
    with Session(engine) as session:
        event = EventService.update_event_capacity(session, UUID(event_id), new_capacity)
        return event.model_dump(mode="json")
