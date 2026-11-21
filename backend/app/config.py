from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://stockiq:stockiq@localhost:3306/stockiq"
    jwt_secret: str = "dev-only-change-me-minimum-32-chars-secret"
    jwt_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173"

    # Intelligence Engine tunables (rule-based analytics, not ML).
    lookback_days: int = 30
    review_period_days: int = 7
    min_history_days: int = 7


settings = Settings()
