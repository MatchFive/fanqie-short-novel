import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Check,
  Loader2,
  Clock,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import type { Plan } from '@/types/shortStory';

/**
 * Step 2: 方案选择页面
 */
export default function PlanSelectPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    setting,
    generatedPlans,
    selectedPlan,
    isGeneratingPlans,
    loadSetting,
    generatePlans,
    selectPlan,
    loadProgress,
  } = useShortStoryStore();

  const [localPlans, setLocalPlans] = useState<Plan[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  useEffect(() => {
    if (novelId) {
      setIsLoading(true);
      setHasLoaded(false);
      loadSetting(novelId).finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
    }
  }, [novelId]);

  useEffect(() => {
    if (generatedPlans.length > 0) {
      setLocalPlans(generatedPlans);
    }
  }, [generatedPlans]);

  // 如果没有方案，自动生成（但先等待数据加载完成）
  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && !isGeneratingPlans && localPlans.length === 0 && setting?.core_hook) {
      // 优先从 store 的 generatedPlans 加载（一键随机流程会预先加载）
      if (generatedPlans.length > 0) {
        setLocalPlans(generatedPlans);
        return;
      }
      // 如果 setting 中已经有方案，同步到本地状态
      if (setting.generated_plans && setting.generated_plans.length > 0) {
        setLocalPlans(setting.generated_plans);
        return;
      }
      generatePlans(novelId, 3);
    }
  }, [novelId, isLoading, hasLoaded, setting, localPlans.length, isGeneratingPlans, generatedPlans]);

  const handleSelect = async (planId: number) => {
    if (!novelId) return;
    await selectPlan(novelId, planId);
    showToast('方案已选择', 'success');
  };

  const handleConfirm = () => {
    if (!selectedPlan) {
      showToast('请先选择一个方案', 'warning');
      return;
    }
    navigate(`/plan?novelId=${novelId}`);
  };

  const handleBack = () => {
    navigate(`/hook?novelId=${novelId}`);
  };

  const handleRegenerate = async () => {
    if (!novelId) return;
    await generatePlans(novelId, 3);
    showToast('方案已重新生成', 'success');
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  // 生成中状态
  if (isGeneratingPlans) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <StepNavigator currentStep={3} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-muted-foreground">AI 正在生成方案...（预计需要 10-30 秒）</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={3}
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
            <h1 className="text-lg font-semibold">Step 2: 选择基础设定</h1>
            <p className="text-xs text-muted-foreground">
              核心爽点：{setting?.core_hook?.slice(0, 30)}...
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新生成
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedPlan}>
            下一步
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* 方案列表 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <p className="text-sm text-muted-foreground">
            AI 为你生成了 {localPlans.length} 个方案，请选择一个：
          </p>

          {localPlans.map((plan) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              isSelected={selectedPlan?.plan_id === plan.plan_id}
              onSelect={() => handleSelect(plan.plan_id)}
            />
          ))}

          {localPlans.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无方案</p>
              <Button className="mt-4" onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                生成方案
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 子组件 ==========

function PlanCard({
  plan,
  isSelected,
  onSelect,
}: {
  plan: Plan;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const narrativeOrderLabels: Record<string, string> = {
    '线性叙事': '线性',
    '倒叙': '倒叙',
    '插叙': '插叙',
    '环形叙事': '环形',
    '多视角拼接': '多视角',
  };

  const endingLabels: Record<string, string> = {
    '圆满结局': '圆满',
    '悲剧结局': '悲剧',
    '反转结局': '反转',
    '开放式结局': '开放',
    '讽刺结局': '讽刺',
  };

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? 'border-foreground bg-accent/30 ring-1 ring-foreground'
          : 'hover:bg-accent/50'
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">方案 {plan.plan_id}</Badge>
            <Badge variant="secondary" className="text-xs">
              {narrativeOrderLabels[plan.narrative_order] || plan.narrative_order}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {endingLabels[plan.ending_type] || plan.ending_type}
            </Badge>
          </div>
          {isSelected && (
            <Badge className="bg-foreground text-background">
              <Check className="w-3 h-3 mr-1" />
              已选
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{plan.plot_summary}</p>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">情绪曲线</p>
              <p className="text-xs">{plan.emotion_curve}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">预估字数</p>
              <p>{plan.estimated_length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">亮点</p>
              <p className="text-xs">{plan.why_this_works}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
