"""
短篇小说服务层
封装业务逻辑：爽点设置、方案生成、详细规划、章节生成、全文整合
纯本地运行版本 - 无 Neo4j/Redis/PostgreSQL 依赖
"""

import json
import random
import logging
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import ShortStorySetting, ShortStoryCategory, PresetHook, PresetCharacterName, Novel, Chapter, IntegrationFix
from app.schemas import (
    Plan, CoreHookSet, GeneratePlansRequest, SelectPlanRequest,
    CategoryConfigCreate, SelectHookRequest,
)
from app.core.llm_client import LLMClient
from app.services.category_service import CategoryService
from app.services.hook_generation_service import HookGenerationService
from app.core.preset_data import (
    SCENE_TEMPLATES, CONFLICT_TYPES, TWIST_TEMPLATES,
    ERA_SETTINGS, ENDING_TYPES
)
from app.core.logging_config import get_logger

logger = get_logger("fanqie_novel.short_story_service")


# ============== Prompt 模板 ==============

PLAN_GENERATION_PROMPT = """你是一位资深短篇小说编辑。请基于以下核心爽点，生成 {count} 个不同的短篇小说基础设定方案。

核心爽点：{hook_description}
目标情绪：{emotional_target}
目标字数：{target_length}

{category_constraints}

每个方案需要包含：
1. 叙事顺序（线性/倒叙/插叙/环形/多视角）
2. 主线剧情概要（3-5句话，要有吸引力）
3. 结局类型（圆满/悲剧/反转/开放式/讽刺）
4. 情绪曲线描述（如：好奇→压抑→爆发→恍然大悟）
5. 为什么这个方案适合这个爽点（1-2句话）
6. 预估字数

要求：
- 方案之间要有明显差异（不同的叙事顺序、不同的结局、不同的角度）
- 避免陈词滥调，力求新颖
- 考虑短篇小说的节奏特点：快速进入、集中爆发、有力收尾
- 每个方案都要围绕核心爽点展开，不能偏离
- **必须严格遵守分类标签约束：主分类定位、情节标签元素、角色标签特征、情绪过程走向、故事背景典型元素**

请按以下 JSON 格式输出，不要输出其他内容：
{{
  "plans": [
    {{
      "plan_id": 1,
      "narrative_order": "...",
      "plot_summary": "...",
      "ending_type": "...",
      "emotion_curve": "...",
      "estimated_length": "...",
      "why_this_works": "..."
    }}
  ]
}}
"""

DETAIL_PLAN_PROMPT = """你是一位资深短篇小说编辑。基于已选定的基础设定，生成详细的短篇小说规划。

基础设定：
- 核心爽点：{hook_description}
- 叙事顺序：{narrative_order}
- 主线剧情：{plot_summary}
- 结局类型：{ending_type}
- 目标字数：{target_length}

{category_constraints}

请生成以下内容：

## 1. 角色人设

主角：
- 姓名（从常见中文名中选取，不要生僻字）
- 年龄、表面身份、真实身份
- 核心欲望（最想要什么）
- 核心恐惧（最怕失去什么）
- 隐藏秘密（与爽点相关）
- 性格缺陷（让人物更真实）
- 人物弧线（故事中的变化）

对手/阻碍者：
- 姓名
- 年龄
- 表面身份、真实身份
- 与主角的关系
- 核心欲望、核心恐惧
- 隐藏秘密
- 性格缺陷
- 行为动机
- 为什么阻碍主角
- 人物弧线

辅助角色（0-2个）：
- 姓名
- 年龄
- 身份
- 在故事中的作用
- 与主角关系
- 关键性格特征

## 2. 重要情节列表（5-10个关键场景）

每个场景需要：
- 场景标题
- 场景描述（2-3句话）
- 场景目的：推进剧情 / 揭示人物 / 制造冲突 / 铺垫转折
- 情绪目标
- 埋下的伏笔（如有）
- 包含的反转（如有）

## 3. 伏笔与反转设计（2-4对）

每对包含：
- 伏笔位置：出现在哪个场景
- 伏笔内容：看似平常的细节
- 隐蔽程度：1-10（10最隐蔽）
- 反转位置：揭露在哪个场景
- 反转内容：揭露什么真相
- 冲击力：1-10（10最震撼）
- 回看满足感：回看时的恍然大悟描述

## 4. 叙事顺序细化

如果是非线性叙事，详细说明时间线安排。

要求：
- 伏笔要隐蔽但合理，回看时应有恍然大悟感
- 反转要有冲击力但符合逻辑，不能机械降神
- 角色动机要充分，行为符合性格
- 所有元素要围绕核心爽点服务
- 考虑目标字数，情节密度要合适
- **必须严格遵守上述分类标签约束，角色/场景/情绪都要符合标签定位**

请按以下 JSON 格式输出，不要输出其他内容：
{{
  "characters": {{
    "protagonist": {{
      "name": "...",
      "age": "...",
      "surface_identity": "...",
      "real_identity": "...",
      "desire": "...",
      "fear": "...",
      "secret": "...",
      "flaw": "...",
      "arc": "..."
    }},
    "antagonist": {{
      "name": "...",
      "age": "...",
      "surface_identity": "...",
      "real_identity": "...",
      "desire": "...",
      "fear": "...",
      "secret": "...",
      "flaw": "...",
      "relationship_to_protagonist": "...",
      "motivation": "...",
      "why_opposing": "...",
      "arc": "..."
    }},
    "supporting": [
      {{
        "name": "...",
        "age": "...",
        "identity": "...",
        "purpose_in_story": "...",
        "relationship": "...",
        "key_trait": "..."
      }}
    ]
  }},
  "key_scenes": [
    {{
      "scene_id": 1,
      "title": "...",
      "description": "...",
      "purpose": "推进剧情",
      "emotion": "...",
      "foreshadowing": null,
      "twist": null
    }}
  ],
  "foreshadowing_twists": [
    {{
      "pair_id": 1,
      "foreshadowing": {{
        "location": "...",
        "content": "...",
        "subtlety": 7
      }},
      "twist": {{
        "location": "...",
        "reveal": "...",
        "impact": 9,
        "satisfaction": "..."
      }}
    }}
  ],
  "narrative_order_detail": "..."
}}
"""

CHAPTER_GENERATION_PROMPT = """请生成短篇小说第 {chapter_number} 章。

项目信息：
- 标题：{project_title}
- 核心爽点：{hook_description}
- 叙事顺序：{narrative_order}
- 目标字数：{target_length}

本章信息：
- 章节号：{chapter_number}/{total_chapters}
- 本章标题：{chapter_title}
- 本章目标：{core_goal}
- 情绪目标：{emotion_target}
- 包含场景：{scenes}
- 预估字数：{estimated_words}
- 章末钩子：{ending_hook}

【前文衔接（极其重要）】
上一章结尾内容：
{previous_ending}

前文关键事件摘要：
{previous_summary}

已确定事实（不可违背）：
{established_facts}

待回收伏笔（如适用）：
{active_foreshadowing}

角色当前状态：
{character_states}

写作要求：
1. **必须承接上一章结尾**：本章开头要自然衔接上一章的结尾，不能突然跳转场景或时间
2. **回顾与推进**：开头用1-2句话简要回顾上一章的关键转折或悬念，然后自然推进到本章场景
3. **对话推动剧情**，展现性格，减少说明性对话
4. **每个场景有明确目的**，不拖泥带水
5. **保持情绪目标**，让读者情绪随文字起伏
6. **在章末设置合适的钩子**（如非最后一章）
7. **字数参考 {estimated_words} 字，根据情节需要可适当调整**
8. **严格遵循已确定事实，不能"吃书"**
9. **如本章需要回收伏笔，要自然融入，不能生硬**
10. **保持叙事顺序的一致性**（倒叙/插叙等）

请直接输出正文内容，不需要章节标题。"""

