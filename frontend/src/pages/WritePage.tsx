/**
 * Step 6: 写作工作台（重新设计版）
 *
 * 交互模式:
 *  - 三栏布局：左侧章节列表 / 中间编辑器 / 右侧上下文面板
 *  - 编辑模式 vs 预览模式
 *  - 重生成对话框
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
import { shortStoryApi } from "@/api/shortStory";
import { useKeyboardShortcuts, type ShortcutDef } from "@/hooks/useKeyboardShortcuts";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  BookOpen,
  Check,
  RefreshCw,
  Edit3,
  Save,
  FileText,
  X,
  Keyboard,
  Undo2,
} from "lucide-react";

/** 草稿历史版本 */
interface DraftEntry {
  timestamp: number;
  content: string;
  wordCount: number;
}

const MAX_DRAFTS = 5; // 每章最多保留 5 个历史版本

function getDraftKey(novelId: string, chapterNum: number) {
  return `fanqie_draft_${novelId}_ch${chapterNum}`;
}

function loadDrafts(novelId: string, chapterNum: number): DraftEntry[] {
  try {
    const raw = localStorage.getItem(getDraftKey(novelId, chapterNum));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 重生成前自动保存当前内容为草稿 */
function saveDraft(novelId: string, chapterNum: number, content: string) {
  if (!content) return;
  const drafts = loadDrafts(novelId, chapterNum);
  // 避免重复保存相同内容
  if (drafts.length > 0 && drafts[0].content === content) return;
  drafts.unshift({ timestamp: Date.now(), content, wordCount: content.length });
  if (drafts.length > MAX_DRAFTS) drafts.length = MAX_DRAFTS;
  try {
    localStorage.setItem(getDraftKey(novelId, chapterNum), JSON.stringify(drafts));
  } catch { /* storage full */ }
}

export default function WritePage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    chapterPlan,
    currentChapter,
    isGenerating,
    generationProgress,
    generateChapter,
    regenerateChapter,
    setCurrentChapter,
    loadChapters,
    loadProgress,
    isGeneratingAll,
    generationAllProgress,
    generateAllChapters,
  } = useShortStoryStore();

  const [editingContent, setEditingContent] = useState("");
  const [editingWordCount, setEditingWordCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const generationBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  useEffect(() => {
    if (novelId) {
      Promise.all([
        useShortStoryStore.getState().loadSetting(novelId),
        loadChapters(novelId),
      ]);
    }
  }, [novelId]);

  const currentCh = chapterPlan.find((ch) => ch.order_index === currentChapter);
  const totalWords = chapterPlan.reduce((sum, ch) => sum + ch.word_count, 0);
  const completedChapters = chapterPlan.filter((ch) => ch.status === "completed").length;

  const handleGenerate = async () => {
    if (!novelId) return;
    await generateChapter(novelId, currentChapter);
    showToast("章节生成完成", "success");
  };

  const handleRegenerate = async () => {
    if (!novelId || !regenerateFeedback.trim()) return;
    setRegenerateDialogOpen(false);
    // 重生成前自动保存当前内容为草稿
    if (currentCh?.content) {
      saveDraft(novelId, currentChapter, currentCh.content);
    }
    setConfirmDialog({
      open: true,
      title: '确认重新生成',
      message: `重新生成将覆盖第 ${currentChapter} 章的当前内容。当前内容已自动保存为草稿备用。是否继续？`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await regenerateChapter(novelId, currentChapter, regenerateFeedback);
        setRegenerateFeedback('');
        showToast('章节已重新生成', 'success');
      },
    });
  };

  /** 恢复最近一次草稿 */
  const handleRestoreDraft = () => {
    if (!novelId) return;
    const drafts = loadDrafts(novelId, currentChapter);
    if (drafts.length === 0) {
      showToast('没有可恢复的草稿', 'warning');
      return;
    }
    setConfirmDialog({
      open: true,
      title: '恢复草稿',
      message: `恢复第 ${currentChapter} 章最近一次草稿（${new Date(drafts[0].timestamp).toLocaleString('zh-CN')}，${drafts[0].wordCount.toLocaleString()} 字）。当前编辑器内容将被覆盖。`,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        setEditingContent(drafts[0].content);
        setEditingWordCount(drafts[0].wordCount);
        showToast('已恢复草稿', 'success');
      },
    });
  };

  const handleAccept = async () => {
    if (!novelId || !currentCh) return;
    try {
      await shortStoryApi.updateChapter(novelId, currentChapter, { status: "completed" });
      const updatedPlan = chapterPlan.map((ch) =>
        ch.order_index === currentChapter ? { ...ch, status: "completed" as const } : ch
      );
      useShortStoryStore.setState({ chapterPlan: updatedPlan });
      showToast("章节已接受", "success");
    } catch {
      showToast("保存失败", "error");
    }
  };

  const handleEdit = () => {
    const content = currentCh?.content || '';
    setEditingContent(content);
    setEditingWordCount(content.length);
    setIsEditing(true);
  };

  const handleContentChange = (value: string) => {
    setEditingContent(value);
    setEditingWordCount(value.length);
  };

  const handleSaveEdit = async () => {
    if (!novelId || !currentCh) return;
    try {
      await shortStoryApi.updateChapter(novelId, currentChapter, { content: editingContent });
      const updatedPlan = chapterPlan.map((ch) =>
        ch.order_index === currentChapter
          ? { ...ch, content: editingContent, word_count: editingContent.length }
          : ch
      );
      useShortStoryStore.setState({ chapterPlan: updatedPlan });
      setIsEditing(false);
      showToast("修改已保存", "success");
    } catch {
      showToast("保存失败", "error");
    }
  };

  const handleGenerateAll = async () => {
    if (!novelId) return;
    try {
      await generateAllChapters(novelId);
      showToast("开始一键生成", "success");
    } catch {
      showToast("一键生成失败", "error");
    }
  };

  // ─── 键盘快捷键 ──────────────────────────────────────────
  const shortcuts: ShortcutDef[] = [
    {
      key: 's',
      ctrl: true,
      description: '保存当前章节',
      handler: () => {
        if (isEditing && editingContent) handleSaveEdit();
      },
    },
    {
      key: 'Enter',
      ctrl: true,
      description: '生成当前章节',
      handler: () => {
        if (!isEditing && !isGenerating) handleGenerate();
      },
    },
    {
      key: 'ArrowRight',
      ctrl: true,
      description: '下一章',
      handler: () => {
        const nextIdx = chapterPlan.findIndex((ch) => ch.order_index === currentChapter) + 1;
        if (nextIdx < chapterPlan.length) setCurrentChapter(chapterPlan[nextIdx].order_index);
      },
    },
    {
      key: 'ArrowLeft',
      ctrl: true,
      description: '上一章',
      handler: () => {
        const prevIdx = chapterPlan.findIndex((ch) => ch.order_index === currentChapter) - 1;
        if (prevIdx >= 0) setCurrentChapter(chapterPlan[prevIdx].order_index);
      },
    },
    {
      key: '?',
      description: '显示/隐藏快捷键列表',
      handler: () => setShowShortcuts((prev) => !prev),
    },
  ];
  useKeyboardShortcuts(shortcuts, { enabled: !regenerateDialogOpen && !confirmDialog.open });

  const draftCount = novelId ? loadDrafts(novelId, currentChapter).length : 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 6: 写作工作台</h1>
          <p className="text-[11px] text-muted-foreground">
            已完成 {completedChapters}/{chapterPlan.length} 章 · 共 {totalWords.toLocaleString()} 字
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGeneratingAll ? (
            <div className="flex items-center gap-2 mr-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[11px] text-muted-foreground">{generationAllProgress}%</span>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleGenerateAll}>
              <BookOpen className="w-3 h-3 mr-1" /> 一键生成全部
            </Button>
          )}
          <Button size="sm" className="text-xs h-7" onClick={() => navigate(`/integrate?novelId=${novelId}`)}>
            下一步 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧章节导航 */}
        <div className="w-[200px] shrink-0 border-r overflow-y-auto p-2 space-y-0.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide px-2 py-1">章节列表</div>
          {chapterPlan.map((ch) => (
            <div
              key={ch.order_index}
              onClick={() => setCurrentChapter(ch.order_index)}
              className={`flex items-center justify-between px-2 py-1.5 cursor-pointer transition-colors
                ${currentChapter === ch.order_index ? "bg-accent border border-foreground" : "hover:bg-accent/50"}`}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-medium">第 {ch.order_index} 章</div>
                <div className="text-[9px] text-muted-foreground truncate">{ch.title}</div>
              </div>
              {ch.status === "completed" && <Check className="w-3 h-3 text-green-500 shrink-0" />}
            </div>
          ))}
        </div>

        {/* 中间编辑器 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="border h-full">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-xs text-muted-foreground">AI 正在生成第 {currentChapter} 章...</p>
                  <Progress value={generationProgress} className="w-48" />
                </div>
              ) : currentCh?.content ? (
                isEditing ? (
                  <textarea
                    value={editingContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="w-full h-full resize-none bg-background text-foreground p-4 text-xs leading-relaxed outline-none border-0"
                  />
                ) : (
                  <div className="p-5">
                    <h3 className="text-sm font-semibold mb-4">
                      第 {currentCh.order_index} 章 {currentCh.title}
                    </h3>
                    <div className="whitespace-pre-wrap text-xs leading-relaxed">{currentCh.content}</div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <BookOpen className="w-6 h-6 opacity-30" />
                  <p className="text-xs">选择左侧章节，点击生成</p>
                </div>
              )}
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="border-t px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="text-[11px] text-muted-foreground flex items-center gap-3">
              <span>
              {isEditing ? (
                <>
                  字数：<span className={`font-semibold ${editingWordCount >= (currentCh?.estimated_words || 1000) ? 'text-[#16A34A]' : editingWordCount >= (currentCh?.estimated_words || 1000) * 0.8 ? 'text-[#D97706]' : ''}`}>
                    {editingWordCount.toLocaleString()}
                  </span> / {(currentCh?.estimated_words || 0).toLocaleString()}
                </>
              ) : (
                <>字数：{(currentCh?.word_count || 0).toLocaleString()} / {(currentCh?.estimated_words || 0).toLocaleString()}</>
              )}
              </span>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                onClick={() => setShowShortcuts((prev) => !prev)}
                aria-label="查看键盘快捷键"
                title="快捷键 (?)"
              >
                <Keyboard className="w-3 h-3" /> 快捷键
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* 恢复草稿按钮 */}
              {currentCh?.content && !isEditing && draftCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={handleRestoreDraft} title={`${draftCount} 个历史版本`}>
                  <Undo2 className="w-3 h-3 mr-1" /> 恢复草稿
                </Button>
              )}
              {currentCh?.content && !isEditing && (
                <>
                  <Button variant="outline" size="sm" className="text-xs h-6" onClick={handleEdit}>
                    <Edit3 className="w-3 h-3 mr-1" /> 修改
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => setRegenerateDialogOpen(true)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> 重生成
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-6" onClick={handleAccept}>
                    <Check className="w-3 h-3 mr-1" /> 接受
                  </Button>
                </>
              )}
              {isEditing && (
                <Button variant="outline" size="sm" className="text-xs h-6" onClick={handleSaveEdit}>
                  <Save className="w-3 h-3 mr-1" /> 保存
                </Button>
              )}
              <Button size="sm" className="text-xs h-6" onClick={handleGenerate} disabled={isGenerating} ref={generationBtnRef}>
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <BookOpen className="w-3 h-3 mr-1" />
                )}
                生成第 {currentChapter} 章
              </Button>
            </div>
          </div>
        </div>

        {/* 右侧上下文面板 */}
        <div className="w-[220px] shrink-0 border-l overflow-y-auto p-3 space-y-3">
          <div className="border p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">前文摘要</div>
            <p className="text-[10px] text-muted-foreground line-clamp-3">
              {chapterPlan
                .filter((ch) => ch.order_index < currentChapter && ch.status === "completed")
                .slice(-1)
                .map((ch) => ch.content?.slice(0, 120) + "...")
                .join("") || "暂无前文"}
            </p>
          </div>
          <div className="border p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">本章目标</div>
            <p className="text-[10px]">{currentCh?.core_goal || "推进剧情"}</p>
          </div>
          <div className="border p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">情绪目标</div>
            <p className="text-[10px]">{currentCh?.emotion_target || "待定"}</p>
          </div>
          {currentCh?.ending_hook && (
            <div className="border p-2">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">章末钩子</div>
              <p className="text-[10px]">{currentCh.ending_hook}</p>
            </div>
          )}
        </div>
      </div>

      {/* 重生成对话框 */}
      {regenerateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-background border w-[400px]">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">重新生成第 {currentChapter} 章</span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setRegenerateDialogOpen(false)} />
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block">修改意见</label>
                <textarea
                  className="w-full bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none focus:border-foreground resize-none"
                  rows={4}
                  placeholder="描述你希望修改的内容..."
                  value={regenerateFeedback}
                  onChange={(e) => setRegenerateFeedback(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setRegenerateDialogOpen(false)}>取消</Button>
                <Button size="sm" className="text-xs h-7" onClick={handleRegenerate} disabled={!regenerateFeedback.trim()}>确认重生成</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 — 用于破坏性操作 */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-background border w-[380px]">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">{confirmDialog.title}</span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))} />
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>取消</Button>
                <Button size="sm" className="text-xs h-7 border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626] hover:text-white" onClick={confirmDialog.onConfirm}>确认</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快捷键面板 */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowShortcuts(false)}>
          <div className="bg-background border w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Keyboard className="w-4 h-4" /> 键盘快捷键
              </span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setShowShortcuts(false)} />
            </div>
            <div className="p-4 space-y-1">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                  <kbd className="px-2 py-0.5 text-[11px] border border-border bg-secondary font-mono">
                    {s.ctrl ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+') : ''}
                    {s.shift ? 'Shift+' : ''}
                    {s.key === 'ArrowRight' ? '→' : s.key === 'ArrowLeft' ? '←' : s.key === 'Enter' ? 'Enter' : s.key === '?' ? '?' : s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-2">
                按 <kbd className="px-1 py-0 text-[10px] border border-border bg-secondary">?</kbd> 随时唤出此面板
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
