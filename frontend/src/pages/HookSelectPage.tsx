/**
 * Step 2: 核心爽点选择页面（重新设计版）
 *
 * 交互模式:
 *  - 顶部：已选分类标签汇总
 *  - 三栏 Tab：AI生成 / 预设库 / 手动输入
 *  - 芯片式爽点选择
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
// StepNavigator removed — sidebar now shows step progress
import type { GeneratedHook } from "@/types/shortStory";
import {
  Search,
  Shuffle,
  PenLine,
  Loader2,
  Zap,
  Heart,
  Skull,
  Eye,
  Flame,
  HelpCircle,
  BookOpen,
  Sparkles,
  Wand2,
  Save,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const categoryIcons: Record<string, React.ReactNode> = {
  identity_twist: <Eye className="w-3 h-3" />,
  revenge: <Flame className="w-3 h-3" />,
  romance: <Heart className="w-3 h-3" />,
  rebirth: <Sparkles className="w-3 h-3" />,
  system: <Zap className="w-3 h-3" />,
  mystery: <HelpCircle className="w-3 h-3" />,
  redemption: <Heart className="w-3 h-3" />,
  misunderstanding: <Shuffle className="w-3 h-3" />,
  reunion: <BookOpen className="w-3 h-3" />,
  survival: <Skull className="w-3 h-3" />,
  mentor: <Eye className="w-3 h-3" />,
  competition: <Flame className="w-3 h-3" />,
};

const categoryNames: Record<string, string> = {
  identity_twist: "身份反转",
  revenge: "打脸复仇",
  romance: "先婚后爱",
  rebirth: "重生逆袭",
  system: "系统金手指",
  mystery: "悬疑揭秘",
  redemption: "情感救赎",
  misunderstanding: "错位误会",
  reunion: "意外重逢",
  survival: "极限求生",
  mentor: "师徒传承",
  competition: "竞争博弈",
};

// =========================================================================
// Page
// =========================================================================
export default function HookSelectPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    categoryConfig,
    categoryMetadata,
    generatedHooks,
    isGeneratingHooks,
    presetHooks,
    hookCategories,
    isLoadingHooks,
    customHookInput,
    fetchPresetHooks,
    fetchHookCategories,
    setCustomHookInput,
    generateHooks,
    selectHook,
    randomCombine,
    loadSetting,
    loadCategoryMetadata,
    loadCategoryConfig,
    setCoreHook,
    setCustomHook,
    loadProgress,
  } = useShortStoryStore();
  void categoryMetadata;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHookId, setSelectedHookId] = useState<string | number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToPresetMap, setSaveToPresetMap] = useState<Record<string | number, boolean>>({});
  const [customRequirement, setCustomRequirement] = useState("");
  const [activeTab, setActiveTab] = useState<"ai" | "preset" | "custom">("ai");
  const [presetSourceFilter, setPresetSourceFilter] = useState<"all" | "system" | "user">("all");

  const getSaveToPreset = (hookId: string | number) => saveToPresetMap[hookId] || false;
  const setSaveToPresetForHook = (hookId: string | number, value: boolean) => {
    setSaveToPresetMap((prev) => ({ ...prev, [hookId]: value }));
  };

  // data loading
  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);
  useEffect(() => {
    loadCategoryMetadata();
    fetchHookCategories();
    fetchPresetHooks();
  }, [loadCategoryMetadata, fetchHookCategories, fetchPresetHooks]);
  useEffect(() => {
    if (novelId) {
      loadSetting(novelId);
      loadCategoryConfig(novelId);
    }
  }, [novelId, loadSetting, loadCategoryConfig]);
  useEffect(() => {
    fetchPresetHooks(selectedCategory || undefined);
  }, [selectedCategory, fetchPresetHooks]);
  useEffect(() => {
    if (activeTab === "preset") {
      fetchPresetHooks(
        selectedCategory || undefined,
        presetSourceFilter === "all" ? undefined : presetSourceFilter
      );
    }
  }, [presetSourceFilter, activeTab, selectedCategory, fetchPresetHooks]);

  // actions
  const handleGenerateHooks = async () => {
    if (!novelId) return;
    const hooks = await generateHooks(novelId, {
      count: 3,
      custom_requirement: customRequirement || undefined,
    });
    if (hooks.length > 0) showToast(`已生成 ${hooks.length} 个爽点`, "success");
  };

  const handleSelectAiHook = async (hook?: GeneratedHook) => {
    if (!novelId) return;
    setIsSaving(true);
    try {
      const hookId = hook?.hook_id ?? "custom";
      const shouldSave = getSaveToPreset(hookId);
      if (hook) {
        await selectHook(novelId, {
          hook_id: hook.hook_id,
          hook_title: hook.title,
          hook_description: hook.description,
          emotional_target: hook.emotional_target,
          save_to_preset: shouldSave,
        });
      } else {
        await selectHook(novelId, {
          custom_hook: customHookInput.trim(),
          emotional_target: "爽",
          save_to_preset: shouldSave,
        });
      }
      showToast("爽点已设置", "success");
      navigate(`/plans?novelId=${novelId}`);
    } catch {
      // store handles error
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPresetHook = async (hookId: string) => {
    if (!novelId) return;
    setSelectedHookId(hookId);
    setIsSaving(true);
    try {
      await setCoreHook(novelId, hookId);
      showToast("爽点已选择", "success");
      navigate(`/plans?novelId=${novelId}`);
    } catch {
      // store handles
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomHook = async () => {
    if (!novelId || !customHookInput.trim()) return;
    setIsSaving(true);
    try {
      await setCustomHook(novelId, customHookInput, undefined, getSaveToPreset("custom"));
      showToast("自定义爽点已设置", "success");
      navigate(`/plans?novelId=${novelId}`);
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandom = async () => {
    if (!novelId) return;
    await randomCombine();
    showToast("随机组合已生成", "success");
    navigate(`/plans?novelId=${novelId}`);
  };

  const filteredHooks = useMemo(() => {
    let hooks = searchQuery
      ? presetHooks.filter(
          (h) => h.title.includes(searchQuery) || h.description.includes(searchQuery)
        )
      : presetHooks;
    if (presetSourceFilter !== "all") hooks = hooks.filter((h) => h.source === presetSourceFilter);
    return hooks;
  }, [presetHooks, searchQuery, presetSourceFilter]);

  // ─── render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 2: 选择核心爽点</h1>
          <p className="text-[11px] text-muted-foreground">基于分类标签，选择故事的核心驱动力</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRandom} className="text-xs h-7">
            <Shuffle className="w-3 h-3 mr-1" /> 随机
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/categories?novelId=${novelId}`)}
            className="text-xs h-7"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> 上一步
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* left: content */}
        <div className="flex-1 min-w-0 pb-14">
          {/* tags summary */}
          {categoryConfig && (
            <SectionCard title="已选分类标签">
              <div className="flex flex-wrap gap-1">
                <Chip selected>{categoryConfig.main_category}</Chip>
                {categoryConfig.plot_tags?.map((t) => (
                  <Chip key={t} selected muted>
                    {t}
                  </Chip>
                ))}
                {categoryConfig.character_tags?.map((t) => (
                  <Chip key={t} selected muted>
                    {t}
                  </Chip>
                ))}
                {categoryConfig.emotion_process && <Chip selected muted>{categoryConfig.emotion_process}</Chip>}
                {categoryConfig.story_background && <Chip selected muted>{categoryConfig.story_background}</Chip>}
              </div>
            </SectionCard>
          )}

          {/* tabs */}
          <div className="flex border-b mb-3">
            {[
              { key: "ai", label: "AI 生成", icon: Wand2 },
              { key: "preset", label: "预设库", icon: BookOpen },
              { key: "custom", label: "手动输入", icon: PenLine },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center px-3 py-1.5 text-[11px] border-b-2 transition-colors
                  ${activeTab === tab.key ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="w-3 h-3 mr-1" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* AI tab */}
          {activeTab === "ai" && (
            <div className="space-y-3">
              <SectionCard title="AI 生成爽点（推荐）">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-background border border-muted text-foreground px-2 py-1.5 text-[11px] outline-none focus:border-foreground"
                      placeholder="额外要求：如「希望有反转、不要太狗血」"
                      value={customRequirement}
                      onChange={(e) => setCustomRequirement(e.target.value)}
                    />
                    <Button onClick={handleGenerateHooks} disabled={isGeneratingHooks} className="text-xs h-7 whitespace-nowrap">
                      {isGeneratingHooks ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 生成中</>
                      ) : (
                        <><Sparkles className="w-3 h-3 mr-1" /> 生成爽点</>
                      )}
                    </Button>
                  </div>
                </div>
              </SectionCard>

              {generatedHooks.length > 0 && (
                <div className="space-y-2">
                  {generatedHooks.map((hook) => (
                    <div
                      key={hook.hook_id}
                      onClick={() => setSelectedHookId(hook.hook_id)}
                      className={`border p-3 cursor-pointer transition-colors
                        ${selectedHookId === hook.hook_id ? "border-foreground bg-accent" : "hover:border-foreground"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Chip selected small>{hook.hook_id}</Chip>
                          <span className="text-xs font-medium">{hook.title}</span>
                        </div>
                        <Chip muted small>{hook.emotional_target}</Chip>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{hook.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">💡 {hook.why_it_works}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-3 h-3"
                            checked={getSaveToPreset(hook.hook_id)}
                            onChange={(e) => setSaveToPresetForHook(hook.hook_id, e.target.checked)}
                          />
                          <Save className="w-2.5 h-2.5" /> 保存到预设库
                        </label>
                        <Button size="sm" onClick={() => handleSelectAiHook(hook)} disabled={isSaving} className="text-xs h-6">
                          <ArrowRight className="w-3 h-3 mr-1" /> 选择
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* preset tab */}
          {activeTab === "preset" && (
            <div className="flex gap-3 h-full min-h-[420px]">
              {/* left sidebar */}
              <div className="w-[140px] shrink-0 border p-2 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-1.5 transition-colors
                    ${selectedCategory === null ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Sparkles className="w-3 h-3" /> 全部
                </button>
                {hookCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-1.5 transition-colors
                      ${selectedCategory === cat.id ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {categoryIcons[cat.id] || <Sparkles className="w-3 h-3" />}
                    {categoryNames[cat.id] || cat.id}
                    <span className="ml-auto text-[9px] border px-1 py-0">{cat.count}</span>
                  </button>
                ))}
              </div>

              {/* right content */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  {(["all", "system", "user"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPresetSourceFilter(f)}
                      className={`text-[10px] px-2 py-0.5 border transition-colors
                        ${presetSourceFilter === f ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:border-foreground"}`}
                    >
                      {f === "all" ? "全部" : f === "system" ? "系统预设" : "我的爽点"}
                    </button>
                  ))}
                  <div className="relative ml-auto">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                      className="bg-background border border-muted text-foreground pl-6 pr-2 py-1 text-[10px] outline-none w-[130px] focus:border-foreground"
                      placeholder="搜索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {isLoadingHooks ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : filteredHooks.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <AlertCircle className="w-5 h-5 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">未找到匹配的爽点</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredHooks.map((hook) => (
                        <div
                          key={hook.id}
                          onClick={() => setSelectedHookId(hook.id)}
                          className={`border p-2 cursor-pointer transition-colors
                            ${selectedHookId === hook.id ? "border-foreground bg-accent" : "hover:border-foreground"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{hook.title}</span>
                            <div className="flex items-center gap-1">
                              {hook.source === "user" && <Chip muted small>我的</Chip>}
                              <Chip muted small>{categoryNames[hook.category] || hook.category}</Chip>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{hook.description}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <Chip muted small>{hook.emotional_target}</Chip>
                            <Button size="sm" onClick={() => handleSelectPresetHook(hook.id)} disabled={isSaving} className="text-xs h-6">
                              选择
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* custom tab */}
          {activeTab === "custom" && (
            <SectionCard title="手动输入爽点">
              <div className="space-y-3">
                <textarea
                  className="w-full bg-background border border-muted text-foreground px-2 py-2 text-[11px] outline-none focus:border-foreground resize-none"
                  placeholder="描述你的核心爽点..."
                  value={customHookInput}
                  onChange={(e) => setCustomHookInput(e.target.value)}
                  rows={4}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-3 h-3"
                      checked={getSaveToPreset("custom")}
                      onChange={(e) => setSaveToPresetForHook("custom", e.target.checked)}
                    />
                    <Save className="w-2.5 h-2.5" /> 保存到预设库
                  </label>
                  <Button size="sm" onClick={handleCustomHook} disabled={!customHookInput.trim() || isSaving} className="text-xs h-7">
                    <ArrowRight className="w-3 h-3 mr-1" /> 选择
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* 步骤导航栏 — 固定底部 */}
        <div className="fixed bottom-0 left-[220px] right-0 h-10 border-t border-border bg-background flex items-center justify-between px-6 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/categories?novelId=${novelId}`)}
            className="text-xs h-7"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> 上一步
          </Button>
          <span className="text-[10px] text-muted-foreground">
            选择一个爽点后自动跳转，或点击跳过
          </span>
          <Button
            size="sm"
            onClick={() => navigate(`/plans?novelId=${novelId}`)}
            className="text-xs h-7"
          >
            跳过 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Sub-components
// =========================================================================

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border mb-2.5">
      <div className="flex items-center px-2.5 py-1.5 border-b">
        <span className="text-[11px] font-semibold">{title}</span>
      </div>
      <div className="px-2.5 py-1.5">{children}</div>
    </div>
  );
}

function Chip({
  selected,
  muted,
  small,
  children,
}: {
  selected?: boolean;
  muted?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 border whitespace-nowrap
        ${small ? "text-[9px]" : "text-[10px]"}
        ${selected && !muted ? "bg-foreground text-background border-foreground" : ""}
        ${muted ? "bg-accent text-muted-foreground border-muted" : ""}`}
    >
      {children}
    </span>
  );
}
