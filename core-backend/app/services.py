from datetime import datetime
from uuid import UUID
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models import Event, EventCreate, Registration, RegistrationCreate


class EventService:

    @staticmethod
    def get_event(session: Session, event_id: UUID) -> Event:
        event = session.get(Event, event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target event does not exist",
            )
        return event

    @staticmethod
    def list_events(session: Session) -> list[Event]:
        return list(session.exec(select(Event).order_by(Event.event_date)).all())

    @classmethod
    def create_event(cls, session: Session, event_in: EventCreate) -> Event:
        if event_in.event_date.replace(tzinfo=None) <= datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Event date must be in the future.",
            )
        db_event = Event.model_validate(event_in)
        db_event.spots_remaining = event_in.capacity
        session.add(db_event)
        session.commit()
        session.refresh(db_event)
        return db_event

    @classmethod
    def register_user(cls, session: Session, registration: RegistrationCreate) -> Registration:
        event = cls.get_event(session, registration.event_id)

        if event.event_date.replace(tzinfo=None) <= datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Registration failed: Cannot register for past events.",
            )

        if event.spots_remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Registration failed: Event is at maximum capacity.",
            )

        existing = session.exec(
            select(Registration).where(
                Registration.event_id == registration.event_id,
                Registration.user_id == registration.user_id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration failed: User is already registered for this event.",
            )

        event.spots_remaining -= 1
        session.add(event)

        db_reg = Registration.model_validate(registration)
        session.add(db_reg)
        session.commit()
        session.refresh(db_reg)
        return db_reg

    @classmethod
    def unregister_user(cls, session: Session, event_id: UUID, user_id: str) -> dict:
        reg = session.exec(
            select(Registration).where(
                Registration.event_id == event_id,
                Registration.user_id == user_id,
            )
        ).first()
        if not reg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registration found for this user and event.",
            )

        event = cls.get_event(session, event_id)
        event.spots_remaining += 1
        session.add(event)
        session.delete(reg)
        session.commit()
        return {"success": True}

    @classmethod
    def update_event_capacity(cls, session: Session, event_id: UUID, new_capacity: int) -> Event:
        event = cls.get_event(session, event_id)
        registered = event.capacity - event.spots_remaining
        if new_capacity < registered:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot set capacity below current registration count ({registered}).",
            )
        delta = new_capacity - event.capacity
        event.capacity = new_capacity
        event.spots_remaining += delta
        session.add(event)
        session.commit()
        session.refresh(event)
        return event
