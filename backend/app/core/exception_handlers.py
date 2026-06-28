"""
全局异常处理器
"""

import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from httpx import HTTPStatusError, TimeoutException, ConnectError

from app.core.errors import (
    ErrorCode, AppException, get_http_status,
    not_found, internal_error, service_unavailable, timeout_error,
)

logger = logging.getLogger("fanqie_novel.exception")


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器"""

    @app.exception_handler(AppException)
    async def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
        logger.warning("AppException: code=%d, detail=%s", exc.error_code.code, exc.detail)
        return JSONResponse(
            status_code=get_http_status(exc.error_code.code),
            content=exc.to_dict(),
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_sqlalchemy_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.error("数据库错误: %s", str(exc), exc_info=True)
        return JSONResponse(
            status_code=500,
            content=internal_error("数据库操作失败").to_dict(),
        )

    @app.exception_handler(HTTPStatusError)
    async def handle_http_status_error(request: Request, exc: HTTPStatusError) -> JSONResponse:
        logger.error("HTTP API 错误: status=%d", exc.response.status_code)
        return JSONResponse(
            status_code=502,
            content={
                "code": ErrorCode.AI_GENERATE_FAILED.code,
                "message": "AI 服务调用失败",
                "detail": str(exc),
                "data": {},
            },
        )

    @app.exception_handler(TimeoutException)
    async def handle_timeout(request: Request, exc: TimeoutException) -> JSONResponse:
        return JSONResponse(status_code=504, content=timeout_error("请求超时").to_dict())

    @app.exception_handler(ConnectError)
    async def handle_connect_error(request: Request, exc: ConnectError) -> JSONResponse:
        return JSONResponse(status_code=503, content=service_unavailable("无法连接外部服务").to_dict())

    @app.exception_handler(Exception)
    async def handle_generic_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.error("未捕获异常 [%s]: %s", type(exc).__name__, str(exc), exc_info=True)
        return JSONResponse(
            status_code=500,
            content=internal_error("服务器内部错误").to_dict(),
        )

    logger.info("全局异常处理器注册完成")