CHAPTER_REGENERATE_PROMPT = """请根据以下反馈重新生成本章内容。

用户反馈：{feedback}

原始要求：
{original_prompt}

请根据用户反馈修改内容，保持其他要求不变。直接输出修改后的正文。"""

CHAPTER_REVIEW_PROMPT = """你是一位资深小说编辑和质量审查员。请审查以下短篇小说章节内容，检查是否存在逻辑硬伤、常识错误或情节矛盾。

【章节信息】
- 章节号：{chapter_number}/{total_chapters}
- 本章标题：{chapter_title}
- 本章目标：{core_goal}

【角色人设（不可违背）】
{character_profiles}

【已确定事实（不可违背）】
{established_facts}

【本章内容】
{chapter_content}

【审查要求】
请逐一检查以下项目，对每项给出 pass/warning/fail 状态：

1. **物理逻辑**：物品/场景描述是否合理？
2. **因果逻辑**：事件之间的因果关系是否成立？
3. **角色一致性**：角色行为是否符合人设
4. **时间逻辑**：时间流逝描述是否合理
5. **对话逻辑**：对话内容是否自然

【输出格式】
请按以下 JSON 格式输出，不要输出其他内容：
{{
  "passed": true/false,
  "checks": [
    {{"item": "物理逻辑", "status": "pass/warning/fail", "detail": "..."}}
  ],
  "issues": [
    {{
      "type": "物理逻辑/因果逻辑/角色一致性/时间逻辑/对话逻辑",
      "description": "具体问题描述",
      "severity": "critical/major/minor",
      "suggestion": "修改建议"
    }}
  ]
}}"""

INTEGRATION_CHECK_PROMPT = """请检查以下短篇小说的完整内容，并给出详细的检查结果和修复建议。

【完整内容】
{full_text}

【原始规划】
- 核心爽点：{hook_description}
- 伏笔列表：{foreshadowing_list}
- 反转列表：{twist_list}
- 情绪曲线：{emotion_curve}
- 角色人设：{character_profiles}
- 叙事顺序：{narrative_order}

【检查要求】
请逐一检查：伏笔回收、角色一致性、时间线、情绪曲线、语言风格、冗余内容、逻辑漏洞

【输出格式】
请按以下 JSON 格式输出，不要输出其他内容：
{{
  "checks": [{{"item": "...", "status": "pass/warning/fail", "detail": "..."}}],
  "suggestions": ["..."],
  "issues": [
    {{
      "issue_type": "foreshadowing/character/timeline/emotion/style/redundancy/logic",
      "issue_description": "...",
      "severity": "critical/major/minor",
      "affected_chapters": [1, 2],
      "suggestion": "..."
    }}
  ]
}}
"""

TITLE_GENERATION_PROMPT = """你是一位番茄小说平台的资深编辑。请基于以下短篇小说内容，生成5个备选作品名。

核心爽点：{hook_description}
叙事顺序：{narrative_order}
结局类型：{ending_type}
情绪曲线：{emotion_curve}

章节概要：
{chapter_summaries}

【番茄小说爆款标题风格要求】
1. 长度：10-20字为宜
2. 常用结构：开局/重生/穿越/闪婚后/我...、马甲/反派/替身等热门人设标签
3. 情绪词：善用"爽""爆""炸""疯""杀""虐""甜""宠"等强情绪词
4. 悬念感：标题本身要有悬念

【输出格式】
{{
  "titles": [
    {{"title": "名字1", "reason": "推荐理由"}},
    {{"title": "名字2", "reason": "推荐理由"}},
    {{"title": "名字3", "reason": "推荐理由"}},
    {{"title": "名字4", "reason": "推荐理由"}},
    {{"title": "名字5", "reason": "推荐理由"}}
  ]
}}
"""

CHAPTER_SPLIT_PROMPT = """你是一位资深短篇小说编辑。请根据以下详细规划，将故事拆分为合理的章节结构。

项目信息：
- 核心爽点：{hook_description}
- 叙事顺序：{narrative_order}
- 目标字数：{target_length}

角色人设：
{character_profiles}

关键场景列表：
{key_scenes}

伏笔与反转设计：
{foreshadowing_twists}

叙事顺序细化：
{narrative_order_detail}

要求：
1. 根据目标字数计算章节数：总字数/1000 ≈ 章节数
2. 每个章节应包含 1-3 个关键场景
3. 每章预估字数控制在 800-1200 字之间
4. 每章需要有：章节标题、场景ID列表、预估字数、核心目标、情绪目标、章末钩子、情节梗概（100字内）
5. 章节之间要有递进关系，情绪曲线要完整

请按以下 JSON 格式输出，不要输出其他内容：
{{
  "chapters": [
    {{
      "title": "...",
      "order_index": 1,
      "scenes_covered": [1, 2],
      "estimated_words": 1000,
      "core_goal": "...",
      "emotion_target": "...",
      "ending_hook": "...",
      "plot_summary": "本章情节梗概，100字以内"
    }}
  ]
}}
"""

OPENING_HOOK_PROMPT = """你是一位番茄小说平台的资深编辑，深谙爆款短篇小说的开篇技巧。

请基于以下小说内容，生成3个开篇钩子。

核心爽点：{hook_description}
叙事顺序：{narrative_order}
结局类型：{ending_type}
情绪曲线：{emotion_curve}

章节概要：
{chapter_summaries}

【要求】
1. 直接切入最精彩的冲突或悬念场景
2. 100-300字，短小精悍
3. 有强烈的情绪冲击力
4. 每个钩子要有不同的切入角度

【输出格式】
{{
  "hooks": [
    {{"hook_id": 1, "content": "钩子内容...", "angle": "切入角度说明"}}
  ]
}}
"""

EXTRA_CHAPTER_PROMPT = """你是一位资深短篇小说作家。请根据以下要求，生成一篇番外章节。

番外类型：{extra_type}
类型说明：{extra_type_desc}

正文内容概要：
{main_story_summary}

角色人设：
{character_profiles}

番外要求：
{description}

预估字数：{estimated_words}字

写作要求：
1. 番外内容要与正文世界观一致
2. 番外要有独立的故事性
3. 保持与正文一致的语言风格
4. 直接输出正文内容，不需要章节标题
"""

# ============== 生成进度跟踪 ==============
_generation_progress: Dict[str, Dict[str, Any]] = {}


