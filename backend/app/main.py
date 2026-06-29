"""
Fanqie Short Novel - FastAPI Backend
AI 辅助短篇小说创作助手 - 纯本地运行版本
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.config import settings, PROJECT_ROOT
from app.database import engine
from app.models import Base
from app.core.logging_config import setup_logging, get_logger
from app.core.exception_handlers import register_exception_handlers

# 初始化日志系统
setup_logging(level="DEBUG" if settings.DEBUG else "INFO")

logger = get_logger("fanqie_novel.main")

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 辅助短篇小说创作助手 - 纯本地运行",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 注册全局异常处理器
register_exception_handlers(app)

# CORS 中间件（本地运行，开放所有来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """应用启动时执行"""
    logger.info("=" * 50)
    logger.info("应用启动: %s v%s", settings.APP_NAME, "1.0.0")
    logger.info("DEBUG 模式: %s", settings.DEBUG)
    logger.info("数据库路径: %s", settings.DATABASE_PATH)
    logger.info("LLM 模型: %s", settings.LLM_MODEL)
    logger.info("=" * 50)

    # 数据库表创建
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("数据库表创建/检查完成")
    except Exception as e:
        logger.error("数据库表创建失败: %s", e, exc_info=True)

    # 初始化预设库数据
    from app.scripts.seed_presets import seed_all
    try:
        await seed_all()
        logger.info("预设库数据初始化完成")
    except Exception as e:
        logger.warning("预设库数据初始化失败（非阻断）: %s", e)

    logger.info("=" * 50)
    logger.info("应用启动完成")
    logger.info("=" * 50)


@app.on_event("shutdown")
async def shutdown():
    """应用关闭时执行"""
    logger.info("应用关闭中...")

    try:
        await engine.dispose()
        logger.info("数据库连接已关闭")
    except Exception as e:
        logger.warning("数据库连接关闭异常: %s", e)

    logger.info("应用已关闭")


# 健康检查
@app.get("/health", tags=["health"])
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "version": "1.0.0", "app": settings.APP_NAME}


# 注册路由
from app.api.short_story import router as short_story_router

app.include_router(short_story_router, prefix="/api/v1")

# ===== 桌面模式：挂载前端静态文件 =====
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "dist"

if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
    static_dir = str(FRONTEND_DIR)

    # 静态资源（assets 目录）
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend_assets")

    # favicon / vite.svg
    @app.get("/vite.svg", include_in_schema=False)
    async def serve_favicon():
        favicon_path = FRONTEND_DIR / "vite.svg"
        if favicon_path.exists():
            return FileResponse(favicon_path)
        return None

    # SPA 回退：所有非 API 非静态路由返回 index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIR / full_path
        # 先尝试直接返回匹配的文件
        if file_path.is_file():
            return FileResponse(file_path)
        # 否则回退到 index.html（SPA 路由）
        return FileResponse(FRONTEND_DIR / "index.html")

    logger.info("前端静态文件已挂载: %s", static_dir)
else:
    logger.warning("前端 dist 目录不存在，跳过静态文件挂载（请先执行 npm run build）")

logger.info("路由注册完成")
