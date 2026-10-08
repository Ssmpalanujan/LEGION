"""Movie Night REST: create room (6-char code), join (2-4 participants)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core import security as sec
from app.models.db import get_db
from app.models.entities import Room, User
from app.schemas.movie import movie_to_out
from app.services import rooms as svc

router = APIRouter(tags=["rooms"])
MAX_PLAYERS = 4


def _room_out(db: Session, room: Room) -> dict:
    from app.models.entities import Movie

    deck = svc.deck_of(room)
    movies = db.query(Movie).filter(Movie.id.in_(deck)).all() if deck else []
    order = {mid: i for i, mid in enumerate(deck)}
    movies.sort(key=lambda m: order.get(m.id, 0))
    return {
        "code": room.code,
        "status": room.status,
        "participants": svc.participants_of(room),
        "deck": [movie_to_out(m).model_dump() for m in movies],
        "finished": svc.finished_map(db, room),
        "result_movie_id": room.result_movie_id,
    }


@router.post("/rooms", status_code=201)
def create_room(user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    for _ in range(10):
        code = svc.new_code()
        if not db.query(Room).filter(Room.code == code).first():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate room code.")
    import json

    room = Room(code=code, host_user_id=user.id, participants=json.dumps([user.id]), deck="[]", status="open")
    db.add(room)
    db.commit()
    db.refresh(room)
    room.deck = json.dumps(svc.build_deck(db))
    db.commit()
    out = _room_out(db, room)
    svc.publish_sync(code, {"type": "room", "code": code, "participants": out["participants"]})
    return out


@router.post("/rooms/{code}/join")
def join_room(code: str, user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    import json

    room = db.query(Room).filter(Room.code == code.upper()).first()
    if room is None:
        raise HTTPException(status_code=404, detail=f"Room {code.upper()} not found.")
    if room.status != "open":
        raise HTTPException(status_code=409, detail="Room is already finished.")
    users = svc.participants_of(room)
    if user.id not in users:
        if len(users) >= MAX_PLAYERS:
            raise HTTPException(status_code=409, detail="Room is full (4 participants max).")
        users.append(user.id)
        room.participants = json.dumps(users)
        db.commit()
    out = _room_out(db, room)
    svc.publish_sync(room.code, {"type": "joined", "user_id": user.id, "participants": users})
    return out


@router.get("/rooms/{code}")
def room_state(code: str, user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.code == code.upper()).first()
    if room is None:
        raise HTTPException(status_code=404, detail=f"Room {code.upper()} not found.")
    if user.id not in svc.participants_of(room):
        raise HTTPException(status_code=403, detail="You are not in this room.")
    return _room_out(db, room)
