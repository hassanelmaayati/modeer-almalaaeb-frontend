"""Test-only API bootstrap with a new disposable database for every browser test.

The reset endpoint is attached only here. This file is not in the backend image.
"""
import asyncio
import os
from pathlib import Path
import signal
import sys
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
BACKEND = Path(os.environ.get('MODEER_BACKEND_PATH', Path(__file__).resolve().parents[2] / 'modeer_backend')).resolve()
sys.path.insert(0, str(BACKEND))
from tests.offline_network import install
install()
from tests.postgres_cluster import TemporaryPostgres
postgres = TemporaryPostgres().start()
os.environ.update(DATABASE_URL=postgres.create_database(), JWT_SECRET='modeer-isolated-browser-test-secret', CORS_ORIGINS='http://127.0.0.1:5174,http://localhost:5174', LIFECYCLE_WORKER='off', GOOGLE_CLIENT_ID='')

from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
import uvicorn
import database
import main
from migrations.initialize import initialize_database
from models.user import UserModel
import models.user
from data.sports_data import build_sports
from models.group import GroupModel
from models.room import RoomModel
from models.membership import MembershipModel
from services import realtime, lobby, lobby_events
from controllers import lobby_ws

# Same algorithms as production; reduced cost is confined to disposable fixtures.
models.user.pwd_context = CryptContext(schemes=['bcrypt_sha256', 'bcrypt'], bcrypt_sha256__rounds=4, bcrypt__rounds=4)
app = main.app
engine = None
current_url = None
reset_lock = asyncio.Lock()


def seed(factory):
    with factory() as session:
        for identifier, name in [('owner', 'Test Owner'), ('member', 'Test Member'), ('outsider', 'Test Outsider'), ('accepted', 'Test Accepted')]:
            user = UserModel(user_name=name, email=identifier + '@example.test', district='capital')
            user.set_password('TestPass123!')
            session.add(user)
        session.add_all(build_sports())
        session.commit()
        session.add_all([GroupModel(owner_id=1, name='Weekend Football', description='Friendly football in Bahrain', sports_id=1), GroupModel(owner_id=1, name='Basketball Friends', description='Meet on the court', sports_id=2)])
        session.commit()
        start = datetime.now(timezone.utc) + timedelta(days=7)
        session.add(RoomModel(host_id=1, sport_id=1, title='Friday Football Match', description='A friendly fixture for all levels', starts_at=start, ends_at=start + timedelta(hours=2), capacity=10, slot_layout={}, difficulty='beginners', visibility='public', admission_policy='approval', district='capital', area='Manama', venue_notes='Private fixture meeting instructions'))
        session.add_all([MembershipModel(user_id=2, group_id=1, status='pending', requested=False, accepted=False), MembershipModel(user_id=4, group_id=1, status='accepted', requested=False, accepted=True), MembershipModel(user_id=3, group_id=2, status='pending', requested=False, accepted=False)])
        session.commit()


def replace_database():
    global engine, current_url
    previous_engine, previous_url = engine, current_url
    current_url = postgres.create_database()
    initialize_database(current_url)
    engine = create_engine(current_url, pool_pre_ping=True)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    database.engine.dispose()
    database.engine = engine
    database.SessionLocal = factory
    realtime.session_factory = factory
    os.environ['DATABASE_URL'] = current_url
    seed(factory)
    if previous_engine is not None:
        previous_engine.dispose()
    if previous_url is not None:
        postgres.drop_database(previous_url)


@app.post('/__test__/reset', include_in_schema=False)
async def reset(request: Request):
    if request.client.host not in {'127.0.0.1', '::1'}:
        raise HTTPException(status_code=403, detail='Loopback fixtures only')
    async with reset_lock:
        await realtime.realtime_hub.close()
        for socket in list(lobby.lobby_hub._watching):
            try:
                await socket.close(code=1001)
            except Exception:
                pass
        realtime.realtime_hub = realtime.RealtimeHub()
        realtime.tickets = realtime.SocketTickets()
        hub = lobby.InMemoryLobbyHub()
        lobby.lobby_hub = hub
        lobby_events.lobby_hub = hub
        lobby_ws.lobby_hub = hub
        lobby_ws.open_total = 0
        lobby_ws.open_by_ip = {}
        replace_database()
    return {'ok': True}


try:
    replace_database()
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('MODEER_TEST_API_PORT', '8001')), log_level='warning', timeout_graceful_shutdown=3)
finally:
    if engine is not None:
        engine.dispose()
    postgres.stop()
