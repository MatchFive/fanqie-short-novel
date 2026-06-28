"""
错误码规范
统一错误码定义
"""

from enum import Enum
from typing import Dict, Any, Optional
from fastapi import HTTPException


class ErrorCode(Enum):
    """错误码枚举"""

    SUCCESS = (0, "成功")
    UNKNOWN_ERROR = (1000, "未知错误")
    INVALID_REQUEST = (1001, "请求参数错误")
    UNAUTHORIZED = (1002, "未授权")
    FORBIDDEN = (1003, "无权限")
    NOT_FOUND = (1004, "资源不存在")
    METHOD_NOT_ALLOWED = (1005, "请求方法不允许")
    RATE_LIMIT = (1006, "请求过于频繁")
    INTERNAL_ERROR = (1007, "服务器内部错误")
    SERVICE_UNAVAILABLE = (1008, "服务暂时不可用")
    TIMEOUT = (1009, "请求超时")

    # 2xxx 项目相关
    NOVEL_NOT_FOUND = (2000, "小说不存在")
    NOVEL_TITLE_EMPTY = (2001, "小说标题不能为空")
    CHAPTER_NOT_FOUND = (2100, "章节不存在")

    # 6xxx AI 相关
    AI_GENERATE_FAILED = (6000, "AI 生成失败")
    AI_NO_API_KEY = (6001, "未配置 API Key，请在设置中配置")
    AI_API_KEY_INVALID = (6002, "API Key 无效或已过期")
    AI_TIMEOUT = (6003, "AI 响应超时")

    # 7xxx 配置相关
    CONFIG_INVALID_URL = (7000, "API 地址格式无效")
    CONFIG_INVALID_KEY = (7001, "API Key 格式无效")

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message


ERROR_HTTP_STATUS: Dict[int, int] = {
    0: 200,
    1001: 400, 1002: 401, 1003: 403, 1004: 404,
    1005: 405, 1006: 429, 1007: 500, 1008: 503, 1009: 504,
    2000: 404, 2001: 400, 2100: 404,
    6000: 500, 6001: 400, 6002: 401, 6003: 504,
    7000: 400, 7001: 400,
}


def get_http_status(code: int) -> int:
    return ERROR_HTTP_STATUS.get(code, 500)


class AppException(Exception):
    """应用自定义异常"""

    def __init__(self, error_code: ErrorCode, detail: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        self.error_code = error_code
        self.detail = detail or error_code.message
        self.data = data or {}
        super().__init__(self.detail)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.error_code.code,
            "message": self.error_code.message,
            "detail": self.detail,
            "data": self.data,
        }

    def to_http_exception(self) -> HTTPException:
        return HTTPException(
            status_code=get_http_status(self.error_code.code),
            detail=self.to_dict(),
        )


def not_found(resource: str = "资源") -> AppException:
    return AppException(ErrorCode.NOT_FOUND, f"{resource}不存在")


def bad_request(message: str = "请求参数错误") -> AppException:
    return AppException(ErrorCode.INVALID_REQUEST, message)


def internal_error(message: str = "服务器内部错误") -> AppException:
    return AppException(ErrorCode.INTERNAL_ERROR, message)


def service_unavailable(message: str = "服务暂时不可用") -> AppException:
    return AppException(ErrorCode.SERVICE_UNAVAILABLE, message)


def timeout_error(message: str = "请求超时") -> AppException:
    return AppException(ErrorCode.TIMEOUT, message)
