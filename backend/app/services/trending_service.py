"""
热点事件分析与创作建议服务
- 自动抓取微博/百度/知乎热搜
- AI 分析热点生成创作建议
- DB 缓存与持久化
- 用户自定义事件分析
"""
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select, update, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HotspotEvent, Novel, ShortStoryCategory, ShortStorySetting
from app.core.llm_client import LLMClient
from app.schemas.trending import (
    HotspotItem, CustomEvent, CreativeSuggestion, TrendingAnalysis,
)

logger = logging.getLogger("fanqie_novel.trending")


# ============== Prompt 模板 ==============

HOTSPOT_PROMPT = """你是一位经验丰富的短篇小说编辑，擅长从社会热点事件中提取创作灵感。

请分析以下热点事件，从中提取 {count} 个不同的短篇小说创作方向：

【热点事件】
标题：{title}
摘要：{summary}

【分析要求】
1. 提取事件中的核心冲突、人性张力、道德困境
2. 每个创作方向要包含：
   - 题材/分类（如：都市、悬疑、情感、科幻、古言等番茄平台分类）
   - 核心爽点描述（一句话）
   - 爽点标题（10-15字）
   - 剧情方向简述（2-3句话）
   - 目标情绪（爽/虐/甜/逆袭/反转等）
3. 方向之间要有显著差异（不同题材、不同视角、不同结局）
4. 短篇小说要求：快速进入冲突、集中爆发、有力收尾

【输出格式 - 纯 JSON】
{{
  "suggestions": [
    {{ "suggestion_id": 1, "genre": "...", "hook_description": "...",
       "hook_title": "...", "plot_direction": "...", "emotional_target": "..." }}
  ]
}}"""

CUSTOM_EVENT_PROMPT = """你是一位经验丰富的短篇小说编辑，擅长从生活中各种事件提炼创作灵感。

用户讲述了ta身边发生或听说的一个事件，请从中提取 {count} 个短篇小说创作方向：

【用户描述的事件】
标题：{title}
详情：{description}

【分析要求】
1. 即使事件看似普通，也要挖掘其中的冲突、张力、情感爆发点
2. 可以适度夸张、改编、嫁接——目的是创作好看的小说,不是复述事件
3. 每个创作方向要包含：
   - 题材/分类（如：都市、悬疑、情感、科幻、古言、职场等）
   - 核心爽点描述（一句话）
   - 爽点标题（10-15字）
   - 剧情方向简述（2-3句话）
   - 目标情绪（爽/虐/甜/逆袭/反转/共鸣等）
4. 方向之间要有显著差异（不同题材、不同视角、不同结局）
5. 短篇小说要求：快速进入冲突、集中爆发、有力收尾

【输出格式 - 纯 JSON】
{{
  "suggestions": [
    {{ "suggestion_id": 1, "genre": "...", "hook_description": "...",
       "hook_title": "...", "plot_direction": "...", "emotional_target": "..." }}
  ]
}}"""

# 自动提取标签的 prompt
TAGS_PROMPT = """从以下创作建议中提取 3-5 个最能代表故事方向的简短标签（如：复仇、逆袭、家庭伦理、悬疑推理等）：

事件标题：{title}
创作建议列表：
{suggestions_text}

请只输出 JSON 数组：["标签1", "标签2", ...]"""

# 入库前 AI 筛选 prompt — 批量判断热搜是否适合小说创作
FILTER_PROMPT = """你是一位短篇小说编辑。请逐个判断以下热搜标题是否适合改编成短篇小说。

【适合】的条件（满足任一项即可）：
- 事件包含可挖掘的人物冲突、人性张力、道德困境
- 事件可以展开成有起承转合的故事情节（情感、悬疑、逆袭、伦理等）
- 奇闻异事、社会现象、争议话题、热点人物故事

【不适合】的条件（满足任一项即排除）：
- 纯领导行程、会议报道、政策文件发布
- 纯数据统计、榜单排名（无人物故事）
- 纯商业产品发布、品牌广告
- 纯体育比赛结果（仅比分通报、淘汰赛结果，无人物延伸）
- 过于抽象的政治口号、理论论述、官方纪念宣传
- 纯社会礼仪、节日祝福、常规人事变动

示例：
- "男子为救女童被刺身亡" → 适合（英雄牺牲、道德困境）
- "德国点球大战 4-5 不敌巴拉圭遭淘汰" → 不适合（纯体育比分结果）
- "一起重温伟大建党精神" → 不适合（抽象政治口号）

请严格按 JSON 数组格式输出，每个元素包含 title、suitable(bool)、reason(简短说明):
[{ "title": "热搜标题", "suitable": true, "reason": "有人物冲突" }]

热搜列表：
{titles_text}"""


