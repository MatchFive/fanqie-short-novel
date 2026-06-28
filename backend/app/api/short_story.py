"""
短篇小说 API 路由
Short Story CRUD + 生成流程
纯本地运行版本 - 无认证
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Novel, ShortStorySetting, PresetHook, PresetCharacterName, Chapter
from app.core.llm_client import LLMClient, LLMService
from app.schemas import (
    ShortStorySettingCreate, ShortStorySettingUpdate, ShortStorySettingResponse,
    CoreHookSet, GeneratePlansRequest, PlansResponse, Plan, SelectPlanRequest,
    ChapterGenerateRequest, ChapterResponse, ChapterCreate,
    PresetHookResponse, PresetHookListResponse,
    RandomCombineRequest, RandomCombineResponse,
    RandomCharacterNamesRequest, RandomCharacterNamesResponse,
    CategoryConfigCreate, CategoryConfigUpdate, CategoryConfigResponse,
    CategoryMetadataResponse,
    GenerateHooksRequest, GeneratedHooksResponse,
    SelectHookRequest, SaveHookToPresetRequest,
    FixRequest, FixBatchResponse, FixApplyRequest,
    FixModifyRequest, FixResponse,
    EnhancedIntegrationResult,
    StepProgressResponse,
    OpeningHookGenerateResponse, OpeningHookSelectRequest,
    ExtraChapterCreate, GenerateAllChaptersResponse, GenerateProgressResponse,
    ApplyAllFixesRequest,
    NovelCreate, NovelResponse, NovelUpdate,
)
from app.services.short_story import ShortStoryService
from app.services.category_service import CategoryService
from app.services.hook_generation_service import HookGenerationService
from app.core.logging_config import get_logger
from app.config import settings

logger = get_logger("fanqie_novel.short_story")
router = APIRouter(prefix="/short-stories", tags=["short-story"])


# ============== LLM 服务依赖 ==============

async def get_llm_service() -> ShortStoryService:
    """获取短篇小说服务实例（从环境变量/配置加载 LLM）"""
    if not settings.LLM_API_KEY:
        raise HTTPException(
            status_code=400,
            detail={
                "code": 6001,
                "message": "未配置 API Key",
                "detail": "请在 .env 文件中设置 LLM_API_KEY 或在界面中配置您的 API Key",
                "data": {},
            },
        )
    client = LLMClient(
        base_url=settings.LLM_BASE_URL,
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
    )
    return ShortStoryService(client)


# ============== 小说管理 ==============

@router.post("/novels", response_model=NovelResponse)
async def create_novel(
    data: NovelCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建短篇小说"""
    novel = Novel(
        title=data.title,
        type="short",
        genre=data.genre,
        target_word_count=data.target_word_count or 8000,
        status="draft",
    )
    db.add(novel)
    await db.commit()
    await db.refresh(novel)
    logger.info("创建短篇小说: id=%s, title=%s", novel.id, novel.title)
    return novel


@router.get("/novels", response_model=List[NovelResponse])
async def list_novels(
    db: AsyncSession = Depends(get_db),
):
    """获取短篇小说列表"""
    result = await db.execute(
        select(Novel).where(Novel.type == "short").order_by(Novel.updated_at.desc())
    )
    novels = result.scalars().all()
    return novels


