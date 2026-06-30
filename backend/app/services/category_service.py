"""
分类标签服务
从独立 JSON 文件加载分类数据，提供分类配置 CRUD
纯本地运行版本
"""
import json
from typing import Dict, List, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import ShortStoryCategory
from app.schemas import CategoryConfigCreate, CategoryConfigUpdate
from app.config import RESOURCE_DATA_DIR, USER_DATA_DIR
from app.core.logging_config import get_logger

logger = get_logger("fanqie_novel.category_service")


class CategoryService:
    """分类标签服务"""

    _category_metadata: Optional[Dict[str, Any]] = None

    # ── 通用文件加载器 ──────────────────────────────────────
    @staticmethod
    def _load_json(filename: str, writable: bool = False) -> Any:
        """加载 JSON 文件，writable=True 时从用户数据目录读取"""
        base = USER_DATA_DIR if writable else RESOURCE_DATA_DIR
        path = base / filename
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            if writable:
                return None  # 用户自定义文件不存在是正常的
            logger.error("分类数据文件未找到: %s", path)
            return None
        except json.JSONDecodeError as e:
            logger.error("解析 %s 失败: %s", filename, e)
            return None

    @staticmethod
    def _save_json(filename: str, data: Any) -> None:
        """保存 JSON 到用户数据目录"""
        path = USER_DATA_DIR / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("用户自定义数据已保存: %s", path)

    # ── 用户自定义数据加载/保存 ─────────────────────────────
    _USER_PLOTS_FILE = "情节分类-用户自定义.json"
    _USER_CHARS_FILE = "角色关键词-用户自定义.json"

    @classmethod
    def _load_user_plots(cls) -> List[Dict[str, Any]]:
        """加载用户自定义的情节分类"""
        data = cls._load_json(cls._USER_PLOTS_FILE, writable=True)
        if not data or not isinstance(data, list):
            return []
        return data

    @classmethod
    def _load_user_chars(cls) -> List[str]:
        """加载用户自定义的角色关键词"""
        data = cls._load_json(cls._USER_CHARS_FILE, writable=True)
        if not data or not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, str)]

    @classmethod
    def save_user_plots(cls, plots: List[Dict[str, Any]]) -> None:
        """保存用户自定义情节分类并刷新缓存"""
        cls._save_json(cls._USER_PLOTS_FILE, plots)
        cls.invalidate_cache()

    @classmethod
    def save_user_chars(cls, chars: List[str]) -> None:
        """保存用户自定义角色关键词并刷新缓存"""
        cls._save_json(cls._USER_CHARS_FILE, chars)
        cls.invalidate_cache()

    @classmethod
    def get_user_custom_data(cls) -> Dict[str, Any]:
        """获取用户自定义数据的完整快照（供前端初始化）"""
        return {
            "user_plots": cls._load_user_plots(),
            "user_chars": cls._load_user_chars(),
        }

    @classmethod
    def invalidate_cache(cls) -> None:
        """使元数据缓存失效（用户自定义数据变更后调用）"""
        cls._category_metadata = None
        logger.debug("分类元数据缓存已失效")

    @classmethod
    def _load_main_categories(cls) -> List[Dict[str, str]]:
        """从「故事分类.json」加载主分类"""
        data = cls._load_json("故事分类.json")
        if not data or not isinstance(data, dict):
            return []
        categories = []
        for gender, info in data.items():
            if isinstance(info, dict):
                for name in info.get("category", []):
                    categories.append({"name": name, "description": "", "gender": gender})
        return categories

    @classmethod
    def _load_plot_categories(cls) -> List[Dict[str, Any]]:
        """从「情节分类.json」加载情节分类，合并用户自定义项"""
        data = cls._load_json("情节分类.json")
        if not data or not isinstance(data, list):
            return []

        # 内置情节分类
        plot_categories = []
        builtin_keys: set = set()
        for item in data:
            if isinstance(item, dict):
                lv2 = item.get("level2", "")
                lv3 = item.get("level3", "")
                builtin_keys.add(lv3)
                plot_categories.append({
                    "level1": lv2,
                    "level2": lv2,
                    "level3": lv3,
                    "tags": item.get("tags", []),
                    "remark": item.get("remark", ""),
                })

        # 合并用户自定义情节（去重：已存在的不追加）
        for item in cls._load_user_plots():
            if isinstance(item, dict):
                lv2 = item.get("level2", "自定义")
                lv3 = item.get("level3", "")
                if lv3 and lv3 not in builtin_keys:
                    plot_categories.append({
                        "level1": lv2,
                        "level2": lv2,
                        "level3": lv3,
                        "tags": item.get("tags", []),
                        "remark": item.get("remark", ""),
                    })

        return plot_categories

    @classmethod
    def _load_character_tags(cls) -> List[str]:
        """从「角色关键词.json」加载角色关键词，合并用户自定义项"""
        data = cls._load_json("角色关键词.json")
        builtin: List[str] = []
        if data and isinstance(data, list):
            builtin = [item for item in data if isinstance(item, str)]

        builtin_set = set(builtin)
        # 合并用户自定义关键词
        for tag in cls._load_user_chars():
            if tag not in builtin_set:
                builtin.append(tag)

        return builtin

    @classmethod
    def _load_emotion_processes(cls) -> List[str]:
        """从「情绪过程.json」加载情绪过程"""
        data = cls._load_json("情绪过程.json")
        if not data or not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, str)]

    @classmethod
    def _load_story_backgrounds(cls) -> List[str]:
        """从「故事背景.json」加载故事背景"""
        data = cls._load_json("故事背景.json")
        if not data or not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, str)]

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        """获取分类元数据（缓存）"""
        if cls._category_metadata is not None:
            return cls._category_metadata

        cls._category_metadata = {
            "main_categories": cls._load_main_categories(),
            "plot_categories": cls._load_plot_categories(),
            "character_tags": cls._load_character_tags(),
            "emotion_processes": cls._load_emotion_processes(),
            "story_backgrounds": cls._load_story_backgrounds(),
        }
        return cls._category_metadata

    @classmethod
    def get_main_category_description(cls, name: str) -> str:
        """获取主分类描述"""
        for cat in cls._load_main_categories():
            if cat["name"] == name:
                return cat.get("description", "")
        return ""

    @classmethod
    def get_plot_tag_requirements(cls, tags: Optional[List[str]]) -> str:
        """获取情节标签要求描述（兼容旧版与新版数据格式）"""
        if not tags:
            return "  - 按情节自然发展"

        plot_data = cls._load_plot_categories()
        requirements = []
        for item in plot_data:
            if item["level3"] in tags:
                tag_list = "、".join(item.get("tags", [])) if item.get("tags") else ""
                remark = f" ({item['remark']})" if item.get("remark") else ""
                requirements.append(f"  - {item['level3']}：{tag_list}{remark}")

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
