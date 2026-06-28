"""
分类标签服务
加载番茄短篇分类 JSON 并提供分类配置 CRUD
纯本地运行版本
"""

import json
from typing import Dict, List, Any, Optional
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import ShortStoryCategory
from app.schemas import CategoryConfigCreate, CategoryConfigUpdate
from app.core.logging_config import get_logger

logger = get_logger("fanqie_novel.category_service")


class CategoryService:
    """分类标签服务"""

    _category_data: Optional[Dict[str, Any]] = None

    @classmethod
    def _get_json_path(cls) -> Path:
        """获取分类 JSON 文件路径"""
        return Path(__file__).parent.parent.parent.parent / "data" / "番茄短篇分类.json"

    @classmethod
    def _load_category_data(cls) -> Dict[str, Any]:
        """加载分类 JSON 数据"""
        if cls._category_data is not None:
            return cls._category_data

        json_path = cls._get_json_path()
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                cls._category_data = json.load(f)
        except FileNotFoundError:
            logger.error("番茄短篇分类.json 未找到: %s", json_path)
            cls._category_data = {}
        except json.JSONDecodeError as e:
            logger.error("解析番茄短篇分类.json 失败: %s", e)
            cls._category_data = {}

        return cls._category_data

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        """获取分类元数据"""
        data = cls._load_category_data()

        main_categories = []
        for item in data.get("短篇主分类", [])[1:]:
            if len(item) >= 3:
                main_categories.append({
                    "name": item[0],
                    "description": item[1],
                    "gender": item[2],
                })

        plot_categories = []
        for item in data.get("情节分类", [])[1:]:
            if len(item) >= 4:
                plot_categories.append({
                    "level1": item[0],
                    "level2": item[1],
                    "level3": item[2],
                    "tags": [t.strip() for t in item[3].split("、") if t.strip()] if item[3] else [],
                    "remark": item[4] if len(item) > 4 else "",
                })

        character_tags = [item[0] for item in data.get("角色关键词", []) if item]
        emotion_processes = [item[0] for item in data.get("情绪过程", []) if item]
        story_backgrounds = [item[0] for item in data.get("故事主要背景", []) if item]

        return {
            "main_categories": main_categories,
            "plot_categories": plot_categories,
            "character_tags": character_tags,
            "emotion_processes": emotion_processes,
            "story_backgrounds": story_backgrounds,
        }

    @classmethod
    def get_main_category_description(cls, name: str) -> str:
        """获取主分类描述"""
        data = cls._load_category_data()
        for item in data.get("短篇主分类", [])[1:]:
            if len(item) >= 2 and item[0] == name:
                return item[1]
        return ""

    @classmethod
    def get_plot_tag_requirements(cls, tags: Optional[List[str]]) -> str:
        """获取情节标签要求描述"""
        if not tags:
            return "  - 按情节自然发展"

        data = cls._load_category_data()
        requirements = []
        for item in data.get("情节分类", [])[1:]:
            if len(item) >= 4 and item[2] in tags:
                tag_list = "、".join([t.strip() for t in item[3].split("、") if t.strip()]) if item[3] else ""
                remark = f" ({item[4]})" if len(item) > 4 and item[4] else ""
                requirements.append(f"  - {item[2]}：{tag_list}{remark}")

        return "\n".join(requirements) if requirements else "  - 按情节自然发展"

    async def create_or_update(
        self, db: AsyncSession, novel_id: str, data: CategoryConfigCreate
    ) -> ShortStoryCategory:
        """创建或更新分类配置"""
        category_data = data.model_dump(exclude={"target_length"})

        # 检查是否存在
        result = await db.execute(
            select(ShortStoryCategory).where(ShortStoryCategory.novel_id == novel_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            for field, value in category_data.items():
                setattr(existing, field, value)
            await db.commit()
            await db.refresh(existing)
            logger.info("更新分类配置: novel_id=%s, main_category=%s", novel_id, data.main_category)
            return existing
        else:
            config = ShortStoryCategory(novel_id=novel_id, **category_data)
            db.add(config)
            await db.commit()
            await db.refresh(config)
            logger.info("创建分类配置: novel_id=%s, main_category=%s", novel_id, data.main_category)
            return config

    async def update(
        self, db: AsyncSession, novel_id: str, data: CategoryConfigUpdate
    ) -> Optional[ShortStoryCategory]:
        """更新分类配置"""
        result = await db.execute(
            select(ShortStoryCategory).where(ShortStoryCategory.novel_id == novel_id)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        logger.info("更新分类配置: novel_id=%s", novel_id)
        return existing

    async def get_by_novel(
        self, db: AsyncSession, novel_id: str
    ) -> Optional[ShortStoryCategory]:
        """获取小说的分类配置"""
        result = await db.execute(
            select(ShortStoryCategory).where(ShortStoryCategory.novel_id == novel_id)
        )
        return result.scalar_one_or_none()
