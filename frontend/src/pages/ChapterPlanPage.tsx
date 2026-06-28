import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Target,
  Smile,
  Loader2,
  GripVertical,
  Plus,
  FileText,
  Star,
} from 'lucide-react';
import type { ShortStoryChapter } from '@/types/shortStory';

/**
 * Step 4: 章节拆分页面
 */
export default function ChapterPlanPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    setting,
    chapterPlan,
    isGeneratingChapters,
    generateChapters,
    loadProgress,
    addExtraChapter,
  } = useShortStoryStore();

  const [localChapters, setLocalChapters] = useState<ShortStoryChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // 番外章对话框
  const [showExtraDialog, setShowExtraDialog] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraType, setExtraType] = useState<'background' | 'motivation' | 'aftermath' | 'custom'>('background');
  const [extraDesc, setExtraDesc] = useState('');
  const [extraWords, setExtraWords] = useState(1000);
  const [insertAfter, setInsertAfter] = useState(0);

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
        useShortStoryStore.getState().loadChapters(novelId),
      ]).finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
    }
  }, [novelId]);

  // 同步章节到本地状态
  useEffect(() => {
    if (chapterPlan.length > 0) {
      setLocalChapters(chapterPlan);
    }
  }, [chapterPlan]);

  // 如果没有章节，自动生成（但先等待数据加载完成）
  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && !isGeneratingChapters && localChapters.length === 0) {
      // 如果 chapterPlan 有数据，同步到 localChapters
      if (chapterPlan.length > 0) {
        setLocalChapters(chapterPlan);
        return;
      }
      // 只有 status 是 planned 或 generating 或 completed 时才触发生成（已完成详细规划）
      if (setting?.status === 'planned' || setting?.status === 'generating' || setting?.status === 'completed') {
        generateChapters(novelId);
      }
    }
  }, [novelId, isLoading, hasLoaded, setting, localChapters.length, isGeneratingChapters, chapterPlan]);

  const totalWords = localChapters.reduce((sum, ch) => sum + (ch.estimated_words || 0), 0);

  const handleRegenerate = async () => {
    if (!novelId) return;
    try {
      await generateChapters(novelId);
      showToast('章节规划已重新生成', 'success');
    } catch (err: any) {
      const msg = err.apiError?.detail || err.apiError?.message || '生成章节失败';
      showToast(msg, 'error');
    }
  };

  const handleConfirm = () => {
    navigate(`/write?novelId=${novelId}`);
  };

  const handleBack = () => {
    navigate(`/plan?novelId=${novelId}`);
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

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
      showToast('番外章已添加', 'success');
      setShowExtraDialog(false);
      setExtraTitle('');
      setExtraDesc('');
    } catch (err: any) {
      showToast('添加番外章失败', 'error');
    }
  };

  // 生成中状态
  if (isGeneratingChapters) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <StepNavigator currentStep={5} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-muted-foreground">AI 正在拆分章节...（预计需要 10-30 秒）</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={5}
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
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-lg font-semibold">Step 4: 章节规划</h1>
            <p className="text-xs text-muted-foreground">
              预估总字数：{totalWords}字 共 {localChapters.length} 章
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowExtraDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            添加番外章
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新生成
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            确认拆分
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* 章节列表 */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3 max-w-3xl mx-auto">
          {localChapters.map((chapter, index) => (
            <ChapterCard
              key={chapter.id || index}
              chapter={chapter}
              index={index}
            />
          ))}

          {localChapters.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无章节规划</p>
              <Button className="mt-4" onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                生成章节
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 添加番外章对话框 */}
      <Dialog open={showExtraDialog} onOpenChange={setShowExtraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加番外章</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">章节标题</label>
              <Input
                value={extraTitle}
                onChange={(e) => setExtraTitle(e.target.value)}
                placeholder="如：角色背景揭秘"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">番外类型</label>
              <Select value={extraType} onValueChange={(v: any) => setExtraType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="background">角色背景</SelectItem>
                  <SelectItem value="motivation">动机揭秘</SelectItem>
                  <SelectItem value="aftermath">后续发展</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">内容描述</label>
              <Textarea
                value={extraDesc}
                onChange={(e) => setExtraDesc(e.target.value)}
                placeholder="描述番外章的主要内容..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">预估字数</label>
              <Input
                type="number"
                value={extraWords}
                onChange={(e) => setExtraWords(Number(e.target.value))}
                min={500}
                max={5000}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">插入位置</label>
              <Select value={String(insertAfter)} onValueChange={(v) => setInsertAfter(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">开头（第1章之前）</SelectItem>
                  {localChapters.map((ch) => (
                    <SelectItem key={ch.order_index} value={String(ch.order_index)}>
                      第{ch.order_index}章之后
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowExtraDialog(false)}>取消</Button>
              <Button onClick={handleAddExtra} disabled={!extraTitle.trim() || !extraDesc.trim()}>
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== 子组件 ==========

function ChapterCard({
  chapter,
}: {
  chapter: ShortStoryChapter;
  index: number;
}) {
  const isExtra = chapter.chapter_type === 'extra';

  return (
    <Card className={`hover:bg-accent/50 ${isExtra ? 'border-dashed' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <Badge variant={isExtra ? 'secondary' : 'outline'}>
              {isExtra ? '番外' : `第${chapter.order_index}章`}
            </Badge>
            <CardTitle className="text-sm">{chapter.title}</CardTitle>
            {isExtra && (
              <Badge variant="outline" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                {chapter.extra_type === 'background' ? '背景' :
                 chapter.extra_type === 'motivation' ? '动机' :
                 chapter.extra_type === 'aftermath' ? '后续' : '自定义'}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {chapter.estimated_words || 0}字
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* 情节梗概 */}
        {chapter.plot_summary && (
          <div className="mb-3 flex items-start space-x-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{chapter.plot_summary}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-start space-x-2">
            <BookOpen className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">场景</p>
              <p>
                {chapter.scenes_covered
                  ?.map((s) => `场景${s}`)
                  .join(', ') || '待定'}
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <Target className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">目标</p>
              <p>{chapter.core_goal || '待定'}</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <Smile className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">情绪</p>
              <p>{chapter.emotion_target || '待定'}</p>
            </div>
          </div>
        </div>
        {chapter.ending_hook && (
          <div className="mt-2 flex items-start space-x-2 text-xs text-muted-foreground">
            <span className="font-medium">钩子：</span>
            <span>{chapter.ending_hook}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