@router.get("/novels/{novel_id}", response_model=NovelResponse)
async def get_novel(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取短篇小说详情"""
    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")
    return novel


@router.put("/novels/{novel_id}", response_model=NovelResponse)
async def update_novel(
    novel_id: str,
    data: NovelUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新短篇小说"""
    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(novel, field, value)

    await db.commit()
    await db.refresh(novel)
    return novel


@router.delete("/novels/{novel_id}")
async def delete_novel(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除短篇小说"""
    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")

    await db.delete(novel)
    await db.commit()
    return {"code": 0, "message": "已删除"}


# ============== 步骤进度查询 ==============

@router.get("/{novel_id}/progress", response_model=StepProgressResponse)
async def get_progress(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取短篇小说创作步骤进度

    返回每个步骤的完成状态和当前所在步骤。
    用于前端 StepNavigator 判断哪些步骤可点击跳转。
    """
    # 查询 setting
    result = await db.execute(
        select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
    )
    setting = result.scalar_one_or_none()

    if not setting:
        return StepProgressResponse(
            completed=[False] * 7,
            current_step=1
        )

    # 查询分类配置
    category_service = CategoryService()
    category_config = await category_service.get_by_novel(db, novel_id)

    # 查询章节（用于判断 Step 5/6）
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.novel_id == novel_id)
    )
    chapters = chapter_result.scalars().all()
    has_chapters = len(chapters) > 0
    all_chapters_completed = all(ch.status == "completed" for ch in chapters) if chapters else False

    # 计算各步骤完成状态
    completed = [
        category_config is not None,                          # Step 1: 分类配置
        setting.core_hook is not None,                        # Step 2: 核心爽点
        setting.selected_plan_id is not None,                 # Step 3: 方案选择
        setting.character_profiles is not None,               # Step 4: 详细规划
        has_chapters,                                         # Step 5: 章节拆分
        all_chapters_completed,                               # Step 6: 逐章写作完成
        setting.status == "completed",                        # Step 7: 全文整合
    ]

    # 计算当前步骤（第一个未完成的步骤）
    current_step = 7
    for i, is_completed in enumerate(completed):
        if not is_completed:
            current_step = i + 1
            break

    return StepProgressResponse(
        completed=completed,
        current_step=current_step
    )


# ============== 短篇小说设定 ==============

