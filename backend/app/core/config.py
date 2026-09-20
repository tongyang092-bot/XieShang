from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ALIYUN_API_KEY: str = ""
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_HTTP_API_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    TRYON_MODEL: str = "wan2.7-image-pro"
    DATABASE_URL: str = "sqlite:///./uploads/xieshang_dev.db"
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()
