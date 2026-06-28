/**
 * 短篇小说状态管理 - 独立版（无需 projectId）
 */
import { create } from 'zustand';
import { shortStoryApi, createShortStoryApi } from '@/api/shortStory';
import type {
  ShortStorySetting,
  ShortStorySettingUpdate,
  CoreHook,
  Plan,
  CharacterProfiles,
  KeyScene,
  ForeshadowingTwistPair,
  ShortStoryChapter,
  PresetHook,
  RandomCombination,
  CategoryConfig,
  CategoryConfigCreate,
  CategoryMetadata,
  GeneratedHook,
  GenerateHooksRequest,
  SelectHookRequest,
  IntegrationIssue,
  IntegrationFix,
  StepProgressResponse,
  OpeningHook,
} from '@/types/shortStory';

interface ShortStoryState {
  novelId: string | null;
  setting: ShortStorySetting | null;

  stepProgress: boolean[] | null;
  currentStep: number;
  isLoadingProgress: boolean;

  // Step 1: 分类配置
  categoryConfig: CategoryConfig | null;
  categoryConfigLoaded: boolean;
  categoryMetadata: CategoryMetadata | null;
  isLoadingCategoryMetadata: boolean;

  // Step 2: 爽点选择
  selectedHook: CoreHook | null;
  customHookInput: string;
  generatedHooks: GeneratedHook[];
  isGeneratingHooks: boolean;
  presetHooks: PresetHook[];
  hookCategories: { id: string; name: string; count: number }[];
  isLoadingHooks: boolean;

  // Step 3: 方案生成
  generatedPlans: Plan[];
  selectedPlan: Plan | null;
  isGeneratingPlans: boolean;

  // Step 4: 详细规划
  detailPlan: {
    characters: CharacterProfiles | null;
    keyScenes: KeyScene[];
    foreshadowingTwists: ForeshadowingTwistPair[];
    narrativeOrderDetail: string;
  } | null;
  isGeneratingPlan: boolean;

  // Step 5: 章节规划
  chapterPlan: ShortStoryChapter[];
  isGeneratingChapters: boolean;

  // Step 6: 写作
  currentChapter: number;
  isGenerating: boolean;
  generationProgress: number;

  // Step 7: 整合
  isIntegrating: boolean;
  integrationResult: {
    totalChapters: number;
    totalWords: number;
    checks: { item: string; status: string; detail: string }[];
    suggestions: string[];
    issues: IntegrationIssue[];
    auto_fixable: IntegrationIssue[];
    title_suggestions?: { title: string; reason: string }[];
  } | null;

  // 一键生成
  isGeneratingAll: boolean;
  generationAllProgress: number;

  // 开篇钩子
  openingHooks: OpeningHook[];
  selectedOpeningHook: OpeningHook | null;

  // 修复
  isFixing: boolean;
  fixes: IntegrationFix[];
  fixesLoaded: boolean;
  currentFix: IntegrationFix | null;

  // 随机组合
  randomCombination: RandomCombination | null;

  error: string | null;

  // Actions
  createShortStory: (title: string) => Promise<string>;
  loadSetting: (novelId: string) => Promise<void>;
  loadChapters: (novelId: string) => Promise<void>;
  loadProgress: (novelId: string) => Promise<StepProgressResponse>;

  loadCategoryMetadata: () => Promise<void>;
  loadCategoryConfig: (novelId: string) => Promise<void>;
  saveCategoryConfig: (novelId: string, data: CategoryConfigCreate) => Promise<void>;

  generateHooks: (novelId: string, data: GenerateHooksRequest) => Promise<GeneratedHook[]>;
  selectHook: (novelId: string, data: SelectHookRequest) => Promise<void>;
  setGeneratedHooks: (hooks: GeneratedHook[]) => void;
  fetchPresetHooks: (category?: string, source?: 'system' | 'user' | 'all') => Promise<void>;
  fetchHookCategories: () => Promise<void>;
  setCoreHook: (novelId: string, hookId: string) => Promise<void>;
  setCustomHook: (novelId: string, description: string, category?: string, saveToPreset?: boolean) => Promise<void>;
  setCustomHookInput: (input: string) => void;

