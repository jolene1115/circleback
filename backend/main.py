from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routes import users

app = FastAPI()

# Allow the frontend (running on port 3000) to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the database tables when the server starts
init_db()

# Connect the user routes
app.include_router(users.router)


@app.get("/")
def home():
    return {"message": "Server is running"}