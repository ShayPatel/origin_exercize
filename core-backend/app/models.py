from datetime import datetime
from uuid import uuid4, UUID
from sqlmodel import SQLModel, Field, UniqueConstraint


# ==========================================
# EVENT MODELS
# ==========================================

class EventBase(SQLModel):
    name: str = Field(index=True, max_length=100)
    description: str | None = Field(default=None)
    event_date: datetime = Field(index=True)
    capacity: int = Field(gt=0)


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: UUID
    spots_remaining: int


class Event(EventBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    spots_remaining: int = Field(default=0)


# ==========================================
# REGISTRATION MODELS
# ==========================================

class RegistrationBase(SQLModel):
    event_id: UUID = Field(foreign_key="event.id", ondelete="CASCADE")
    user_id: str = Field(index=True)


class RegistrationCreate(RegistrationBase):
    pass


class RegistrationRead(RegistrationBase):
    id: UUID
    registered_at: datetime


class Registration(RegistrationBase, table=True):
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_user_event_registration"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    registered_at: datetime = Field(default_factory=datetime.utcnow)