  generatePlans: (novelId: string, count?: number) => Promise<void>;
  selectPlan: (novelId: string, planId: number) => Promise<void>;

  generateDetailPlan: (novelId: string) => Promise<void>;
  updateSetting: (novelId: string, data: Partial<ShortStorySettingUpdate>) => Promise<void>;

  generateChapters: (novelId: string) => Promise<void>;

  generateChapter: (novelId: string, chapterNum: number) => Promise<void>;
  regenerateChapter: (novelId: string, chapterNum: number, feedback: string) => Promise<void>;
  setCurrentChapter: (num: number) => void;

  generateAllChapters: (novelId: string) => Promise<void>;
  pollGenerationProgress: (novelId: string) => Promise<void>;

  generateOpeningHooks: (novelId: string) => Promise<void>;
  selectOpeningHook: (novelId: string, hookId: number) => Promise<void>;

  addExtraChapter: (novelId: string, data: any) => Promise<void>;
  removeExtraChapter: (novelId: string, chapterId: string) => Promise<void>;
  applyAllFixes: (novelId: string) => Promise<void>;

  integrate: (novelId: string) => Promise<void>;
  exportStory: (novelId: string, format?: 'txt' | 'md' | 'epub') => Promise<string>;

  fixIssues: (novelId: string, issues: IntegrationIssue[]) => Promise<IntegrationFix[]>;
  applyFix: (novelId: string, fixId: string) => Promise<void>;
  rejectFix: (novelId: string, fixId: string) => Promise<void>;
  modifyFix: (novelId: string, fixId: string, text: string) => Promise<void>;
  loadFixes: (novelId: string) => Promise<void>;
  setCurrentFix: (fix: IntegrationFix | null) => void;

  randomCombine: (hookCategory?: string) => Promise<void>;

  clearError: () => void;
  reset: () => void;
  setCategoryConfigLoaded: (loaded: boolean) => void;
}

