import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import { shortStoryApi, updateNovelApi } from '@/api/shortStory';
import type { IntegrationIssue, IntegrationFix } from '@/types/shortStory';
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
} from 'lucide-react';

/**
 * Step 6: 全文整合与导出（增强版：支持智能修复）
 *
 * 整合完成后界面：
 * - 统计卡片
 * - 问题列表（发现问题时显示）
 * - 修复方案列表
 * - 整合检查结果
 * - 章节预览
 * - 备选作品名
 */
export default function IntegratePage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
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
  const [selectedFix, setSelectedFix] = useState<IntegrationFix | null>(null);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [novelTitle, setNovelTitle] = useState('短篇小说');

  const hasLoadedRef = useRef(false);

  // 标记是否已完成初始加载
  useEffect(() => {
    if (hasLoaded) {
      setIsLoading(false);
    }
  }, [hasLoaded]);

  // 加载小说信息
  useEffect(() => {
    if (novelId) {
      shortStoryApi.getSetting(novelId).then((setting) => {
        if (setting?.title) {
          setNovelTitle(setting.title);
        }
      }).catch(() => {});
    }
  }, [novelId]);

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  // 加载设定和章节
  useEffect(() => {
    if (novelId && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(true);
      setHasLoaded(false);
      Promise.all([
        useShortStoryStore.getState().loadSetting(novelId),
        useShortStoryStore.getState().loadChapters(novelId),
        loadFixes(novelId),
      ]).finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
    }
  }, [novelId, loadFixes]);

  const handleIntegrate = async () => {
    if (!novelId) return;
    await integrate(novelId);
    showToast('整合完成', 'success');
  };

  const handleFixAll = async () => {
    if (!novelId || !integrationResult?.auto_fixable?.length) return;
    try {
      await fixIssues(novelId, integrationResult.auto_fixable);
      showToast('已生成修复方案', 'success');
    } catch (err) {
      showToast('生成修复方案失败', 'error');
    }
  };

  const handleFixSingle = async (issue: IntegrationIssue) => {
    if (!novelId) return;
    try {
      const result = await fixIssues(novelId, [issue]);
      if (result.length > 0) {
        setSelectedFix(result[0]);
        setShowFixDialog(true);
      }
    } catch (err) {
      showToast('生成修复方案失败', 'error');
    }
  };

  const handleAcceptFix = async () => {
    if (!novelId || !selectedFix) return;
    try {
      await applyFix(novelId, selectedFix.id);
      showToast('修复已应用', 'success');
      setShowFixDialog(false);
      setSelectedFix(null);
    } catch (err) {
      showToast('应用修复失败', 'error');
    }
  };

  const handleRejectFix = async () => {
    if (!novelId || !selectedFix) return;
    try {
      await rejectFix(novelId, selectedFix.id);
      showToast('已拒绝修复', 'info');
      setShowFixDialog(false);
      setSelectedFix(null);
    } catch (err) {
      showToast('操作失败', 'error');
    }
  };

  const handleEditFix = async () => {
    if (!novelId || !selectedFix) return;
    try {
      await modifyFix(novelId, selectedFix.id, editText);
      showToast('修改已应用', 'success');
      setEditMode(false);
      setShowFixDialog(false);
      setSelectedFix(null);
    } catch (err) {
      showToast('应用修改失败', 'error');
    }
  };

  const handleExport = async (format: 'txt' | 'md' | 'epub') => {
    if (!novelId) return;
    try {
      const content = await exportStory(novelId, format);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novelTitle}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('导出成功', 'success');
    } catch (err) {
      showToast('导出失败', 'error');
    }
  };

  const handleSelectTitle = async (title: string) => {
    if (!novelId) return;
    try {
      await updateNovelApi(novelId, title);
      // 立即更新本地状态，确保导出时使用最新标题
      setNovelTitle(title);
      showToast(`作品名已更新为「${title}」`, 'success');
    } catch (err) {
      showToast('更新作品名失败', 'error');
    }
  };

  const handleBack = () => {
    navigate(`/write?novelId=${novelId}`);
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  const handleGenerateHooks = async () => {
    if (!novelId) return;
    try {
      await generateOpeningHooks(novelId);
      showToast('已生成开篇钩子候选', 'success');
    } catch (err) {
      showToast('生成开篇钩子失败', 'error');
    }
  };

  const handleSelectHook = async (hookId: number) => {
    if (!novelId) return;
    try {
      await selectOpeningHook(novelId, hookId);
      showToast('开篇钩子已选择', 'success');
    } catch (err) {
      showToast('选择开篇钩子失败', 'error');
    }
  };

  const handleApplyAllFixes = async () => {
    if (!novelId) return;
    try {
      await applyAllFixes(novelId);
      showToast('已批量应用所有修复', 'success');
    } catch (err) {
      showToast('批量应用修复失败', 'error');
    }
  };

  const openFixDialog = useCallback((fix: IntegrationFix) => {
    setSelectedFix(fix);
    setEditText(fix.fixed_text);
    setEditMode(false);
    setShowFixDialog(true);
  }, []);

  const totalWords = chapterPlan.reduce((sum, ch) => sum + ch.word_count, 0);
  const completedChapters = chapterPlan.filter((ch) => ch.status === 'completed').length;

  // 是否有问题需要修复
  const hasIssues = integrationResult?.issues && integrationResult.issues.length > 0;
  const hasFixes = fixes.length > 0;
  const hasTitleSuggestions = integrationResult?.title_suggestions && integrationResult.title_suggestions.length > 0;
  const pendingFixes = fixes.filter(f => f.status === 'pending');

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={7}
          onStepClick={handleStepClick}
        />
      </div>

      {/* 顶部导航 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回编辑
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-lg font-semibold">Step 6: 全文整合</h1>
            <p className="text-xs text-muted-foreground">
              共 {completedChapters}/{chapterPlan.length} 章完成，{totalWords}字
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>
            <Download className="w-4 h-4 mr-2" />
            导出 TXT
          </Button>
          <Button size="sm" onClick={handleIntegrate} disabled={isIntegrating}>
            {isIntegrating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                整合中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                开始整合
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">总章节</p>
                    <p className="text-lg font-semibold">{chapterPlan.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">总字数</p>
                    <p className="text-lg font-semibold">{totalWords.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">已完成</p>
                    <p className="text-lg font-semibold">{completedChapters}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 开篇钩子（Sprint 17）- 始终显示，允许用户生成和选择 */}
          {true && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  开篇钩子
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedOpeningHook ? (
                  <div className="p-3 bg-accent/20 rounded">
                    <p className="text-sm font-medium">已选钩子</p>
                    <p className="text-sm mt-1">{selectedOpeningHook.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">切入角度：{selectedOpeningHook.angle}</p>
                  </div>
                ) : (
                  <>
                    {openingHooks.map((hook) => (
                      <div
                        key={hook.hook_id}
                        className="flex items-start justify-between p-2 rounded hover:bg-accent/50 cursor-pointer"
                        onClick={() => handleSelectHook(hook.hook_id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{hook.hook_id}</Badge>
                            <span className="text-sm font-medium">{hook.angle}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{hook.content}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          选择
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={handleGenerateHooks}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      重新生成钩子
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 问题列表（新增：Sprint 16） */}
          {hasIssues && (
            <Card className="border-yellow-500/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                  发现 {integrationResult!.issues.length} 个问题
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {integrationResult!.issues.map((issue, index) => (
                  <div key={index} className="flex items-start justify-between p-2 rounded bg-yellow-500/5">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'}>
                          {issue.severity}
                        </Badge>
                        <span className="text-sm font-medium">{issue.issue_description}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{issue.suggestion}</p>
                      {issue.affected_chapters && issue.affected_chapters.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          影响章节：第{issue.affected_chapters.join('、')}章
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleFixSingle(issue)}>
                        <Wrench className="w-3 h-3 mr-1" /> 修复
                      </Button>
                    </div>
                  </div>
                ))}
                {integrationResult!.auto_fixable.length > 0 && (
                  <Button className="w-full mt-2" onClick={handleFixAll} disabled={isFixing}>
                    {isFixing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成修复方案...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> 一键修复全部（{integrationResult!.auto_fixable.length}项）
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* 修复方案列表 */}
          {hasFixes && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm">修复方案</CardTitle>
                {pendingFixes.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleApplyAllFixes}>
                    <Check className="w-3 h-3 mr-1" />
                    全部应用（{pendingFixes.length}）
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {fixes.map((fix) => (
                  <div
                    key={fix.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent/50 cursor-pointer"
                    onClick={() => openFixDialog(fix)}
                  >
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{fix.issue_type}</Badge>
                      <span className="text-sm">{fix.issue_description}</span>
                    </div>
                    <Badge className={
                      fix.status === 'accepted' ? 'bg-green-500' :
                      fix.status === 'rejected' ? 'bg-red-500' :
                      fix.status === 'modified' ? 'bg-blue-500' : 'bg-yellow-500'
                    }>
                      {fix.status === 'pending' ? '待确认' :
                       fix.status === 'accepted' ? '已应用' :
                       fix.status === 'rejected' ? '已拒绝' : '已修改'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 整合检查 */}
          {integrationResult?.checks && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">整合检查</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {integrationResult.checks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded">
                    <div className="flex items-center space-x-2">
                      {check.status === 'pass' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : check.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{check.item}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{check.detail}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 优化建议 */}
          {integrationResult?.suggestions && integrationResult.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">优化建议</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {integrationResult.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      • {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 备选作品名 */}
          {hasTitleSuggestions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  备选作品名
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {integrationResult.title_suggestions!.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleSelectTitle(t.title)}
                  >
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <span className="text-sm font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">{t.reason}</span>
                    </div>
                    <Button variant="ghost" size="sm">
                      选用
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 章节预览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">章节预览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {chapterPlan.map((ch) => (
                <div
                  key={ch.order_index}
                  className="flex items-center justify-between p-2 rounded hover:bg-accent/50"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">第{ch.order_index}章</span>
                    <span className="text-sm font-medium">{ch.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">
                      {ch.word_count}字
                    </span>
                    {ch.status === 'completed' ? (
                      <Badge variant="outline" className="text-green-500">
                        完成
                      </Badge>
                    ) : (
                      <Badge variant="outline">待生成</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 修复对比对话框 */}
      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>修复预览</DialogTitle>
            <DialogDescription>
              查看修复前后的对比，选择接受、拒绝或手动编辑。
            </DialogDescription>
          </DialogHeader>
          {selectedFix && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">问题：{selectedFix.issue_description}</p>
                <p className="text-xs text-muted-foreground">
                  类型：{selectedFix.issue_type} | 影响章节：{selectedFix.affected_chapters?.join(', ')}
                </p>
              </div>

              {editMode ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">手动编辑：</p>
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      取消
                    </Button>
                    <Button onClick={handleEditFix}>应用修改</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-500">修改前</p>
                      <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap max-h-[300px] overflow-auto">
                        {selectedFix.original_text}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-green-500">修改后</p>
                      <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap max-h-[300px] overflow-auto">
                        {selectedFix.fixed_text}
                      </div>
                    </div>
                  </div>

                  {selectedFix.fix_reason && (
                    <div className="p-3 bg-blue-500/5 rounded">
                      <p className="text-sm font-medium">修改说明</p>
                      <p className="text-sm text-muted-foreground">{selectedFix.fix_reason}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={handleRejectFix}>
                      <X className="w-4 h-4 mr-1" /> 拒绝
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditText(selectedFix.fixed_text);
                        setEditMode(true);
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-1" /> 手动编辑
                    </Button>
                    <Button onClick={handleAcceptFix}>
                      <Check className="w-4 h-4 mr-1" /> 接受修改
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
