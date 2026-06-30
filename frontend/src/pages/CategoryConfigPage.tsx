/**
 * Step 1: 分类标签配置页面（重新设计版）
 *
 * 交互模式:
 *  - 主分类: 芯片单选，按性别着色（蓝=男频 粉=女频 绿=通用）
 *  - 情节分类: 多选 + 搜索 + ⚙管理（新增/删除/拖拽排序）
 *  - 角色关键词: 多选 + 搜索 + ⚙管理（新增/删除/拖拽排序）
 *  - 情绪过程: 纯单选展示
 *  - 故事背景: 纯单选展示
 *  - 自定义标签: 自由输入
 *  - 右侧面板: 实时汇总已选
 */
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type DragEvent as ReactDragEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Save, Plus, GripVertical, X } from "lucide-react";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
import { shortStoryApi } from "@/api/shortStory";
// StepNavigator removed — sidebar now shows step progress
import type { CategoryConfigCreate, PlotCategory } from "@/types/shortStory";

// ---------------------------------------------------------------------------
// 本地芯片管理用类型
// ---------------------------------------------------------------------------
interface ManagedPlot extends PlotCategory {
  _id: string; // 拖拽排序用唯一 id
}

// ---------------------------------------------------------------------------
// 性别 ↔ 颜色映射
// ---------------------------------------------------------------------------
const GENDER_CLASS: Record<string, string> = {
  "男频": "border-[#5B8DEF]",
  "女频": "border-[#E87D9F]",
  "通用": "border-[#6BAF6B]",
};

const GENDER_CLASS_SELECTED: Record<string, string> = {
  "男频": "bg-[#5B8DEF] border-[#5B8DEF] text-white",
  "女频": "bg-[#E87D9F] border-[#E87D9F] text-white",
  "通用": "bg-[#6BAF6B] border-[#6BAF6B] text-white",
};

// 右侧 tag 颜色
const SRC_TAG: Record<string, string> = {
  male: "border-[#5B8DEF] text-[#5B8DEF] bg-[#5B8DEF]/5",
  female: "border-[#E87D9F] text-[#E87D9F] bg-[#E87D9F]/5",
  common: "border-[#6BAF6B] text-[#6BAF6B] bg-[#6BAF6B]/5",
  plot: "border-[#e67e22] text-[#e67e22] bg-[#e67e22]/5",
  char: "border-[#1abc9c] text-[#1abc9c] bg-[#1abc9c]/5",
  emotion: "border-[#9b59b6] text-[#9b59b6] bg-[#9b59b6]/5",
  bg: "border-[#7f8c8d] text-[#7f8c8d] bg-[#7f8c8d]/5",
  custom: "border-[#f39c12] text-[#f39c12] bg-[#f39c12]/5",
};

