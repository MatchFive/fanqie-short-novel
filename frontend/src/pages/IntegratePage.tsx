/**
 * Step 7: 全文整合与导出（重新设计版）
 *
 * 交互模式:
 *  - 统计卡片（总章节/总字数/已完成）
 *  - 开篇钩子选择
 *  - 问题列表与修复方案（Sprint 16）
 *  - 整合检查、优化建议
 *  - 备选作品名选择
 *  - 章节预览列表
 *  - 导出按钮
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
import { shortStoryApi, updateNovelApi } from "@/api/shortStory";
// StepNavigator removed — sidebar now shows step progress
import type { IntegrationIssue, IntegrationFix } from "@/types/shortStory";
import {
  ArrowLeft,
  Download,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  BookOpen,
  Sparkles,
  Lightbulb,
  Wrench,
  X,
  Edit3,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function IntegratePage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    chapterPlan,
    isIntegrating,
    integrationResult,
    isFixing,
    fixes,
    integrate,
    exportStory,
    fixIssues,
    applyFix,
    rejectFix,
    modifyFix,
    loadFixes,
    loadProgress,
    openingHooks,
    selectedOpeningHook,
    generateOpeningHooks,
    selectOpeningHook,
    applyAllFixes,
  } = useShortStoryStore();

  const [, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [selectedFix, setSelectedFix] = useState<IntegrationFix | null>(null);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [novelTitle, setNovelTitle] = useState("短篇小说");
  const hasLoadedRef = useRef(false);

  useEffect(() => { if (hasLoaded) setIsLoading(false); }, [hasLoaded]);
  useEffect(() => {
    if (novelId) {
      shortStoryApi.getSetting(novelId).then((s) => { if (s?.title) setNovelTitle(s.title); }).catch(() => {});
    }
  }, [novelId]);
  useEffect(() => { if (novelId) loadProgress(novelId); }, [novelId, loadProgress]);
  useEffect(() => {
    if (novelId && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(true);
      setIsPageLoading(true);
      setHasLoaded(false);
      setLoadError(null);
      Promise.all([
        useShortStoryStore.getState().loadSetting(novelId),
        useShortStoryStore.getState().loadChapters(novelId),
        loadFixes(novelId),
      ])
        .then(() => { setHasLoaded(true); })
        .catch((err: any) => { setLoadError(err?.message || '加载整合数据失败'); })
        .finally(() => { setIsLoading(false); setIsPageLoading(false); });
    }
  }, [novelId, loadFixes]);

  const handleIntegrate = async () => {
    if (!novelId) return;
    await integrate(novelId);
    showToast("整合完成", "success");
  };

  const handleFixAll = async () => {
    if (!novelId || !integrationResult?.auto_fixable?.length) return;
    try {
      await fixIssues(novelId, integrationResult.auto_fixable);
      showToast("已生成修复方案", "success");
    } catch { showToast("生成修复方案失败", "error"); }
  };

  const handleFixSingle = async (issue: IntegrationIssue) => {
    if (!novelId) return;
    try {
      const result = await fixIssues(novelId, [issue]);
      if (result.length > 0) { setSelectedFix(result[0]); setShowFixDialog(true); }
    } catch { showToast("生成修复方案失败", "error"); }
  };

  const handleAcceptFix = async () => {
    if (!novelId || !selectedFix) return;
    try { await applyFix(novelId, selectedFix.id); showToast("修复已应用", "success"); setShowFixDialog(false); setSelectedFix(null); }
    catch { showToast("应用修复失败", "error"); }
  };

  const handleRejectFix = async () => {
    if (!novelId || !selectedFix) return;
    try { await rejectFix(novelId, selectedFix.id); showToast("已拒绝修复", "info"); setShowFixDialog(false); setSelectedFix(null); }
    catch { showToast("操作失败", "error"); }
  };

  const handleEditFix = async () => {
    if (!novelId || !selectedFix) return;
    try { await modifyFix(novelId, selectedFix.id, editText); showToast("修改已应用", "success"); setEditMode(false); setShowFixDialog(false); setSelectedFix(null); }
    catch { showToast("应用修改失败", "error"); }
  };

  const handleExport = async (format: "txt" | "md" | "epub") => {
    if (!novelId) return;
    try {
      const content = await exportStory(novelId, format);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${novelTitle}.${format}`; a.click();
      URL.revokeObjectURL(url);
      showToast("导出成功", "success");
    } catch { showToast("导出失败", "error"); }
  };

  const handleSelectTitle = async (title: string) => {
    if (!novelId) return;
    try { await updateNovelApi(novelId, title); setNovelTitle(title); showToast(`作品名已更新为「${title}」`, "success"); }
    catch { showToast("更新作品名失败", "error"); }
  };

  const handleGenerateHooks = async () => {
    if (!novelId) return;
    try { await generateOpeningHooks(novelId); showToast("已生成开篇钩子候选", "success"); }
    catch { showToast("生成开篇钩子失败", "error"); }
  };

  const handleSelectHook = async (hookId: number) => {
    if (!novelId) return;
    try { await selectOpeningHook(novelId, hookId); showToast("开篇钩子已选择", "success"); }
    catch { showToast("选择开篇钩子失败", "error"); }
  };

  const handleApplyAllFixes = async () => {
    if (!novelId) return;
    try { await applyAllFixes(novelId); showToast("已批量应用所有修复", "success"); }
    catch { showToast("批量应用修复失败", "error"); }
  };

  const openFixDialog = useCallback((fix: IntegrationFix) => {
    setSelectedFix(fix); setEditText(fix.fixed_text); setEditMode(false); setShowFixDialog(true);
  }, []);

  const totalWords = chapterPlan.reduce((sum, ch) => sum + ch.word_count, 0);
  const completedChapters = chapterPlan.filter((ch) => ch.status === "completed").length;
  const hasIssues = integrationResult?.issues && integrationResult.issues.length > 0;
  const hasFixes = fixes.length > 0;
  const hasTitleSuggestions = integrationResult?.title_suggestions && integrationResult.title_suggestions.length > 0;
  const pendingFixes = fixes.filter((f) => f.status === "pending");

  if (isPageLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs text-muted-foreground">加载整合数据...</span>
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
            className="px-3 py-1.5 text-xs border border-foreground hover:bg-hover cursor-pointer inline-flex items-center gap-1.5"
            onClick={() => {
              if (novelId) {
                setIsPageLoading(true);
                setLoadError(null);
                Promise.all([
                  useShortStoryStore.getState().loadSetting(novelId),
                  useShortStoryStore.getState().loadChapters(novelId),
                  loadFixes(novelId),
                ]).finally(() => setIsPageLoading(false));
              }
            }}
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
          <h1 className="text-base font-semibold">Step 7: 全文整合</h1>
          <p className="text-[11px] text-muted-foreground">
            共 {completedChapters}/{chapterPlan.length} 章完成 · {totalWords.toLocaleString()} 字
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleExport("txt")}>
            <Download className="w-3 h-3 mr-1" /> 导出 TXT
          </Button>
          <Button size="sm" className="text-xs h-7" onClick={handleIntegrate} disabled={isIntegrating}>
            {isIntegrating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 整合中</> : <><Sparkles className="w-3 h-3 mr-1" /> 开始整合</>}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        <div className="max-w-3xl mx-auto space-y-3 py-2">
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: BookOpen, label: "总章节", value: chapterPlan.length },
              { icon: FileText, label: "总字数", value: totalWords.toLocaleString() },
              { icon: Check, label: "已完成", value: completedChapters, color: "text-green-500" },
            ].map((s, i) => (
              <div key={i} className="border p-3 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color || "text-muted-foreground"}`} />
                <div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-semibold">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 开篇钩子 */}
          <Section title="开篇钩子" icon={<Sparkles className="w-3.5 h-3.5" />}>
            {selectedOpeningHook ? (
              <div className="p-2 bg-accent">
                <div className="text-[11px] font-medium">已选钩子</div>
                <div className="text-xs mt-1">{selectedOpeningHook.content}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">切入角度：{selectedOpeningHook.angle}</div>
              </div>
            ) : (
              <>
                {openingHooks.map((hook) => (
                  <div
                    key={hook.hook_id}
                    onClick={() => handleSelectHook(hook.hook_id)}
                    className="flex items-start justify-between p-2 hover:bg-accent/50 cursor-pointer border-b last:border-0"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="border px-1 py-0 text-[10px]">{hook.hook_id}</span>
                        <span className="font-medium">{hook.angle}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{hook.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-6">选择</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs h-6 w-full mt-1" onClick={handleGenerateHooks}>
                  <Sparkles className="w-3 h-3 mr-1" /> 生成钩子
                </Button>
              </>
            )}
          </Section>

          {/* 问题列表 */}
          {hasIssues && (
            <Section title={`发现 ${integrationResult!.issues.length} 个问题`} icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}>
              {integrationResult!.issues.map((issue, i) => (
                <div key={i} className="flex items-start justify-between p-2 border-b last:border-0 bg-yellow-50/30">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1 py-0 border ${issue.severity === "critical" ? "border-red-500 text-red-500 bg-red-50" : "text-muted-foreground"}`}>
                        {issue.severity}
                      </span>
                      <span className="text-[11px] font-medium">{issue.issue_description}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{issue.suggestion}</p>
                    {issue.affected_chapters?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">影响章节：第 {issue.affected_chapters.join("、")} 章</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => handleFixSingle(issue)}>
                    <Wrench className="w-2.5 h-2.5 mr-1" /> 修复
                  </Button>
                </div>
              ))}
              {integrationResult!.auto_fixable.length > 0 && (
                <Button className="w-full text-xs h-7 mt-1" onClick={handleFixAll} disabled={isFixing}>
                  {isFixing ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 生成修复方案</> : <><Sparkles className="w-3 h-3 mr-1" /> 一键修复 ({integrationResult!.auto_fixable.length}项)</>}
                </Button>
              )}
            </Section>
          )}

          {/* 修复方案列表 */}
          {hasFixes && (
            <Section title="修复方案" icon={<Wrench className="w-3.5 h-3.5" />} right={
              pendingFixes.length > 0 && (
                <Button variant="outline" size="sm" className="text-xs h-5" onClick={handleApplyAllFixes}>
                  <Check className="w-2.5 h-2.5 mr-0.5" /> 全部应用 ({pendingFixes.length})
                </Button>
              )
            }>
              {fixes.map((fix) => (
                <div key={fix.id} onClick={() => openFixDialog(fix)} className="flex items-center justify-between p-2 border-b last:border-0 hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] border px-1 py-0">{fix.issue_type}</span>
                    <span className="text-[11px]">{fix.issue_description}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0 text-white
                    ${fix.status === "accepted" ? "bg-green-500" : fix.status === "rejected" ? "bg-red-500" : fix.status === "modified" ? "bg-blue-500" : "bg-yellow-500"}`}>
                    {fix.status === "pending" ? "待确认" : fix.status === "accepted" ? "已应用" : fix.status === "rejected" ? "已拒绝" : "已修改"}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* 整合检查 */}
          {integrationResult?.checks && (
            <Section title="整合检查" icon={<Check className="w-3.5 h-3.5" />}>
              {integrationResult.checks.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 border-b last:border-0">
                  <div className="flex items-center gap-1.5">
                    {c.status === "pass" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                    <span className="text-[11px]">{c.item}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{c.detail}</span>
                </div>
              ))}
            </Section>
          )}

          {/* 优化建议 */}
          {integrationResult?.suggestions?.length > 0 && (
            <Section title="优化建议" icon={<Lightbulb className="w-3.5 h-3.5" />}>
              {integrationResult.suggestions.map((s, i) => (
                <div key={i} className="text-[11px] text-muted-foreground py-1 border-b last:border-0">· {s}</div>
              ))}
            </Section>
          )}

          {/* 备选作品名 */}
          {hasTitleSuggestions && (
            <Section title="备选作品名" icon={<Lightbulb className="w-3.5 h-3.5" />}>
              {integrationResult.title_suggestions!.map((t, i) => (
                <div key={i} onClick={() => handleSelectTitle(t.title)} className="flex items-center justify-between p-2 border-b last:border-0 hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] border px-1 py-0">{i + 1}</span>
                    <span className="text-[11px] font-medium">{t.title}</span>
                    <span className="text-[10px] text-muted-foreground">{t.reason}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-6">选用</Button>
                </div>
              ))}
            </Section>
          )}

          {/* 章节预览 */}
          <Section title="章节预览" icon={<BookOpen className="w-3.5 h-3.5" />}>
            {chapterPlan.map((ch) => (
              <div key={ch.order_index} className="flex items-center justify-between p-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">第 {ch.order_index} 章</span>
                  <span className="text-[11px] font-medium">{ch.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{ch.word_count}字</span>
                  {ch.status === "completed" ? (
                    <span className="text-[9px] text-green-500 border border-green-500 px-1 py-0">完成</span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground border px-1 py-0">待生成</span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        </div>
      </div>

      {/* 修复对比对话框 */}
      {showFixDialog && selectedFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-background border w-[700px] max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">修复预览</span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setShowFixDialog(false)} />
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[11px] font-medium">问题：{selectedFix.issue_description}</div>
                <div className="text-[10px] text-muted-foreground">
                  类型：{selectedFix.issue_type} · 影响章节：{selectedFix.affected_chapters?.join(", ")}
                </div>
              </div>
              {editMode ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium">手动编辑：</div>
                  <textarea
                    className="w-full bg-background border border-muted text-foreground px-2 py-2 text-xs outline-none focus:border-foreground resize-none font-mono"
                    rows={12}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setEditMode(false)}>取消</Button>
                    <Button size="sm" className="text-xs h-7" onClick={handleEditFix}>应用修改</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] font-medium text-red-500 mb-1">修改前</div>
                      <div className="border p-2 text-[11px] whitespace-pre-wrap max-h-[250px] overflow-y-auto bg-muted/30">{selectedFix.original_text}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-green-500 mb-1">修改后</div>
                      <div className="border p-2 text-[11px] whitespace-pre-wrap max-h-[250px] overflow-y-auto bg-muted/30">{selectedFix.fixed_text}</div>
                    </div>
                  </div>
                  {selectedFix.fix_reason && (
                    <div className="border p-2 bg-blue-50/30">
                      <div className="text-[11px] font-medium">修改说明</div>
                      <div className="text-[10px] text-muted-foreground">{selectedFix.fix_reason}</div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleRejectFix}><X className="w-3 h-3 mr-1" /> 拒绝</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setEditText(selectedFix.fixed_text); setEditMode(true); }}><Edit3 className="w-3 h-3 mr-1" /> 手动编辑</Button>
                    <Button size="sm" className="text-xs h-7" onClick={handleAcceptFix}><Check className="w-3 h-3 mr-1" /> 接受修改</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Sub-component
// =========================================================================
function Section({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border">
      <div className="px-3 py-1.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-semibold">{title}</span>
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}
