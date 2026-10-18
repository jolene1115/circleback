"""Password accounts and private, cross-device interview history."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from urllib.parse import urlsplit
from typing import Literal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from backend.models import NonEmptyText
from backend.services import db

router = APIRouter(prefix='/api/account', tags=['accounts'])
COOKIE = 'circleback_session'
MAX_AGE = 60 * 60 * 24 * 30


def init_accounts():
    with db.connection() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS accounts (
            userId TEXT PRIMARY KEY REFERENCES users(id), email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS account_tokens (
            tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES accounts(userId), expires REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS account_history (
            userId TEXT NOT NULL REFERENCES accounts(userId), id TEXT NOT NULL,
            entry TEXT NOT NULL, savedAt TEXT NOT NULL, PRIMARY KEY(userId, id)
        );
        CREATE TABLE IF NOT EXISTS login_limits (
            key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets REAL NOT NULL
        );
        ''')


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Enter a valid email address')
        return value


class Signup(Credentials):
    name: NonEmptyText = Field(max_length=80)


def same_origin(request: Request):
    origin = request.headers.get('origin')
    expected_origin = os.getenv('APP_ORIGIN', '').rstrip('/')
    valid_origin = origin == expected_origin if expected_origin else (not origin or urlsplit(origin).netloc == request.headers.get('host'))
    if request.headers.get('sec-fetch-site') == 'cross-site' or (origin and not valid_origin):
        raise HTTPException(403, 'Request must come from this website')


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600_000).hex()
    return f'{salt}:{digest}'


def current_user(request: Request):
    token = request.cookies.get(COOKIE, '')
    with db.connection() as conn:
        row = conn.execute('''SELECT users.id, users.name, users.createdAt, accounts.email
            FROM account_tokens JOIN accounts ON accounts.userId = account_tokens.userId
            JOIN users ON users.id = accounts.userId WHERE tokenHash = ? AND expires > ?''',
            (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    if row is None:
        raise HTTPException(401, 'Please log in to your account')
    return dict(row)


def issue_login(response, user_id):
    token = secrets.token_urlsafe(32)
    with db.connection() as conn:
        conn.execute('DELETE FROM account_tokens WHERE expires <= ?', (time.time(),))
        conn.execute('INSERT INTO account_tokens VALUES (?, ?, ?)',
                     (hashlib.sha256(token.encode()).hexdigest(), user_id, time.time() + MAX_AGE))
    response.set_cookie(COOKIE, token, max_age=MAX_AGE, httponly=True,
                        secure=os.getenv('COOKIE_SECURE', '').lower() == 'true', samesite='lax', path='/')


def rate_limit(request, email):
    # Stored in SQLite so restarts and multiple workers cannot bypass the limit.
    ip = request.client.host if request.client else 'unknown'
    now = time.time()
    blocked = False
    with db.connection() as conn:
        conn.execute('DELETE FROM login_limits WHERE resets <= ?', (now,))
        for scope, maximum in ((f'pair:{ip}:{email}', 10), (f'ip:{ip}', 60)):
            key = hashlib.sha256(scope.encode()).hexdigest()
            conn.execute('INSERT INTO login_limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now + 900))
            count = conn.execute('SELECT count FROM login_limits WHERE key=?', (key,)).fetchone()[0]
            blocked = blocked or count > maximum
    if blocked:
        raise HTTPException(429, 'Too many attempts. Please try again in 15 minutes.')


@router.post('/signup', dependencies=[Depends(same_origin)])
def signup(body: Signup, request: Request, response: Response):
    rate_limit(request, body.email)
    identifier, created = db.identity()
    hashed = password_hash(body.password)
    try:
        with db.connection() as conn:
            conn.execute('INSERT INTO users VALUES (?, ?, ?)', (identifier, body.name, created))
            conn.execute('INSERT INTO accounts VALUES (?, ?, ?)', (identifier, body.email, hashed))
    except sqlite3.IntegrityError as exc:
        raise HTTPException(409, 'Unable to create this account. Try logging in instead.') from exc
    issue_login(response, identifier)
    return dict(id=identifier, name=body.name, email=body.email, createdAt=created)


@router.post('/login', dependencies=[Depends(same_origin)])
def login(body: Credentials, request: Request, response: Response):
    rate_limit(request, body.email)
    with db.connection() as conn:
        row = conn.execute('SELECT * FROM accounts WHERE email=?', (body.email,)).fetchone()
    stored = row['passwordHash'] if row else '0' * 32 + ':' + '0' * 64
    if not hmac.compare_digest(password_hash(body.password, stored.split(':')[0]), stored):
        raise HTTPException(401, 'Email or password is incorrect')
    issue_login(response, row['userId'])
    return {**db.get_user(row['userId']), 'email': body.email}


@router.get('/me')
def me(user=Depends(current_user)):
    return user


@router.post('/logout', dependencies=[Depends(same_origin)])
def logout(request: Request, response: Response):
    with db.connection() as conn:
        conn.execute('DELETE FROM account_tokens WHERE tokenHash=?',
                     (hashlib.sha256(request.cookies.get(COOKIE, '').encode()).hexdigest(),))
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


class HistoryEntry(BaseModel):
    mode: Literal['interview', 'speaking'] = 'interview'
    timeLimitSec: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    id: NonEmptyText = Field(max_length=100)
    createdAt: datetime | None = None
    topic: str = Field(max_length=500)
    date: str = Field(max_length=100)
    focus: list[str] = Field(default_factory=list, max_length=30)
    context: str = Field(default='', max_length=20000)
    turns: list[dict] = Field(max_length=100)

    @field_validator('turns')
    @classmethod
    def valid_turns(cls, turns):
        for turn in turns:
            if not isinstance(turn.get('q'), str) or not isinstance(turn.get('a'), str):
                raise ValueError('Each answer must contain question and transcript strings')
        return turns


class HistoryBatch(BaseModel):
    entries: list[HistoryEntry] = Field(max_length=100)


@router.get('/history')
def history(user=Depends(current_user), limit: int = 100, offset: int = 0):
    if limit < 1 or limit > 100 or offset < 0:
        raise HTTPException(422, 'Invalid history page')
    with db.connection() as conn:
        rows = conn.execute('SELECT entry FROM account_history WHERE userId=? ORDER BY savedAt DESC, id DESC LIMIT ? OFFSET ?',
                            (user['id'], limit, offset)).fetchall()
    return [json.loads(row['entry']) for row in rows]


@router.post('/history', dependencies=[Depends(same_origin)])
def save_history(body: HistoryBatch, user=Depends(current_user)):
    entries = [(e.id, e.model_dump_json()) for e in body.entries]
    if sum(len(entry.encode()) for _, entry in entries) > 2_000_000:
        raise HTTPException(413, 'History upload is too large; import fewer interviews at a time')
    with db.connection() as conn:
        for identifier, entry in entries:
            # Immutable IDs make retries/imports idempotent, without overwriting saved interviews.
            data = json.loads(entry)
            try:
                created = datetime.fromisoformat(data['createdAt']) if data.get('createdAt') else datetime.strptime(data['date'], '%b %d, %Y').replace(tzinfo=timezone.utc)
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                saved_at = created.astimezone(timezone.utc).isoformat()
            except ValueError:
                raise HTTPException(422, 'Interview date must be a valid date')
            conn.execute('INSERT OR IGNORE INTO account_history VALUES (?, ?, ?, ?)',
                         (user['id'], identifier, entry, saved_at))
    return {'saved': len(entries)}


def protect_user_history(user_id, request):
    """Legacy demo routes must not bypass ownership for registered profiles."""
    with db.connection() as conn:
        registered = conn.execute('SELECT 1 FROM accounts WHERE userId=?', (user_id,)).fetchone()
    if registered:
        if request.method not in ('GET', 'HEAD'):
            same_origin(request)
        if current_user(request)['id'] != user_id:
            raise HTTPException(404, 'User not found')


def protect_session(session_id, request):
    session = db.get_session(session_id)
    protect_user_history(session['userId'], request)