// ---------------------------------------------------------------------------
// Chip 组件
// ---------------------------------------------------------------------------
function Chip({
  selected,
  genderClass,
  genderClassSelected,
  onClick,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  selected: boolean;
  genderClass?: string;
  genderClassSelected?: string;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: ReactDragEvent) => void;
  onDragOver?: (e: ReactDragEvent) => void;
  onDrop?: (e: ReactDragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      className={`
        inline-flex items-center gap-0.5 px-[9px] py-[3px] text-[11px] border
        cursor-pointer select-none whitespace-nowrap transition-colors
        ${
          selected
            ? genderClassSelected ||
              "bg-foreground text-background border-foreground"
            : genderClass || "bg-background text-foreground border-muted hover:border-foreground"
        }
      `}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 全页组件
// ---------------------------------------------------------------------------
export default function CategoryConfigPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    categoryConfig,
    categoryMetadata,
    isLoadingCategoryMetadata,
    loadCategoryMetadata,
    loadCategoryConfig,
    saveCategoryConfig,
    loadProgress,
  } = useShortStoryStore();

  // ── 表单状态 ──────────────────────────────────────────────
  const [mainCategory, setMainCategory] = useState("");
  const [selectedPlots, setSelectedPlots] = useState<string[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [emotionProcess, setEmotionProcess] = useState("");
  const [storyBackground, setStoryBackground] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [targetLength, setTargetLength] = useState(8000);
  const [isSaving, setIsSaving] = useState(false);

  // ── 管理模式 ──────────────────────────────────────────────
  const [plotManage, setPlotManage] = useState(false);
  const [charManage, setCharManage] = useState(false);

  // 本地可编辑数据
  const [localPlotData, setLocalPlotData] = useState<ManagedPlot[]>([]);
  const [localCharData, setLocalCharData] = useState<string[]>([]);

  // ── 搜索 / 筛选 ───────────────────────────────────────────
  const [plotSearch, setPlotSearch] = useState("");
  const [plotFilter, setPlotFilter] = useState("");
  const [charSearch, setCharSearch] = useState("");

  // ── 新增表单 ──────────────────────────────────────────────
  const [showPlotAdd, setShowPlotAdd] = useState(false);
  const [plotAddName, setPlotAddName] = useState("");
  const [plotAddLevel2, setPlotAddLevel2] = useState("");
  const [showCharAdd, setShowCharAdd] = useState(false);
  const [charAddName, setCharAddName] = useState("");

  const plotAddInputRef = useRef<HTMLInputElement>(null);
  const charAddInputRef = useRef<HTMLInputElement>(null);

  // ── 拖拽状态 ──────────────────────────────────────────────
  const dragRef = useRef<{ type: string; index: number } | null>(null);

  // ===================== 初始化数据加载 ======================
  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  useEffect(() => {
    loadCategoryMetadata();
  }, [loadCategoryMetadata]);

  useEffect(() => {
    if (!novelId) return;
    loadCategoryConfig(novelId);
  }, [novelId, loadCategoryConfig]);

  // ── 回填已有配置 ─────────────────────────────────────────
  useEffect(() => {
    if (categoryConfig) {
      // 注意：旧版是单 plot，新版是多选，兼容旧数据
      setMainCategory(categoryConfig.main_category || "");
      const legacyPlot = categoryConfig.plot_level3;
      const plotTags = categoryConfig.plot_tags || [];
      setSelectedPlots(
        legacyPlot && !plotTags.includes(legacyPlot)
          ? [legacyPlot, ...plotTags]
          : plotTags.length > 0
          ? plotTags
          : legacyPlot
          ? [legacyPlot]
          : []
      );
      setSelectedCharacters(categoryConfig.character_tags || []);
      setEmotionProcess(categoryConfig.emotion_process || "");
      setStoryBackground(categoryConfig.story_background || "");
      setCustomTags(categoryConfig.custom_tags || []);
      setTargetLength(categoryConfig.target_length || 8000);
    }
  }, [categoryConfig]);

  // ── 加载 metadata 到本地可编辑数据（后端已合并用户自定义项）──
  useEffect(() => {
    if (categoryMetadata) {
      const plots: ManagedPlot[] = categoryMetadata.plot_categories.map((p) => ({
        ...p,
        _id: `${p.level1}-${p.level2}-${p.level3}`,
      }));
      const chars: string[] = [...categoryMetadata.character_tags];

      // 确保已选中的项都有 chip（可能来自 categoryConfig 回填）
      const existingPlotKeys = new Set(plots.map((p) => p.level3));
      for (const tag of selectedPlots) {
        if (!existingPlotKeys.has(tag)) {
          plots.push({
            level1: "自定义", level2: "自定义", level3: tag,
            tags: [], remark: "", _id: tag,
          });
        }
      }
      const existingCharKeys = new Set(chars);
      for (const tag of selectedCharacters) {
        if (!existingCharKeys.has(tag)) {
          chars.push(tag);
        }
      }

      setLocalPlotData(plots);
      setLocalCharData(chars);
    }
  }, [categoryMetadata]);

  // ===================== 派生数据 ============================
  const mainCategories = useMemo(() => {
    if (!categoryMetadata) return [];
    return categoryMetadata.main_categories.map((c) => ({
      ...c,
      _gender: c.gender as keyof typeof GENDER_CLASS,
    }));
  }, [categoryMetadata]);

  const selectedMain = useMemo(
    () => mainCategories.find((c) => c.name === mainCategory),
    [mainCategories, mainCategory]
  );

  const plotLevel2s = useMemo(
    () => [...new Set(localPlotData.map((d) => d.level2))].sort(),
    [localPlotData]
  );

  const filteredPlots = useMemo(() => {
    let list = localPlotData;
    if (plotFilter) list = list.filter((d) => d.level2 === plotFilter);
    if (plotSearch) {
      const s = plotSearch.toLowerCase();
      list = list.filter(
        (d) =>
          d.level3.toLowerCase().includes(s) ||
          d.level2.toLowerCase().includes(s) ||
          d.tags.some((t) => t.toLowerCase().includes(s))
      );
    }
    return list;
  }, [localPlotData, plotFilter, plotSearch]);

  const filteredChars = useMemo(() => {
    if (!charSearch) return localCharData;
    const s = charSearch.toLowerCase();
    return localCharData.filter((c) => c.toLowerCase().includes(s));
  }, [localCharData, charSearch]);

  // ===================== 选中计数 ============================
  const selectionCount = useMemo(() => {
    let n = 0;
    if (mainCategory) n++;
    n += selectedPlots.length;
    n += selectedCharacters.length;
    if (emotionProcess) n++;
    if (storyBackground) n++;
    n += customTags.length;
    return n;
  }, [
    mainCategory,
    selectedPlots,
    selectedCharacters,
    emotionProcess,
    storyBackground,
    customTags,
  ]);

  // ===================== 操作函数 ============================

  // 主分类
  const toggleMain = useCallback((name: string) => {
    setMainCategory((prev) => (prev === name ? "" : name));
  }, []);

  // 情节多选
  const togglePlot = useCallback((level3: string) => {
    if (plotManage) return; // 管理模式禁止选中
    setSelectedPlots((prev) =>
      prev.includes(level3) ? prev.filter((p) => p !== level3) : [...prev, level3]
    );
  }, [plotManage]);

  // 角色多选
  const toggleChar = useCallback((tag: string) => {
    if (charManage) return;
    setSelectedCharacters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, [charManage]);

  // 情绪（单选）
  const selectEmotion = useCallback((val: string) => {
    setEmotionProcess((prev) => (prev === val ? "" : val));
  }, []);

  // 背景（单选）
  const selectBg = useCallback((val: string) => {
    setStoryBackground((prev) => (prev === val ? "" : val));
  }, []);

  // 自定义标签
  const addCustomTag = useCallback(() => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (customTags.includes(tag)) {
      setCustomTagInput("");
      return;
    }
    setCustomTags((prev) => [...prev, tag]);
    setCustomTagInput("");
  }, [customTagInput, customTags]);

  const removeCustomTag = useCallback((tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // 删除已选项（从右侧面板）
  const removeSelection = useCallback(
    (type: string, val?: string) => {
      switch (type) {
        case "main":
          setMainCategory("");
          break;
        case "plot":
          if (val) setSelectedPlots((p) => p.filter((x) => x !== val));
          break;
        case "char":
          if (val) setSelectedCharacters((c) => c.filter((x) => x !== val));
          break;
        case "emotion":
          setEmotionProcess("");
          break;
        case "bg":
          setStoryBackground("");
          break;
        case "custom":
          if (val) removeCustomTag(val);
          break;
      }
    },
    [removeCustomTag]
  );

  // ===================== 管理模式 - 情节 =====================
  const togglePlotManage = useCallback(() => {
    setPlotManage((prev) => !prev);
  }, []);

  const showPlotAddForm = useCallback(() => {
    setShowPlotAdd(true);
    setTimeout(() => plotAddInputRef.current?.focus(), 50);
  }, []);

  const cancelPlotAdd = useCallback(() => {
    setShowPlotAdd(false);
    setPlotAddName("");
    setPlotAddLevel2("");
  }, []);

  const confirmPlotAdd = useCallback(async () => {
    const name = plotAddName.trim();
    const lv2 = plotAddLevel2 || "自定义";
    if (!name) {
      showToast("请输入情节名称", "warning");
      return;
    }
    if (localPlotData.some((d) => d.level3 === name)) {
      showToast("该情节已存在", "warning");
      return;
    }
    const newItem: ManagedPlot = { level1: lv2, level2: lv2, level3: name, tags: [], remark: "", _id: name };
    const updated = [...localPlotData, newItem];
    setLocalPlotData(updated);
    cancelPlotAdd();
    // 保存到后端 JSON 文件
    try {
      await shortStoryApi.saveUserPlots(updated.map((p) => ({ level2: p.level2, level3: p.level3, tags: p.tags, remark: p.remark })));
      showToast(`已新增: ${name}`, "success");
    } catch {
      showToast("已添加到本地，但保存到文件失败", "warning");
    }
  }, [plotAddName, plotAddLevel2, localPlotData, cancelPlotAdd, showToast]);

  const deletePlot = useCallback(
    async (id: string) => {
      const item = localPlotData.find((d) => d._id === id);
      const updated = localPlotData.filter((d) => d._id !== id);
      setLocalPlotData(updated);
      if (item) {
        setSelectedPlots((prev) => prev.filter((p) => p !== item.level3));
        showToast(`已删除: ${item.level3}`, "info");
      }
      try {
        await shortStoryApi.saveUserPlots(updated.map((p) => ({ level2: p.level2, level3: p.level3, tags: p.tags, remark: p.remark })));
      } catch { /* 静默 */ }
    },
    [localPlotData, showToast]
  );

  // ===================== 管理模式 - 角色 =====================
  const toggleCharManage = useCallback(() => {
    setCharManage((prev) => !prev);
  }, []);

  const showCharAddForm = useCallback(() => {
    setShowCharAdd(true);
    setTimeout(() => charAddInputRef.current?.focus(), 50);
  }, []);

  const cancelCharAdd = useCallback(() => {
    setShowCharAdd(false);
    setCharAddName("");
  }, []);

  const confirmCharAdd = useCallback(async () => {
    const name = charAddName.trim();
    if (!name) {
      showToast("请输入关键词", "warning");
      return;
    }
    if (localCharData.includes(name)) {
      showToast("该关键词已存在", "warning");
      return;
    }
    const updated = [...localCharData, name];
    setLocalCharData(updated);
    cancelCharAdd();
    try {
      await shortStoryApi.saveUserChars(updated);
      showToast(`已新增: ${name}`, "success");
    } catch {
      showToast("已添加到本地，但保存到文件失败", "warning");
    }
  }, [charAddName, localCharData, cancelCharAdd, showToast]);

  const deleteChar = useCallback(
    async (idx: number) => {
      const name = localCharData[idx];
      const updated = localCharData.filter((_, i) => i !== idx);
      setLocalCharData(updated);
      setSelectedCharacters((prev) => prev.filter((c) => c !== name));
      showToast(`已删除: ${name}`, "info");
      try {
        await shortStoryApi.saveUserChars(updated);
      } catch { /* 静默 */ }
    },
    [localCharData, showToast]
  );

  // ===================== 拖拽排序 ============================
  const onDragStart = useCallback(
    (e: ReactDragEvent, type: string, idx: number) => {
      dragRef.current = { type, index: idx };
      (e.target as HTMLElement).classList.add("opacity-35");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    },
    []
  );

  const onDragOver = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDragEnd = useCallback((e: ReactDragEvent) => {
    (e.target as HTMLElement).classList.remove("opacity-35");
    dragRef.current = null;
  }, []);

  const onPlotDrop = useCallback(
    (e: ReactDragEvent, targetIdx: number) => {
      e.preventDefault();
      if (!dragRef.current || dragRef.current.type !== "plot") return;
      const src = dragRef.current.index;
      dragRef.current = null;
      if (src === targetIdx) return;
      setLocalPlotData((prev) => {
        const arr = [...prev];
        const [item] = arr.splice(src, 1);
        arr.splice(targetIdx, 0, item);
        shortStoryApi.saveUserPlots(arr.map((p) => ({ level2: p.level2, level3: p.level3, tags: p.tags, remark: p.remark }))).catch(() => {});
        return arr;
      });
    },
    []
  );

  const onCharDrop = useCallback(
    (e: ReactDragEvent, targetIdx: number) => {
      e.preventDefault();
      if (!dragRef.current || dragRef.current.type !== "char") return;
      const src = dragRef.current.index;
      dragRef.current = null;
      if (src === targetIdx) return;
      setLocalCharData((prev) => {
        const arr = [...prev];
        const [item] = arr.splice(src, 1);
        arr.splice(targetIdx, 0, item);
        shortStoryApi.saveUserChars(arr).catch(() => {});
        return arr;
      });
    },
    []
  );

  // ===================== 保存 ================================
  const handleSave = useCallback(async () => {
    // DEBUG: 确认 handleSave 被调用
    fetch('/api/v1/health').catch(() => {});
    console.warn('[DEBUG] handleSave called, novelId=', novelId, 'mainCategory=', mainCategory);

    if (!novelId) {
      showToast("缺少小说ID，请返回首页重新创建", "error");
      return;
    }
    if (!mainCategory) {
      showToast("请选择主分类", "error");
      return;
    }

    // 获取选中情节中第一个的层级信息，用于旧版兼容
    let plotL1 = "",
      plotL2 = "",
      plotL3 = "";
    if (selectedPlots.length > 0) {
      const firstPlot = localPlotData.find((p) => p.level3 === selectedPlots[0]);
      if (firstPlot) {
        plotL1 = firstPlot.level1;
        plotL2 = firstPlot.level2;
        plotL3 = firstPlot.level3;
      }
    }

    const data: CategoryConfigCreate = {
      main_category: mainCategory,
      gender_orientation: selectedMain?.gender || "通用",
      plot_tags: selectedPlots.length > 0 ? selectedPlots : undefined,
      plot_level1: plotL1 || undefined,
      plot_level2: plotL2 || undefined,
      plot_level3: plotL3 || undefined,
      character_tags: selectedCharacters.length > 0 ? selectedCharacters : undefined,
      emotion_process: emotionProcess || undefined,
      story_background: storyBackground || undefined,
      custom_tags: customTags.length > 0 ? customTags : undefined,
      target_length: targetLength,
    };

    setIsSaving(true);
    try {
      await saveCategoryConfig(novelId, data);
      showToast("分类配置已保存", "success");
      navigate(`/hook?novelId=${novelId}`);
    } catch (err: any) {
      const detail = err?.apiError?.detail || err?.apiError?.message || "保存失败，请检查后端服务";
      showToast(detail, "error");
    } finally {
      setIsSaving(false);
    }
  }, [
    novelId,
    mainCategory,
    selectedMain,
    selectedPlots,
    localPlotData,
    selectedCharacters,
    emotionProcess,
    storyBackground,
    customTags,
    targetLength,
    saveCategoryConfig,
    showToast,
    navigate,
  ]);

  // ===================== Loading =============================
  if (isLoadingCategoryMetadata && !categoryMetadata) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ===================== Render ==============================
  return (
    <div className="flex flex-col">
      {/* 标题栏 + 保存按钮 */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 1: 故事分类与标签</h1>
          <p className="text-[11px] text-muted-foreground">
            选择分类、角色、情绪和背景设定
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !mainCategory}
          className="rounded-none text-xs h-8"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1" />
              保存并下一步
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* 左右分栏 */}
      <div className="flex gap-0">
        {/* ============ 左面板 ============ */}
        <div className="flex-1 min-w-0 pb-12">
          {/* ❶ 主分类 */}
          <SectionCard
            title="主分类"
            right={
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-[#5B8DEF]" />
                <span className="inline-block w-1.5 h-1.5 bg-[#E87D9F]" />
                <span className="inline-block w-1.5 h-1.5 bg-[#6BAF6B]" />
                <span className="text-[9px] text-muted-foreground ml-0.5">
                  男/女/通用
                </span>
              </span>
            }
            hint="单选"
          >
            <div className="flex flex-wrap gap-1.5">
              {mainCategories.map((cat) => (
                <Chip
                  key={cat.name}
                  selected={mainCategory === cat.name}
                  genderClass={GENDER_CLASS[cat._gender]}
                  genderClassSelected={GENDER_CLASS_SELECTED[cat._gender]}
                  onClick={() => toggleMain(cat.name)}
                >
                  <span className="text-[12px] font-medium">{cat.name}</span>
                </Chip>
              ))}
            </div>
          </SectionCard>

          {/* ❷ 情节分类 */}
          <SectionCard
            title="情节分类"
            right={
              <div className="flex items-center gap-1.5">
                <input
                  className="bg-background border border-muted text-foreground px-2 py-1 text-[10px] outline-none w-[80px] focus:border-foreground"
                  placeholder="搜索..."
                  value={plotSearch}
                  onChange={(e) => setPlotSearch(e.target.value)}
                />
                <select
                  className="bg-background border border-muted text-foreground px-1 py-1 text-[10px] outline-none cursor-pointer"
                  value={plotFilter}
                  onChange={(e) => setPlotFilter(e.target.value)}
                >
                  <option value="">全部</option>
                  {plotLevel2s.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
                <button
                  className={`inline-flex items-center justify-center h-[22px] px-2 text-[10px] border transition-colors
                    ${plotManage ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-muted hover:border-foreground hover:text-foreground"}`}
                  onClick={togglePlotManage}
                >
                  <GripVertical className="w-3 h-3 mr-0.5" /> 管理
                </button>
              </div>
            }
          >
            <div
              className={`flex flex-wrap gap-1.5 ${plotManage ? "select-none" : ""}`}
            >
              {filteredPlots.map((p, idx) => (
                <Chip
                  key={p._id}
                  selected={selectedPlots.includes(p.level3)}
                  onClick={() => togglePlot(p.level3)}
                  draggable={plotManage}
                  onDragStart={plotManage ? (e) => onDragStart(e, "plot", idx) : undefined}
                  onDragOver={plotManage ? onDragOver : undefined}
                  onDragEnd={plotManage ? onDragEnd : undefined}
                  onDrop={plotManage ? (e) => onPlotDrop(e, idx) : undefined}
                >
                  {plotManage && (
                    <GripVertical className="w-2.5 h-2.5 text-muted-foreground mr-0.5 cursor-grab" />
                  )}
                  <span>
                    {p.level3}
                    <span className="block text-[8px] text-muted-foreground leading-tight">
                      {p.level2}
                    </span>
                  </span>
                  {plotManage && (
                    <X
                      className="w-3 h-3 text-red-500 ml-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlot(p._id);
                      }}
                    />
                  )}
                </Chip>
              ))}
            </div>

            {showPlotAdd && (
              <div className="flex gap-1 mt-1.5">
                <input
                  ref={plotAddInputRef}
                  className="flex-1 bg-background border border-muted text-foreground px-2 py-1 text-[10px] outline-none focus:border-foreground min-w-[80px]"
                  placeholder="新情节名称"
                  value={plotAddName}
                  onChange={(e) => setPlotAddName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmPlotAdd();
                    if (e.key === "Escape") cancelPlotAdd();
                  }}
                />
                <select
                  className="bg-background border border-muted text-foreground px-1 py-1 text-[10px] outline-none"
                  value={plotAddLevel2}
                  onChange={(e) => setPlotAddLevel2(e.target.value)}
                >
                  <option value="">分组</option>
                  {plotLevel2s.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
                <button
                  className="border px-2 py-1 text-[10px] hover:border-green-500 hover:text-green-600"
                  onClick={confirmPlotAdd}
                >
                  ✓
                </button>
                <button
                  className="border px-2 py-1 text-[10px] hover:border-red-400 hover:text-red-400"
                  onClick={cancelPlotAdd}
                >
                  ✕
                </button>
              </div>
            )}
            <button
              className="inline-flex items-center justify-center w-6 h-6 text-muted-foreground border border-dashed border-muted hover:border-foreground text-sm mt-1"
              onClick={showPlotAddForm}
              title="新增情节"
            >
              <Plus className="w-3 h-3" />
            </button>
          </SectionCard>

          {/* ❸ 角色关键词 */}
          <SectionCard
            title="角色关键词"
            right={
              <div className="flex items-center gap-1.5">
                <input
                  className="bg-background border border-muted text-foreground px-2 py-1 text-[10px] outline-none w-[80px] focus:border-foreground"
                  placeholder="搜索..."
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                />
                <button
                  className={`inline-flex items-center justify-center h-[22px] px-2 text-[10px] border transition-colors
                    ${charManage ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-muted hover:border-foreground hover:text-foreground"}`}
                  onClick={toggleCharManage}
                >
                  <GripVertical className="w-3 h-3 mr-0.5" /> 管理
                </button>
              </div>
            }
          >
            <div
              className={`flex flex-wrap gap-1.5 ${charManage ? "select-none" : ""}`}
            >
              {filteredChars.map((tag, idx) => (
                <Chip
                  key={tag}
                  selected={selectedCharacters.includes(tag)}
                  onClick={() => toggleChar(tag)}
                  draggable={charManage}
                  onDragStart={
                    charManage ? (e) => onDragStart(e, "char", idx) : undefined
                  }
                  onDragOver={charManage ? onDragOver : undefined}
                  onDragEnd={charManage ? onDragEnd : undefined}
                  onDrop={
                    charManage ? (e) => onCharDrop(e, idx) : undefined
                  }
                >
                  {charManage && (
                    <GripVertical className="w-2.5 h-2.5 text-muted-foreground mr-0.5 cursor-grab" />
                  )}
                  <span className="text-[11px]">{tag}</span>
                  {charManage && (
                    <X
                      className="w-3 h-3 text-red-500 ml-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChar(idx);
                      }}
                    />
                  )}
                </Chip>
              ))}
            </div>

            {showCharAdd && (
              <div className="flex gap-1 mt-1.5">
                <input
                  ref={charAddInputRef}
                  className="flex-1 bg-background border border-muted text-foreground px-2 py-1 text-[10px] outline-none focus:border-foreground"
                  placeholder="新关键词名称"
                  value={charAddName}
                  onChange={(e) => setCharAddName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmCharAdd();
                    if (e.key === "Escape") cancelCharAdd();
                  }}
                />
                <button
                  className="border px-2 py-1 text-[10px] hover:border-green-500 hover:text-green-600"
                  onClick={confirmCharAdd}
                >
                  ✓
                </button>
                <button
                  className="border px-2 py-1 text-[10px] hover:border-red-400 hover:text-red-400"
                  onClick={cancelCharAdd}
                >
                  ✕
                </button>
              </div>
            )}
            <button
              className="inline-flex items-center justify-center w-6 h-6 text-muted-foreground border border-dashed border-muted hover:border-foreground text-sm mt-1"
              onClick={showCharAddForm}
              title="新增关键词"
            >
              <Plus className="w-3 h-3" />
            </button>
          </SectionCard>

          {/* ❹/❺ 情绪 + 背景 并排 */}
          <div className="flex gap-2">
            <SectionCard
              title="情绪过程"
              hint="单选"
              className="flex-1"
            >
              <div className="flex flex-wrap gap-1.5">
                {categoryMetadata?.emotion_processes.map((proc) => (
                  <Chip
                    key={proc}
                    selected={emotionProcess === proc}
                    onClick={() => selectEmotion(proc)}
                  >
                    <span className="text-[11px]">{proc}</span>
                  </Chip>
                ))}
              </div>
            </SectionCard>
            <SectionCard
              title="故事背景"
              hint="单选"
              className="flex-1"
            >
              <div className="flex flex-wrap gap-1.5">
                {categoryMetadata?.story_backgrounds.map((bg) => (
                  <Chip
                    key={bg}
                    selected={storyBackground === bg}
                    onClick={() => selectBg(bg)}
                  >
                    <span className="text-[11px]">{bg}</span>
                  </Chip>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* ❻ 自定义标签 */}
          <SectionCard title="自定义标签" hint="自由输入你想要的标签">
            <div className="flex flex-wrap gap-1.5">
              {customTags.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">
                  暂无自定义标签
                </span>
              )}
              {customTags.map((tag) => (
                <Chip
                  key={tag}
                  selected={true}
                >
                  <span className="text-[11px]">{tag}</span>
                  <X
                    className="w-3 h-3 ml-1 opacity-50 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomTag(tag);
                    }}
                  />
                </Chip>
              ))}
            </div>
            <div className="flex gap-1 mt-1.5">
              <input
                className="flex-1 bg-background border border-muted text-foreground px-2 py-1 text-[10px] outline-none focus:border-foreground"
                placeholder="输入自定义标签，回车添加..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
              />
              <button
                className="border px-2 py-1 text-[10px] hover:border-foreground"
                onClick={addCustomTag}
              >
                添加
              </button>
            </div>
          </SectionCard>

          {/* ❼ 目标字数 */}
          <SectionCard title="目标字数">
            <div className="flex items-center gap-3 max-w-[320px]">
              <input
                type="range"
                min={2000}
                max={30000}
                step={1000}
                value={targetLength}
                onChange={(e) => setTargetLength(Number(e.target.value))}
                className="flex-1 accent-foreground"
              />
              <span className="text-xs font-medium w-16 text-right tabular-nums">
                {targetLength} 字
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              约 {Math.round(targetLength / 1000)} 章，每章约 1000 字
            </p>
          </SectionCard>
        </div>

        {/* ============ 右面板 ============ */}
        <div className="w-[280px] flex-shrink-0 border-l overflow-y-auto p-3 bg-background">
          <div className="flex items-center gap-1 mb-3 pb-2 border-b">
            <h3 className="text-[13px] font-semibold">已选分类</h3>
            <span className="ml-auto text-[10px] text-muted-foreground bg-background border px-1.5 py-0.5">
              {selectionCount} 项
            </span>
          </div>

          {selectionCount === 0 && (
            <span className="text-[10px] text-muted-foreground italic">
              尚未选择任何分类
            </span>
          )}

          {mainCategory && (
            <SelGroup title="主分类">
              <SelTag
                kind={selectedMain?.gender === "男频" ? "male" : selectedMain?.gender === "女频" ? "female" : "common"}
                label={mainCategory}
                onRemove={() => removeSelection("main")}
              />
            </SelGroup>
          )}

          {selectedPlots.length > 0 && (
            <SelGroup title={`情节分类 ${selectedPlots.length}项`}>
              {selectedPlots.map((p) => (
                <SelTag
                  key={p}
                  kind="plot"
                  label={p}
                  onRemove={() => removeSelection("plot", p)}
                />
              ))}
            </SelGroup>
          )}

          {selectedCharacters.length > 0 && (
            <SelGroup title={`角色关键词 ${selectedCharacters.length}项`}>
              {selectedCharacters.map((c) => (
                <SelTag
                  key={c}
                  kind="char"
                  label={c}
                  onRemove={() => removeSelection("char", c)}
                />
              ))}
            </SelGroup>
          )}

          {emotionProcess && (
            <SelGroup title="情绪过程">
              <SelTag
                kind="emotion"
                label={emotionProcess}
                onRemove={() => removeSelection("emotion")}
              />
            </SelGroup>
          )}

          {storyBackground && (
            <SelGroup title="故事背景">
              <SelTag
                kind="bg"
                label={storyBackground}
                onRemove={() => removeSelection("bg")}
              />
            </SelGroup>
          )}

          {customTags.length > 0 && (
            <SelGroup title={`自定义标签 ${customTags.length}项`}>
              {customTags.map((t) => (
                <SelTag
                  key={t}
                  kind="custom"
                  label={t}
                  onRemove={() => removeSelection("custom", t)}
                />
              ))}
            </SelGroup>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 子组件
// =========================================================================

/** 分类区块容器 */
function SectionCard({
  title,
  right,
  hint,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border mb-2 ${className}`}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b">
        <span className="text-[12px] font-semibold">{title}</span>
        <div className="flex items-center gap-1.5">
          {right}
          {hint && (
            <span className="text-[9px] text-muted-foreground">{hint}</span>
          )}
        </div>
      </div>
      <div className="px-2.5 py-1.5">{children}</div>
    </div>
  );
}

/** 右侧选中标签 */
function SelGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <div className="text-[9px] font-semibold text-muted-foreground tracking-wide mb-1.5">
        ▸ {title}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

/** 右侧单个选中标签 */
function SelTag({
  kind,
  label,
  onRemove,
}: {
  kind: keyof typeof SRC_TAG;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] border whitespace-nowrap ${SRC_TAG[kind]}`}
    >
      {label}
      <X
        className="w-2.5 h-2.5 opacity-50 hover:opacity-100 cursor-pointer"
        onClick={onRemove}
      />
    </span>
  );
}
