"""
配置管理
使用 Pydantic Settings 从环境变量加载配置
纯本地运行版本 - 仅需配置模型即可使用
"""

import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_app_root() -> Path:
    """获取应用根目录（兼容开发模式与 PyInstaller 打包模式）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包：exe 所在目录（可写数据目录）
        return Path(sys.executable).parent
    # 开发模式：config.py 在 backend/app/ 下，上三级为项目根目录
    return Path(__file__).resolve().parent.parent.parent


def _get_resource_root() -> Path:
    """获取资源根目录（只读资源：前端 dist、assets 等）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包：_MEIPASS 解压目录
        return Path(sys._MEIPASS)  # type: ignore
    # 开发模式：同项目根目录
    return _get_app_root()


# 项目根目录（可写数据：.env、数据库、备份等）
PROJECT_ROOT = _get_app_root()
# 资源根目录（只读：前端文件、图标等）
RESOURCE_ROOT = _get_resource_root()
ENV_FILE_PATH = PROJECT_ROOT / ".env"

# 静态资源数据目录（JSON 分类文件等，打包时随 exe 分发）
# 开发模式：PROJECT_ROOT/data；打包模式：_MEIPASS/data
RESOURCE_DATA_DIR = RESOURCE_ROOT / "data"
# 用户数据目录（可写：用户自定义分类、数据库等）
# 始终指向 exe 所在目录/data（打包模式也在这里）
USER_DATA_DIR = PROJECT_ROOT / "data"

# 确保必要目录存在（打包模式下首次运行时创建）
PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR.mkdir(exist_ok=True)
(PROJECT_ROOT / "logs").mkdir(exist_ok=True)


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