class ShortStoryService:
    """短篇小说服务"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client

    async def _get_or_create_setting(self, db: AsyncSession, novel_id: str) -> ShortStorySetting:
        """获取或创建设定"""
        result = await db.execute(
            select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
        )
        setting = result.scalar_one_or_none()
        if not setting:
            setting = ShortStorySetting(
                novel_id=novel_id,
                emotional_target="爽",
                target_length=8000,
                status="draft",
            )
            db.add(setting)
            await db.commit()
            await db.refresh(setting)
            logger.info("自动创建设定: novel_id=%s", novel_id)
        return setting

    def _build_category_constraints(self, config: Optional[ShortStoryCategory]) -> str:
        """构建分类约束描述文本"""
        if not config:
            return ""

        lines = ["【番茄平台分类标签约束】"]
        lines.append(f"- 主分类：{config.main_category}（{config.gender_orientation}）")

        plot_tags = ", ".join(config.plot_tags or [])
        if plot_tags:
            lines.append(f"- 情节标签：{plot_tags}")

        character_tags = ", ".join(config.character_tags or [])
        if character_tags:
            lines.append(f"- 角色标签：{character_tags}")

        if config.emotion_process:
            lines.append(f"- 情绪过程：{config.emotion_process}")

        if config.story_background:
            lines.append(f"- 故事背景：{config.story_background}")

        custom_tags = ", ".join(config.custom_tags or [])
        if custom_tags:
            lines.append(f"- 自定义标签：{custom_tags}")

        lines.append("- 必须严格遵守以上分类约束，不能生成与标签不符的内容")
        return "\n".join(lines)

    async def _get_category_config(self, db: AsyncSession, novel_id: str) -> Optional[ShortStoryCategory]:
        """获取分类配置"""
        category_service = CategoryService()
        return await category_service.get_by_novel(db, novel_id)

    # ============== Step 0: 分类配置 ==============

    async def set_category_config(self, db: AsyncSession, novel_id: str, data: CategoryConfigCreate) -> ShortStoryCategory:
        """设置分类配置"""
        category_service = CategoryService()
        config = await category_service.create_or_update(db, novel_id, data)

        setting = await self._get_or_create_setting(db, novel_id)
        setting.category_config_id = config.id
        if data.target_length is not None:
            setting.target_length = data.target_length
        await db.commit()

        logger.info("设置分类配置: novel_id=%s, main_category=%s", novel_id, data.main_category)
        return config

    # ============== Step 1: 核心爽点 ==============

    async def generate_hooks(self, db: AsyncSession, novel_id: str, count: int = 3,
                              custom_requirement: Optional[str] = None) -> List[Dict[str, Any]]:
        """根据分类标签生成爽点候选"""
        category_config = await self._get_category_config(db, novel_id)
        if not category_config:
            raise ValueError("请先配置分类标签")

        hook_service = HookGenerationService(self.llm)
        hooks = await hook_service.generate_hooks(
            category_config=category_config, count=count, custom_requirement=custom_requirement
        )
        return hooks

    async def select_hook(self, db: AsyncSession, novel_id: str, data: SelectHookRequest) -> ShortStorySetting:
        """选择核心爽点"""
        setting = await self._get_or_create_setting(db, novel_id)
        category_config = await self._get_category_config(db, novel_id)

        if data.custom_hook:
            setting.core_hook = data.custom_hook
            setting.hook_category = category_config.main_category if category_config else "custom"
            setting.emotional_target = data.emotional_target or "爽"
        elif data.hook_id is not None and data.hook_title and data.hook_description:
            setting.core_hook = data.hook_description
            setting.hook_category = category_config.main_category if category_config else "custom"
            setting.emotional_target = data.emotional_target or "爽"
        else:
            raise ValueError("请提供 hook_id+hook_title+hook_description 或 custom_hook")

        await self._sync_novel_status(db, novel_id, "draft")

        if data.save_to_preset and category_config:
            hook_service = HookGenerationService(self.llm)
            preset = await hook_service.save_to_preset(
                db=db,
                hook_data={
                    "title": data.hook_title or "未命名爽点",
                    "description": setting.core_hook,
                    "emotional_target": setting.emotional_target,
                    "tags": [],
                },
                category_config=category_config
            )
            await db.refresh(setting)
            return setting

        await db.commit()
        await db.refresh(setting)
        logger.info("选择核心爽点: novel_id=%s", novel_id)
        return setting

    async def set_core_hook(self, db: AsyncSession, novel_id: str, data: CoreHookSet) -> ShortStorySetting:
        """设置核心爽点"""
        setting = await self._get_or_create_setting(db, novel_id)

        if data.hook_id:
            preset_result = await db.execute(
                select(PresetHook).where(PresetHook.id == data.hook_id)
            )
            preset = preset_result.scalar_one_or_none()
            if not preset:
                raise ValueError("预设爽点不存在")

            variants = preset.example_variants or [preset.description]
            description = random.choice(variants) if variants else preset.description

            setting.core_hook = description
            setting.hook_category = preset.category
            setting.emotional_target = preset.emotional_target
            preset.usage_count += 1

        elif data.custom_hook:
            setting.core_hook = data.custom_hook
            setting.hook_category = data.category or "custom"
            setting.emotional_target = data.emotional_target
        else:
            raise ValueError("请提供 hook_id 或 custom_hook")

        if data.save_to_preset:
            category_config = await self._get_category_config(db, novel_id)
            if category_config:
                hook_service = HookGenerationService(self.llm)
                preset = await hook_service.save_to_preset(
                    db=db,
                    hook_data={
                        "title": data.custom_hook[:20] if data.custom_hook else "未命名爽点",
                        "description": setting.core_hook,
                        "emotional_target": setting.emotional_target,
                        "tags": [],
                    },
                    category_config=category_config
                )
                await db.refresh(setting)
                return setting

        await db.commit()
        await db.refresh(setting)
        logger.info("设置核心爽点: novel_id=%s", novel_id)
        return setting

    # ============== Step 2: 方案生成 ==============

    async def generate_plans(self, db: AsyncSession, novel_id: str, data: GeneratePlansRequest) -> List[Plan]:
        """生成基础设定方案"""
        setting = await self._get_or_create_setting(db, novel_id)
        if not setting.core_hook:
            raise ValueError("请先设置核心爽点")

        category_config = await self._get_category_config(db, novel_id)
        category_constraints = self._build_category_constraints(category_config)

        if self.llm and self.llm.api_key:
            try:
                plans = await self._generate_plans_with_llm(
                    hook_description=setting.core_hook,
                    emotional_target=setting.emotional_target or "爽",
                    target_length=data.target_length,
                    count=data.count,
                    category_constraints=category_constraints
                )
            except Exception as e:
                logger.warning("LLM 生成方案失败，使用模拟数据: %s", e)
                plans = self._generate_mock_plans(setting.core_hook, setting.emotional_target or "爽", data.target_length, data.count)
        else:
            plans = self._generate_mock_plans(setting.core_hook, setting.emotional_target or "爽", data.target_length, data.count)

        setting.generated_plans = [plan.model_dump() for plan in plans]
        setting.target_length = data.target_length
        await db.commit()
        await db.refresh(setting)

        logger.info("生成方案: novel_id=%s, count=%d", novel_id, len(plans))
        return plans

    async def _generate_plans_with_llm(self, hook_description: str, emotional_target: str,
                                        target_length: int, count: int, category_constraints: str = "") -> List[Plan]:
        """使用 LLM 生成方案"""
        prompt = PLAN_GENERATION_PROMPT.format(
            count=count, hook_description=hook_description,
            emotional_target=emotional_target, target_length=target_length,
            category_constraints=category_constraints
        )
        messages = [
            {"role": "system", "content": "你是一位资深短篇小说编辑，擅长设计吸引人的故事结构。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            json_str = content[json_start:json_end] if json_start >= 0 and json_end > json_start else content
            data = json.loads(json_str)
            return [Plan(**plan_data) for plan_data in data.get("plans", [])]
        except (json.JSONDecodeError, Exception) as e:
            logger.error("解析 LLM 输出失败: %s", e)
            raise ValueError(f"解析生成结果失败: {e}")

    def _generate_mock_plans(self, hook_description: str, emotional_target: str,
                              target_length: int, count: int) -> List[Plan]:
        """生成模拟方案"""
        narrative_orders = ["线性叙事", "倒叙", "插叙", "环形叙事", "多视角拼接"]
        ending_types = ["圆满结局", "悲剧结局", "反转结局", "开放式结局", "讽刺结局"]
        emotion_curves = [
            "好奇→压抑→爆发→恍然大悟", "平静→疑惑→紧张→释然",
            "压抑→努力→爆发→满足", "疑惑→理解→震惊→反思", "温暖→冲突→痛苦→治愈",
        ]
        why_works = [
            "倒叙制造悬念，让读者好奇'如何走到这一步'",
            "线性叙事最自然，适合展现完整的人物成长弧线",
            "多视角增加故事层次，讽刺结局引人深思",
            "插叙让回忆与现实交织，增强情感冲击力",
            "环形叙事首尾呼应，给读者完整的心理满足",
        ]
        plans = []
        for i in range(min(count, len(narrative_orders))):
            plans.append(Plan(
                plan_id=i + 1, narrative_order=narrative_orders[i],
                plot_summary=f"基于爽点「{hook_description[:30]}...」的{i+1}号方案。采用{narrative_orders[i]}的方式，讲述一个{emotional_target}感十足的短篇故事。",
                ending_type=ending_types[i], emotion_curve=emotion_curves[i],
                estimated_length=f"{target_length}字", why_this_works=why_works[i]
            ))
        return plans

    async def select_plan(self, db: AsyncSession, novel_id: str, data: SelectPlanRequest) -> ShortStorySetting:
        """选择方案"""
        setting = await self._get_or_create_setting(db, novel_id)
        if not setting.generated_plans:
            raise ValueError("请先生成方案")

        plan_ids = [p.get("plan_id") for p in (setting.generated_plans or [])]
        if data.plan_id not in plan_ids:
            raise ValueError("无效的方案ID")

        setting.selected_plan_id = data.plan_id
        if data.customizations:
            if "narrative_order" in data.customizations:
                setting.narrative_order = data.customizations["narrative_order"]
            if "plot_summary" in data.customizations:
                setting.plot_summary = data.customizations["plot_summary"]
            if "ending_type" in data.customizations:
                setting.ending_type = data.customizations["ending_type"]
            if "emotion_curve" in data.customizations:
                setting.emotion_curve = data.customizations["emotion_curve"]

        await db.commit()
        await db.refresh(setting)
        logger.info("选择方案: novel_id=%s, plan_id=%d", novel_id, data.plan_id)
        return setting

    # ============== Step 3: 详细规划 ==============

    async def generate_detail_plan(self, db: AsyncSession, novel_id: str) -> ShortStorySetting:
        """生成详细规划"""
        setting = await self._get_or_create_setting(db, novel_id)
        if not setting.selected_plan_id:
            raise ValueError("请先选择方案")

        selected_plan = None
        for plan in (setting.generated_plans or []):
            if plan.get("plan_id") == setting.selected_plan_id:
                selected_plan = plan
                break

        if not selected_plan:
            raise ValueError("所选方案不存在")

        category_config = await self._get_category_config(db, novel_id)
        category_constraints = self._build_category_constraints(category_config)

        if not self.llm or not self.llm.api_key:
            raise ValueError("未配置 LLM API Key，无法生成详细规划")

        detail_plan = await self._generate_detail_with_llm(
            hook_description=setting.core_hook,
            narrative_order=selected_plan.get("narrative_order", "线性叙事"),
            plot_summary=selected_plan.get("plot_summary", ""),
            ending_type=selected_plan.get("ending_type", "圆满结局"),
            target_length=setting.target_length,
            category_constraints=category_constraints
        )

        setting.character_profiles = detail_plan.get("characters")
        setting.key_scenes = detail_plan.get("key_scenes")
        setting.foreshadowing_twists = detail_plan.get("foreshadowing_twists")
        setting.narrative_order_detail = detail_plan.get("narrative_order_detail")
        setting.status = "planned"

        await self._sync_novel_status(db, novel_id, "planned")
        await db.commit()
        await db.refresh(setting)
        logger.info("生成详细规划: novel_id=%s", novel_id)
        return setting

    async def _generate_detail_with_llm(self, hook_description: str, narrative_order: str,
                                         plot_summary: str, ending_type: str, target_length: int,
                                         category_constraints: str = "") -> Dict[str, Any]:
        """使用 LLM 生成详细规划"""
        prompt = DETAIL_PLAN_PROMPT.format(
            hook_description=hook_description, narrative_order=narrative_order,
            plot_summary=plot_summary, ending_type=ending_type,
            target_length=target_length, category_constraints=category_constraints
        )
        messages = [
            {"role": "system", "content": "你是一位资深短篇小说编辑，擅长角色设计和情节编排。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        content = response["choices"][0]["message"]["content"]

        try:
            return self._parse_detail_json(content)
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("首次 JSON 解析失败: %s，尝试让 LLM 修复格式", e)
            repaired = await self._repair_json_with_llm(content, str(e))
            try:
                return self._parse_detail_json(repaired)
            except (json.JSONDecodeError, ValueError) as e2:
                logger.error("JSON 修复重试仍然失败: %s", e2)
                raise ValueError(f"详细规划生成失败：LLM 输出的 JSON 格式无法解析") from e2

    @staticmethod
    def _parse_detail_json(content: str) -> Dict[str, Any]:
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        json_str = content[json_start:json_end] if json_start >= 0 and json_end > json_start else content
        return json.loads(json_str)

    async def _repair_json_with_llm(self, broken_json: str, parse_error: str) -> str:
        repair_prompt = f"""以下 JSON 文本解析时报错：{parse_error}
