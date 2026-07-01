"""
Trending API 路由
热点事件分析 + 创作建议 — 半自动模式
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.llm_client import LLMClient
from app.core.logging_config import get_logger
from app.config import settings
from app.schemas.trending import (
    HotspotItem, CustomEvent, CreativeSuggestion, TrendingAnalysis,
    HotspotListResponse, TrendingAnalysisResponse, TrendingConfirmRequest, ConfirmResponse,
    HotspotStoredListResponse, HotspotEventResponse, HotspotDetailResponse, UseMarkResponse,
    AnalyzeRequest,
)
from app.services.trending_service import TrendingService

logger = get_logger("fanqie_novel.trending")
router = APIRouter(prefix="/trending", tags=["trending"])


# ============== LLM 服务依赖 ==============

async def get_trending_service() -> TrendingService:
    """获取 Trending 服务实例"""
    if not settings.LLM_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="未配置 API Key，请在 .env 文件中设置 LLM_API_KEY",
        )
    client = LLMClient(
        base_url=settings.LLM_BASE_URL,
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
    )
    return TrendingService(client)


# ============== 热点抓取 & 分析 ==============

@router.get("/hotspots", response_model=HotspotListResponse)
async def get_hotspots(
    sources: Optional[str] = Query(None, description="逗号分隔的来源，默认全部"),
    db: AsyncSession = Depends(get_db),
):
    """获取当前热点列表（不含 AI 分析）"""
    source_list = [s.strip() for s in sources.split(",")] if sources else None
    service = TrendingService(
        LLMClient(
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
            model=settings.LLM_MODEL,
        )
    )
    try:
        items = await service.fetch_hotspots(db, sources=source_list)
        return HotspotListResponse(data=items)
    except Exception as e:
        logger.error("获取热点失败: %s", e)
        raise HTTPException(status_code=500, detail="获取热点失败，请稍后重试")


@router.post("/analyze", response_model=TrendingAnalysisResponse)
async def analyze_trending(
    data: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    service: TrendingService = Depends(get_trending_service),
):
    """分析热点事件（双模式）
    
    模式1 — 自动抓取热搜: {"sources": ["weibo"], "force_refresh": false}
    模式2 — 用户自定义事件: {"custom_event": {"title": "...", "description": "..."}}
    """
    try:
        analyses: list[TrendingAnalysis] = []

        # 模式2: 用户自定义事件
        if data.custom_event:
            custom = data.custom_event
            if not custom.title or not custom.description:
                raise HTTPException(status_code=400, detail="标题和描述不能为空")
            if len(custom.title) < 1 or len(custom.title) > 30:
                raise HTTPException(status_code=400, detail="标题长度需在 1-30 字之间")
            if len(custom.description) < 10 or len(custom.description) > 500:
                raise HTTPException(status_code=400, detail="描述长度需在 10-500 字之间")

            analysis = await service.analyze_and_save_custom_event(db, custom)
            analyses.append(analysis)
            return TrendingAnalysisResponse(data=analyses)

        # 模式1: 自动抓取热搜
        source_list = data.sources if data.sources else None
        hotspots = await service.fetch_hotspots(
            db, sources=source_list, force_refresh=data.force_refresh,
        )

        if not hotspots:
            return TrendingAnalysisResponse(
                code=0, message="暂无热搜数据", data=[]
            )

        # 对每个热点生成 AI 分析
        for hotspot in hotspots:
            suggestions = await service.analyze_hotspot(db, hotspot)
            analyses.append(TrendingAnalysis(
                event=hotspot,
                suggestions=suggestions,
                analysis_summary=f"从「{hotspot.title}」提取了 {len(suggestions)} 个创作方向",
            ))

        return TrendingAnalysisResponse(data=analyses)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("分析热点失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


# ============== 确认创作方向 ==============

@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_trending(
    data: TrendingConfirmRequest,
    db: AsyncSession = Depends(get_db),
    service: TrendingService = Depends(get_trending_service),
):
    """确认创作方向，自动创建 Novel + CategoryConfig + ShortStorySetting"""
    try:
        result = await service.confirm_and_create(
            db,
            event=data.event,
            suggestion=data.suggestion,
            target_length=data.target_length,
        )
        return ConfirmResponse(data=result)
    except Exception as e:
        logger.error("确认创作方向失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


# ============== 持久化查询 ==============

@router.get("/stored", response_model=HotspotStoredListResponse)
async def get_stored_hotspots(
    source: Optional[str] = Query(None, description="来源过滤"),
    tag: Optional[str] = Query(None, description="标签过滤"),
    genre: Optional[str] = Query(None, description="题材过滤"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    sort_by: Optional[str] = Query("fetched_at", description="排序字段: fetched_at | usage_count"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    service: TrendingService = Depends(get_trending_service),
):
    """查询已存储的热点事件列表（默认按时间倒序）"""
    try:
        events, total = await service.get_stored_hotspots(db, {
            "source": source,
            "tag": tag,
            "genre": genre,
            "keyword": keyword,
            "sort_by": sort_by,
            "page": page,
            "page_size": page_size,
        })
        data = []
        for ev in events:
            ai_sug = None
            if ev.ai_suggestions:
                ai_sug = [CreativeSuggestion(**s) for s in ev.ai_suggestions]
            data.append(HotspotEventResponse(
                id=ev.id,
                title=ev.title,
                summary=ev.summary,
                source=ev.source,
                source_url=ev.source_url,
                rank=ev.rank,
                ai_suggestions=ai_sug,
                analysis_summary=ev.analysis_summary,
                tags=ev.tags,
                usage_count=ev.usage_count,
                fetched_at=ev.fetched_at,
                created_at=ev.created_at,
                updated_at=ev.updated_at,
            ))
        return HotspotStoredListResponse(
            data=data, total=total, page=page, page_size=page_size,
        )
    except Exception as e:
        logger.error("查询存储热点失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/stored/{event_id}", response_model=HotspotDetailResponse)
async def get_stored_hotspot_detail(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    service: TrendingService = Depends(get_trending_service),
):
    """获取单个存储的热点事件详情"""
    try:
        ev = await service.get_stored_hotspot_detail(db, event_id)
        if not ev:
            raise HTTPException(status_code=404, detail="热点事件不存在")
        ai_sug = None
        if ev.ai_suggestions:
            ai_sug = [CreativeSuggestion(**s) for s in ev.ai_suggestions]
        return HotspotDetailResponse(data=HotspotEventResponse(
            id=ev.id,
            title=ev.title,
            summary=ev.summary,
            source=ev.source,
            source_url=ev.source_url,
            rank=ev.rank,
            ai_suggestions=ai_sug,
            analysis_summary=ev.analysis_summary,
            tags=ev.tags,
            usage_count=ev.usage_count,
            fetched_at=ev.fetched_at,
            created_at=ev.created_at,
            updated_at=ev.updated_at,
        ))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取存储热点详情失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/stored/{event_id}/use", response_model=UseMarkResponse)
async def mark_hotspot_used(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    service: TrendingService = Depends(get_trending_service),
):
    """标记事件被使用（usage_count +1）"""
    try:
        await service.mark_used(db, event_id)
        return UseMarkResponse()
    except Exception as e:
        logger.error("标记使用失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")
