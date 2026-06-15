from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    CORE_MCP_URL: str = "http://127.0.0.1:8000/mcp/sse"
    LOCAL_MODEL: str = "lm_studio/qwen3.6-35b-a3b"
    LM_STUDIO_BASE_URL: str = "http://127.0.0.1:1234/v1"
    LM_STUDIO_API_KEY: str = "lm-studio"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
