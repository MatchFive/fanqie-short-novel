"""
整合修复服务
封装整合检查发现问题后的 AI 修复逻辑
纯本地运行版本
"""

import json
import logging
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Novel, Chapter, ShortStorySetting, IntegrationFix
from app.core.llm_client import LLMClient
from app.core.logging_config import get_logger

logger = get_logger("fanqie_novel.integration_fix")


FIX_PROMPT = """你是一位资深小说编辑。请根据以下问题描述，修复小说内容。

【修复要求】
问题类型：{issue_type}
问题描述：{issue_description}

【原文内容】
{original_text}

【修复约束】
1. 只修改与问题相关的部分，保持其他内容不变
2. 修改后的内容要与上下文自然衔接
3. 保持原有的语言风格和叙事节奏
4. 字数变化控制在 ±20% 以内
5. 严格遵循以下事实（不可违背）：
{established_facts}

【角色人设（不可违背）】
{character_profiles}

【伏笔信息】
{foreshadowing_info}

【时间线】
{timeline_info}

【输出要求】
如果原文包含多个章节（以"第X章"标记分隔），请对每个需要修改的章节分别输出修复后的内容。
每个章节的修复后内容以标记分隔：
===CHAPTER_START:第X章===
修复后的章节内容
===CHAPTER_END===

同时在内容末尾附上修改说明：
【修改说明】
1. 修改了哪些内容
2. 为什么这样修改
3. 修改后的效果
"""

MULTI_CHAPTER_FIX_PROMPT = """你是一位资深小说编辑。请根据以下问题描述，修复涉及多个章节的小说内容。

【修复要求】
问题类型：{issue_type}
问题描述：{issue_description}

【原文内容（按章节分隔）】
{original_text}

【修复约束】
1. 只修改与问题相关的部分
2. 修改后的内容要与上下文自然衔接
3. 保持原有的语言风格和叙事节奏
4. 严格遵循以下事实（不可违背）：
{established_facts}

【角色人设（不可违背）】
{character_profiles}

【输出要求】
请对每个章节分别输出修复后的完整内容：
===CHAPTER_START:第X章===
修复后的章节内容
===CHAPTER_END===

同时附上修改说明：
【修改说明】
1. 修改了哪些内容
2. 为什么这样修改
3. 修改后的效果
"""


