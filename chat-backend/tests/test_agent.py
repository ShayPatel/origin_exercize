"""
Unit tests for agent construction and config defaults.
Does not require LM Studio or core-backend to be running.
"""
import os
import pytest
from app.config import settings
from app.agent import build_agent
from google.adk import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset


def test_settings_defaults():
    assert settings.LOCAL_MODEL.startswith("openai/")
    assert "1234" in settings.LM_STUDIO_BASE_URL
    assert settings.CORE_MCP_URL.endswith("/mcp/sse")


def test_litellm_env_set_by_agent_module():
    assert os.environ.get("OPENAI_API_BASE") == settings.LM_STUDIO_BASE_URL
    assert os.environ.get("OPENAI_API_KEY") == settings.LM_STUDIO_API_KEY


def test_build_agent_returns_agent_instance():
    agent = build_agent()
    assert isinstance(agent, Agent)


def test_build_agent_uses_litellm():
    agent = build_agent()
    assert isinstance(agent.model, LiteLlm)


def test_build_agent_has_mcp_toolset():
    agent = build_agent()
    assert len(agent.tools) == 1
    assert isinstance(agent.tools[0], McpToolset)


def test_build_agent_instruction_contains_date():
    agent = build_agent()
    assert "2026" in agent.instruction
