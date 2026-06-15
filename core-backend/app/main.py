from contextlib import asynccontextmanager
from uuid import UUID
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from app.config import settings
from app.database import create_db_and_tables, get_session
from app.models import EventCreate, EventRead, RegistrationCreate, RegistrationRead
from app.services import EventService
from app.mcp_server import mcp


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Event Management Core", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount MCP SSE server — endpoint becomes /mcp/sse
mcp_app = mcp.http_app(transport="sse", path="/sse")
app.mount("/mcp", mcp_app)


# ==========================================
# REST endpoints for the admin panel
# ==========================================

@app.get("/api/events", response_model=list[EventRead])
def list_events(session: Session = Depends(get_session)):
    return EventService.list_events(session)


@app.post("/api/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(event_in: EventCreate, session: Session = Depends(get_session)):
    return EventService.create_event(session, event_in)


@app.get("/api/events/{event_id}", response_model=EventRead)
def get_event(event_id: UUID, session: Session = Depends(get_session)):
    return EventService.get_event(session, event_id)


@app.get("/api/events/{event_id}/registrations", response_model=list[RegistrationRead])
def list_registrations(event_id: UUID, session: Session = Depends(get_session)):
    EventService.get_event(session, event_id)
    from sqlmodel import select
    from app.models import Registration
    regs = list(session.exec(select(Registration).where(Registration.event_id == event_id)).all())
    return regs


@app.post(
    "/api/events/{event_id}/registrations",
    response_model=RegistrationRead,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    event_id: UUID,
    reg_in: RegistrationCreate,
    session: Session = Depends(get_session),
):
    reg_in.event_id = event_id
    return EventService.register_user(session, reg_in)


@app.delete("/api/events/{event_id}/registrations/{user_id}")
def unregister_user(
    event_id: UUID,
    user_id: str,
    session: Session = Depends(get_session),
):
    return EventService.unregister_user(session, event_id, user_id)


@app.patch("/api/events/{event_id}/capacity", response_model=EventRead)
def update_capacity(
    event_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
):
    new_capacity = payload.get("capacity")
    if new_capacity is None:
        raise HTTPException(status_code=400, detail="capacity field required")
    return EventService.update_event_capacity(session, event_id, int(new_capacity))
