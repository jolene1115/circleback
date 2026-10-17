"""SQLite persistence. JSON is decoded at the boundary; connections always close."""
import json
import os
import sqlite3
import uuid

from backend import config  # loads the project .env before reading DATABASE_PATH
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.getenv("DATABASE_PATH", str(config.ROOT_DIR / "backend" / "app.db")))


class NotFoundError(Exception):
    pass


class InvalidDataError(Exception):
    pass


@contextmanager
def connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    with connection() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0), createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id),
            mode TEXT NOT NULL CHECK(mode IN ('interview', 'speaking')),
            setup TEXT, createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES sessions(id), question TEXT,
            transcript TEXT NOT NULL CHECK(length(trim(transcript)) > 0),
            durationSec REAL CHECK(durationSec >= 0), metrics TEXT, feedback TEXT, createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user_created ON sessions(userId, createdAt, id);
        CREATE INDEX IF NOT EXISTS attempts_session_created ON attempts(sessionId, createdAt, id);
        PRAGMA user_version = 1;
        ''')


def identity():
    return str(uuid.uuid4()), datetime.now(timezone.utc).isoformat()


def decode(row):
    if row is None:
        return None
    value = dict(row)
    for key in ('setup', 'metrics', 'feedback'):
        if key in value and value[key] is not None:
            value[key] = json.loads(value[key])
    return value


def require(conn, table, identifier):
    # Table names are internal constants, never request input.
    row = conn.execute(f'SELECT * FROM {table} WHERE id = ?', (identifier,)).fetchone()
    if row is None:
        raise NotFoundError(f'{table[:-1].capitalize()} not found')
    return decode(row)


def create_user(name):
    name = name.strip()
    if not name:
        raise InvalidDataError('Name cannot be empty')
    identifier, created = identity()
    with connection() as conn:
        conn.execute('INSERT INTO users VALUES (?, ?, ?)', (identifier, name, created))
    return dict(id=identifier, name=name, createdAt=created)


def get_user(user_id):
    with connection() as conn:
        return decode(conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone())


def create_session(user_id, mode, setup):
    if mode not in ('interview', 'speaking'):
        raise InvalidDataError('Invalid session mode')
    identifier, created = identity()
    with connection() as conn:
        require(conn, 'users', user_id)
        conn.execute('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)',
                     (identifier, user_id, mode, json.dumps(setup), created))
        return require(conn, 'sessions', identifier)


def get_session(session_id, mode=None):
    with connection() as conn:
        session = require(conn, 'sessions', session_id)
        if mode and session['mode'] != mode:
            raise InvalidDataError(f'Session must use {mode} mode')
        return session


def list_sessions(user_id, limit, offset):
    with connection() as conn:
        require(conn, 'users', user_id)
        return [decode(row) for row in conn.execute(
            'SELECT * FROM sessions WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?',
            (user_id, limit, offset))]


def save_attempt(session_id, question, transcript, metrics, feedback, mode=None):
    identifier, created = identity()
    with connection() as conn:
        session = require(conn, 'sessions', session_id)
        if mode and session['mode'] != mode:
            raise InvalidDataError(f'Session must use {mode} mode')
        if session['mode'] == 'interview' and not question:
            raise InvalidDataError('Interview attempts require a question')
        conn.execute('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?)', (
            identifier, session_id, question, transcript, metrics['durationSec'],
            json.dumps(metrics, allow_nan=False), json.dumps(feedback, allow_nan=False), created))
        return require(conn, 'attempts', identifier)


def list_attempts(session_id, limit, offset):
    with connection() as conn:
        require(conn, 'sessions', session_id)
        return [decode(row) for row in conn.execute(
            'SELECT * FROM attempts WHERE sessionId = ? ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?',
            (session_id, limit, offset))]
