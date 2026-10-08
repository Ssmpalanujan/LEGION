"""Movie Night WebSocket: /ws/rooms/{code}?token=JWT. Shared swipe deck, live status, group result."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core import security as sec
from app.models.db import SessionLocal
from app.models.entities import Room, RoomSwipe
from app.schemas.movie import movie_to_out
from app.services import rooms as svc

router = APIRouter()


@router.websocket("/ws/rooms/{code}")
async def room_ws(ws: WebSocket, code: str, token: str = ""):
    code = code.upper()
    try:
        user_id = sec.decode(token, "access")
    except Exception:
        await ws.close(code=4401)
        return
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.code == code).first()
        if room is None or user_id not in svc.participants_of(room):
            await ws.close(code=4404)
            return
    finally:
        db.close()
    await svc.ws_connect(code, ws)
    try:
        await svc.publish(code, {"type": "presence", "user_id": user_id, "online": True})
        while True:
            msg = await ws.receive_json()
            db = SessionLocal()
            try:
                room = db.query(Room).filter(Room.code == code).first()
                if room is None:
                    await ws.send_json({"type": "error", "detail": "Room gone."})
                    continue
                if msg.get("type") == "swipe":
                    mid, liked = int(msg["movie_id"]), bool(msg["liked"])
                    if mid not in svc.deck_of(room):
                        await ws.send_json({"type": "error", "detail": "Not in deck."})
                        continue
                    if room.status != "open":
                        await ws.send_json({"type": "error", "detail": "Room finished."})
                        continue
                    ex = db.query(RoomSwipe).filter(
                        RoomSwipe.room_id == room.id, RoomSwipe.user_id == user_id, RoomSwipe.movie_id == mid
                    ).first()
                    if ex:
                        ex.liked = liked
                    else:
                        db.add(RoomSwipe(room_id=room.id, user_id=user_id, movie_id=mid, liked=liked))
                    db.commit()
                    fin = svc.finished_map(db, room)
                    await svc.publish(code, {
                        "type": "swipe", "user_id": user_id, "movie_id": mid,
                        "liked": liked, "finished": fin,
                    })
                    if all(fin.values()) and fin:
                        winner, nlikes, total, expl = svc.group_pick(db, room)
                        room.status = "finished"
                        room.result_movie_id = winner.id if winner else None
                        db.commit()
                        await svc.publish(code, {
                            "type": "result",
                            "movie": movie_to_out(winner).model_dump() if winner else None,
                            "likes": nlikes,
                            "of": total,
                            "explanation": expl,
                        })
                elif msg.get("type") == "status":
                    await ws.send_json({"type": "status", "finished": svc.finished_map(db, room)})
                else:
                    await ws.send_json({"type": "error", "detail": "Unknown message type."})
            except Exception as e:
                try:
                    await ws.send_json({"type": "error", "detail": str(e)})
                except Exception:
                    pass
            finally:
                db.close()
    except WebSocketDisconnect:
        pass
    finally:
        svc.ws_disconnect(code, ws)
