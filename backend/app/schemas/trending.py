"""
Trending 功能 — Pydantic Schema 定义
热点事件分析与创作建议
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ============== 热点事件 ==============

class HotspotItem(BaseModel):
    """热点事件（API 传输）"""
    title: str           # 热点标题
    summary: str         # 事件摘要
    source: str          # 来源 (weibo/baidu/zhihu/user_input)
    url: str = ""        # 原文链接
    rank: int = 0        # 热度排名


class CustomEvent(BaseModel):
    """用户自定义事件"""
    title: str = Field(..., min_length=1, max_length=30, description="事件标题")
    description: str = Field(..., min_length=10, max_length=500, description="事件详情")


# ============== AI 创作建议 ==============

class CreativeSuggestion(BaseModel):
    """AI 生成的创作建议"""
    suggestion_id: int
    genre: str           # 题材/分类 (都市、悬疑、情感...)
    hook_description: str  # 核心爽点描述
    hook_title: str      # 爽点标题 (10-15字)
    plot_direction: str  # 剧情方向简述
    emotional_target: str  # 目标情绪 (爽/虐/甜/逆袭/反转...)


class TrendingAnalysis(BaseModel):
    """完整热点分析结果"""
    event: HotspotItem
    suggestions: List[CreativeSuggestion]
    analysis_summary: str = ""


# ============== API 请求/响应 ==============

class AnalyzeRequest(BaseModel):
    """分析请求 — 双模式"""
    sources: Optional[List[str]] = None    # 模式1: 指定抓取来源
    custom_event: Optional[CustomEvent] = None  # 模式2: 用户自定义事件
    force_refresh: bool = False            # 是否跳过缓存强制刷新


class TrendingAnalysisResponse(BaseModel):
    """分析响应"""
    code: int = 0
    message: str = "分析完成"
    data: List[TrendingAnalysis] = []


class HotspotListResponse(BaseModel):
    """热点列表响应"""
    code: int = 0
    data: List[HotspotItem] = []


class TrendingConfirmRequest(BaseModel):
    """确认创作方向请求"""
    event: HotspotItem              # 选中的事件
    suggestion: CreativeSuggestion  # 选中的创作建议
    target_length: int = Field(default=8000, ge=2000, le=30000)


class ConfirmResponse(BaseModel):
    """确认响应"""
    code: int = 0
    message: str = "创作方向已确认"
    data: dict = {}  # { novel_id, setting, category_config }


# ============== 持久化查询 ==============

class HotspotEventResponse(BaseModel):
    """从 hotspot_events 表返回的完整记录"""
    model_config = {"from_attributes": True}

    id: str
    title: str
    summary: Optional[str] = None
    source: str
    source_url: Optional[str] = None
    rank: int = 0
    ai_suggestions: Optional[List[CreativeSuggestion]] = None
    analysis_summary: Optional[str] = None
    tags: Optional[List[str]] = None
    usage_count: int = 0
    fetched_at: datetime
    created_at: datetime
    updated_at: datetime


class HotspotStoredListResponse(BaseModel):
    """存储热点列表响应"""
    code: int = 0
    data: List[HotspotEventResponse] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class HotspotDetailResponse(BaseModel):
    """存储热点详情响应"""
    code: int = 0
    data: Optional[HotspotEventResponse] = None


class UseMarkResponse(BaseModel):
    """标记使用响应"""
    code: int = 0
    message: str = "ok"