请修复 JSON 格式错误，只输出修复后的 JSON，不要添加任何解释文字。

错误的 JSON 内容：
{broken_json[-6000:]}"""
        messages = [
            {"role": "system", "content": "你是一个 JSON 格式修复工具。只输出修复后的有效 JSON。"},
            {"role": "user", "content": repair_prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        return response["choices"][0]["message"]["content"]

    # ============== Step 4: 章节拆分 ==============

    async def generate_chapters(self, db: AsyncSession, novel_id: str) -> List[Chapter]:
        """生成章节规划"""
        setting = await self._get_or_create_setting(db, novel_id)
        if setting.status != "planned":
            raise ValueError("请先生成详细规划")

        if not self.llm or not self.llm.api_key:
            raise ValueError("未配置 AI 模型 API Key，请先设置 API Key 后再试")

        # 删除旧章节
        result = await db.execute(select(Chapter).where(Chapter.novel_id == novel_id))
        old_chapters = result.scalars().all()
        for ch in old_chapters:
            await db.delete(ch)

        try:
            chapters_data = await self._generate_chapters_with_llm(setting)
        except Exception as e:
            logger.error("LLM 拆分章节失败: %s", e)
            raise ValueError(f"AI 拆分章节失败: {e}")

        created = []
        for ch_data in chapters_data:
            chapter = Chapter(
                novel_id=novel_id, title=ch_data["title"], content="",
                status="draft", word_count=0, order_index=ch_data["order_index"],
                estimated_words=ch_data.get("estimated_words"),
                scenes_covered=ch_data.get("scenes_covered"),
                core_goal=ch_data.get("core_goal"),
                emotion_target=ch_data.get("emotion_target"),
                ending_hook=ch_data.get("ending_hook"),
                plot_summary=ch_data.get("plot_summary"),
                chapter_type="main",
            )
            db.add(chapter)
            created.append(chapter)

        await db.commit()
        for ch in created:
            await db.refresh(ch)

        logger.info("生成章节: novel_id=%s, count=%d", novel_id, len(created))
        return created

    async def _generate_chapters_with_llm(self, setting: ShortStorySetting) -> List[Dict[str, Any]]:
        """使用 LLM 智能拆分章节"""
        character_profiles = ""
        if setting.character_profiles:
            chars = setting.character_profiles
            if chars.get("protagonist"):
                p = chars["protagonist"]
                character_profiles += f"主角：{p.get('name', '未知')}，{p.get('age', '')}，{p.get('surface_identity', '')}（真实身份：{p.get('real_identity', '')}）\n"
            if chars.get("antagonist"):
                a = chars["antagonist"]
                character_profiles += f"对手：{a.get('name', '未知')}，{a.get('relationship_to_protagonist', '')}\n"

        key_scenes = ""
        if setting.key_scenes:
            for scene in setting.key_scenes:
                key_scenes += f"场景{scene.get('scene_id', '?')}：{scene.get('title', '')}\n- 描述：{scene.get('description', '')}\n\n"

        foreshadowing_twists = ""
        if setting.foreshadowing_twists:
            for pair in setting.foreshadowing_twists:
                fs = pair.get("foreshadowing", {})
                twist = pair.get("twist", {})
                foreshadowing_twists += f"伏笔对{pair.get('pair_id', '?')}：\n- 伏笔：{fs.get('content', '')}\n- 反转：{twist.get('reveal', '')}\n\n"

        prompt = CHAPTER_SPLIT_PROMPT.format(
            hook_description=setting.core_hook or "",
            narrative_order=setting.narrative_order or "线性叙事",
            target_length=setting.target_length or 8000,
            character_profiles=character_profiles or "未提供",
            key_scenes=key_scenes or "未提供",
            foreshadowing_twists=foreshadowing_twists or "未提供",
            narrative_order_detail=setting.narrative_order_detail or "未提供",
        )

        messages = [
            {"role": "system", "content": "你是一位资深短篇小说编辑，擅长故事结构设计和章节拆分。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            json_str = content[json_start:json_end] if json_start >= 0 and json_end > json_start else content
            data = json.loads(json_str)
            chapters = data.get("chapters", [])
            for ch in chapters:
                ch.setdefault("scenes_covered", [ch.get("order_index", 1)])
                ch.setdefault("estimated_words", 1000)
                ch.setdefault("core_goal", "推进剧情")
                ch.setdefault("emotion_target", "")
                ch.setdefault("ending_hook", "")
                ch.setdefault("plot_summary", "")
            return chapters
        except (json.JSONDecodeError, Exception) as e:
            logger.error("解析 LLM 章节拆分输出失败: %s", e)
            raise ValueError(f"解析章节拆分结果失败: {e}")

    # ============== Step 5: 逐章生成 ==============

    async def generate_chapter_content(self, db: AsyncSession, novel_id: str,
                                        chapter_num: int, feedback: Optional[str] = None) -> Chapter:
        """生成单章正文（带上下文管理）"""
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.order_index == chapter_num)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError("章节不存在")

        result = await db.execute(
            select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
        )
        setting = result.scalar_one_or_none()
        if not setting:
            raise ValueError("设定不存在")

        context = await self._build_generation_context(db, novel_id, chapter_num)

        scenes = setting.key_scenes or []
        chapter_scenes = [
            s for s in scenes if s.get("scene_id") in (chapter.scenes_covered or [chapter_num])
        ]
        scenes_desc = "\n".join([f"- {s.get('title', '')}: {s.get('description', '')}" for s in chapter_scenes]) or "按情节自然发展"

        prompt = CHAPTER_GENERATION_PROMPT.format(
            project_title=setting.core_hook[:30] if setting.core_hook else "短篇小说",
            hook_description=setting.core_hook or "",
            narrative_order=setting.narrative_order or "线性叙事",
            target_length=setting.target_length or 8000,
            chapter_number=chapter_num,
            total_chapters=await self._get_total_chapters(db, novel_id),
            chapter_title=chapter.title,
            core_goal=chapter.core_goal or "推进剧情",
            emotion_target=chapter.emotion_target or "",
            scenes=scenes_desc,
            estimated_words=chapter.estimated_words or 1500,
            ending_hook=chapter.ending_hook or "",
            previous_ending=context.get("previous_ending", ""),
            previous_summary=context.get("previous_summary", ""),
            established_facts=context.get("established_facts", ""),
            active_foreshadowing=context.get("active_foreshadowing", ""),
            character_states=context.get("character_states", ""),
        )

        if feedback:
            prompt = CHAPTER_REGENERATE_PROMPT.format(feedback=feedback, original_prompt=prompt)

        if self.llm and self.llm.api_key:
            try:
                content = await self._generate_with_llm(prompt)
            except Exception as e:
                logger.warning("LLM 生成章节失败，使用模拟数据: %s", e)
                content = self._generate_mock_chapter(chapter, feedback)
        else:
            content = self._generate_mock_chapter(chapter, feedback)

        # Agent 审查
        review_result = None
        if self.llm and self.llm.api_key and len(content) > 100:
            try:
                review_result = await self._review_chapter_content(
                    db=db, novel_id=novel_id, chapter_num=chapter_num,
                    chapter_title=chapter.title,
                    core_goal=chapter.core_goal or "推进剧情",
                    content=content
                )
                if review_result and not review_result.get("passed", True) and not feedback:
                    critical_issues = [
                        i for i in review_result.get("issues", []) if i.get("severity") == "critical"
                    ]
                    if critical_issues:
                        logger.warning("章节 %d 审查发现 %d 个严重问题，自动重试修复", chapter_num, len(critical_issues))
                        issues_feedback = "\n".join([
                            f"- {i.get('description', '')}: {i.get('suggestion', '')}" for i in critical_issues
                        ])
                        retry_prompt = CHAPTER_REGENERATE_PROMPT.format(
                            feedback=f"以下逻辑问题需要修复：\n{issues_feedback}", original_prompt=prompt
                        )
                        try:
                            content = await self._generate_with_llm(retry_prompt)
                            logger.info("章节 %d 自动修复完成", chapter_num)
                        except Exception as e:
                            logger.warning("自动修复章节 %d 失败: %s", chapter_num, e)
            except Exception as e:
                logger.warning("章节 %d 审查失败，跳过审查: %s", chapter_num, e)

        chapter.content = content
        chapter.word_count = len(content)
        chapter.status = "completed"
        if review_result:
            chapter.review_result = review_result

        total_chapters = await self._get_total_chapters(db, novel_id)
        if chapter_num == 1:
            await self._sync_novel_status(db, novel_id, "ongoing")
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.status == "completed")
        )
        completed_count = len(result.scalars().all())
        if completed_count >= total_chapters:
            await self._sync_novel_status(db, novel_id, "completed")
            setting.status = "completed"

        await db.commit()
        await db.refresh(chapter)
        logger.info("生成章节内容: novel_id=%s, chapter=%d, words=%d", novel_id, chapter_num, chapter.word_count)
        return chapter

    async def _build_generation_context(self, db: AsyncSession, novel_id: str, chapter_num: int) -> Dict[str, str]:
        """构建生成上下文"""
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.order_index < chapter_num)
            .where(Chapter.status == "completed").order_by(Chapter.order_index)
        )
        previous_chapters = result.scalars().all()

        previous_ending = ""
        if previous_chapters:
            last_chapter = previous_chapters[-1]
            if last_chapter.content:
                content = last_chapter.content
                previous_ending = content[-500:] if len(content) > 500 else content

        previous_summary = ""
        if previous_chapters:
            summaries = []
            for ch in previous_chapters:
                if ch.content:
                    content = ch.content
                    start = content[:100].strip()
                    end = content[-100:].strip() if len(content) > 100 else ""
                    summaries.append(f"第{ch.order_index}章《{ch.title}》：{start}...{end}")
            previous_summary = "\n".join(summaries)

        result = await db.execute(select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id))
        setting = result.scalar_one_or_none()

        established_facts = []
        if setting and setting.character_profiles:
            chars = setting.character_profiles
            if chars.get("protagonist"):
                p = chars["protagonist"]
                established_facts.append(f"主角{p.get('name', '')}的表面身份是{p.get('surface_identity', '')}")
                established_facts.append(f"主角的真实身份是{p.get('real_identity', '')}")
            if chars.get("antagonist"):
                a = chars["antagonist"]
                established_facts.append(f"对手{a.get('name', '')}的动机是{a.get('motivation', '')}")

        key_events = []
        for ch in previous_chapters:
            if ch.content:
                content = ch.content
                event_trigger = content[:100].strip().replace('\n', ' ')
                event_result = content[-100:].strip().replace('\n', ' ') if len(content) > 100 else ""
                key_events.append(f"第{ch.order_index}章：{event_trigger}... → {event_result}")
        if key_events:
            established_facts.append("\n【已发生的关键事件】")
            established_facts.extend(key_events)

        active_foreshadowing = []
        if setting and setting.foreshadowing_twists:
            for pair in setting.foreshadowing_twists:
                fs = pair.get("foreshadowing", {})
                twist = pair.get("twist", {})
                twist_location = twist.get("location", "")
                if "场景" in twist_location:
                    try:
                        scene_id = int(twist_location.replace("场景", ""))
                        if scene_id >= chapter_num:
                            active_foreshadowing.append(f"{fs.get('content', '')}（将在场景{scene_id}回收）")
                    except:
                        active_foreshadowing.append(fs.get("content", ""))
                else:
                    active_foreshadowing.append(fs.get("content", ""))

        character_states = []
        if setting and setting.character_profiles:
            chars = setting.character_profiles
            if chars.get("protagonist"):
                p = chars["protagonist"]
                state = f"{p.get('name', '主角')}：{p.get('arc', '暂无变化')}"
                if previous_chapters and previous_chapters[-1].content:
                    last_content = previous_chapters[-1].content
                    ending_hint = last_content[-50:].strip().replace('\n', ' ')
                    state += f" | 当前处境（基于上一章结尾）：{ending_hint}..."
                character_states.append(state)
            if chars.get("antagonist"):
                a = chars["antagonist"]
                character_states.append(f"{a.get('name', '对手')}：{a.get('motivation', '暂无变化')}")

        return {
            "previous_ending": previous_ending or "（本章为第一章，无前文）",
            "previous_summary": previous_summary or "无",
            "established_facts": "\n".join(f"- {f}" for f in established_facts) or "无",
            "active_foreshadowing": "\n".join(f"- {f}" for f in active_foreshadowing) or "无",
            "character_states": "\n".join(f"- {c}" for c in character_states) or "无",
        }

    async def _get_total_chapters(self, db: AsyncSession, novel_id: str) -> int:
        result = await db.execute(select(Chapter).where(Chapter.novel_id == novel_id))
        return len(result.scalars().all())

    async def _generate_with_llm(self, prompt: str) -> str:
        messages = [
            {"role": "system", "content": "你是一位专业的小说作家，擅长写短篇小说。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        return response["choices"][0]["message"]["content"]

    async def _review_chapter_content(self, db: AsyncSession, novel_id: str, chapter_num: int,
                                       chapter_title: str, core_goal: str, content: str) -> Optional[Dict[str, Any]]:
        """审查章节内容"""
        result = await db.execute(select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id))
        setting = result.scalar_one_or_none()
        if not setting:
            return None

        character_profiles = "未提供"
        if setting.character_profiles:
            chars = setting.character_profiles
            profiles = []
            if chars.get("protagonist"):
                p = chars["protagonist"]
                profiles.append(f"主角：{p.get('name', '未知')}，表面身份：{p.get('surface_identity', '')}，真实身份：{p.get('real_identity', '')}")
            if chars.get("antagonist"):
                a = chars["antagonist"]
                profiles.append(f"对手：{a.get('name', '未知')}，关系：{a.get('relationship_to_protagonist', '')}，动机：{a.get('motivation', '')}")
            character_profiles = "\n".join(profiles)

        established_facts = "无"
        if setting.character_profiles:
            chars = setting.character_profiles
            facts = []
            if chars.get("protagonist"):
                p = chars["protagonist"]
                facts.append(f"主角{p.get('name', '')}表面身份：{p.get('surface_identity', '')}")
                facts.append(f"主角真实身份：{p.get('real_identity', '')}")
            established_facts = "\n".join(facts) or "无"

        total_chapters = await self._get_total_chapters(db, novel_id)

        prompt = CHAPTER_REVIEW_PROMPT.format(
            chapter_number=chapter_num, total_chapters=total_chapters,
            chapter_title=chapter_title, core_goal=core_goal,
            character_profiles=character_profiles, established_facts=established_facts,
            chapter_content=content[:4000],
        )

        messages = [
            {"role": "system", "content": "你是一位资深小说编辑和质量审查员。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=2000)
        review_content = response["choices"][0]["message"]["content"]

        try:
            json_start = review_content.find("{")
            json_end = review_content.rfind("}") + 1
            data = json.loads(review_content[json_start:json_end]) if json_start >= 0 and json_end > json_start else json.loads(review_content)
            return data
        except (json.JSONDecodeError, Exception) as e:
            logger.warning("解析审查结果失败: %s", e)
            return {"passed": True, "checks": [], "issues": []}

    def _generate_mock_chapter(self, chapter: Chapter, feedback: Optional[str] = None) -> str:
        """生成模拟章节内容"""
        base_content = f"""{chapter.title}