@router.post("/{novel_id}/setting", response_model=ShortStorySettingResponse)
async def create_short_story_setting(
    novel_id: str,
    data: ShortStorySettingCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建短篇小说设定（新建短篇项目时调用）"""
    # 检查 novel 是否存在
    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")

    # 检查是否已存在设定
    result = await db.execute(
        select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="该小说已存在设定")

    setting = ShortStorySetting(
        novel_id=novel_id,
        core_hook=data.core_hook,
        hook_category=data.hook_category,
        emotional_target=data.emotional_target or "爽",
    )
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    logger.info("创建短篇小说设定: novel_id=%s", novel_id)
    return setting


@router.get("/{novel_id}/setting", response_model=ShortStorySettingResponse)
async def get_short_story_setting(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取短篇小说设定"""
    result = await db.execute(
        select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="设定不存在")
    return setting


@router.put("/{novel_id}/setting", response_model=ShortStorySettingResponse)
async def update_short_story_setting(
    novel_id: str,
    data: ShortStorySettingUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新短篇小说设定"""
    result = await db.execute(
        select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="设定不存在")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(setting, field, value)

    await db.commit()
    await db.refresh(setting)
    logger.info("更新短篇小说设定: novel_id=%s", novel_id)
    return setting


# ============== Step 0: 分类标签配置 ==============

@router.get("/categories/metadata", response_model=CategoryMetadataResponse)
async def get_category_metadata():
    """获取番茄平台分类元数据"""
    metadata = CategoryService.get_metadata()
    return metadata


@router.post("/{novel_id}/categories", response_model=CategoryConfigResponse)
async def create_category_config(
    novel_id: str,
    data: CategoryConfigCreate,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """创建/更新分类配置"""
    try:
        config = await service.set_category_config(db, novel_id, data)
        return config
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{novel_id}/categories", response_model=CategoryConfigResponse)
async def get_category_config(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取分类配置"""
    category_service = CategoryService()
    config = await category_service.get_by_novel(db, novel_id)
    if not config:
        raise HTTPException(status_code=404, detail="分类配置不存在")
    return config


@router.put("/{novel_id}/categories", response_model=CategoryConfigResponse)
async def update_category_config(
    novel_id: str,
    data: CategoryConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新分类配置"""
    category_service = CategoryService()
    config = await category_service.update(db, novel_id, data)
    if not config:
        raise HTTPException(status_code=404, detail="分类配置不存在")
    return config


# ============== Step 1: 核心爽点 ==============

@router.post("/{novel_id}/hooks/generate", response_model=GeneratedHooksResponse)
async def generate_hooks(
    novel_id: str,
    data: GenerateHooksRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """根据分类标签生成爽点候选"""
    try:
        hooks = await service.generate_hooks(
            db, novel_id,
            count=data.count,
            custom_requirement=data.custom_requirement
        )
        return GeneratedHooksResponse(hooks=hooks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("生成爽点失败: %s", e)
        raise HTTPException(status_code=500, detail="生成爽点失败")


@router.post("/{novel_id}/hooks/select", response_model=ShortStorySettingResponse)
async def select_hook(
    novel_id: str,
    data: SelectHookRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """选择核心爽点"""
    try:
        setting = await service.select_hook(db, novel_id, data)
        return setting
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{novel_id}/hooks/save-preset", response_model=PresetHookResponse)
async def save_hook_to_preset(
    novel_id: str,
    data: SaveHookToPresetRequest,
    db: AsyncSession = Depends(get_db),
):
    """保存爽点到预设库"""
    category_service = CategoryService()
    category_config = await category_service.get_by_novel(db, novel_id)
    if not category_config:
        raise HTTPException(status_code=400, detail="请先配置分类标签")

    hook_service = HookGenerationService.from_config()
    preset = await hook_service.save_to_preset(
        db=db,
        hook_data={
            "title": data.hook_title,
            "description": data.hook_description,
            "emotional_target": data.emotional_target,
            "tags": data.tags or [],
        },
        category_config=category_config
    )
    return preset


@router.post("/{novel_id}/hook", response_model=ShortStorySettingResponse)
async def set_core_hook(
    novel_id: str,
    data: CoreHookSet,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """设置核心爽点（兼容旧接口：预设库/手动输入）"""
    try:
        setting = await service.set_core_hook(db, novel_id, data)
        return setting
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Step 2: 基础设定方案 ==============

@router.post("/{novel_id}/generate-plans", response_model=PlansResponse)
async def generate_plans(
    novel_id: str,
    data: GeneratePlansRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成基础设定方案（3-5个）"""
    try:
        plans = await service.generate_plans(db, novel_id, data)
        return PlansResponse(plans=plans)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{novel_id}/select-plan", response_model=ShortStorySettingResponse)
async def select_plan(
    novel_id: str,
    data: SelectPlanRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """选择方案并保存"""
    try:
        setting = await service.select_plan(db, novel_id, data)
        return setting
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Step 3: 详细规划 ==============

@router.post("/{novel_id}/generate-detail", response_model=ShortStorySettingResponse)
async def generate_detail_plan(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成详细规划（角色、情节、伏笔、反转）"""
    try:
        setting = await service.generate_detail_plan(db, novel_id)
        return setting
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Step 4: 章节拆分 ==============

@router.get("/{novel_id}/chapters", response_model=List[ChapterResponse])
async def list_chapters(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取章节列表"""
    result = await db.execute(
        select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
    )
    chapters = result.scalars().all()
    return chapters


@router.post("/{novel_id}/generate-chapters", response_model=List[ChapterResponse])
async def generate_chapters(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成章节规划（自动拆分）"""
    try:
        chapters = await service.generate_chapters(db, novel_id)
        return chapters
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Step 5: 逐章生成 ==============

@router.post("/{novel_id}/chapters/{chapter_num}/generate", response_model=ChapterResponse)
async def generate_chapter(
    novel_id: str,
    chapter_num: int,
    data: ChapterGenerateRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成单章正文（带上下文管理）"""
    try:
        chapter = await service.generate_chapter_content(db, novel_id, chapter_num, data.feedback)
        return chapter
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{novel_id}/chapters/{chapter_num}/regenerate", response_model=ChapterResponse)
async def regenerate_chapter(
    novel_id: str,
    chapter_num: int,
    data: ChapterGenerateRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """根据反馈重新生成章节"""
    if not data.feedback:
        raise HTTPException(status_code=400, detail="请提供修改意见")
    try:
        chapter = await service.generate_chapter_content(db, novel_id, chapter_num, data.feedback)
        return chapter
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{novel_id}/chapters/{chapter_num}", response_model=ChapterResponse)
async def update_chapter(
    novel_id: str,
    chapter_num: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """更新章节内容或状态"""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.novel_id == novel_id)
        .where(Chapter.order_index == chapter_num)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")

    if "content" in data:
        chapter.content = data["content"]
        chapter.word_count = len(data["content"])
    if "status" in data:
        chapter.status = data["status"]

    await db.commit()
    await db.refresh(chapter)
    return chapter


# ============== Step 6: 全文整合 ==============

@router.post("/{novel_id}/integrate")
async def integrate_story(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """全文整合与检查（增强版）"""
    try:
        result = await service.integrate_story(db, novel_id)
        return {
            "code": 0,
            "message": "整合完成",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== 整合修复 ==============

@router.post("/{novel_id}/fix", response_model=FixBatchResponse)
async def fix_issues(
    novel_id: str,
    data: FixRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """修复整合问题"""
    try:
        fixes = await service.fix_integration_issues(db, novel_id, [issue.model_dump() for issue in data.issues])
        return {
            "fixes": fixes,
            "batch_number": fixes[0].batch_number if fixes else 1,
        }
    except Exception as e:
        logger.error("修复失败: %s", e)
        raise HTTPException(status_code=500, detail=f"修复失败: {str(e)}")


@router.post("/{novel_id}/fix/apply")
async def apply_fixes(
    novel_id: str,
    data: FixApplyRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """批量应用修复"""
    for fix_id in data.fix_ids:
        try:
            await service.apply_fix(db, fix_id)
        except Exception as e:
            logger.error("应用修复失败 %s: %s", fix_id, e)
    return {"code": 0, "message": "修复已应用", "status": "applied"}


@router.put("/{novel_id}/fix/apply-all")
async def apply_all_fixes(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """批量应用所有 pending 修复"""
    try:
        result = await service.apply_all_fixes(db, novel_id)
        return {
            "code": 0,
            "message": result.get("message", "修复已应用"),
            "data": result
        }
    except Exception as e:
        logger.error("批量应用修复失败: %s", e)
        raise HTTPException(status_code=500, detail=f"批量应用修复失败: {str(e)}")


@router.post("/{novel_id}/fix/{fix_id}/reject")
async def reject_fix(
    novel_id: str,
    fix_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """拒绝修复"""
    await service.reject_fix(db, fix_id)
    return {"code": 0, "message": "已拒绝修复", "status": "rejected"}


@router.put("/{novel_id}/fix/{fix_id}")
async def modify_fix(
    novel_id: str,
    fix_id: str,
    data: FixModifyRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """用户修改修复内容并应用"""
    await service.modify_and_apply_fix(db, fix_id, data.fixed_text)
    return {"code": 0, "message": "修改已应用", "status": "modified_and_applied"}


@router.get("/{novel_id}/fixes", response_model=List[FixResponse])
async def get_fixes(
    novel_id: str,
    batch_number: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """获取修复记录"""
    fixes = await service.get_fixes(db, novel_id, batch_number)
    return fixes


# ============== 开篇钩子 ==============

@router.post("/{novel_id}/opening-hooks/generate", response_model=OpeningHookGenerateResponse)
async def generate_opening_hooks(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成开篇钩子候选"""
    try:
        hooks = await service.generate_opening_hooks(db, novel_id)
        # 保存候选列表到 setting
        result = await db.execute(
            select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.opening_hooks_list = hooks
            await db.commit()
        return {"hooks": hooks}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("生成开篇钩子失败: %s", e)
        raise HTTPException(status_code=500, detail="生成开篇钩子失败")


@router.post("/{novel_id}/opening-hooks/select", response_model=ShortStorySettingResponse)
async def select_opening_hook(
    novel_id: str,
    data: OpeningHookSelectRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """选择开篇钩子"""
    try:
        setting = await service.select_opening_hook(db, novel_id, data.hook_id)
        return setting
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== 一键生成全部章节 ==============

@router.post("/{novel_id}/chapters/generate-all", response_model=GenerateAllChaptersResponse)
async def generate_all_chapters(
    novel_id: str,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """一键生成全部章节"""
    try:
        result = await service.generate_all_chapters(db, novel_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("一键生成全部章节失败: %s", e)
        raise HTTPException(status_code=500, detail=f"一键生成失败: {str(e)}")


@router.get("/{novel_id}/chapters/generate-all/progress", response_model=GenerateProgressResponse)
async def get_generation_progress(
    novel_id: str,
    service: ShortStoryService = Depends(get_llm_service),
):
    """查询一键生成进度"""
    progress = service.get_generation_progress(novel_id)
    return progress


# ============== 番外章 ==============

@router.post("/{novel_id}/extra-chapters", response_model=ChapterResponse)
async def add_extra_chapter(
    novel_id: str,
    data: ExtraChapterCreate,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """添加番外章"""
    try:
        chapter = await service.add_extra_chapter(
            db, novel_id,
            title=data.title,
            extra_type=data.extra_type,
            description=data.description,
            estimated_words=data.estimated_words,
            insert_after=data.insert_after
        )
        return chapter
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{novel_id}/extra-chapters/{chapter_id}")
async def delete_extra_chapter(
    novel_id: str,
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除番外章"""
    result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id).where(Chapter.novel_id == novel_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="番外章不存在")
    if chapter.chapter_type != "extra":
        raise HTTPException(status_code=400, detail="只能删除番外章")

    # 删除后调整后续章节的 order_index
    shift_result = await db.execute(
        select(Chapter)
        .where(Chapter.novel_id == novel_id)
        .where(Chapter.order_index > chapter.order_index)
        .order_by(Chapter.order_index)
    )
    chapters_to_shift = shift_result.scalars().all()
    for ch in chapters_to_shift:
        ch.order_index -= 1

    await db.delete(chapter)
    await db.commit()
    return {"code": 0, "message": "番外章已删除"}


@router.post("/{novel_id}/extra-chapters/{chapter_num}/generate", response_model=ChapterResponse)
async def generate_extra_chapter(
    novel_id: str,
    chapter_num: int,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """生成番外章内容"""
    try:
        chapter = await service.generate_extra_chapter(db, novel_id, chapter_num)
        return chapter
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== 导出 ==============

@router.get("/{novel_id}/export")
async def export_short_story(
    novel_id: str,
    format: str = Query(default="txt", pattern="^(txt|md|epub)$"),
    db: AsyncSession = Depends(get_db),
):
    """导出完整短篇小说（包含开篇钩子）"""
    result = await db.execute(
        select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
    )
    chapters = result.scalars().all()

    if not chapters:
        raise HTTPException(status_code=404, detail="没有可导出的内容")

    # 获取开篇钩子
    setting_result = await db.execute(
        select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
    )
    setting = setting_result.scalar_one_or_none()
    opening_hook = ""
    if setting and setting.opening_hook:
        hook_data = setting.opening_hook
        if isinstance(hook_data, dict) and hook_data.get("content"):
            opening_hook = hook_data["content"] + "\n\n"

    full_text = opening_hook + "\n\n".join([f"第{ch.order_index}章 {ch.title}\n\n{ch.content}" for ch in chapters])

    return {
        "code": 0,
        "message": "导出成功",
        "data": {
            "format": format,
            "total_words": sum(ch.word_count for ch in chapters),
            "content": full_text
        }
    }


# ============== 预设库 API ==============

@router.get("/presets/hooks", response_model=PresetHookListResponse)
async def list_preset_hooks(
    category: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = Query(None, pattern="^(system|user)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取爽点列表（支持 source 过滤）"""
    query = select(PresetHook)

    if category:
        query = query.where(PresetHook.category == category)

    if source:
        query = query.where(PresetHook.source == source)

    if search:
        query = query.where(
            (PresetHook.title.ilike(f"%{search}%")) |
            (PresetHook.description.ilike(f"%{search}%"))
        )

    # 统计总数
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    # 获取分类统计
    cat_result = await db.execute(
        select(PresetHook.category, func.count())
        .group_by(PresetHook.category)
    )
    categories = [
        {"id": cat, "name": cat, "count": cnt}
        for cat, cnt in cat_result.all()
    ]

    return PresetHookListResponse(
        items=items,
        total=total,
        categories=categories
    )


@router.get("/presets/hooks/categories")
async def list_hook_categories(
    db: AsyncSession = Depends(get_db),
):
    """获取爽点分类列表"""
    result = await db.execute(
        select(PresetHook.category, func.count())
        .group_by(PresetHook.category)
    )
    categories = [
        {"id": cat, "name": cat, "count": cnt}
        for cat, cnt in result.all()
    ]
    return {"categories": categories}


@router.post("/presets/combine", response_model=RandomCombineResponse)
async def random_combine(
    data: RandomCombineRequest,
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """随机组合生成基础设定"""
    try:
        result = await service.random_combine(db, data.hook_category)
        return RandomCombineResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/presets/characters/random", response_model=RandomCharacterNamesResponse)
async def random_character_names(
    count: int = Query(default=5, ge=1, le=20),
    gender: Optional[str] = Query(None, pattern="^(male|female)$"),
    style: Optional[str] = Query(None, pattern="^(现代|古风|西幻)$"),
    db: AsyncSession = Depends(get_db),
    service: ShortStoryService = Depends(get_llm_service),
):
    """随机角色名生成"""
    names = await service.random_character_names(db, count, gender, style)
    return RandomCharacterNamesResponse(names=names)
