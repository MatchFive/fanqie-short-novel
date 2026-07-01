/**
 * 首页：短篇小说创作入口
 * 设计语言：Lovart 黑白灰 + 边框分割 + 芯片式交互
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
import { shortStoryApi } from "@/api/shortStory";
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  Shuffle,
  Zap,
  Loader2,
  PenLine,
  Layers,
  FileText,
  BookMarked,
} from "lucide-react";

export default function ShortStoryCreatePage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const [title, setTitle] = useState("");
  const [isRandomCreating, setIsRandomCreating] = useState(false);
  const { createShortStory, randomCombine } = useShortStoryStore();

  const handleCreate = async () => {
    try {
      const novelId = await createShortStory(title);
      showToast("短篇小说创作已开始", "success");
      navigate(`/categories?novelId=${novelId}`);
    } catch {
      showToast("创建失败", "error");
    }
  };

  const handleRandomCreate = async () => {
    setIsRandomCreating(true);
    try {
      const novelId = await createShortStory("");
      await shortStoryApi.createCategoryConfig(novelId, {
        main_category: "都市脑洞",
        gender_orientation: "男频",
      });
      await randomCombine();
      const combo = useShortStoryStore.getState().randomCombination;
      if (!combo) throw new Error("随机组合失败");

      const setting = await shortStoryApi.setCoreHook(novelId, {
        custom_hook: combo.hook.description,
        category: combo.hook.category,
        emotional_target: "爽",
      });
      useShortStoryStore.setState({
        selectedHook: {
          id: "custom",
          category: combo.hook.category,
          description: combo.hook.description,
          emotional_target: "爽",
          is_custom: true,
        },
        setting,
      });
      await shortStoryApi.generatePlans(novelId, { count: 3, target_length: 8000 });
      await useShortStoryStore.getState().loadSetting(novelId);
      showToast("随机短篇小说已生成", "success");
      navigate(`/plans?novelId=${novelId}`);
    } catch {
      showToast("随机生成失败", "error");
    } finally {
      setIsRandomCreating(false);
    }
  };

  const steps = [
    { icon: Layers, label: "分类", desc: "选择故事标签与分类" },
    { icon: Zap, label: "爽点", desc: "确定核心驱动力" },
    { icon: BookMarked, label: "方案", desc: "AI 生成多方案" },
    { icon: FileText, label: "规划", desc: "角色 + 情节 + 章节" },
    { icon: PenLine, label: "写作", desc: "逐章 AI 写作" },
    { icon: Sparkles, label: "整合", desc: "全文整合与导出" },
  ];

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="w-full max-w-[560px] space-y-6">
        {/* 标题区 */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight">番茄短篇小说创作</h1>
          <p className="text-[12px] text-muted-foreground">
            AI 驱动的短篇小说创作工作台 · 7 步完成一篇高质量短篇
          </p>
        </div>

        {/* 流程预览 */}
        <div className="border">
          <div className="px-3 py-2 border-b flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold">创作流程</span>
            <span className="text-[9px] text-muted-foreground ml-auto">6 步</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                <s.icon className="w-3 h-3 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-foreground">{s.label}</div>
                  <div className="text-[8px] truncate">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 手动创建 */}
        <div className="border">
          <div className="px-3 py-2 border-b flex items-center gap-1.5">
            <PenLine className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold">手动创建</span>
            <span className="text-[9px] text-muted-foreground ml-auto">
              按流程逐步配置
            </span>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-background border border-muted text-foreground px-2 py-1.5 text-xs outline-none focus:border-foreground"
                placeholder="输入作品名称（可选）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate} className="text-xs h-8 whitespace-nowrap">
                开始创作
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* 一键随机 */}
        <div className="border border-dashed">
          <div className="px-3 py-2 border-b border-dashed flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold">一键随机创作</span>
            <span className="text-[9px] text-muted-foreground ml-auto">
              快速体验
            </span>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="space-y-1">
              {[
                "随机爽点 + 随机角色 + 随机背景",
                "自动生成 3 个方案供选择",
                "快速进入写作阶段",
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Zap className="w-2.5 h-2.5 shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full text-xs h-8"
              onClick={handleRandomCreate}
              disabled={isRandomCreating}
            >
              {isRandomCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                  开始随机创作
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
