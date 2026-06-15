from datetime import datetime, timedelta
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.models import EventCreate, RegistrationCreate
from app.services import EventService


def _future_event(session, capacity=10, days_ahead=30):
    event_in = EventCreate(
        name="Test Event",
        description="desc",
        event_date=datetime.utcnow() + timedelta(days=days_ahead),
        capacity=capacity,
    )
    return EventService.create_event(session, event_in)


# ==========================================
# create_event
# ==========================================

def test_create_event_sets_spots_remaining(session):
    event = _future_event(session, capacity=50)
    assert event.spots_remaining == 50


def test_create_event_past_date_rejected(session):
    event_in = EventCreate(
        name="Old",
        description=None,
        event_date=datetime.utcnow() - timedelta(days=1),
        capacity=10,
    )
    with pytest.raises(HTTPException) as exc:
        EventService.create_event(session, event_in)
    assert exc.value.status_code == 422


# ==========================================
# register_user
# ==========================================

def test_register_user_happy_path(session):
    event = _future_event(session)
    reg_in = RegistrationCreate(event_id=event.id, user_id="alice")
    reg = EventService.register_user(session, reg_in)
    assert reg.user_id == "alice"
    session.refresh(event)
    assert event.spots_remaining == 9


def test_register_user_past_event_rejected(session):
    event = _future_event(session)
    # Manually backdating to simulate a past event
    from sqlmodel import Session
    event.event_date = datetime.utcnow() - timedelta(seconds=1)
    session.add(event)
    session.commit()

    reg_in = RegistrationCreate(event_id=event.id, user_id="bob")
    with pytest.raises(HTTPException) as exc:
        EventService.register_user(session, reg_in)
    assert exc.value.status_code == 422
    assert "past" in exc.value.detail.lower()


def test_register_user_full_capacity_rejected(session):
    event = _future_event(session, capacity=1)
    EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id="alice"))

    with pytest.raises(HTTPException) as exc:
        EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id="bob"))
    assert exc.value.status_code == 422
    assert "capacity" in exc.value.detail.lower()


def test_register_user_duplicate_rejected(session):
    event = _future_event(session)
    reg_in = RegistrationCreate(event_id=event.id, user_id="alice")
    EventService.register_user(session, reg_in)

    with pytest.raises(HTTPException) as exc:
        EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id="alice"))
    assert exc.value.status_code == 409


def test_register_user_event_not_found(session):
    reg_in = RegistrationCreate(event_id=uuid4(), user_id="alice")
    with pytest.raises(HTTPException) as exc:
        EventService.register_user(session, reg_in)
    assert exc.value.status_code == 404


# ==========================================
# unregister_user
# ==========================================

def test_unregister_user_restores_spot(session):
    event = _future_event(session, capacity=5)
    EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id="alice"))
    session.refresh(event)
    assert event.spots_remaining == 4

    result = EventService.unregister_user(session, event.id, "alice")
    assert result["success"] is True
    session.refresh(event)
    assert event.spots_remaining == 5


def test_unregister_user_not_registered(session):
    event = _future_event(session)
    with pytest.raises(HTTPException) as exc:
        EventService.unregister_user(session, event.id, "nobody")
    assert exc.value.status_code == 404


# ==========================================
# update_event_capacity
# ==========================================

def test_update_capacity_increase(session):
    event = _future_event(session, capacity=10)
    updated = EventService.update_event_capacity(session, event.id, 20)
    assert updated.capacity == 20
    assert updated.spots_remaining == 20


def test_update_capacity_decrease_valid(session):
    event = _future_event(session, capacity=10)
    EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id="alice"))
    updated = EventService.update_event_capacity(session, event.id, 5)
    assert updated.capacity == 5
    assert updated.spots_remaining == 4


def test_update_capacity_below_registrations_rejected(session):
    event = _future_event(session, capacity=10)
    for i in range(5):
        EventService.register_user(session, RegistrationCreate(event_id=event.id, user_id=f"user{i}"))

    with pytest.raises(HTTPException) as exc:
        EventService.update_event_capacity(session, event.id, 3)
    assert exc.value.status_code == 422
