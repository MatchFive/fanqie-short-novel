/**
 * Step 5: 章节规划页面（重新设计版）
 *
 * 交互模式:
 *  - 章节卡片列表，每张卡片展示章节关键信息
 *  - 顶部操作栏：添加番外 / 重新生成 / 确认
 *  - 番外章对话框
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
// StepNavigator removed — sidebar now shows step progress
import type { ShortStoryChapter } from "@/types/shortStory";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Target,
  Smile,
  Loader2,
  Plus,
  FileText,
  Star,
  X,
  AlertCircle,
} from "lucide-react";

export default function ChapterPlanPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const { setting, chapterPlan, isGeneratingChapters, generateChapters, loadProgress, addExtraChapter } =
    useShortStoryStore();

  const [localChapters, setLocalChapters] = useState<ShortStoryChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showExtraDialog, setShowExtraDialog] = useState(false);
  const [extraTitle, setExtraTitle] = useState("");
  const [extraType, setExtraType] = useState<"background" | "motivation" | "aftermath" | "custom">("background");
  const [extraDesc, setExtraDesc] = useState("");
  const [extraWords, setExtraWords] = useState(1000);
  const [insertAfter, setInsertAfter] = useState(0);

  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  useEffect(() => {
    if (novelId) {
      setIsLoading(true);
      setHasLoaded(false);
      setLoadError(null);
      Promise.all([
        useShortStoryStore.getState().loadSetting(novelId),
        useShortStoryStore.getState().loadChapters(novelId),
      ])
        .then(() => { setHasLoaded(true); })
        .catch((err: any) => { setLoadError(err?.message || '加载章节数据失败'); })
        .finally(() => { setIsLoading(false); });
    }
  }, [novelId]);

  useEffect(() => {
    if (chapterPlan.length > 0) setLocalChapters(chapterPlan);
  }, [chapterPlan]);

  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && !isGeneratingChapters && localChapters.length === 0) {
      if (chapterPlan.length > 0) {
        setLocalChapters(chapterPlan);
        return;
      }
      if (setting?.status === "planned" || setting?.status === "generating" || setting?.status === "completed") {
        generateChapters(novelId);
      }
    }
  }, [novelId, isLoading, hasLoaded, setting, localChapters.length, isGeneratingChapters, chapterPlan]);

  const totalWords = localChapters.reduce((sum, ch) => sum + (ch.estimated_words || 0), 0);
  const handleRegenerate = async () => {
    if (!novelId) return;
    try {
      await generateChapters(novelId);
      showToast("章节规划已重新生成", "success");
    } catch (err: any) {
      showToast(err.apiError?.detail || "生成失败", "error");
    }
  };

  const handleConfirm = () => navigate(`/write?novelId=${novelId}`);

  const handleAddExtra = async () => {
    if (!novelId) return;
    try {
      await addExtraChapter(novelId, {
        title: extraTitle,
        extra_type: extraType,
        description: extraDesc,
        estimated_words: extraWords,
        insert_after: insertAfter,
      });
      showToast("番外章已添加", "success");
      setShowExtraDialog(false);
      setExtraTitle("");
      setExtraDesc("");
    } catch {
      showToast("添加失败", "error");
    }
  };

  if (isGeneratingChapters) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs text-muted-foreground">AI 正在拆分章节...</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs text-muted-foreground">加载章节数据...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-8 h-8 text-[#DC2626] opacity-60" />
          <p className="text-xs text-muted-foreground">{loadError}</p>
          <button
            className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted cursor-pointer inline-flex items-center gap-1.5"
            onClick={() => { if (novelId) {
              setIsLoading(true);
              Promise.all([
                useShortStoryStore.getState().loadSetting(novelId),
                useShortStoryStore.getState().loadChapters(novelId),
              ]).finally(() => { setIsLoading(false); setHasLoaded(true); });
            }}}
          >
            <RefreshCw className="w-3 h-3" /> 重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 5: 章节规划</h1>
          <p className="text-[11px] text-muted-foreground">
            预估总字数：{totalWords.toLocaleString()} 字 · 共 {localChapters.length} 章
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowExtraDialog(true)}>
            <Plus className="w-3 h-3 mr-1" /> 添加番外
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleRegenerate}>
            <RefreshCw className="w-3 h-3 mr-1" /> 重新生成
          </Button>
          <Button size="sm" className="text-xs h-7" onClick={handleConfirm}>
            确认拆分 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        <div className="max-w-2xl space-y-2 py-1">
          {localChapters.map((ch, i) => (
            <div key={ch.id || i} className={`border ${ch.chapter_type === "extra" ? "border-dashed" : ""}`}>
              <div className="px-3 py-1.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0 border ${ch.chapter_type === "extra" ? "bg-accent" : ""}`}>
                    {ch.chapter_type === "extra" ? "番外" : `第 ${ch.order_index} 章`}
                  </span>
                  <span className="text-[11px] font-medium">{ch.title}</span>
                  {ch.chapter_type === "extra" && (
                    <span className="text-[9px] px-1 py-0 border text-muted-foreground flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" />
                      {ch.extra_type === "background" ? "背景" : ch.extra_type === "motivation" ? "动机" : ch.extra_type === "aftermath" ? "后续" : "自定义"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{ch.estimated_words || 0} 字</span>
              </div>
              <div className="p-3 space-y-2">
                {ch.plot_summary && (
                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{ch.plot_summary}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <BookOpen className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground">场景</div>
                      <div>
                        {ch.scenes_covered?.map((s) => `场景${s}`).join(", ") || "待定"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Target className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground">目标</div>
                      <div>{ch.core_goal || "待定"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Smile className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground">情绪</div>
                      <div>{ch.emotion_target || "待定"}</div>
                    </div>
                  </div>
                </div>
                {ch.ending_hook && (
                  <div className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="font-medium text-foreground shrink-0">钩子：</span>
                    <span>{ch.ending_hook}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {localChapters.length === 0 && (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <FileText className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">暂无章节规划</p>
              <Button onClick={handleRegenerate} size="sm" className="text-xs h-7">
                <RefreshCw className="w-3 h-3 mr-1" /> 生成章节
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 番外章对话框 */}
      {showExtraDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-background border w-[400px] max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">添加番外章</span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setShowExtraDialog(false)} />
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block">章节标题</label>
                <input
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none focus:border-foreground"
                  value={extraTitle}
                  onChange={(e) => setExtraTitle(e.target.value)}
                  placeholder="如：角色背景揭秘"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">番外类型</label>
                <select
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none"
                  value={extraType}
                  onChange={(e) => setExtraType(e.target.value as typeof extraType)}
                >
                  <option value="background">角色背景</option>
                  <option value="motivation">动机揭秘</option>
                  <option value="aftermath">后续发展</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">内容描述</label>
                <textarea
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none focus:border-foreground resize-none"
                  rows={3}
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="描述番外章的主要内容..."
                />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">预估字数</label>
                <input
                  type="number"
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none focus:border-foreground"
                  value={extraWords}
                  onChange={(e) => setExtraWords(Number(e.target.value))}
                  min={500}
                  max={5000}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">插入位置</label>
                <select
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none"
                  value={String(insertAfter)}
                  onChange={(e) => setInsertAfter(Number(e.target.value))}
                >
                  <option value="0">开头（第1章之前）</option>
                  {localChapters.map((ch) => (
                    <option key={ch.order_index} value={String(ch.order_index)}>
                      第 {ch.order_index} 章之后
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowExtraDialog(false)}>取消</Button>
                <Button size="sm" className="text-xs h-7" onClick={handleAddExtra} disabled={!extraTitle.trim() || !extraDesc.trim()}>添加</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
