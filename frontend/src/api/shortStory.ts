/**
 * 短篇小说 API - 简化版（无 projectId）
 */
import client from './client';
import type {
  ShortStorySetting,
  ShortStorySettingCreate,
  ShortStorySettingUpdate,
  CoreHookSetRequest,
  GeneratePlansRequest,
  PlansResponse,
  SelectPlanRequest,
  ChapterGenerateRequest,
  ShortStoryChapter,
  PresetHookList,
  RandomCombineRequest,
  RandomCombination,
  IntegrationResult,
  ExportResult,
  RandomCharacterNamesRequest,
  CategoryConfig,
  CategoryConfigCreate,
  CategoryMetadata,
  GeneratedHook,
  GenerateHooksRequest,
  SelectHookRequest,
  SaveHookToPresetRequest,
  PresetHook,
  IntegrationFix,
  FixRequest,
  FixApplyRequest,
  FixModifyRequest,
  FixBatchResponse,
  StepProgressResponse,
  OpeningHook,
  ExtraChapterCreate,
  GenerationProgress,
} from '@/types/shortStory';

export const shortStoryApi = {
  /** 获取步骤进度 */
  getProgress: (novelId: string) =>
    client.get<StepProgressResponse>(`/short-stories/${novelId}/progress`),

  // ============== 设定管理 ==============

  createSetting: (novelId: string, data: ShortStorySettingCreate) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/setting`, data),

  getSetting: (novelId: string) =>
    client.get<ShortStorySetting>(`/short-stories/${novelId}/setting`),

  updateSetting: (novelId: string, data: ShortStorySettingUpdate) =>
    client.put<ShortStorySetting>(`/short-stories/${novelId}/setting`, data),

  // ============== Step 1: 分类配置 ==============

  getCategoryMetadata: () =>
    client.get<CategoryMetadata>(`/short-stories/categories/metadata`),

  createCategoryConfig: (novelId: string, data: CategoryConfigCreate) =>
    client.post<CategoryConfig>(`/short-stories/${novelId}/categories`, data),

  getCategoryConfig: (novelId: string) =>
    client.get<CategoryConfig>(`/short-stories/${novelId}/categories`),

  updateCategoryConfig: (novelId: string, data: Partial<CategoryConfigCreate>) =>
    client.put<CategoryConfig>(`/short-stories/${novelId}/categories`, data),

  // ── 用户自定义分类持久化（JSON 文件）──

  getUserCustomData: () =>
    client.get<{ user_plots: any[]; user_chars: string[] }>(`/short-stories/categories/user-custom`),

  saveUserPlots: (plots: any[]) =>
    client.post<{ status: string; count: number }>(`/short-stories/categories/user-plots`, { plots }),

  saveUserChars: (chars: string[]) =>
    client.post<{ status: string; count: number }>(`/short-stories/categories/user-chars`, { chars }),

  // ============== Step 2: 核心爽点 ==============

  generateHooks: (novelId: string, data: GenerateHooksRequest) =>
    client.post<{ hooks: GeneratedHook[] }>(`/short-stories/${novelId}/hooks/generate`, data),

  selectHook: (novelId: string, data: SelectHookRequest) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/hooks/select`, data),

  saveHookToPreset: (novelId: string, data: SaveHookToPresetRequest) =>
    client.post<PresetHook>(`/short-stories/${novelId}/hooks/save-preset`, data),

  setCoreHook: (novelId: string, data: CoreHookSetRequest) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/hook`, data),

  // ============== Step 3: 方案生成 ==============

  generatePlans: (novelId: string, data: GeneratePlansRequest) =>
    client.post<PlansResponse>(`/short-stories/${novelId}/generate-plans`, data),

  selectPlan: (novelId: string, data: SelectPlanRequest) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/select-plan`, data),

  // ============== Step 4: 详细规划 ==============

  generateDetailPlan: (novelId: string) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/generate-detail`),

  // ============== Step 5: 章节拆分 ==============

  listChapters: (novelId: string) =>
    client.get<ShortStoryChapter[]>(`/short-stories/${novelId}/chapters`),

  generateChapters: (novelId: string) =>
    client.post<ShortStoryChapter[]>(`/short-stories/${novelId}/generate-chapters`),

  // ============== Step 6: 逐章生成 ==============

  generateChapter: (novelId: string, chapterNum: number, data?: ChapterGenerateRequest) =>
    client.post<ShortStoryChapter>(`/short-stories/${novelId}/chapters/${chapterNum}/generate`, data || {}),

  regenerateChapter: (novelId: string, chapterNum: number, data: ChapterGenerateRequest) =>
    client.post<ShortStoryChapter>(`/short-stories/${novelId}/chapters/${chapterNum}/regenerate`, data),

  updateChapter: (novelId: string, chapterNum: number, data: { content?: string; status?: 'draft' | 'completed' }) =>
    client.patch<ShortStoryChapter>(`/short-stories/${novelId}/chapters/${chapterNum}`, data),

  // ============== Step 7: 全文整合 ==============

  integrate: (novelId: string) =>
    client.post<{ data: IntegrationResult }>(`/short-stories/${novelId}/integrate`),

  export: (novelId: string, format: 'txt' | 'md' | 'epub' = 'txt') =>
    client.get<{ data: ExportResult }>(`/short-stories/${novelId}/export?format=${format}`),

  // ============== 整合修复 ==============

  fixIssues: (novelId: string, data: FixRequest) =>
    client.post<FixBatchResponse>(`/short-stories/${novelId}/fix`, data),

  applyFixes: (novelId: string, data: FixApplyRequest) =>
    client.post<{ code: number; message: string }>(`/short-stories/${novelId}/fix/apply`, data),

  rejectFix: (novelId: string, fixId: string) =>
    client.post<{ code: number; message: string }>(`/short-stories/${novelId}/fix/${fixId}/reject`),

  modifyFix: (novelId: string, fixId: string, data: FixModifyRequest) =>
    client.put<{ code: number; message: string }>(`/short-stories/${novelId}/fix/${fixId}`, data),

  getFixes: (novelId: string, batchNumber?: number) =>
    client.get<IntegrationFix[]>(`/short-stories/${novelId}/fixes`, { params: { batch_number: batchNumber } }),

  applyAllFixes: (novelId: string) =>
    client.put<{ code: number; message: string; data: any }>(`/short-stories/${novelId}/fix/apply-all`),

  // ============== 一键生成全部章节 ==============

  generateAllChapters: (novelId: string) =>
    client.post<{ task_id: string; status: string; total_chapters: number; current_chapter: number }>(`/short-stories/${novelId}/chapters/generate-all`),

  getGenerationProgress: (novelId: string) =>
    client.get<GenerationProgress>(`/short-stories/${novelId}/chapters/generate-all/progress`),

  // ============== 开篇钩子 ==============

  generateOpeningHooks: (novelId: string) =>
    client.post<{ hooks: OpeningHook[] }>(`/short-stories/${novelId}/opening-hooks/generate`),

  selectOpeningHook: (novelId: string, hookId: number) =>
    client.post<ShortStorySetting>(`/short-stories/${novelId}/opening-hooks/select`, { hook_id: hookId }),

  // ============== 番外章 ==============

  addExtraChapter: (novelId: string, data: ExtraChapterCreate) =>
    client.post<ShortStoryChapter>(`/short-stories/${novelId}/extra-chapters`, data),

  deleteExtraChapter: (novelId: string, chapterId: string) =>
    client.delete(`/short-stories/${novelId}/extra-chapters/${chapterId}`),

  generateExtraChapter: (novelId: string, chapterNum: number) =>
    client.post<ShortStoryChapter>(`/short-stories/${novelId}/extra-chapters/${chapterNum}/generate`),

  // ============== 预设库 ==============

  listPresetHooks: (params?: { category?: string; search?: string; source?: 'system' | 'user'; page?: number; page_size?: number }) =>
    client.get<PresetHookList>(`/short-stories/presets/hooks`, { params }),

  listHookCategories: () =>
    client.get<{ categories: { id: string; name: string; count: number }[] }>(`/short-stories/presets/hooks/categories`),

  randomCombine: (data?: RandomCombineRequest) =>
    client.post<RandomCombination>(`/short-stories/presets/combine`, data || {}),

  randomCharacterNames: (params?: RandomCharacterNamesRequest) =>
    client.get<{ names: { name: string; gender: string; style: string }[] }>(`/short-stories/presets/characters/random`, { params }),
};

/** 创建短篇小说 */
export function createShortStoryApi(title?: string) {
  return client.post<{ id: string }>(`/short-stories/novels`, { title: title || '未命名短篇小说' });
}

/** 更新小说标题 */
export function updateNovelApi(novelId: string, title: string) {
  return client.put(`/short-stories/novels/${novelId}`, { title });
}

/** 获取小说列表 */
export function listNovelsApi() {
  return client.get<NovelListItem[]>(`/short-stories/novels`);
}

/** 删除小说 */
export function deleteNovelApi(novelId: string) {
  return client.delete(`/short-stories/novels/${novelId}`);
}

/** 小说列表项 */
export interface NovelListItem {
  id: string;
  title: string;
  type: string;
  genre: string | null;
  target_word_count: number | null;
  word_count?: number;   // 实际已写字数（聚合章节）
  status: string;
  created_at: string;
  updated_at: string;
}