export const useShortStoryStore = create<ShortStoryState>((set, get) => ({
  novelId: null,
  setting: null,
  stepProgress: null,
  currentStep: 1,
  isLoadingProgress: false,
  categoryConfig: null,
  categoryConfigLoaded: false,
  categoryMetadata: null,
  isLoadingCategoryMetadata: false,
  selectedHook: null,
  customHookInput: '',
  generatedHooks: [],
  isGeneratingHooks: false,
  presetHooks: [],
  hookCategories: [],
  isLoadingHooks: false,
  generatedPlans: [],
  selectedPlan: null,
  isGeneratingPlans: false,
  detailPlan: null,
  isGeneratingPlan: false,
  chapterPlan: [],
  isGeneratingChapters: false,
  currentChapter: 1,
  isGenerating: false,
  generationProgress: 0,
  isIntegrating: false,
  integrationResult: null,
  isGeneratingAll: false,
  generationAllProgress: 0,
  openingHooks: [],
  selectedOpeningHook: null,
  isFixing: false,
  fixes: [],
  fixesLoaded: false,
  currentFix: null,
  randomCombination: null,
  error: null,

  createShortStory: async (title: string) => {
    try {
      const novel = await createShortStoryApi();
      const novelId = novel.id;
      await shortStoryApi.createSetting(novelId, { novel_id: novelId });
      set({ novelId });
      return novelId;
    } catch (err: any) {
      set({ error: err.apiError?.message || '创建失败' });
      throw err;
    }
  },

  loadSetting: async (novelId: string) => {
    try {
      const setting = await shortStoryApi.getSetting(novelId);
      set({ novelId, setting });
      if (setting.core_hook) {
        set({
          selectedHook: {
            id: setting.selected_plan_id?.toString() || '',
            category: setting.hook_category || '',
            description: setting.core_hook,
            emotional_target: setting.emotional_target || '爽',
          },
        });
      }
      if (setting.generated_plans) {
        set({ generatedPlans: setting.generated_plans });
      }
      if (setting.selected_plan_id) {
        const plan = setting.generated_plans?.find((p: any) => p.plan_id === setting.selected_plan_id);
        if (plan) set({ selectedPlan: plan });
      }
      if (setting.character_profiles) {
        set({
          detailPlan: {
            characters: setting.character_profiles,
            keyScenes: setting.key_scenes || [],
            foreshadowingTwists: setting.foreshadowing_twists || [],
            narrativeOrderDetail: setting.narrative_order_detail || '',
          },
        });
      }
      const hooksList = (setting as any).opening_hooks_list;
      if (hooksList && Array.isArray(hooksList)) {
        set({ openingHooks: hooksList as OpeningHook[] });
      }
      const selectedHook = setting.opening_hook;
      if (selectedHook && typeof selectedHook === 'object' && (selectedHook as any).content) {
        set({ selectedOpeningHook: selectedHook as unknown as OpeningHook });
      }
    } catch (err: any) {
      set({ error: err.apiError?.message || '加载失败' });
    }
  },

  loadChapters: async (novelId: string) => {
    try {
      const chapters = await shortStoryApi.listChapters(novelId);
      set({ chapterPlan: chapters });
    } catch (err: any) {
      set({ error: err.apiError?.message || '加载章节失败' });
    }
  },

  loadProgress: async (novelId: string) => {
    set({ isLoadingProgress: true });
    try {
      const progress = await shortStoryApi.getProgress(novelId);
      set({ stepProgress: progress.completed, currentStep: progress.current_step, isLoadingProgress: false });
      return progress;
    } catch {
      set({ error: '加载进度失败', isLoadingProgress: false, stepProgress: [false, false, false, false, false, false, false], currentStep: 1 });
      return { completed: [false, false, false, false, false, false, false], current_step: 1 };
    }
  },

  loadCategoryMetadata: async () => {
    set({ isLoadingCategoryMetadata: true });
    try {
      const metadata = await shortStoryApi.getCategoryMetadata();
      set({ categoryMetadata: metadata });
    } catch (err: any) {
      set({ error: err.apiError?.message || '加载分类元数据失败' });
    } finally {
      set({ isLoadingCategoryMetadata: false });
    }
  },

  loadCategoryConfig: async (novelId: string) => {
    try {
      const config = await shortStoryApi.getCategoryConfig(novelId);
      set({ categoryConfig: config, categoryConfigLoaded: true });
    } catch {
      set({ categoryConfig: null, categoryConfigLoaded: true });
    }
  },

  saveCategoryConfig: async (novelId: string, data: CategoryConfigCreate) => {
    try {
      const config = await shortStoryApi.createCategoryConfig(novelId, data);
      set({ categoryConfig: config });
    } catch (err: any) {
      set({ error: err.apiError?.message || '保存分类配置失败' });
      throw err;
    }
  },

  generateHooks: async (novelId: string, data: GenerateHooksRequest) => {
    set({ isGeneratingHooks: true });
    try {
      const response = await shortStoryApi.generateHooks(novelId, data);
      set({ generatedHooks: response.hooks });
      return response.hooks;
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成爽点失败' });
      return [];
    } finally {
      set({ isGeneratingHooks: false });
    }
  },

  selectHook: async (novelId: string, data: SelectHookRequest) => {
    try {
      const setting = await shortStoryApi.selectHook(novelId, data);
      set({
        setting,
        selectedHook: {
          id: data.hook_id?.toString() || 'custom',
          category: setting.hook_category || '',
          description: setting.core_hook || '',
          emotional_target: (setting.emotional_target as any) || '爽',
          is_custom: !!data.custom_hook,
        },
      });
    } catch (err: any) {
      set({ error: err.apiError?.message || '选择爽点失败' });
      throw err;
    }
  },

  setGeneratedHooks: (hooks: GeneratedHook[]) => set({ generatedHooks: hooks }),

  fetchPresetHooks: async (category?: string, source?: 'system' | 'user' | 'all') => {
    set({ isLoadingHooks: true });
    try {
      const response = await shortStoryApi.listPresetHooks({ category, source: source === 'all' ? undefined : source as 'system' | 'user' });
      set({ presetHooks: response.items });
    } catch (err: any) {
      set({ error: err.apiError?.message || '获取爽点失败' });
    } finally {
      set({ isLoadingHooks: false });
    }
  },

  fetchHookCategories: async () => {
    try {
      const response = await shortStoryApi.listHookCategories();
      set({ hookCategories: response.categories });
    } catch (err: any) {
      set({ error: err.apiError?.message || '获取分类失败' });
    }
  },

  setCoreHook: async (novelId: string, hookId: string) => {
    try {
      const setting = await shortStoryApi.setCoreHook(novelId, { hook_id: hookId, emotional_target: '爽' });
      set({ setting, selectedHook: { id: hookId, category: setting.hook_category || '', description: setting.core_hook || '', emotional_target: setting.emotional_target || '爽' } });
    } catch (err: any) {
      set({ error: err.apiError?.message || '设置爽点失败' });
    }
  },

  setCustomHook: async (novelId: string, description: string, category?: string, saveToPreset?: boolean) => {
    try {
      const setting = await shortStoryApi.setCoreHook(novelId, { custom_hook: description, category: category || 'custom', emotional_target: '爽', save_to_preset: saveToPreset });
      set({ setting, selectedHook: { id: 'custom', category: category || 'custom', description, emotional_target: '爽', is_custom: true } });
    } catch (err: any) {
      set({ error: err.apiError?.message || '设置自定义爽点失败' });
    }
  },

  setCustomHookInput: (input: string) => set({ customHookInput: input }),

  generatePlans: async (novelId: string, count: number = 3) => {
    set({ isGeneratingPlans: true });
    try {
      const response = await shortStoryApi.generatePlans(novelId, { count, target_length: 8000 });
      set({ generatedPlans: response.plans, selectedPlan: null });
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成方案失败' });
    } finally {
      set({ isGeneratingPlans: false });
    }
  },

  selectPlan: async (novelId: string, planId: number) => {
    try {
      const setting = await shortStoryApi.selectPlan(novelId, { plan_id: planId });
      const plan = get().generatedPlans.find((p) => p.plan_id === planId);
      set({ setting, selectedPlan: plan || null });
    } catch (err: any) {
      set({ error: err.apiError?.message || '选择方案失败' });
    }
  },

  generateDetailPlan: async (novelId: string) => {
    set({ isGeneratingPlan: true });
    try {
      const setting = await shortStoryApi.generateDetailPlan(novelId);
      set({
        setting,
        detailPlan: {
          characters: setting.character_profiles || null,
          keyScenes: setting.key_scenes || [],
          foreshadowingTwists: setting.foreshadowing_twists || [],
          narrativeOrderDetail: setting.narrative_order_detail || '',
        },
      });
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成详细规划失败' });
    } finally {
      set({ isGeneratingPlan: false });
    }
  },

  updateSetting: async (novelId: string, data: Partial<ShortStorySettingUpdate>) => {
    try {
      const setting = await shortStoryApi.updateSetting(novelId, data);
      set({
        setting,
        detailPlan: {
          characters: setting.character_profiles || null,
          keyScenes: setting.key_scenes || [],
          foreshadowingTwists: setting.foreshadowing_twists || [],
          narrativeOrderDetail: setting.narrative_order_detail || '',
        },
      });
    } catch (err: any) {
      set({ error: err.apiError?.message || '更新设定失败' });
      throw err;
    }
  },

  generateChapters: async (novelId: string) => {
    set({ isGeneratingChapters: true });
    try {
      const chapters = await shortStoryApi.generateChapters(novelId);
      set({ chapterPlan: chapters });
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成章节失败' });
    } finally {
      set({ isGeneratingChapters: false });
    }
  },

  generateChapter: async (novelId: string, chapterNum: number) => {
    set({ isGenerating: true, generationProgress: 0 });
    try {
      const chapter = await shortStoryApi.generateChapter(novelId, chapterNum);
      const updatedPlan = get().chapterPlan.map((ch) => ch.order_index === chapterNum ? chapter : ch);
      set({ chapterPlan: updatedPlan, generationProgress: 100 });
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成章节失败' });
    } finally {
      set({ isGenerating: false });
    }
  },

  regenerateChapter: async (novelId: string, chapterNum: number, feedback: string) => {
    set({ isGenerating: true, generationProgress: 0 });
    try {
      const chapter = await shortStoryApi.regenerateChapter(novelId, chapterNum, { feedback });
      const updatedPlan = get().chapterPlan.map((ch) => ch.order_index === chapterNum ? chapter : ch);
      set({ chapterPlan: updatedPlan, generationProgress: 100 });
    } catch (err: any) {
      set({ error: err.apiError?.message || '重生成章节失败' });
    } finally {
      set({ isGenerating: false });
    }
  },

  setCurrentChapter: (num: number) => set({ currentChapter: num }),

  generateAllChapters: async (novelId: string) => {
    set({ isGeneratingAll: true, generationAllProgress: 0 });
    try {
      await shortStoryApi.generateAllChapters(novelId);
      await get().pollGenerationProgress(novelId);
    } catch (err: any) {
      set({ error: err.apiError?.message || '一键生成失败', isGeneratingAll: false });
    }
  },

  pollGenerationProgress: async (novelId: string) => {
    const poll = async () => {
      try {
        const progress = await shortStoryApi.getGenerationProgress(novelId);
        set({ generationAllProgress: progress.progress_percent });
        if (progress.status === 'completed') {
          set({ isGeneratingAll: false });
          await get().loadChapters(novelId);
          return;
        }
        if (progress.status === 'failed') {
          set({ isGeneratingAll: false, error: '生成失败' });
          return;
        }
        setTimeout(() => poll(), 2000);
      } catch (err: any) {
        set({ isGeneratingAll: false, error: err.apiError?.message || '获取进度失败' });
      }
    };
    poll();
  },

  generateOpeningHooks: async (novelId: string) => {
    try {
      const response = await shortStoryApi.generateOpeningHooks(novelId);
      set({ openingHooks: response.hooks });
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成开篇钩子失败' });
    }
  },

  selectOpeningHook: async (novelId: string, hookId: number) => {
    try {
      const setting = await shortStoryApi.selectOpeningHook(novelId, hookId);
      const selectedHook = setting.opening_hook as any;
      set({ setting, selectedOpeningHook: selectedHook && selectedHook.content ? selectedHook : null });
    } catch (err: any) {
      set({ error: err.apiError?.message || '选择开篇钩子失败' });
    }
  },

  addExtraChapter: async (novelId: string, data: any) => {
    try {
      const chapter = await shortStoryApi.addExtraChapter(novelId, data);
      set({ chapterPlan: [...get().chapterPlan, chapter] });
    } catch (err: any) {
      set({ error: err.apiError?.message || '添加番外章失败' });
    }
  },

  removeExtraChapter: async (novelId: string, chapterId: string) => {
    try {
      await shortStoryApi.deleteExtraChapter(novelId, chapterId);
      set({ chapterPlan: get().chapterPlan.filter(ch => ch.id !== chapterId) });
    } catch (err: any) {
      set({ error: err.apiError?.message || '删除番外章失败' });
    }
  },

  applyAllFixes: async (novelId: string) => {
    try {
      await shortStoryApi.applyAllFixes(novelId);
      await get().loadFixes(novelId);
      await get().loadChapters(novelId);
    } catch (err: any) {
      set({ error: err.apiError?.message || '批量应用修复失败' });
    }
  },

  integrate: async (novelId: string) => {
    set({ isIntegrating: true });
    try {
      const response = await shortStoryApi.integrate(novelId);
      const data = response.data;
      set({
        integrationResult: {
          totalChapters: data.total_chapters,
          totalWords: data.total_words,
          checks: data.checks,
          suggestions: data.suggestions,
          issues: data.issues || [],
          auto_fixable: data.auto_fixable || [],
          title_suggestions: data.title_suggestions || [],
        }
      });
    } catch (err: any) {
      set({ error: err.apiError?.message || '整合失败' });
    } finally {
      set({ isIntegrating: false });
    }
  },

  exportStory: async (novelId: string, format: 'txt' | 'md' | 'epub' = 'txt') => {
    try {
      const response = await shortStoryApi.export(novelId, format);
      return response.data.content;
    } catch (err: any) {
      set({ error: err.apiError?.message || '导出失败' });
      throw err;
    }
  },

  fixIssues: async (novelId: string, issues: IntegrationIssue[]) => {
    set({ isFixing: true });
    try {
      const response = await shortStoryApi.fixIssues(novelId, { issues });
      set({ fixes: response.fixes, isFixing: false });
      return response.fixes;
    } catch (err: any) {
      set({ error: err.apiError?.message || '生成修复方案失败', isFixing: false });
      return [];
    }
  },

  applyFix: async (novelId: string, fixId: string) => {
    try {
      await shortStoryApi.applyFixes(novelId, { fix_ids: [fixId] });
      const updatedFixes = get().fixes.map(f => f.id === fixId ? { ...f, status: 'accepted' as const } : f);
      set({ fixes: updatedFixes });
      await get().loadChapters(novelId);
    } catch (err: any) {
      set({ error: err.apiError?.message || '应用修复失败' });
    }
  },

  rejectFix: async (novelId: string, fixId: string) => {
    try {
      await shortStoryApi.rejectFix(novelId, fixId);
      const updatedFixes = get().fixes.map(f => f.id === fixId ? { ...f, status: 'rejected' as const } : f);
      set({ fixes: updatedFixes });
    } catch (err: any) {
      set({ error: err.apiError?.message || '拒绝修复失败' });
    }
  },

  modifyFix: async (novelId: string, fixId: string, text: string) => {
    try {
      await shortStoryApi.modifyFix(novelId, fixId, { fixed_text: text });
      const updatedFixes = get().fixes.map(f => f.id === fixId ? { ...f, status: 'modified' as const, user_modified_text: text } : f);
      set({ fixes: updatedFixes });
      await get().loadChapters(novelId);
    } catch (err: any) {
      set({ error: err.apiError?.message || '修改修复失败' });
    }
  },

  loadFixes: async (novelId: string) => {
    if (get().fixesLoaded) return;
    try {
      const fixes = await shortStoryApi.getFixes(novelId);
      set({ fixes, fixesLoaded: true });
    } catch {
      set({ fixes: [], fixesLoaded: true });
    }
  },

  setCurrentFix: (fix: IntegrationFix | null) => set({ currentFix: fix }),

  randomCombine: async (hookCategory?: string) => {
    try {
      const response = await shortStoryApi.randomCombine({ hook_category: hookCategory });
      set({ randomCombination: response });
    } catch (err: any) {
      set({ error: err.apiError?.message || '随机组合失败' });
    }
  },

  clearError: () => set({ error: null }),
  setCategoryConfigLoaded: (loaded: boolean) => set({ categoryConfigLoaded: loaded }),

  reset: () => set({
    novelId: null, setting: null, stepProgress: null, currentStep: 1, isLoadingProgress: false,
    categoryConfig: null, categoryConfigLoaded: false, categoryMetadata: null,
    selectedHook: null, customHookInput: '', generatedHooks: [],
    generatedPlans: [], selectedPlan: null, detailPlan: null,
    chapterPlan: [], currentChapter: 1, generationProgress: 0,
    isIntegrating: false, integrationResult: null, isGeneratingAll: false, generationAllProgress: 0,
    openingHooks: [], selectedOpeningHook: null, isFixing: false, fixes: [], fixesLoaded: false, currentFix: null,
    randomCombination: null, error: null,
  }),
}));