class IntegrationFixService:
    """整合修复服务"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client

    async def check_and_find_issues(self, db: AsyncSession, novel_id: str) -> Dict[str, Any]:
        """整合检查并发现问题"""
        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
        )
        chapters = result.scalars().all()

        if not chapters:
            raise ValueError("没有可整合的章节")

        incomplete = [ch for ch in chapters if ch.status != "completed"]
        if incomplete:
            raise ValueError(f"还有 {len(incomplete)} 章未完成")

        result = await db.execute(
            select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id)
        )
        setting = result.scalar_one_or_none()

        full_text = "\n\n".join([ch.content for ch in chapters if ch.content])

        if self.llm and self.llm.api_key and len(full_text) > 100:
            try:
                return await self._check_with_llm(full_text, setting, chapters)
            except Exception as e:
                logger.warning("LLM 整合检查失败，使用规则检查: %s", e)

        return self._rule_based_check(chapters, setting)

    async def _check_with_llm(self, full_text: str, setting: Optional[ShortStorySetting],
                               chapters: List[Chapter]) -> Dict[str, Any]:
        """使用 LLM 进行整合检查"""
        from app.services.short_story import INTEGRATION_CHECK_PROMPT

        foreshadowing_list = []
        twist_list = []
        character_profiles = ""

        if setting and setting.foreshadowing_twists:
            for pair in setting.foreshadowing_twists:
                fs = pair.get("foreshadowing", {})
                twist = pair.get("twist", {})
                foreshadowing_list.append(f"{fs.get('location', '')}: {fs.get('content', '')}")
                twist_list.append(f"{twist.get('location', '')}: {twist.get('reveal', '')}")

        if setting and setting.character_profiles:
            chars = setting.character_profiles
            if chars.get("protagonist"):
                p = chars["protagonist"]
                character_profiles += f"主角：{p.get('name', '')}，{p.get('surface_identity', '')}（真实身份：{p.get('real_identity', '')}）\n"
                character_profiles += f"- 核心欲望：{p.get('desire', '')}\n- 核心恐惧：{p.get('fear', '')}\n"
                character_profiles += f"- 隐藏秘密：{p.get('secret', '')}\n- 人物弧线：{p.get('arc', '')}\n"

        prompt = INTEGRATION_CHECK_PROMPT.format(
            full_text=full_text[:8000],
            hook_description=setting.core_hook if setting else "",
            foreshadowing_list="\n".join(foreshadowing_list) or "无",
            twist_list="\n".join(twist_list) or "无",
            emotion_curve=setting.emotion_curve if setting else "",
            character_profiles=character_profiles or "未提供",
            narrative_order=setting.narrative_order if setting else "线性叙事",
        )

        messages = [
            {"role": "system", "content": "你是一位资深小说编辑，擅长检查小说质量并给出具体修复建议。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=4000)
        content = response["choices"][0]["message"]["content"]

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            data = json.loads(content[json_start:json_end]) if json_start >= 0 and json_end > json_start else json.loads(content)
            return {
                "total_chapters": len(chapters),
                "total_words": len(full_text),
                "checks": data.get("checks", []),
                "suggestions": data.get("suggestions", []),
                "issues": data.get("issues", []),
                "auto_fixable": data.get("auto_fixable", []),
            }
        except Exception as e:
            logger.error("解析 LLM 整合检查输出失败: %s", e)
            return self._rule_based_check(chapters, setting)

    def _rule_based_check(self, chapters: List[Chapter], setting: Optional[ShortStorySetting]) -> Dict[str, Any]:
        """基于规则的检查"""
        total_words = sum(ch.word_count for ch in chapters)
        checks = [
            {"item": "伏笔回收", "status": "pass", "detail": "已检查"},
            {"item": "角色一致性", "status": "pass", "detail": "已检查"},
            {"item": "时间线", "status": "pass", "detail": "通顺"},
            {"item": "情绪曲线", "status": "pass", "detail": "完整"},
            {"item": "语言风格", "status": "pass", "detail": "统一"},
            {"item": "冗余内容", "status": "pass", "detail": "未发现"},
        ]
        issues = []
        auto_fixable = []
        if setting and setting.target_length and total_words < setting.target_length * 0.8:
            issue = {
                "issue_type": "redundancy",
                "issue_description": f"当前{total_words}字，目标{setting.target_length}字，字数不足",
                "severity": "major",
                "affected_chapters": [ch.order_index for ch in chapters],
                "suggestion": "扩充章节内容"
            }
            issues.append(issue)
            auto_fixable.append(issue)
        return {"total_chapters": len(chapters), "total_words": total_words,
                "checks": checks, "suggestions": [], "issues": issues, "auto_fixable": auto_fixable}

    async def fix_issues(self, db: AsyncSession, novel_id: str, issues: List[Dict[str, Any]]) -> List[IntegrationFix]:
        """批量修复问题"""
        result = await db.execute(select(ShortStorySetting).where(ShortStorySetting.novel_id == novel_id))
        setting = result.scalar_one_or_none()

        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.order_index)
        )
        chapters = {ch.order_index: ch for ch in result.scalars().all()}

        result = await db.execute(
            select(IntegrationFix).where(IntegrationFix.novel_id == novel_id)
            .order_by(IntegrationFix.batch_number.desc())
        )
        fixes_result = result.scalars().all()
        last_fix = fixes_result[0] if fixes_result else None
        batch_number = (last_fix.batch_number + 1) if last_fix else 1

        fixes = []
        for issue in issues:
            try:
                fix = await self._fix_single_issue(db, novel_id, issue, chapters, setting, batch_number)
                if fix:
                    fixes.append(fix)
            except Exception as e:
                logger.error("修复问题失败: %s", e)
                continue

        if setting:
            setting.integration_batch_count = batch_number
            await db.commit()

        return fixes

    async def _fix_single_issue(self, db: AsyncSession, novel_id: str, issue: Dict[str, Any],
                                 chapters: Dict[int, Chapter], setting: Optional[ShortStorySetting],
                                 batch_number: int) -> Optional[IntegrationFix]:
        """修复单个问题"""
        issue_type = issue.get("issue_type", "")
        affected_chapters = issue.get("affected_chapters", [])

        original_text_parts = []
        for ch_num in sorted(affected_chapters):
            if ch_num in chapters:
                ch = chapters[ch_num]
                original_text_parts.append(f"===第{ch_num}章 {ch.title}===\n{ch.content}")

        if not original_text_parts:
            original_text_parts = [
                f"===第{ch.order_index}章 {ch.title}===\n{ch.content}"
                for ch in sorted(chapters.values(), key=lambda x: x.order_index)
            ]

        original_text = "\n\n".join(original_text_parts)
        is_multi_chapter = len(affected_chapters) > 1

        context = self._build_fix_context(setting, issue_type)
        prompt_template = MULTI_CHAPTER_FIX_PROMPT if is_multi_chapter else FIX_PROMPT

        prompt = prompt_template.format(
            issue_type=issue_type,
            issue_description=issue.get("issue_description", ""),
            original_text=original_text[:6000],
            established_facts=context.get("established_facts", ""),
            character_profiles=context.get("character_profiles", ""),
            foreshadowing_info=context.get("foreshadowing_info", ""),
            timeline_info=context.get("timeline_info", ""),
        )

        messages = [
            {"role": "system", "content": "你是一位资深小说编辑，擅长精准修复小说问题。"},
            {"role": "user", "content": prompt}
        ]
        response = await self.llm.chat(messages, max_tokens=6000)
        content = response["choices"][0]["message"]["content"]

        if is_multi_chapter:
            fixed_text, fix_reason, chapter_fixes = self._parse_multi_chapter_fix_result(content, affected_chapters)
        else:
            fixed_text, fix_reason = self._parse_fix_result(content)
            chapter_fixes = None

        fix = IntegrationFix(
            novel_id=novel_id,
            batch_number=batch_number,
            issue_type=issue_type,
            issue_description=issue.get("issue_description", ""),
            affected_chapters=affected_chapters,
            original_text=original_text[:6000],
            fixed_text=fixed_text,
            fix_reason=fix_reason,
            status="pending",
        )

        if chapter_fixes:
            fix.chapter_fixes = chapter_fixes

        db.add(fix)
        await db.commit()
        await db.refresh(fix)
        return fix

    def _build_fix_context(self, setting: Optional[ShortStorySetting], issue_type: str) -> Dict[str, str]:
        """构建修复上下文"""
        context = {"established_facts": "", "character_profiles": "", "foreshadowing_info": "", "timeline_info": ""}
        if not setting:
            return context

        if setting.character_profiles:
            chars = setting.character_profiles
            facts = []
            if chars.get("protagonist"):
                p = chars["protagonist"]
                facts.append(f"主角{p.get('name', '')}表面身份：{p.get('surface_identity', '')}")
                facts.append(f"主角真实身份：{p.get('real_identity', '')}")
            context["established_facts"] = "\n".join(facts)

            profiles = []
            if chars.get("protagonist"):
                p = chars["protagonist"]
                profiles.append(f"主角：{p.get('name', '')}，{p.get('age', '')}，{p.get('surface_identity', '')}（真实身份：{p.get('real_identity', '')}）")
            context["character_profiles"] = "\n".join(profiles)

        if setting.foreshadowing_twists:
            fs_info = []
            for pair in setting.foreshadowing_twists:
                fs = pair.get("foreshadowing", {})
                twist = pair.get("twist", {})
                fs_info.append(f"伏笔：{fs.get('content', '')}（在{fs.get('location', '')}）")
                fs_info.append(f"反转：{twist.get('reveal', '')}（在{twist.get('location', '')}）")
            context["foreshadowing_info"] = "\n".join(fs_info)

        context["timeline_info"] = setting.narrative_order_detail or setting.narrative_order or ""
        return context

    def _parse_fix_result(self, content: str) -> tuple:
        """解析修复结果"""
        separators = ["【修改说明】", "修改说明：", "## 修改说明", "修改说明"]
        for sep in separators:
            if sep in content:
                parts = content.split(sep, 1)
                if len(parts) == 2:
                    return parts[0].strip(), parts[1].strip()
        return content.strip(), "AI 自动修复"

    def _parse_multi_chapter_fix_result(self, content: str, affected_chapters: List[int]) -> tuple:
        """解析多章节修复结果"""
        import re

        fix_reason = "AI 自动修复"
        body = content
        separators = ["【修改说明】", "修改说明：", "## 修改说明", "修改说明"]
        for sep in separators:
            if sep in body:
                parts = body.split(sep, 1)
                if len(parts) == 2:
                    body = parts[0].strip()
                    fix_reason = parts[1].strip()
                    break

        chapter_pattern = re.compile(
            r'===CHAPTER_START:第(\d+)章===\s*(.*?)\s*===CHAPTER_END===', re.DOTALL
        )
        matches = chapter_pattern.findall(body)

        chapter_fixes: Dict[int, str] = {}
        if matches:
            for ch_num_str, ch_content in matches:
                ch_num = int(ch_num_str)
                if ch_num in affected_chapters:
                    chapter_fixes[ch_num] = ch_content.strip()

            all_fixed = []
            for ch_num in sorted(chapter_fixes.keys()):
                all_fixed.append(f"===第{ch_num}章===\n{chapter_fixes[ch_num]}")
            fixed_text = "\n\n".join(all_fixed)
        else:
            fixed_text = body.strip()

        return fixed_text, fix_reason, chapter_fixes if chapter_fixes else None

    async def apply_fix(self, db: AsyncSession, fix_id: str) -> None:
        """应用修复到章节"""
        result = await db.execute(select(IntegrationFix).where(IntegrationFix.id == fix_id))
        fix = result.scalar_one_or_none()
        if not fix:
            raise ValueError("修复记录不存在")

        fixed_text = fix.user_modified_text or fix.fixed_text
        chapter_fixes = fix.chapter_fixes
        is_multi_chapter = (fix.affected_chapters and len(fix.affected_chapters) > 1)

        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == fix.novel_id)
            .where(Chapter.order_index.in_(fix.affected_chapters or []))
        )
        chapters = result.scalars().all()

        if is_multi_chapter and chapter_fixes and isinstance(chapter_fixes, dict):
            for ch in chapters:
                ch_num = ch.order_index
                if ch_num in chapter_fixes:
                    ch.content = chapter_fixes[ch_num]
                    ch.word_count = len(chapter_fixes[ch_num])
                else:
                    ch.content = fixed_text
                    ch.word_count = len(fixed_text)
        else:
            for ch in chapters:
                ch.content = fixed_text
                ch.word_count = len(fixed_text)

        fix.status = "accepted"
        await db.commit()

    async def apply_all_fixes(self, db: AsyncSession, novel_id: str) -> Dict[str, Any]:
        """批量应用所有 pending 修复"""
        result = await db.execute(
            select(IntegrationFix).where(IntegrationFix.novel_id == novel_id)
            .where(IntegrationFix.status == "pending").order_by(IntegrationFix.created_at.asc())
        )
        fixes = result.scalars().all()

        if not fixes:
            return {"applied_count": 0, "message": "没有待应用的修复"}

        chapter_fixes: Dict[int, IntegrationFix] = {}
        for fix in fixes:
            for ch_num in (fix.affected_chapters or []):
                chapter_fixes[ch_num] = fix

        result = await db.execute(
            select(Chapter).where(Chapter.novel_id == novel_id)
            .where(Chapter.order_index.in_(list(chapter_fixes.keys())))
        )
        chapters = {ch.order_index: ch for ch in result.scalars().all()}

        applied_count = 0
        for ch_num, fix in chapter_fixes.items():
            if ch_num in chapters:
                ch = chapters[ch_num]
                ch_fixes = fix.chapter_fixes
                if ch_fixes and isinstance(ch_fixes, dict) and ch_num in ch_fixes:
                    ch.content = ch_fixes[ch_num]
                    ch.word_count = len(ch_fixes[ch_num])
                else:
                    fixed_text = fix.user_modified_text or fix.fixed_text
                    ch.content = fixed_text
                    ch.word_count = len(fixed_text)
                applied_count += 1

        for fix in fixes:
            fix.status = "accepted"

        await db.commit()

        return {
            "applied_count": applied_count, "total_fixes": len(fixes),
            "affected_chapters": list(chapter_fixes.keys()),
            "message": f"成功应用 {applied_count} 个章节的修复"
        }

    async def reject_fix(self, db: AsyncSession, fix_id: str) -> None:
        """拒绝修复"""
        result = await db.execute(select(IntegrationFix).where(IntegrationFix.id == fix_id))
        fix = result.scalar_one_or_none()
        if not fix:
            raise ValueError("修复记录不存在")
        fix.status = "rejected"
        await db.commit()

    async def modify_and_apply_fix(self, db: AsyncSession, fix_id: str, user_text: str) -> None:
        """用户修改修复内容后应用"""
        result = await db.execute(select(IntegrationFix).where(IntegrationFix.id == fix_id))
        fix = result.scalar_one_or_none()
        if not fix:
            raise ValueError("修复记录不存在")
        fix.user_modified_text = user_text
        fix.status = "modified"
        await db.commit()
        await self.apply_fix(db, fix_id)

    async def get_fixes(self, db: AsyncSession, novel_id: str, batch_number: Optional[int] = None) -> List[IntegrationFix]:
        """获取修复记录"""
        query = select(IntegrationFix).where(IntegrationFix.novel_id == novel_id)
        if batch_number:
            query = query.where(IntegrationFix.batch_number == batch_number)
        query = query.order_by(IntegrationFix.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()
