import React from 'react';
import { Check, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShortStoryStore } from '@/stores/shortStoryStore';

interface Step {
  id: number;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, label: '分类', description: '配置番茄分类标签' },
  { id: 2, label: '爽点', description: '选择核心爽点' },
  { id: 3, label: '方案', description: '选择基础设定' },
  { id: 4, label: '规划', description: '详细规划' },
  { id: 5, label: '章节', description: '章节拆分' },
  { id: 6, label: '写作', description: '逐章生成' },
  { id: 7, label: '整合', description: '全文整合' },
];

interface StepNavigatorProps {
  currentStep: number;
  modifiedSteps?: number[];
  onStepClick?: (step: number) => void;
  className?: string;
}

/**
 * 七步流程导航组件
 * 显示短篇小说创作的七个步骤进度
 * completedSteps 从全局 store 读取，确保刷新后状态正确
 * 严格遵循 Lovart 黑白灰直角规范
 */
export default function StepNavigator({
  currentStep,
  modifiedSteps = [],
  onStepClick,
  className,
}: StepNavigatorProps) {
  const stepProgress = useShortStoryStore((s) => s.stepProgress);
  const isLoadingProgress = useShortStoryStore((s) => s.isLoadingProgress);

  const getStepStatus = (stepId: number): 'completed' | 'active' | 'modified' | 'pending' => {
    if (stepId === currentStep) return 'active';
    if (modifiedSteps.includes(stepId)) return 'modified';
    // 从 store 读取完成状态
    if (stepProgress && stepProgress[stepId - 1]) return 'completed';
    return 'pending';
  };

  const canClick = (stepId: number): boolean => {
    if (!onStepClick) return false;
    // 当前步骤和已完成的步骤都可以点击跳转
    if (stepId === currentStep) return true;
    if (stepProgress && stepProgress[stepId - 1]) return true;
    return false;
  };

  const statusConfig = {
    completed: {
      icon: <Check className="w-3.5 h-3.5" />,
      circleClass: 'bg-foreground text-background border-foreground',
      lineClass: 'bg-foreground',
      labelClass: 'text-foreground',
    },
    active: {
      icon: <Play className="w-3.5 h-3.5" />,
      circleClass: 'bg-background text-foreground border-foreground ring-1 ring-foreground',
      lineClass: 'bg-muted',
      labelClass: 'text-foreground font-semibold',
    },
    modified: {
      icon: <span className="text-xs">!</span>,
      circleClass: 'bg-muted text-foreground border-foreground',
      lineClass: 'bg-muted',
      labelClass: 'text-foreground',
    },
    pending: {
      icon: (stepId: number) => <span className="text-xs">{stepId}</span>,
      circleClass: 'bg-background text-muted-foreground border-muted',
      lineClass: 'bg-muted',
      labelClass: 'text-muted-foreground',
    },
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const config = statusConfig[status];
          const clickable = canClick(step.id);

          return (
            <React.Fragment key={step.id}>
              {/* 步骤节点 */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => clickable && onStepClick?.(step.id)}
                  disabled={!clickable}
                  className={cn(
                    'w-8 h-8 border flex items-center justify-center transition-all rounded-none',
                    config.circleClass,
                    clickable && 'cursor-pointer hover:opacity-80',
                    !clickable && 'cursor-default',
                    isLoadingProgress && 'opacity-50'
                  )}
                >
                  {typeof config.icon === 'function' ? (config.icon as (stepId: number) => React.ReactNode)(step.id) : config.icon}
                </button>
                <div className="mt-1.5 text-center">
                  <p className={cn('text-xs', config.labelClass)}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* 连接线 */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-2 -mt-6">
                  <div className={cn('h-0.5 transition-colors', config.lineClass)} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
