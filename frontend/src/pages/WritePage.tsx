import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import { shortStoryApi } from '@/api/shortStory';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  BookOpen,
  Check,
  RefreshCw,
  Edit3,
  Save,
} from 'lucide-react';

/**
 * Step 5: 写作工作台
 */
export default function WritePage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
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

  const [editingContent, setEditingContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  void isLoading;
  void hasLoaded;

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  // 加载设定和章节
  useEffect(() => {
    if (novelId) {
      setIsLoading(true);
      setHasLoaded(false);
      Promise.all([
        useShortStoryStore.getState().loadSetting(novelId),
        loadChapters(novelId),
      ]).finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
    }
  }, [novelId]);

  const currentCh = chapterPlan.find((ch) => ch.order_index === currentChapter);

  const handleGenerate = async () => {
    if (!novelId) return;
    await generateChapter(novelId, currentChapter);
    showToast('章节生成完成', 'success');
  };

  const handleRegenerate = async () => {
    if (!novelId || !regenerateFeedback.trim()) return;
    setRegenerateDialogOpen(false);
    await regenerateChapter(novelId, currentChapter, regenerateFeedback);
    setRegenerateFeedback('');
    showToast('章节已重新生成', 'success');
  };

  const handleAccept = async () => {
    if (!novelId || !currentCh) return;
    try {
      await shortStoryApi.updateChapter(novelId, currentChapter, { status: 'completed' });
      // 更新本地状态
      const updatedPlan = chapterPlan.map((ch) =>
        ch.order_index === currentChapter ? { ...ch, status: 'completed' as const } : ch
      );
      useShortStoryStore.setState({ chapterPlan: updatedPlan });
      showToast('章节已接受', 'success');
    } catch (err) {
      showToast('保存失败', 'error');
    }
  };

  const handleEdit = () => {
    setEditingContent(currentCh?.content || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!novelId || !currentCh) return;
    try {
      await shortStoryApi.updateChapter(novelId, currentChapter, { content: editingContent });
      // 更新本地状态
      const updatedPlan = chapterPlan.map((ch) =>
        ch.order_index === currentChapter ? { ...ch, content: editingContent, word_count: editingContent.length } : ch
      );
      useShortStoryStore.setState({ chapterPlan: updatedPlan });
      setIsEditing(false);
      showToast('修改已保存', 'success');
    } catch (err) {
      showToast('保存失败', 'error');
    }
  };

  const handleConfirm = () => {
    navigate(`/integrate?novelId=${novelId}`);
  };

  const handleBack = () => {
    navigate(`/chapters?novelId=${novelId}`);
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  const handleGenerateAll = async () => {
    if (!novelId) return;
    try {
      await generateAllChapters(novelId);
      showToast('开始一键生成全部章节', 'success');
    } catch (err: any) {
      showToast('一键生成失败', 'error');
    }
  };

  const totalWords = chapterPlan.reduce((sum, ch) => sum + ch.word_count, 0);
  const completedChapters = chapterPlan.filter((ch) => ch.status === 'completed').length;

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={6}
          onStepClick={handleStepClick}
        />
      </div>

      {/* 顶部导航 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            上一步
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Step 5: 写作工作台</h1>
            <p className="text-xs text-muted-foreground">
              已完成 {completedChapters}/{chapterPlan.length} 章，共 {totalWords} 字
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isGeneratingAll ? (
            <div className="flex items-center space-x-2 mr-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs text-muted-foreground">
                一键生成中 {generationAllProgress}%
              </span>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleGenerateAll}>
              <BookOpen className="w-4 h-4 mr-2" />
              一键生成全部
            </Button>
          )}
          <Button size="sm" onClick={handleConfirm}>
            下一步
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧章节导航 */}
        <div className="w-56 border-r p-3 space-y-2 overflow-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            章节列表
          </p>
          {chapterPlan.map((ch) => (
            <div
              key={ch.order_index}
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                currentChapter === ch.order_index
                  ? 'bg-foreground/10 border border-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setCurrentChapter(ch.order_index)}
            >
              <div>
                <p className="text-sm font-medium">第{ch.order_index}章</p>
                <p className="text-xs text-muted-foreground">{ch.title}</p>
              </div>
              {ch.status === 'completed' && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>
          ))}
        </div>

        {/* 中间编辑器 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 overflow-auto">
            <div className="h-full border rounded p-4 bg-background">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    AI 正在生成第{currentChapter}章...
                  </p>
                  <Progress value={generationProgress} className="w-64" />
                </div>
              ) : currentCh?.content ? (
                isEditing ? (
                  <Textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="h-full resize-none"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="text-lg font-semibold mb-4">
                      第{currentCh.order_index}章 {currentCh.title}
                    </h3>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {currentCh.content}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <BookOpen className="w-8 h-8 mb-2" />
                  <p>选择左侧章节，点击生成按钮开始写作</p>
                </div>
              )}
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              字数：{(currentCh?.word_count || 0).toLocaleString()} / {(currentCh?.estimated_words || 0).toLocaleString()}
            </div>
            <div className="flex items-center space-x-2">
              {currentCh?.content && !isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    修改
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRegenerateDialogOpen(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重生成
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAccept}>
                    <Check className="w-4 h-4 mr-2" />
                    接受
                  </Button>
                </>
              )}
              {isEditing && (
                <Button variant="outline" size="sm" onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              )}
              <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4 mr-2" />
                )}
                生成第{currentChapter}章
              </Button>
            </div>
          </div>
        </div>

        {/* 右侧上下文面板 */}
        <div className="w-64 border-l p-3 space-y-4 overflow-auto">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              前文摘要
            </p>
            <p className="text-xs text-muted-foreground">
              {chapterPlan
                .filter((ch) => ch.order_index < currentChapter && ch.status === 'completed')
                .slice(-1)
                .map((ch) => ch.content?.slice(0, 100) + '...')
                .join('') || '暂无前文'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              本章目标
            </p>
            <p className="text-xs">{currentCh?.core_goal || '推进剧情'}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              情绪目标
            </p>
            <p className="text-xs">{currentCh?.emotion_target || '待定'}</p>
          </div>

          {currentCh?.ending_hook && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                章末钩子
              </p>
              <p className="text-xs">{currentCh.ending_hook}</p>
            </div>
          )}
        </div>
      </div>

      {/* 重生成对话框 */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新生成第{currentChapter}章</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">修改意见</label>
              <Textarea
                placeholder="请描述你希望修改的内容，例如：增加更多对话描写、加快节奏、改变某个情节..."
                value={regenerateFeedback}
                onChange={(e) => setRegenerateFeedback(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleRegenerate} disabled={!regenerateFeedback.trim()}>
                确认重生成
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
