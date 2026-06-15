import uuid
import warnings
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.agent import build_agent
from app.agui_bridge import stream_agent_response

# ADK emits UserWarnings for every experimental feature used (MCP graceful
# error handling, JSON schema for func decls, etc.). These are noise — the
# features work correctly; we just don't want them in every request log.
warnings.filterwarnings("ignore", category=UserWarning, module="google.adk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Event Management Chat Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/v1/chat/stream")
async def chat_stream(request: Request):
    """
    Accepts AG-UI RunAgentInput JSON and returns an SSE stream of AG-UI events.

    Expected body:
      { "threadId": "...", "messages": [{"role": "user", "content": "..."}] }
    """
    body = await request.json()
    messages = body.get("messages", [])
    user_message = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            user_message = m.get("content", "")
            break
    thread_id = body.get("threadId", str(uuid.uuid4()))
    agent = build_agent()
    return await stream_agent_response(agent, user_message, thread_id)
