/**
 * 短篇小说类型定义
 * 与后端 Pydantic Schema 对应
 */

// ============== 核心枚举 ==============

export type EmotionalTarget = '爽' | '甜' | '虐' | '惊' | '暖';
export type NarrativeOrder = '线性叙事' | '倒叙' | '插叙' | '环形叙事' | '多视角拼接';
export type EndingType = '圆满结局' | '悲剧结局' | '反转结局' | '开放式结局' | '讽刺结局';
export type ShortStoryStatus = 'draft' | 'planned' | 'generating' | 'completed';

// ============== 核心爽点 ==============

export interface CoreHook {
  id?: string;
  category: string;
  description: string;
  emotional_target: EmotionalTarget;
  is_custom?: boolean;
}

// ============== 基础设定方案 ==============

export interface Plan {
  plan_id: number;
  narrative_order: NarrativeOrder | string;
  plot_summary: string;
  ending_type: EndingType | string;
  emotion_curve: string;
  estimated_length: string;
  why_this_works: string;
}

export interface PlansResponse {
  plans: Plan[];
}

// ============== 详细规划 ==============

export interface CharacterProfile {
  name: string;
  age?: string;
  surface_identity?: string;
  real_identity?: string;
  desire?: string;
  fear?: string;
  secret?: string;
  flaw?: string;
  arc?: string;
  relationship_to_protagonist?: string;
  motivation?: string;
  why_opposing?: string;
  identity?: string;
  purpose_in_story?: string;
  key_trait?: string;
  role?: string;
}

export interface CharacterProfiles {
  protagonist: CharacterProfile;
  antagonist?: CharacterProfile;
  supporting?: CharacterProfile[];
}

export interface KeyScene {
  scene_id: number;
  title: string;
  description: string;
  purpose: '推进剧情' | '揭示人物' | '制造冲突' | '铺垫转折' | string;
  emotion: string;
  foreshadowing?: string;
  twist?: string;
}

export interface ForeshadowingTwistPair {
  pair_id: number;
  foreshadowing: {
    location: string;
    content: string;
    subtlety: number;
  };
  twist: {
    location: string;
    reveal: string;
    impact: number;
    satisfaction: string;
  };
}

export interface DetailPlan {
  characters: CharacterProfiles;
  key_scenes: KeyScene[];
  foreshadowing_twists: ForeshadowingTwistPair[];
  narrative_order_detail?: string;
}

// ============== 短篇小说设定 ==============

export interface ShortStorySetting {
  id: string;
  novel_id: string;
  core_hook?: string;
  hook_category?: string;
  emotional_target?: EmotionalTarget;
  narrative_order?: NarrativeOrder | string;
  plot_summary?: string;
  ending_type?: EndingType | string;
  emotion_curve?: string;
  target_length: number;
  generated_plans?: Plan[];
  selected_plan_id?: number;
  character_profiles?: CharacterProfiles;
  key_scenes?: KeyScene[];
  foreshadowing_twists?: ForeshadowingTwistPair[];
  narrative_order_detail?: string;
  opening_hook?: OpeningHook | null;
  status: ShortStoryStatus;
  created_at: string;
  updated_at: string;
}

// ============== 章节规划 ==============

export interface ShortStoryChapter {
  id: string;
  novel_id: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'generating';
  word_count: number;
  order_index: number;
  emotion_target?: string;
  ending_hook?: string;
  scenes_covered?: number[];
  core_goal?: string;
  estimated_words?: number;
  timeline_position?: string;
  plot_summary?: string;
  chapter_type?: 'main' | 'extra';
  extra_type?: 'background' | 'motivation' | 'aftermath' | 'custom';
  created_at: string;
  updated_at: string;
}

// ============== 预设库 ==============

export interface PresetHook {
  id: string;
  category: string;
  title: string;
  description: string;
  emotional_target: EmotionalTarget;
  example_variants?: string[];
  tags?: string[];
  usage_count: number;
  source?: 'system' | 'user';
  created_at: string;
}

export interface HookCategory {
  id: string;
  name: string;
  count: number;
}

export interface PresetHookList {
  items: PresetHook[];
  total: number;
  categories: HookCategory[];
}

export interface PresetCharacterName {
  id: string;
  surname: string;
  name: string;
  gender: 'male' | 'female';
  style?: '现代' | '古风' | '西幻';
  usage_count: number;
  created_at: string;
}

export interface RandomCombination {
  hook: { category: string; title: string; description: string };
  characters: {
    protagonist: { name: string; gender: string; style?: string };
    antagonist?: { name: string; gender: string; style?: string };
    supporting?: { name: string; gender: string; style?: string }[];
  };
  setting: { era: string; location: string; genre: string };
  elements: { scenes: string[]; conflict: { type: string; description: string } };
  twist: { type: string; description: string };
  ending_type: string;
}

// ============== API 请求/响应 ==============

export interface ShortStorySettingCreate {
  novel_id: string;
  core_hook?: string;
  hook_category?: string;
  emotional_target?: EmotionalTarget;
}

