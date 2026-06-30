"""
Pydantic Schema 定义
短篇小说专用 - 请求/响应模型
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


# ============== Novel ==============

class NovelBase(BaseModel):
    """小说基础字段"""
    title: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default="short", pattern="^(short)$")
    genre: Optional[str] = None
    target_word_count: int = Field(default=8000, ge=0)
    status: str = Field(default="draft", pattern="^(draft|ongoing|completed)$")


class NovelCreate(NovelBase):
    """创建小说请求"""
    pass


class NovelUpdate(BaseModel):
    """更新小说请求"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    genre: Optional[str] = None
    target_word_count: Optional[int] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(draft|ongoing|completed)$")


class NovelResponse(NovelBase):
    """小说响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    word_count: int = 0  # 实际已写字数（聚合章节）


# ============== Chapter ==============

class ChapterBase(BaseModel):
    """章节基础字段"""
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(default="")
    summary: Optional[str] = None
    status: str = Field(default="draft", pattern="^(draft|completed)$")
    word_count: int = Field(default=0, ge=0)
    order_index: int = Field(..., ge=0)


class ChapterCreate(ChapterBase):
    """创建章节请求"""
    novel_id: str


class ChapterUpdate(BaseModel):
    """更新章节请求"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(draft|completed)$")
    word_count: Optional[int] = Field(None, ge=0)
    order_index: Optional[int] = Field(None, ge=0)
    plot_summary: Optional[str] = None
    chapter_type: Optional[str] = Field(None, pattern="^(main|extra)$")
    extra_type: Optional[str] = Field(None, pattern="^(background|motivation|aftermath|custom)$")


class ChapterResponse(ChapterBase):
    """章节响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime
    plot_summary: Optional[str] = None
    chapter_type: Optional[str] = None
    extra_type: Optional[str] = None


# ============== Short Story (短篇小说) ==============

class ShortStorySettingBase(BaseModel):
    """短篇小说设定基础字段"""
    # Step 1: 核心爽点
    core_hook: Optional[str] = None
    hook_category: Optional[str] = None
    emotional_target: Optional[str] = Field(default="爽", pattern="^(爽|甜|虐|惊|暖)$")

    # Step 2: 基础设定
    narrative_order: Optional[str] = Field(None, pattern="^(线性叙事|倒叙|插叙|环形叙事|多视角拼接)$")
    plot_summary: Optional[str] = None
    ending_type: Optional[str] = Field(None, pattern="^(圆满结局|悲剧结局|反转结局|开放式结局|讽刺结局)$")
    emotion_curve: Optional[str] = None
    target_length: int = Field(default=8000, ge=2000, le=30000)
    selected_plan_id: int = Field(default=1, ge=1)

    # Step 3: 详细规划（JSON 结构）
    character_profiles: Optional[Dict[str, Any]] = None
    key_scenes: Optional[List[Dict[str, Any]]] = None
    foreshadowing_twists: Optional[List[Dict[str, Any]]] = None
    narrative_order_detail: Optional[str] = None

    status: str = Field(default="draft", pattern="^(draft|planned|generating|completed)$")


class ShortStorySettingCreate(BaseModel):
    """创建短篇小说设定请求"""
    novel_id: str
    core_hook: Optional[str] = None
    hook_category: Optional[str] = None
    emotional_target: Optional[str] = "爽"


class ShortStorySettingUpdate(BaseModel):
    """更新短篇小说设定请求"""
    core_hook: Optional[str] = None
    hook_category: Optional[str] = None
    emotional_target: Optional[str] = None
    narrative_order: Optional[str] = None
    plot_summary: Optional[str] = None
    ending_type: Optional[str] = None
    emotion_curve: Optional[str] = None
    target_length: Optional[int] = Field(None, ge=2000, le=30000)
    selected_plan_id: Optional[int] = Field(None, ge=1)
    character_profiles: Optional[Dict[str, Any]] = None
    key_scenes: Optional[List[Dict[str, Any]]] = None
    foreshadowing_twists: Optional[List[Dict[str, Any]]] = None
    narrative_order_detail: Optional[str] = None
    generated_plans: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    opening_hook: Optional[Dict[str, Any]] = None


class ShortStorySettingResponse(ShortStorySettingBase):
    """短篇小说设定响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    novel_id: str
    generated_plans: Optional[List[Dict[str, Any]]] = None
    opening_hook: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# ============== 番茄分类标签 ==============