# 兜底关键词过滤：明显不适合小说创作的体育/政治/榜单类
_UNSUITABLE_KEYWORDS = [
    # 体育比分与赛果
    "点球大战", "世界杯", "淘汰赛", "不敌", "止步", "晋级", "惜败", "憾负", "比分",
    # 抽象政治与官方纪念
    "建党精神", "重要讲话精神",
    # 纯榜单与排名
    r"排行榜", r"榜单", r"TOP\d+", r"top\d+",
]
_UNSUITABLE_PATTERNS = [re.compile(kw, re.IGNORECASE) for kw in _UNSUITABLE_KEYWORDS]


def _is_obviously_unsuitable(title: str) -> bool:
    """关键词兜底：命中明显非故事类的直接排除"""
    for pat in _UNSUITABLE_PATTERNS:
        if pat.search(title):
            return True
    return False


async def _batch_filter_hotspots(llm: "LLMClient", items: list) -> list:
    """批量 AI 筛选：只保留适合小说创作的热搜"""
    if not items:
        return items

    # 第一层：关键词兜底过滤
    pre_filtered = [it for it in items if not _is_obviously_unsuitable(it.title)]
    removed_by_keyword = len(items) - len(pre_filtered)
    if removed_by_keyword:
        logger.info("关键词兜底排除: %d", removed_by_keyword)

    if not pre_filtered:
        return []

    # 构建标题列表文本
    titles_text = "\n".join(
        f"{i+1}. [{it.source}] {it.title}"
        for i, it in enumerate(pre_filtered)
    )

    try:
        messages = [
            {"role": "system", "content": "你是一位短篇小说编辑，擅长判断事件是否具备创作潜力。请严格按 JSON 数组格式输出，不要额外文字。"},
            {"role": "user", "content": FILTER_PROMPT.format(titles_text=titles_text)},
        ]
        response = await llm.chat(messages, max_tokens=1000)
        content = response["choices"][0]["message"]["content"]

        # 提取 JSON
        json_start = content.find("[")
        json_end = content.rfind("]") + 1
        if json_start < 0 or json_end <= json_start:
            logger.warning("AI筛选返回格式异常，按关键词兜底结果保留: %s", content[:200])
            return pre_filtered

        results = json.loads(content[json_start:json_end])

        # 按标题匹配筛选（严格模式：未匹配到的默认排除）
        passed = []
        failed_count = 0
        for it in pre_filtered:
            matched = None
            for r in results:
                if isinstance(r, dict) and r.get("title", "").strip() == it.title.strip():
                    matched = r
                    break
            if matched is None:
                logger.debug("AI筛选未匹配，默认排除: [%s] %s", it.source, it.title)
                failed_count += 1
            elif matched.get("suitable", True):
                passed.append(it)
            else:
                logger.info("AI筛选排除: [%s] %s — %s", it.source, it.title, matched.get("reason", ""))
                failed_count += 1

        logger.info("AI筛选完成: 输入%d, 保留%d, 排除%d", len(pre_filtered), len(passed), failed_count)
        return passed

    except Exception as e:
        logger.warning("AI筛选异常，按关键词兜底结果保留: %s", e)
        return pre_filtered


# ============== 热搜抓取 ==============

# 热搜数据源配置
HOTSPOT_SOURCES = {
    "weibo": {
        "name": "微博热搜",
        "url": "https://weibo.com/ajax/side/hotSearch",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
        },
    },
    "baidu": {
        "name": "百度热搜",
        "url": "https://top.baidu.com/board?tab=realtime",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    },
    "zhihu": {
        "name": "知乎热榜",
        "url": "https://api.zhihu.com/topstory/hot-lists/total?limit=50",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
        },
    },
}


