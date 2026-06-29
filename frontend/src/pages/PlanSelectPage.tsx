/**
 * Step 3: 方案选择页面（重新设计版）
 *
 * 交互模式:
 *  - 展示 AI 生成的 3 个方案
 *  - 卡片式选择，选中高亮
 *  - 顶部操作栏：重新生成 / 下一步
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
// StepNavigator removed — sidebar now shows step progress
import type { Plan } from "@/types/shortStory";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Check,
  Loader2,
  Clock,
  TrendingUp,
  Lightbulb,
  FileText,
  Layers,
  AlertCircle,
} from "lucide-react";

export default function PlanSelectPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  useEffect(() => {
    if (novelId) {
      setIsLoading(true);
      setHasLoaded(false);
      setLoadError(null);
      loadSetting(novelId)
        .then(() => { setHasLoaded(true); })
        .catch((err: any) => { setLoadError(err?.message || '加载设置失败'); })
        .finally(() => { setIsLoading(false); });
    }
  }, [novelId]);

  useEffect(() => {
    if (generatedPlans.length > 0) setLocalPlans(generatedPlans);
  }, [generatedPlans]);

  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && !isGeneratingPlans && localPlans.length === 0 && setting?.core_hook) {
      if (generatedPlans.length > 0) {
        setLocalPlans(generatedPlans);
        return;
      }
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
    showToast("方案已选择", "success");
  };

  const handleConfirm = () => {
    if (!selectedPlan) {
      showToast("请先选择一个方案", "warning");
      return;
    }
    navigate(`/plan?novelId=${novelId}`);
  };

  const handleRegenerate = async () => {
    if (!novelId) return;
    await generatePlans(novelId, 3);
    showToast("方案已重新生成", "success");
  };

  if (isGeneratingPlans) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center space-y-4 py-16">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs text-muted-foreground">AI 正在生成方案...（预计 10-30 秒）</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center space-y-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-xs text-muted-foreground">加载数据...</p>
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
            onClick={() => { if (novelId) loadSetting(novelId).then(() => setHasLoaded(true)).catch((err: any) => setLoadError(err?.message || '加载失败')).finally(() => setIsLoading(false)); }}
          >
            <RefreshCw className="w-3 h-3" /> 重试
          </button>
        </div>
      </div>
    );
  }

  const narrativeLabels: Record<string, string> = {
    "线性叙事": "线性",
    "倒叙": "倒叙",
    "插叙": "插叙",
    "环形叙事": "环形",
    "多视角拼接": "多视角",
  };
  const endingLabels: Record<string, string> = {
    "圆满结局": "圆满",
    "悲剧结局": "悲剧",
    "反转结局": "反转",
    "开放式结局": "开放",
    "讽刺结局": "讽刺",
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 3: 选择基础设定</h1>
          <p className="text-[11px] text-muted-foreground">
            爽点：{setting?.core_hook?.slice(0, 40)}
            {setting?.core_hook && setting.core_hook.length > 40 ? "..." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="text-xs h-7">
            <RefreshCw className="w-3 h-3 mr-1" /> 重新生成
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedPlan} className="text-xs h-7">
            下一步 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        <p className="text-[11px] text-muted-foreground mb-3">
          AI 为你生成了 {localPlans.length} 个方案，请选择一个：
        </p>

        <div className="space-y-3 max-w-3xl">
          {localPlans.map((plan) => (
            <div
              key={plan.plan_id}
              onClick={() => handleSelect(plan.plan_id)}
              className={`border cursor-pointer transition-colors
                ${selectedPlan?.plan_id === plan.plan_id ? "border-foreground bg-accent ring-1 ring-foreground" : "hover:border-foreground"}`}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium border-b-2 border-foreground px-0.5">
                    方案 {plan.plan_id}
                  </span>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0 border">
                    {narrativeLabels[plan.narrative_order] || plan.narrative_order}
                  </span>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0 border">
                    {endingLabels[plan.ending_type] || plan.ending_type}
                  </span>
                </div>
                {selectedPlan?.plan_id === plan.plan_id && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-foreground text-background px-2 py-0.5">
                    <Check className="w-3 h-3" /> 已选
                  </span>
                )}
              </div>

              <div className="p-3 space-y-3">
                <p className="text-xs leading-relaxed">{plan.plot_summary}</p>

                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">情绪曲线</div>
                      <div>{plan.emotion_curve}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Clock className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">预估字数</div>
                      <div>{plan.estimated_length}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">亮点</div>
                      <div>{plan.why_this_works}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {localPlans.length === 0 && (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <FileText className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">暂无方案</p>
              <Button onClick={handleRegenerate} size="sm" className="text-xs h-7">
                <RefreshCw className="w-3 h-3 mr-1" /> 生成方案
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
