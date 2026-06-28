"""
配置管理
使用 Pydantic Settings 从环境变量加载配置
纯本地运行版本 - 仅需配置模型即可使用
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用
    APP_NAME: str = "Fanqie Short Novel"
    DEBUG: bool = False
    SECRET_KEY: str = "fanqie-short-novel-local"

    # SQLite 数据库（纯本地，无需安装任何数据库）
    # 默认存储在项目 data 目录下
    DATABASE_PATH: str = str(PROJECT_ROOT / "data" / "fanqie_short_novel.db")

    # LLM 默认配置 (OpenAI 兼容格式)
    # 用户只需在 .env 或启动后界面中配置这三个变量即可使用
    LLM_BASE_URL: str = "https://api.deepseek.com"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "deepseek-v4-flash"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 4000

    # 服务端口
    HOST: str = "127.0.0.1"
    PORT: int = 8001


# 全局配置实例
settings = Settings()