这是第{chapter.order_index}章的模拟生成内容。"""

        if feedback:
            base_content += f"\n\n【根据反馈修改】\n用户反馈：{feedback}\n\n"

        base_content += """

林凡站在夜色中，城市的霓虹灯在他身后闪烁。他低头看了看手机，那条神秘订单的备注还在屏幕上——一串看似随机的数字。

"这到底是什么意思？"他皱起眉头。

作为一名普通的外卖员，林凡的生活简单而规律。每天接单、送餐、回家。但今晚，这串数字让他感到不安。

他回想起下午在餐厅遇到的那个人——赵天宇。那个总是带着轻蔑笑容的男人，当众羞辱他，说他这辈子就是个送外卖的命。

林凡握紧了拳头。没有人知道，他曾经是国家最精锐的特种兵。那些年的训练和战斗，让他拥有了常人难以想象的能力。

手机突然震动，又一条消息进来："爸爸，救我。"

林凡瞳孔骤缩。那是女儿苏婉的号码。

他立刻拨回去，但只听到冰冷的提示音："您拨打的号码已关机。"

那串数字……林凡突然意识到什么，手指飞快地在屏幕上滑动。经纬度坐标！这是女儿所在的位置！

他扔下电动车，拦下一辆出租车。"去城西废弃工厂，快！"

