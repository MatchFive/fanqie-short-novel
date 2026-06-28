"""
AI 爽点生成服务
根据番茄分类标签生成核心爽点候选
纯本地运行版本
"""

import json
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ShortStoryCategory, PresetHook
from app.core.llm_client import LLMClient
from app.core.logging_config import get_logger
from app.services.category_service import CategoryService

logger = get_logger("fanqie_novel.hook_generation")


HOOK_GENERATION_PROMPT = """你是一位资深短篇小说编辑，熟悉番茄小说平台的内容生态和读者偏好。

请根据以下分类标签，生成 {count} 个不同的核心爽点（故事钩子）。

【分类标签】
- 主分类：{main_category}（{gender_orientation}）
  定位：{main_category_desc}
- 情节标签：{plot_tags}
- 角色标签：{character_tags}
- 情绪过程：{emotion_process}
- 故事背景：{story_background}
- 自定义标签：{custom_tags}
{custom_requirement}

【爽点生成要求】
1. 每个爽点必须严格围绕主分类"{main_category}"的核心关系展开
2. 必须包含情节标签中的元素：{plot_tags}
3. 必须体现角色标签特征：{character_tags}
4. 情绪走向要符合"{emotion_process}"过程
5. 场景要有"{story_background}"的典型元素
6. 爽点要有吸引力，一句话概括核心冲突或反转
7. 避免陈词滥调，力求新颖但符合平台调性
8. 爽点之间要有明显差异（不同角度、不同冲突、不同反转）

【输出格式】
每个爽点包含：
- hook_id: 编号
- title: 爽点标题（简洁有力，10字以内）
- description: 爽点描述（1-2句话，说清楚核心冲突）
- emotional_target: 目标情绪（爽/甜/虐/惊/暖）
- why_it_works: 为什么这个爽点能火（1句话）
- tags: 相关标签列表

请按以下 JSON 格式输出，不要输出其他内容：
{{
  "hooks": [
    {{
      "hook_id": 1,
      "title": "...",
      "description": "...",
      "emotional_target": "爽",
      "why_it_works": "...",
      "tags": ["..."]
    }}
  ]
}}
"""


class HookGenerationService:
    """爽点生成服务"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client

    @classmethod
    def from_config(cls) -> "HookGenerationService":
        """从配置创建实例（用于 save_to_preset 等无需 LLM 的操作）"""
        from app.config import settings
        client = None
        if settings.LLM_API_KEY:
            client = LLMClient(
                base_url=settings.LLM_BASE_URL,
                api_key=settings.LLM_API_KEY,
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
        return cls(llm_client=client)

    async def generate_hooks(
        self,
        category_config: ShortStoryCategory,
        count: int = 3,
        custom_requirement: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """根据分类标签生成爽点"""
        if not self.llm or not self.llm.api_key:
            raise ValueError("未配置 AI 模型 API Key")

        custom_req = f"\n【用户额外要求】\n{custom_requirement}\n" if custom_requirement else ""

        prompt = HOOK_GENERATION_PROMPT.format(
            count=count,
            main_category=category_config.main_category,
            gender_orientation=category_config.gender_orientation,
            main_category_desc=CategoryService.get_main_category_description(category_config.main_category),
            plot_tags=", ".join(category_config.plot_tags or []),
            character_tags=", ".join(category_config.character_tags or []),
            emotion_process=category_config.emotion_process or "",
            story_background=category_config.story_background or "",
            custom_tags=", ".join(category_config.custom_tags or []),
            custom_requirement=custom_req,
        )

        messages = [
            {"role": "system", "content": "你是一位资深短篇小说编辑，擅长设计吸引人的故事钩子。"},
            {"role": "user", "content": prompt}
        ]

        response = await self.llm.chat(messages, max_tokens=3000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(content[json_start:json_end])
            else:
                data = json.loads(content)

            hooks = data.get("hooks", [])
            for idx, hook in enumerate(hooks, start=1):
                hook["hook_id"] = idx
            return hooks
        except (json.JSONDecodeError, Exception) as e:
            logger.error("解析 LLM 爽点生成输出失败: %s", e)
            raise ValueError(f"解析生成结果失败: {e}")

    async def save_to_preset(
        self, db: AsyncSession, hook_data: Dict[str, Any], category_config: ShortStoryCategory
    ) -> PresetHook:
        """将 AI 生成的爽点保存到预设库"""
        tags = await self._extract_tags_from_hook(hook_data.get("description", ""))
        if not tags and hook_data.get("tags"):
            tags = hook_data["tags"]

        preset = PresetHook(
            category=category_config.main_category,
            title=hook_data.get("title", "未命名爽点"),
            description=hook_data.get("description", ""),
            emotional_target=hook_data.get("emotional_target", "爽"),
            example_variants=[hook_data.get("description", "")],
            tags=tags if tags else [],
            usage_count=0,
            source="user",
        )
        db.add(preset)
        await db.commit()
        await db.refresh(preset)
        logger.info("保存爽点到预设库: id=%s, title=%s", preset.id, preset.title)
        return preset

    async def _extract_tags_from_hook(self, description: str) -> List[str]:
        """从爽点描述中提取核心情节标签"""
        if not self.llm or not self.llm.api_key or not description:
            return []

        prompt = f"""请从以下爽点描述中提取3-5个关键词标签。

要求：
- 不要包含人名
- 只提取情节类型标签（如"重生"、"复仇"、"打脸"、"逆袭"）
- 标签要简洁，2-4个字

爽点：{description}

请直接输出 JSON 数组格式，不要输出其他内容：
["标签1", "标签2", "标签3"]"""

        messages = [
            {"role": "system", "content": "你是一位资深内容编辑，擅长提取关键词标签。"},
            {"role": "user", "content": prompt}
        ]

        try:
            response = await self.llm.chat(messages, max_tokens=500)
            content = response["choices"][0]["message"]["content"]

            json_start = content.find("[")
            json_end = content.rfind("]") + 1
            if json_start >= 0 and json_end > json_start:
                tags = json.loads(content[json_start:json_end])
                return [t for t in tags if isinstance(t, str) and len(t) <= 10]
            return []
        except Exception as e:
            logger.warning("提取标签失败: %s", e)
            return []