async def _fetch_weibo() -> List[HotspotItem]:
    """抓取微博热搜"""
    source = HOTSPOT_SOURCES["weibo"]
    headers = {
        **source["headers"],
        "Referer": "https://weibo.com/",
        "Cookie": "SUB=_2AkMRDmhQf8NxqwFRmP4Ty2ribY9-wgDEieKlrYYjJRMxHRl-yT9kqmgNtQs4JEXQpLerrwE7BntJmaQfBGHVa5nREfIj;",
    }
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.get(source["url"], headers=headers)
        data = resp.json()
        if not data.get("ok"):
            logger.warning("微博API返回异常: %s", data)
            return []
        items = []
        realtime = data.get("data", {}).get("realtime", [])
        for i, item in enumerate(realtime[:20], 1):
            word = (item.get("word") or "").strip()
            if not word:
                continue
            # 尝试获取更丰富的摘要
            summary = (item.get("note") or item.get("word_scheme") or word).strip()
            items.append(HotspotItem(
                title=word,
                summary=summary,
                source="weibo",
                url=f"https://s.weibo.com/weibo?q={word}",
                rank=i,
            ))
        return items


async def _fetch_baidu() -> List[HotspotItem]:
    """抓取百度热搜"""
    source = HOTSPOT_SOURCES["baidu"]
    items = []
    try:
        from html import unescape as html_unescape


        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            resp = await client.get(source["url"], headers=source["headers"])
            html = resp.text

            # 百度热搜数据在 <!--s-data:{...}--> HTML 注释中
            m = re.search(r'<!--s-data:(.+?)-->', html)
            if not m:
                logger.warning("百度热搜: 未找到 s-data 注释")
                return items

            raw_json = html_unescape(m.group(1))
            data = json.loads(raw_json)
            cards = data.get("data", {}).get("cards", [])
            content_list = []
            for card in cards:
                if card.get("component") == "hotList":
                    content_list = card.get("content", [])
                    break

            for i, item in enumerate(content_list[:20], 1):
                word = (item.get("query") or item.get("word") or "").strip()
                if not word:
                    continue
                desc = (item.get("desc") or "").strip()
                url = item.get("url") or f"https://www.baidu.com/s?wd={word}"
                items.append(HotspotItem(
                    title=word,
                    summary=desc if desc else word,
                    source="baidu",
                    url=url,
                    rank=i,
                ))
    except Exception as e:
        logger.warning("百度热搜解析异常: %s", e)
    return items


async def _fetch_zhihu() -> List[HotspotItem]:
    """抓取知乎热榜"""
    source = HOTSPOT_SOURCES["zhihu"]
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.get(source["url"], headers=source["headers"])
        data = resp.json()
        items = []
        hot_list = data.get("data", [])
        for i, item in enumerate(hot_list[:20], 1):
            target = item.get("target", {})
            title = target.get("title", "").strip()
            # 新版 API 中 excerpt 在 target 中，旧版可能在 target 外
            excerpt = (target.get("excerpt") or item.get("excerpt") or "").strip()
            if not title:
                continue
            target_id = target.get("id", "")
            # 构建可访问的 URL
            if target.get("url"):
                url = target["url"].replace("api.zhihu.com", "www.zhihu.com")
            else:
                url = f"https://www.zhihu.com/question/{target_id}" if target_id else ""
            items.append(HotspotItem(
                title=title,
                summary=excerpt if excerpt else title,
                source="zhihu",
                url=url,
                rank=i,
            ))
        return items


SOURCE_FETCHERS = {
    "weibo": _fetch_weibo,
    "baidu": _fetch_baidu,
    "zhihu": _fetch_zhihu,
}


# ============== TrendingService ==============