司机被他的气势吓到，一脚油门踩到底。

车窗外的景色飞速后退，林凡的心跳也随之加速。他不知道等待他的是什么，但有一点他很确定——

无论是谁，敢动他的女儿，都要付出代价。

（本章完）"""

        target_words = chapter.estimated_words or 1500
        while len(base_content) < target_words * 0.8:
            base_content += "\n\n林凡深吸一口气，推开了那扇生锈的铁门。黑暗中，他听到了微弱的哭泣声……"

        return base_content

    # ============== Step 6: 全文整合 ==============

    async def integrate_story(self, db: AsyncSession, novel_id: str) -> Dict[str, Any]:
        """全文整合与检查"""
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        result = await fix_service.check_and_find_issues(db, novel_id)

        setting_result = await db.execute(
            select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
        )
        setting = setting_result.scalar_one_or_none()
        if setting:
            setting.last_integration_result = result
            await db.commit()

        novel_result = await db.execute(select(Novel).where(Novel.id == novel_id))
        novel = novel_result.scalar_one_or_none()

        title_suggestions = None
        if novel and (not novel.title or novel.title in ('未命名短篇小说', '新建短篇小说', '随机生成的短篇小说')):
            try:
                chapters_result = await db.execute(
                    select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
                )
                chapters = chapters_result.scalars().all()
                title_suggestions = await self._generate_title_suggestions(setting, chapters)
            except Exception as e:
                logger.warning("生成作品名失败: %s", e)

        if title_suggestions:
            result["title_suggestions"] = title_suggestions

        if setting and setting.opening_hook:
            result["opening_hook"] = setting.opening_hook

        return result

    async def fix_integration_issues(self, db: AsyncSession, novel_id: str,
                                      issues: List[Dict[str, Any]]) -> List[IntegrationFix]:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        return await fix_service.fix_issues(db, novel_id, issues)

    async def apply_fix(self, db: AsyncSession, fix_id: str) -> None:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        await fix_service.apply_fix(db, fix_id)

    async def reject_fix(self, db: AsyncSession, fix_id: str) -> None:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        await fix_service.reject_fix(db, fix_id)

    async def modify_and_apply_fix(self, db: AsyncSession, fix_id: str, user_text: str) -> None:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        await fix_service.modify_and_apply_fix(db, fix_id, user_text)

    async def apply_all_fixes(self, db: AsyncSession, novel_id: str) -> Dict[str, Any]:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        return await fix_service.apply_all_fixes(db, novel_id)

    # ============== 开篇钩子 ==============

    async def generate_opening_hooks(self, db: AsyncSession, novel_id: str) -> List[Dict[str, str]]:
        setting = await self._get_or_create_setting(db, novel_id)
        if not setting.selected_plan_id:
            raise ValueError("请先选择方案")

        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
        )
        chapters = result.scalars().all()

        chapter_summaries = "\n".join([
            f"第{ch.order_index}章 {ch.title}: {ch.content[:80] if ch.content else '待生成'}..."
            for ch in chapters[:3]
        ])

        prompt = OPENING_HOOK_PROMPT.format(
            hook_description=setting.core_hook or "",
            narrative_order=setting.narrative_order or "线性叙事",
            ending_type=setting.ending_type or "反转结局",
            emotion_curve=setting.emotion_curve or "",
            chapter_summaries=chapter_summaries
        )

        messages = [
            {"role": "system", "content": "你是一位番茄小说平台的资深编辑，擅长写爆款开篇钩子。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=2000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            data = json.loads(content[json_start:json_end]) if json_start >= 0 and json_end > json_start else json.loads(content)
            return data.get("hooks", [])
        except (json.JSONDecodeError, Exception) as e:
            logger.error("解析开篇钩子失败: %s", e)
            return []

    async def select_opening_hook(self, db: AsyncSession, novel_id: str, hook_id: int) -> ShortStorySetting:
        setting = await self._get_or_create_setting(db, novel_id)
        hooks = setting.opening_hooks_list or []
        if isinstance(hooks, dict):
            hooks = [hooks]

        selected = None
        for h in hooks:
            if h.get("hook_id") == hook_id:
                selected = h
                break

        if not selected:
            raise ValueError("钩子不存在")

        setting.opening_hook = selected
        await db.commit()
        await db.refresh(setting)
        logger.info("选择开篇钩子: novel_id=%s, hook_id=%d", novel_id, hook_id)
        return setting

    # ============== 一键生成全部章节 ==============

    async def generate_all_chapters(self, db: AsyncSession, novel_id: str) -> Dict[str, Any]:
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
        )
        chapters = result.scalars().all()

        if not chapters:
            raise ValueError("没有可生成的章节")

        total = len(chapters)
        task_id = str(novel_id)

        _generation_progress[task_id] = {
            "status": "generating", "current_chapter": 0,
            "total_chapters": total, "progress_percent": 0,
        }

        try:
            for i, ch in enumerate(chapters):
                if ch.status == "completed" and ch.content:
                    continue
                await self.generate_chapter_content(db, novel_id, ch.order_index)
                _generation_progress[task_id] = {
                    "status": "generating", "current_chapter": i + 1,
                    "total_chapters": total, "progress_percent": int((i + 1) / total * 100),
                }

            _generation_progress[task_id]["status"] = "completed"
            _generation_progress[task_id]["progress_percent"] = 100

            return {"task_id": task_id, "status": "completed", "total_chapters": total, "current_chapter": total}
        except Exception as e:
            logger.error("一键生成全部章节失败: %s", e)
            _generation_progress[task_id]["status"] = "failed"
            raise

    def get_generation_progress(self, novel_id: str) -> Dict[str, Any]:
        task_id = str(novel_id)
        return _generation_progress.get(task_id, {
            "status": "pending", "current_chapter": 0, "total_chapters": 0, "progress_percent": 0,
        })

    # ============== 番外章 ==============

    async def add_extra_chapter(self, db: AsyncSession, novel_id: str, title: str,
                                  extra_type: str, description: str, estimated_words: int, insert_after: int) -> Chapter:
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.order_index > insert_after)
            .order_by(Chapter.order_index.desc())
        )
        chapters_to_shift = result.scalars().all()
        for ch in chapters_to_shift:
            ch.order_index += 1

        extra_chapter = Chapter(
            novel_id=novel_id, title=title, content="", status="draft",
            word_count=0, order_index=insert_after + 1,
            estimated_words=estimated_words, core_goal=description,
            emotion_target="", chapter_type="extra", extra_type=extra_type,
        )
        db.add(extra_chapter)
        await db.commit()
        await db.refresh(extra_chapter)
        logger.info("添加番外章: novel_id=%s, type=%s, title=%s", novel_id, extra_type, title)
        return extra_chapter

    async def generate_extra_chapter(self, db: AsyncSession, novel_id: str, chapter_num: int) -> Chapter:
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.order_index == chapter_num)
            .where(Chapter.chapter_type == "extra")
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError("番外章不存在")

        result = await db.execute(select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id))
        setting = result.scalar_one_or_none()

        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).where(Chapter.chapter_type == "main")
            .order_by(Chapter.order_index)
        )
        main_chapters = result.scalars().all()
        main_summary = "\n".join([
            f"第{ch.order_index}章 {ch.title}: {ch.content[:100] if ch.content else '待生成'}..."
            for ch in main_chapters[:3]
        ])

        extra_type_desc = {
            "background": "描写角色的过去，解释为什么TA会有这样的性格/动机",
            "motivation": "深入揭示角色的内心动机和隐藏秘密",
            "aftermath": "描写故事结束后，各角色的生活状态",
            "custom": "根据用户自定义要求创作",
        }.get(chapter.extra_type or "custom", "自定义番外")

        character_profiles = ""
        if setting and setting.character_profiles:
            chars = setting.character_profiles
            if chars.get("protagonist"):
                p = chars["protagonist"]
                character_profiles += f"主角：{p.get('name', '未知')}，{p.get('age', '')}，{p.get('surface_identity', '')}（真实身份：{p.get('real_identity', '')}）\n"

        prompt = EXTRA_CHAPTER_PROMPT.format(
            extra_type=chapter.extra_type or "custom", extra_type_desc=extra_type_desc,
            main_story_summary=main_summary, character_profiles=character_profiles or "未提供",
            description=chapter.core_goal or "", estimated_words=chapter.estimated_words or 1000,
        )

        messages = [
            {"role": "system", "content": "你是一位资深短篇小说作家，擅长写番外章节。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        content = response["choices"][0]["message"]["content"]

        chapter.content = content
        chapter.word_count = len(content)
        chapter.status = "completed"

        await db.commit()
        await db.refresh(chapter)
        return chapter

    # ============== 辅助方法 ==============

    async def _sync_novel_status(self, db: AsyncSession, novel_id: str, status: str) -> None:
        result = await db.execute(select(Novel).where(Novel.id == novel_id))
        novel = result.scalar_one_or_none()
        if novel:
            novel.status = status
            await db.commit()
            logger.info("同步 Novel 状态: novel_id=%s, status=%s", novel_id, status)

    async def get_fixes(self, db: AsyncSession, novel_id: str, batch_number: Optional[int] = None) -> List[IntegrationFix]:
        from app.services.integration_fix_service import IntegrationFixService
        fix_service = IntegrationFixService(self.llm)
        return await fix_service.get_fixes(db, novel_id, batch_number)

    async def _generate_title_suggestions(self, setting: Optional[ShortStorySetting],
                                           chapters: List[Chapter]) -> List[Dict[str, str]]:
        chapter_summaries = "\n".join([
            f"第{ch.order_index}章 {ch.title}: {ch.content[:50]}..." for ch in chapters[:3]
        ])

        prompt = TITLE_GENERATION_PROMPT.format(
            hook_description=setting.core_hook if setting else "",
            narrative_order=setting.narrative_order if setting else "线性叙事",
            ending_type=setting.ending_type if setting else "反转结局",
            emotion_curve=setting.emotion_curve if setting else "",
            chapter_summaries=chapter_summaries
        )

        messages = [
            {"role": "system", "content": "你是一位资深小说编辑，擅长为小说起吸引人的名字。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=2000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            json_str = content[json_start:json_end] if json_start >= 0 and json_end > json_start else content
            data = json.loads(json_str)
            return data.get("titles", [])
        except (json.JSONDecodeError, Exception) as e:
            logger.error("解析作品名失败: %s", e)
            return []

    # ============== 预设库服务 ==============

    async def random_combine(self, db: AsyncSession, hook_category: Optional[str] = None) -> Dict[str, Any]:
        """随机组合生成基础设定"""
        query = select(PresetHook)
        if hook_category:
            query = query.where(PresetHook.category == hook_category)
        result = await db.execute(query)
        hooks = result.scalars().all()

        if not hooks:
            from app.core.preset_data import PRESET_HOOKS
            hooks = PRESET_HOOKS
            if hook_category:
                hooks = [h for h in hooks if h["category"] == hook_category]
            if not hooks:
                raise ValueError("没有可用的爽点")
            selected_hook = random.choice(hooks)
            hook_data = {
                "category": selected_hook["category"],
                "title": selected_hook["title"],
                "description": random.choice(selected_hook.get("example_variants", [selected_hook["description"]]))
            }
        else:
            selected_hook = random.choice(hooks)
            variants = selected_hook.example_variants or [selected_hook.description]
            hook_data = {
                "category": selected_hook.category,
                "title": selected_hook.title,
                "description": random.choice(variants) if variants else selected_hook.description
            }

        result = await db.execute(select(PresetCharacterName).limit(50))
        names = result.scalars().all()

        if len(names) < 10:
            from app.core.preset_data import generate_character_names
            memory_names = generate_character_names()
            male_names = [n for n in memory_names if n["gender"] == "male"]
            female_names = [n for n in memory_names if n["gender"] == "female"]
        else:
            male_names = [n for n in names if n.gender == "male"]
            female_names = [n for n in names if n.gender == "female"]

        protagonist = random.choice(male_names) if male_names else None
        antagonist = random.choice(male_names) if male_names and len(male_names) > 1 else None
        supporting_list = []
        if female_names:
            supporting_list.append(random.choice(female_names))

        scene_pool = [s for s in SCENE_TEMPLATES]
        selected_scenes = random.sample(scene_pool, min(3, len(scene_pool)))
        scene_elements = []

        def get_char_name(n):
            if isinstance(n, dict):
                return f"{n['surname']}{n['name']}"
            return f"{n.surname}{n.name}" if n else "主角"

        p_name = get_char_name(protagonist)
        a_name = get_char_name(antagonist)
        for scene in selected_scenes:
            filled = scene["template"].replace("{主角}", p_name).replace("{对手}", a_name)
            scene_elements.append(f"【{scene['category']}】{filled}")

        conflict = random.choice(CONFLICT_TYPES)
        twist = random.choice(TWIST_TEMPLATES)
        twist_filled = twist["template"].replace("{人物A}", p_name).replace("{人物B}", a_name)
        era = random.choice(ERA_SETTINGS)
        ending = random.choice(ENDING_TYPES)

        def format_name(n):
            if isinstance(n, dict):
                return {"name": f"{n['surname']}{n['name']}", "gender": n["gender"], "style": n.get("style", "现代")}
            return {"name": f"{n.surname}{n.name}", "gender": n.gender, "style": n.style or "现代"}

        return {
            "hook": hook_data,
            "characters": {
                "protagonist": format_name(protagonist) if protagonist else {"name": "主角", "gender": "male", "style": "现代"},
                "antagonist": format_name(antagonist) if antagonist else {"name": "对手", "gender": "male", "style": "现代"},
                "supporting": [format_name(s) for s in supporting_list]
            },
            "setting": {"era": era["era"], "location": random.choice(era["locations"]), "genre": random.choice(era["genres"])},
            "elements": {"scenes": scene_elements, "conflict": {"type": conflict["type"], "description": conflict["description"]}},
            "twist": {"type": twist["type"], "description": twist_filled},
            "ending_type": ending
        }

    async def random_character_names(self, db: AsyncSession, count: int = 5,
                                       gender: Optional[str] = None, style: Optional[str] = None) -> List[Dict[str, str]]:
        query = select(PresetCharacterName)
        if gender:
            query = query.where(PresetCharacterName.gender == gender)
        if style:
            query = query.where(PresetCharacterName.style == style)
        query = query.limit(count)
        result = await db.execute(query)
        names = result.scalars().all()
        return [{"name": f"{n.surname}{n.name}", "gender": n.gender, "style": n.style or "现代"} for n in names]
