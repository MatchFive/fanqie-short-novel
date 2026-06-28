"""
数据库模型
SQLAlchemy ORM 模型定义 - 短篇小说专用（SQLite 兼容）
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Novel(Base):
    """小说表"""
    __tablename__ = "novels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False, default="short")  # 固定为 short
    genre = Column(String(50), nullable=True)
    target_word_count = Column(Integer, default=8000)
    status = Column(String(20), default="draft")  # draft / ongoing / completed
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关系
    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")


class Chapter(Base):
    """章节表"""
    __tablename__ = "chapters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, default="")
    summary = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # draft / completed
    word_count = Column(Integer, default=0)
    order_index = Column(Integer, nullable=False)

    # 短篇专属字段
    emotion_target = Column(String(100), nullable=True)
    ending_hook = Column(String(255), nullable=True)
    scenes_covered = Column(JSON, nullable=True)
    core_goal = Column(String(255), nullable=True)
    estimated_words = Column(Integer, nullable=True)
    generation_context = Column(JSON, nullable=True)
    plot_summary = Column(Text, nullable=True)
    chapter_type = Column(String(20), default="main")  # main / extra
    extra_type = Column(String(20), nullable=True)  # background/motivation/aftermath/custom
    review_result = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关系
    novel = relationship("Novel", back_populates="chapters")


class ShortStoryCategory(Base):
    """短篇小说分类标签配置（番茄平台分类体系）"""
    __tablename__ = "short_story_categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)

    main_category = Column(String(50), nullable=False)
    gender_orientation = Column(String(10), nullable=False)
    plot_tags = Column(JSON, nullable=True)
    plot_level1 = Column(String(50), nullable=True)
    plot_level2 = Column(String(50), nullable=True)
    plot_level3 = Column(String(50), nullable=True)
    character_tags = Column(JSON, nullable=True)
    emotion_process = Column(String(50), nullable=True)
    story_background = Column(String(50), nullable=True)
    custom_tags = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    novel = relationship("Novel")


class ShortStorySetting(Base):
    """短篇小说核心设定（Step 1-7 的输出存储）"""
    __tablename__ = "short_story_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    category_config_id = Column(String(36), ForeignKey("short_story_categories.id"), nullable=True)

    # Step 1: 核心爽点
    core_hook = Column(Text, nullable=True)
    hook_category = Column(String(50), nullable=True)
    emotional_target = Column(String(20), nullable=True)

    # Step 2: 基础设定
    narrative_order = Column(String(50), nullable=True)
    plot_summary = Column(Text, nullable=True)
    ending_type = Column(String(50), nullable=True)
    emotion_curve = Column(Text, nullable=True)
    target_length = Column(Integer, default=8000)
    generated_plans = Column(JSON, nullable=True)
    selected_plan_id = Column(Integer, default=1)

    # Step 3: 详细规划
    character_profiles = Column(JSON, nullable=True)
    key_scenes = Column(JSON, nullable=True)
    foreshadowing_twists = Column(JSON, nullable=True)
    narrative_order_detail = Column(Text, nullable=True)

    # 整合修复
    integration_batch_count = Column(Integer, default=0)
    last_integration_result = Column(JSON, nullable=True)

    # 开篇钩子
    opening_hook = Column(JSON, nullable=True)
    opening_hooks_list = Column(JSON, nullable=True)

    # 元数据
    status = Column(String(20), default="draft")  # draft / planned / generating / completed
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    novel = relationship("Novel")


class IntegrationFix(Base):
    """整合修复记录"""
    __tablename__ = "integration_fixes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(Integer, nullable=False, default=1)
    issue_type = Column(String(50), nullable=False)
    issue_description = Column(Text, nullable=False)
    affected_chapters = Column(JSON, nullable=True)  # SQLite: 存 JSON 字符串
    original_text = Column(Text, nullable=False)
    fixed_text = Column(Text, nullable=False)
    fix_reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending / accepted / rejected / modified
    user_modified_text = Column(Text, nullable=True)
    chapter_fixes = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PresetHook(Base):
    """爽点库"""
    __tablename__ = "preset_hooks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    emotional_target = Column(String(20), nullable=False)
    example_variants = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)  # SQLite: 存 JSON 字符串
    usage_count = Column(Integer, default=0)
    source = Column(String(20), default="system")  # system / user

    created_at = Column(DateTime, server_default=func.now())


class PresetCharacterName(Base):
    """角色名库"""
    __tablename__ = "preset_character_names"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    surname = Column(String(10), nullable=False, index=True)
    name = Column(String(10), nullable=False, index=True)
    gender = Column(String(10), nullable=False, index=True)
    style = Column(String(20), nullable=True)
    usage_count = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())