export interface ShortStorySettingUpdate {
  core_hook?: string;
  hook_category?: string;
  emotional_target?: EmotionalTarget;
  narrative_order?: NarrativeOrder | string;
  plot_summary?: string;
  ending_type?: EndingType | string;
  emotion_curve?: string;
  target_length?: number;
  selected_plan_id?: number;
  character_profiles?: CharacterProfiles;
  key_scenes?: KeyScene[];
  foreshadowing_twists?: ForeshadowingTwistPair[];
  narrative_order_detail?: string;
  generated_plans?: Plan[];
  status?: ShortStoryStatus;
}

export interface CoreHookSetRequest {
  hook_id?: string;
  custom_hook?: string;
  category?: string;
  emotional_target: EmotionalTarget;
  save_to_preset?: boolean;
}

export interface GeneratePlansRequest {
  count?: number;
  target_length?: number;
}

export interface SelectPlanRequest {
  plan_id: number;
  customizations?: {
    narrative_order?: string;
    plot_summary?: string;
    ending_type?: string;
    emotion_curve?: string;
  };
}

export interface ChapterGenerateRequest {
  feedback?: string;
}

export interface RandomCombineRequest {
  hook_category?: string;
}

export interface RandomCharacterNamesRequest {
  count?: number;
  gender?: 'male' | 'female';
  style?: '现代' | '古风' | '西幻';
}

// ============== 整合结果 ==============

export interface IntegrationCheck {
  item: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

export interface IntegrationResult {
  total_chapters: number;
  total_words: number;
  checks: IntegrationCheck[];
  suggestions: string[];
  full_text?: string;
  title_suggestions?: { title: string; reason: string }[];
  issues?: IntegrationIssue[];
  auto_fixable?: IntegrationIssue[];
  opening_hook?: { hook_id: number; content: string; angle: string };
}

export interface ExportResult {
  format: 'txt' | 'md' | 'epub';
  total_words: number;
  content: string;
}

// ============== 整合修复 ==============

export interface IntegrationIssue {
  issue_type: 'foreshadowing' | 'character' | 'timeline' | 'emotion' | 'style' | 'redundancy' | 'logic' | 'consistency';
  issue_description: string;
  severity: 'critical' | 'major' | 'minor';
  affected_chapters?: number[];
  suggestion: string;
}

export interface IntegrationFix {
  id: string;
  novel_id: string;
  batch_number: number;
  issue_type: string;
  issue_description: string;
  affected_chapters?: number[];
  original_text: string;
  fixed_text: string;
  fix_reason?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  user_modified_text?: string;
  created_at: string;
  updated_at: string;
}

export interface FixRequest {
  issues: IntegrationIssue[];
}

export interface FixBatchResponse {
  fixes: IntegrationFix[];
  batch_number: number;
}

export interface FixApplyRequest {
  fix_ids: string[];
}

export interface FixModifyRequest {
  fixed_text: string;
}

// ============== 番茄分类标签 ==============

export interface MainCategory {
  name: string;
  description: string;
  gender: '女频' | '男频' | '通用';
}

export interface PlotCategory {
  level1: string;
  level2: string;
  level3: string;
  tags: string[];
  remark?: string;
}

export interface CategoryConfig {
  id: string;
  novel_id: string;
  main_category: string;
  gender_orientation: '女频' | '男频' | '通用';
  plot_tags?: string[];
  plot_level1?: string;
  plot_level2?: string;
  plot_level3?: string;
  character_tags?: string[];
  emotion_process?: string;
  story_background?: string;
  custom_tags?: string[];
  target_length?: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryConfigCreate {
  main_category: string;
  gender_orientation: string;
  plot_tags?: string[];
  plot_level1?: string;
  plot_level2?: string;
  plot_level3?: string;
  character_tags?: string[];
  emotion_process?: string;
  story_background?: string;
  custom_tags?: string[];
  target_length?: number;
}

export interface CategoryMetadata {
  main_categories: MainCategory[];
  plot_categories: PlotCategory[];
  character_tags: string[];
  emotion_processes: string[];
  story_backgrounds: string[];
}

export interface GeneratedHook {
  hook_id: number;
  title: string;
  description: string;
  emotional_target: string;
  why_it_works: string;
  tags: string[];
}

export interface GenerateHooksRequest {
  count?: number;
  custom_requirement?: string;
}

export interface SelectHookRequest {
  hook_id?: number;
  hook_title?: string;
  hook_description?: string;
  custom_hook?: string;
  emotional_target?: string;
  save_to_preset?: boolean;
}

export interface SaveHookToPresetRequest {
  hook_title: string;
  hook_description: string;
  emotional_target: string;
  tags?: string[];
}

export interface OpeningHook {
  hook_id: number;
  content: string;
  angle: string;
}

export interface GenerationProgress {
  status: string;
  current_chapter: number;
  total_chapters: number;
  progress_percent: number;
}

export interface ExtraChapterCreate {
  title: string;
  extra_type: 'background' | 'motivation' | 'aftermath' | 'custom';
  description: string;
  estimated_words: number;
  insert_after: number;
}

// ============== 步骤进度 ==============

export interface StepProgressResponse {
  completed: boolean[];
  current_step: number;
}