class CategoryConfigCreate(BaseModel):
    """创建分类配置请求"""
    main_category: str = Field(..., min_length=1, max_length=50)
    gender_orientation: str = Field(..., min_length=1, max_length=10)
    plot_tags: Optional[List[str]] = None
    plot_level1: Optional[str] = None
    plot_level2: Optional[str] = None
    plot_level3: Optional[str] = None
    character_tags: Optional[List[str]] = None
    emotion_process: Optional[str] = None
    story_background: Optional[str] = None
    custom_tags: Optional[List[str]] = None
    target_length: Optional[int] = Field(default=8000, ge=2000, le=30000)


class CategoryConfigUpdate(BaseModel):
    """更新分类配置请求"""
    main_category: Optional[str] = Field(None, min_length=1, max_length=50)
    gender_orientation: Optional[str] = Field(None, min_length=1, max_length=10)
    plot_tags: Optional[List[str]] = None
    plot_level1: Optional[str] = None
    plot_level2: Optional[str] = None
    plot_level3: Optional[str] = None
    character_tags: Optional[List[str]] = None
    emotion_process: Optional[str] = None
    story_background: Optional[str] = None
    custom_tags: Optional[List[str]] = None


class CategoryConfigResponse(BaseModel):
    """分类配置响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    novel_id: str
    main_category: str
    gender_orientation: str
    plot_tags: Optional[List[str]] = None
    plot_level1: Optional[str] = None
    plot_level2: Optional[str] = None
    plot_level3: Optional[str] = None
    character_tags: Optional[List[str]] = None
    emotion_process: Optional[str] = None
    story_background: Optional[str] = None
    custom_tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime


class CategoryMetadataResponse(BaseModel):
    """分类元数据响应（用于前端渲染选项）"""
    main_categories: List[Dict[str, str]]
    plot_categories: List[Dict[str, Any]]
    character_tags: List[str]
    emotion_processes: List[str]
    story_backgrounds: List[str]


# ============== AI 生成爽点 ==============

class GenerateHooksRequest(BaseModel):
    """生成爽点请求"""
    count: int = Field(default=3, ge=1, le=5)
    custom_requirement: Optional[str] = None


class GeneratedHook(BaseModel):
    """AI 生成的爽点"""
    hook_id: int
    title: str
    description: str
    emotional_target: str
    why_it_works: str
    tags: List[str]


class GeneratedHooksResponse(BaseModel):
    """生成爽点响应"""
    hooks: List[GeneratedHook]


class SelectHookRequest(BaseModel):
    """选择爽点请求"""
    hook_id: Optional[int] = None
    hook_title: Optional[str] = None
    hook_description: Optional[str] = None
    custom_hook: Optional[str] = None
    emotional_target: Optional[str] = Field(default="爽", pattern="^(爽|甜|虐|惊|暖)$")
    save_to_preset: bool = False


class SaveHookToPresetRequest(BaseModel):
    """保存爽点到预设库请求"""
    hook_title: str
    hook_description: str
    emotional_target: str
    tags: Optional[List[str]] = None


class CoreHookSet(BaseModel):
    """设置核心爽点请求（兼容旧接口）"""
    hook_id: Optional[str] = None          # 预设爽点ID
    custom_hook: Optional[str] = None      # 自定义爽点
    category: Optional[str] = None
    emotional_target: str = Field(default="爽", pattern="^(爽|甜|虐|惊|暖)$")
    save_to_preset: bool = False


class GeneratePlansRequest(BaseModel):
    """生成基础设定方案请求"""
    count: int = Field(default=3, ge=1, le=5)
    target_length: int = Field(default=8000, ge=2000, le=30000)


class Plan(BaseModel):
    """单个方案"""
    plan_id: int
    narrative_order: str
    plot_summary: str
    ending_type: str
    emotion_curve: str
    estimated_length: str
    why_this_works: str


class PlansResponse(BaseModel):
    """方案列表响应"""
    plans: List[Plan]


class SelectPlanRequest(BaseModel):
    """选择方案请求"""
    plan_id: int
    customizations: Optional[Dict[str, Any]] = None


class ChapterGenerateRequest(BaseModel):
    """生成单章请求"""
    feedback: Optional[str] = None  # 用户修改意见（用于重生成）


class StepProgressResponse(BaseModel):
    """步骤进度响应"""
    completed: List[bool]  # 7个步骤的完成状态
    current_step: int      # 当前所在步骤（1-7）


# ============== Preset (预设库) ==============

class PresetHookBase(BaseModel):
    """爽点库基础字段"""
    category: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    emotional_target: str = Field(..., pattern="^(爽|甜|虐|惊|暖)$")
    example_variants: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = Field(default="system", pattern="^(system|user)$")


class PresetHookCreate(PresetHookBase):
    """创建爽点请求"""
    pass


class PresetHookResponse(PresetHookBase):
    """爽点响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    usage_count: int = 0
    created_at: datetime


