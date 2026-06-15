import os
from google.adk import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset, SseConnectionParams
from google.genai.types import GenerateContentConfig
from app.config import settings

# Point LiteLLM at LM Studio before any model is instantiated
os.environ["OPENAI_API_BASE"] = settings.LM_STUDIO_BASE_URL
os.environ["OPENAI_API_KEY"] = settings.LM_STUDIO_API_KEY


def build_agent() -> Agent:
    mcp_toolset = McpToolset(
        connection_params=SseConnectionParams(
            url=settings.CORE_MCP_URL,
            timeout=10.0,
            sse_read_timeout=300.0,
        )
    )
    return Agent(
        name="local_event_agent",
        model=LiteLlm(model=settings.LOCAL_MODEL),
        instruction=(
            "You are a helpful local assistant managing events and user registrations.\n"
            "Today's date is Sunday, June 14, 2026.\n"
            "You MUST use your built-in code_execution tool to perform date differences, "
            "time offsets, calculations, or registration lists BEFORE calling database tools."
        ),
        tools=[mcp_toolset],
        generate_content_config=GenerateContentConfig(temperature=0.0),
    )
