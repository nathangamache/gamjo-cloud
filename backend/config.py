from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://gamjo:gamjo_dev_2026@localhost:5433/gamjo"
    redis_url: str = "redis://localhost:6380/0"

    secret_key: str = "gamjo-dev-secret-change-in-production-2026"
    magic_link_expiry_minutes: int = 15
    session_expiry_days: int = 90

    resend_api_key: str = ""
    from_email: str = "noreply@gamachecloud.com"

    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 20

    app_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8081"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()