class PresetHookListResponse(BaseModel):
    """爽点列表响应"""
    model_config = ConfigDict(from_attributes=True)

    items: List[PresetHookResponse]
    total: int
    categories: List[Dict[str, Any]] = []


class PresetCharacterNameBase(BaseModel):
    """角色名库基础字段"""
    surname: str = Field(..., min_length=1, max_length=10)
    name: str = Field(..., min_length=1, max_length=10)
    gender: str = Field(..., pattern="^(male|female)$")
    style: Optional[str] = Field(None, pattern="^(现代|古风|西幻)$")


class PresetCharacterNameCreate(PresetCharacterNameBase):
    """创建角色名请求"""
    pass


class PresetCharacterNameResponse(PresetCharacterNameBase):
    """角色名响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    usage_count: int = 0
    created_at: datetime


class RandomCombineRequest(BaseModel):
    """随机组合请求"""
    hook_category: Optional[str] = None


class RandomCombineResponse(BaseModel):
    """随机组合响应"""
    hook: Dict[str, Any]
    characters: Dict[str, Any]
    setting: Dict[str, Any]
    elements: Dict[str, Any]
    twist: Dict[str, Any]
    ending_type: str


class RandomCharacterNamesRequest(BaseModel):
    """随机角色名请求"""
    count: int = Field(default=5, ge=1, le=20)
    gender: Optional[str] = Field(None, pattern="^(male|female)$")
    style: Optional[str] = Field(None, pattern="^(现代|古风|西幻)$")


class RandomCharacterNamesResponse(BaseModel):
    """随机角色名响应"""
    names: List[Dict[str, str]]


# ============== 整合修复 ==============

class IntegrationIssue(BaseModel):
    """整合发现的问题"""
    issue_type: str = Field(..., pattern="^(foreshadowing|character|timeline|emotion|style|redundancy|logic|consistency)$")
    issue_description: str
    severity: str = Field(..., pattern="^(critical|major|minor)$")
    affected_chapters: Optional[List[int]] = None
    suggestion: str


class FixRequest(BaseModel):
    """修复请求"""
    issues: List[IntegrationIssue]


class FixResponse(BaseModel):
    """修复响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    novel_id: str
    batch_number: int
    issue_type: str
    issue_description: str
    affected_chapters: Optional[List[int]] = None
    original_text: str
    fixed_text: str
    fix_reason: Optional[str] = None
    status: str = Field(default="pending", pattern="^(pending|accepted|rejected|modified)$")
    user_modified_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FixBatchResponse(BaseModel):
    """批量修复响应"""
    fixes: List[FixResponse]
    batch_number: int


class FixApplyRequest(BaseModel):
    """应用修复请求"""
    fix_ids: List[str]


class ApplyAllFixesRequest(BaseModel):
    """批量应用修复请求"""
    pass


class FixModifyRequest(BaseModel):
    """用户修改修复请求"""
    fixed_text: str


class EnhancedIntegrationResult(BaseModel):
    """增强版整合结果"""
    total_chapters: int
    total_words: int
    checks: List[Dict[str, Any]]
    suggestions: List[str]
    issues: List[IntegrationIssue] = []
    auto_fixable: List[IntegrationIssue] = []
    title_suggestions: Optional[List[Dict[str, str]]] = None
    opening_hook: Optional[Dict[str, Any]] = None


# ============== 开篇钩子 ==============

class OpeningHook(BaseModel):
    """开篇钩子"""
    hook_id: int
    content: str
    angle: str  # 切入角度说明


class OpeningHookGenerateResponse(BaseModel):
    """生成开篇钩子响应"""
    hooks: List[OpeningHook]


class OpeningHookSelectRequest(BaseModel):
    """选择开篇钩子请求"""
    hook_id: int


# ============== 番外 / 一键生成 ==============

class ExtraChapterCreate(BaseModel):
    """添加番外章请求"""
    title: str = Field(..., min_length=1, max_length=255)
    extra_type: str = Field(..., pattern="^(background|motivation|aftermath|custom)$")
    description: str
    estimated_words: int = Field(default=1000, ge=500, le=5000)
    insert_after: int


class GenerateAllChaptersResponse(BaseModel):
    """一键生成全部章节响应"""
    task_id: str
    status: str
    total_chapters: int
    current_chapter: int


class GenerateProgressResponse(BaseModel):
    """生成进度响应"""
    status: str  # pending / generating / completed / failed
    current_chapter: int
    total_chapters: int
    progress_percent: int
