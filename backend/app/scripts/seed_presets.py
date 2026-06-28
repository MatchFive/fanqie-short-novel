"""
预设库种子数据初始化脚本
运行方式：python -m app.scripts.seed_presets
"""

import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import PresetHook, PresetCharacterName
from app.core.preset_data import PRESET_HOOKS, generate_character_names
from app.core.logging_config import get_logger

logger = get_logger("fanqie_novel.seed_presets")


async def seed_preset_hooks(db: AsyncSession):
    """初始化爽点库"""
    result = await db.execute(select(PresetHook))
    existing = result.scalars().all()

    if existing:
        logger.info("爽点库已有 %d 条数据，跳过初始化", len(existing))
        return

    for hook_data in PRESET_HOOKS:
        hook = PresetHook(
            category=hook_data["category"],
            title=hook_data["title"],
            description=hook_data["description"],
            emotional_target=hook_data["emotional_target"],
            example_variants=hook_data.get("example_variants"),
            tags=hook_data.get("tags"),
        )
        db.add(hook)

    await db.commit()
    logger.info("爽点库初始化完成，共 %d 条数据", len(PRESET_HOOKS))


async def seed_preset_character_names(db: AsyncSession):
    """初始化角色名库"""
    result = await db.execute(select(PresetCharacterName))
    existing = result.scalars().all()

    if existing:
        logger.info("角色名库已有 %d 条数据，跳过初始化", len(existing))
        return

    names_data = generate_character_names()

    for name_data in names_data:
        name = PresetCharacterName(
            surname=name_data["surname"],
            name=name_data["name"],
            gender=name_data["gender"],
            style=name_data["style"],
        )
        db.add(name)

    await db.commit()
    logger.info("角色名库初始化完成，共 %d 条数据", len(names_data))


async def seed_all():
    """初始化所有预设库数据"""
    async with AsyncSessionLocal() as db:
        try:
            await seed_preset_hooks(db)
            await seed_preset_character_names(db)
            logger.info("所有预设库数据初始化完成")
        except Exception as e:
            logger.error("预设库初始化失败: %s", e, exc_info=True)
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed_all())