class TrendingService:
    """热点事件分析与创作建议服务"""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def fetch_hotspots(
        self, db: AsyncSession,
        sources: List[str] = None,
        force_refresh: bool = False,
        filter_unsuitable: bool = True,
    ) -> List[HotspotItem]:
        """抓取当前热点事件列表（优先DB缓存）
        
        Args:
            filter_unsuitable: 是否用 AI 过滤不适合小说创作的热搜（默认开启）
        """
        if sources is None:
            sources = ["weibo", "baidu", "zhihu"]

        all_items: List[HotspotItem] = []

        if not force_refresh:
            # 先从 DB 查缓存（30分钟 TTL），同时用关键词兜底过滤旧数据
            threshold = datetime.utcnow() - timedelta(minutes=30)
            for source in list(sources):
                result = await db.execute(
                    select(HotspotEvent)
                    .where(HotspotEvent.source == source)
                    .where(HotspotEvent.fetched_at >= threshold)
                    .order_by(HotspotEvent.rank.asc())
                )
                cached = result.scalars().all()
                if cached:
                    kept = 0
                    for ev in cached:
                        item = HotspotItem(
                            title=ev.title,
                            summary=ev.summary or ev.title,
                            source=ev.source,
                            url=ev.source_url or "",
                            rank=ev.rank,
                        )
                        if _is_obviously_unsuitable(item.title):
                            logger.debug("缓存命中但命中兜底关键词，跳过: [%s] %s", item.source, item.title)
                            continue
                        all_items.append(item)
                        kept += 1
                    if kept > 0:
                        logger.info("热点缓存命中: source=%s, count=%d", source, kept)
                        # 从待抓取列表中移除已缓存的源
                        sources = [s for s in sources if s != source]

        # 抓取未缓存的源，按优先级依次尝试
        for source in sources:
            items = await self._fetch_from_source(source)
            if items:
                # 入库前 AI 筛选：排除不适合小说创作的热搜
                if filter_unsuitable and self.llm:
                    items = await _batch_filter_hotspots(self.llm, items)
                all_items.extend(items)
                # 写入/更新 DB
                for item in items:
                    await self._upsert_event(db, item)

        # 按 rank 排序
        all_items.sort(key=lambda x: x.rank)
        return all_items

    async def _fetch_from_source(self, source: str) -> List[HotspotItem]:
        """从指定源抓取，失败时 fallback"""
        if source not in SOURCE_FETCHERS:
            logger.warning("未知热搜源: %s", source)
            return []

        fetcher = SOURCE_FETCHERS[source]
        try:
            items = await fetcher()
            logger.info("热搜抓取成功: source=%s, count=%d", source, len(items))
            return items
        except Exception as e:
            logger.warning("热搜抓取失败: source=%s, error=%s", source, e)
            return []

    async def _upsert_event(self, db: AsyncSession, item: HotspotItem):
        """写入或更新热点事件到DB"""
        result = await db.execute(
            select(HotspotEvent)
            .where(HotspotEvent.title == item.title)
            .where(HotspotEvent.source == item.source)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.rank = item.rank
            existing.summary = item.summary
            existing.source_url = item.url
            existing.fetched_at = datetime.utcnow()
        else:
            event = HotspotEvent(
                title=item.title,
                summary=item.summary,
                source=item.source,
                source_url=item.url,
                rank=item.rank,
                fetched_at=datetime.utcnow(),
            )
            db.add(event)
        await db.commit()

    async def analyze_hotspot(
        self, db: AsyncSession, hotspot: HotspotItem
    ) -> List[CreativeSuggestion]:
        """用 LLM 分析热点并持久化结果"""
        # 先查 DB 是否已有分析
        result = await db.execute(
            select(HotspotEvent)
            .where(HotspotEvent.title == hotspot.title)
            .where(HotspotEvent.source == hotspot.source)
        )
        event = result.scalar_one_or_none()

        if event and event.ai_suggestions:
            logger.info("AI 建议缓存命中: %s", hotspot.title)
            return [CreativeSuggestion(**s) for s in event.ai_suggestions]

        # 调用 LLM
        suggestions = await self._llm_generate_suggestions(
            HOTSPOT_PROMPT.format(
                count=3, title=hotspot.title, summary=hotspot.summary
            )
        )

        # 自动提取标签
        tags = await self._extract_tags(hotspot.title, suggestions)

        # 持久化到 DB
        if event:
            event.ai_suggestions = [s.dict() for s in suggestions]
            event.tags = tags
            event.analysis_summary = f"从「{hotspot.title}」提取了 {len(suggestions)} 个创作方向"
            event.updated_at = datetime.utcnow()
        else:
            event = HotspotEvent(
                title=hotspot.title,
                summary=hotspot.summary,
                source=hotspot.source,
                source_url=hotspot.url,
                rank=hotspot.rank,
                ai_suggestions=[s.dict() for s in suggestions],
                tags=tags,
                analysis_summary=f"从「{hotspot.title}」提取了 {len(suggestions)} 个创作方向",
            )
            db.add(event)
        await db.commit()

        return suggestions

    async def analyze_and_save_custom_event(
        self, db: AsyncSession, event: CustomEvent
    ) -> TrendingAnalysis:
        """分析用户自定义事件并存入DB"""
        # 调用 LLM 生成建议
        suggestions = await self._llm_generate_suggestions(
            CUSTOM_EVENT_PROMPT.format(
                count=3, title=event.title, description=event.description
            )
        )

        # 包装成 HotspotItem
        hotspot = HotspotItem(
            title=event.title,
            summary=event.description,
            source="user_input",
            url="",
            rank=0,
        )

        # 自动提取标签
        tags = await self._extract_tags(event.title, suggestions)

        # 存入 DB
        db_event = HotspotEvent(
            title=event.title,
            summary=event.description,
            source="user_input",
            ai_suggestions=[s.dict() for s in suggestions],
            tags=tags,
            analysis_summary=f"从用户输入「{event.title}」提取了 {len(suggestions)} 个创作方向",
        )
        db.add(db_event)
        await db.commit()

        return TrendingAnalysis(
            event=hotspot,
            suggestions=suggestions,
            analysis_summary=f"从「{event.title}」提取了 {len(suggestions)} 个创作方向",
        )

    async def _llm_generate_suggestions(self, prompt: str) -> List[CreativeSuggestion]:
        """调用 LLM 生成创作建议"""
        messages = [
            {"role": "system", "content": "你是一位专业的短篇小说编辑，擅长从各类事件中提取创作灵感。请严格按照 JSON 格式输出。"},
            {"role": "user", "content": prompt},
        ]
        response = await self.llm.chat(messages, max_tokens=2000)
        content = response["choices"][0]["message"]["content"]

        # 提取 JSON
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
        else:
            json_str = content

        data = json.loads(json_str)
        suggestions = [CreativeSuggestion(**s) for s in data.get("suggestions", [])]
        return suggestions

    async def _extract_tags(self, title: str, suggestions: List[CreativeSuggestion]) -> List[str]:
        """从创作建议中自动提取标签"""
        try:
            suggestions_text = "\n".join(
                f"- {s.genre}·{s.emotional_target}: {s.hook_title}"
                for s in suggestions
            )
            prompt = TAGS_PROMPT.format(title=title, suggestions_text=suggestions_text)
            messages = [
                {"role": "system", "content": "你是一个标签提取助手，只输出 JSON 数组。"},
                {"role": "user", "content": prompt},
            ]
            response = await self.llm.chat(messages, max_tokens=200)
            content = response["choices"][0]["message"]["content"].strip()
            json_start = content.find("[")
            json_end = content.rfind("]") + 1
            if json_start >= 0 and json_end > json_start:
                return json.loads(content[json_start:json_end])
        except Exception:
            pass
        # fallback: 从情绪和题材组合
        return list(set(s.emotional_target for s in suggestions) | set(s.genre for s in suggestions))

    async def get_stored_hotspots(
        self, db: AsyncSession, filters: dict
    ) -> Tuple[List[HotspotEvent], int]:
        """分页查询已存储的热点事件"""
        page = filters.get("page", 1)
        page_size = filters.get("page_size", 20)
        source = filters.get("source")
        tag = filters.get("tag")
        genre = filters.get("genre")
        keyword = filters.get("keyword")

        query = select(HotspotEvent)
        count_query = select(func.count(HotspotEvent.id))

        conditions = []
        if source:
            conditions.append(HotspotEvent.source == source)
        if keyword:
            conditions.append(
                or_(
                    HotspotEvent.title.ilike(f"%{keyword}%"),
                    HotspotEvent.summary.ilike(f"%{keyword}%"),
                )
            )

        # tag 过滤 (JSON 数组)
        if tag:
            conditions.append(
                HotspotEvent.tags.isnot(None)
            )
            # 使用 SQLite JSON 函数
            tag_cond = f"EXISTS (SELECT 1 FROM json_each(hotspot_events.tags) WHERE value = '{tag}')"
            query = query.where(tag_cond)
            count_query = count_query.where(tag_cond)

        # genre 过滤 (JSON 对象数组中的 genre 字段)
        if genre:
            conditions.append(
                HotspotEvent.ai_suggestions.isnot(None)
            )
            genre_cond = f"EXISTS (SELECT 1 FROM json_each(hotspot_events.ai_suggestions) WHERE json_extract(value, '$.genre') = '{genre}')"
            query = query.where(genre_cond)
            count_query = count_query.where(genre_cond)

        for cond in conditions:
            query = query.where(cond)
            count_query = count_query.where(cond)

        # 排序: 默认按抓取时间倒序（最新优先）
        sort_by = filters.get("sort_by", "fetched_at")
        if sort_by == "usage_count":
            query = query.order_by(HotspotEvent.usage_count.desc(), HotspotEvent.fetched_at.desc())
        else:
            query = query.order_by(HotspotEvent.fetched_at.desc())

        # 总数
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        events = result.scalars().all()

        return list(events), total

    async def get_stored_hotspot_detail(
        self, db: AsyncSession, event_id: str
    ) -> Optional[HotspotEvent]:
        """获取单个存储的热点事件详情"""
        result = await db.execute(
            select(HotspotEvent).where(HotspotEvent.id == event_id)
        )
        return result.scalar_one_or_none()

    async def mark_used(self, db: AsyncSession, event_id: str):
        """标记事件被使用（usage_count +1）"""
        await db.execute(
            update(HotspotEvent)
            .where(HotspotEvent.id == event_id)
            .values(usage_count=HotspotEvent.usage_count + 1)
        )
        await db.commit()

    async def confirm_and_create(
        self, db: AsyncSession,
        event: HotspotItem,
        suggestion: CreativeSuggestion,
        target_length: int = 8000,
    ) -> Dict:
        """确认创作方向并自动创建 Novel + CategoryConfig + ShortStorySetting"""
        # 1. 创建 Novel
        novel = Novel(
            title=event.title[:255],
            type="short",
            genre=suggestion.genre,
            target_word_count=target_length,
            status="draft",
        )
        db.add(novel)
        await db.flush()  # 获取 novel.id

        # 2. 创建 CategoryConfig
        category_config = ShortStoryCategory(
            novel_id=novel.id,
            main_category=suggestion.genre,
            gender_orientation="通用",
            emotion_process=suggestion.emotional_target,
            plot_tags=[suggestion.genre],
        )
        db.add(category_config)
        await db.flush()

        # 3. 创建 ShortStorySetting
        setting = ShortStorySetting(
            novel_id=novel.id,
            category_config_id=category_config.id,
            core_hook=suggestion.hook_description,
            hook_category=suggestion.genre,
            emotional_target=suggestion.emotional_target,
            target_length=target_length,
            plot_summary=suggestion.plot_direction,
        )
        db.add(setting)
        await db.commit()

        # 标记事件被使用
        result = await db.execute(
            select(HotspotEvent)
            .where(HotspotEvent.title == event.title)
            .where(HotspotEvent.source == event.source)
        )
        db_event = result.scalar_one_or_none()
        if db_event:
            await self.mark_used(db, db_event.id)

        logger.info("确认创作方向: novel_id=%s, title=%s", novel.id, novel.title)

        return {
            "novel_id": novel.id,
            "title": novel.title,
            "genre": novel.genre,
            "target_word_count": novel.target_word_count,
        }
