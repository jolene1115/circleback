import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

# The database file will be created next to this code
DB_PATH = Path(__file__).parent / "app.db"


def get_connection():
    """Open the database file."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us read rows like dictionaries
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create the tables if they don't exist yet. Safe to run many times."""
    conn = get_connection()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id        TEXT PRIMARY KEY,
            name      TEXT NOT NULL,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id        TEXT PRIMARY KEY,
            userId    TEXT NOT NULL,
            mode      TEXT NOT NULL,
            setup     TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id          TEXT PRIMARY KEY,
            sessionId   TEXT NOT NULL,
            question    TEXT,
            transcript  TEXT NOT NULL,
            durationSec REAL,
            metrics     TEXT,
            feedback    TEXT,
            createdAt   TEXT NOT NULL,
            FOREIGN KEY (sessionId) REFERENCES sessions(id)
        );
        """
    )
    conn.commit()
    conn.close()


# ---------- USER FUNCTIONS ----------

def create_user(name: str) -> dict:
    """Add a new user and return it."""
    user_id = str(uuid.uuid4())  # a random unique ID
    created_at = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    conn.execute(
        "INSERT INTO users (id, name, createdAt) VALUES (?, ?, ?)",
        (user_id, name, created_at),
    )
    conn.commit()
    conn.close()

    return {"id": user_id, "name": name, "createdAt": created_at}


def get_user(user_id: str) -> dict | None:
    """Find a user by ID. Returns None if they don't exist."""
    conn = get_connection()
    row = conn.execute(
        "SELECT id, name, createdAt FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()

    return dict(row) if row else None