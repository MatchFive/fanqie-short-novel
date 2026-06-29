import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { createShortStoryApi } from '@/api/shortStory';
import { useAppStore } from '@/stores/appStore';

export default function CreatePage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);
  const [manualName, setManualName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleManualCreate = async () => {
    setIsCreating(true);
    try {
      const novel = await createShortStoryApi(manualName.trim() || undefined);
      showToast('作品创建成功', 'success');
      navigate(`/categories?novelId=${novel.id}`);
    } catch {
      // 后端未启动时，无 novelId 进入分类页（仍可查看预设）
      navigate('/categories');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRandomCreate = async () => {
    setIsCreating(true);
    try {
      const novel = await createShortStoryApi();
      showToast('随机创作已启动', 'success');
      navigate(`/categories?novelId=${novel.id}`);
    } catch {
      navigate('/categories');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">创作新作品</h1>
      <p className="text-[13px] text-muted-foreground mb-6">选择一种方式开始你的故事</p>

      <div className="grid grid-cols-2 gap-3 mt-6">
        {/* 手动创建 */}
        <div className="border border-border p-5 bg-background">
          <div className="text-[32px] mb-4">📖</div>
          <h2 className="font-semibold text-base mb-4">创建短篇小说</h2>
          <div className="mb-4">
            <label className="text-[13px] font-semibold block mb-1.5">作品名称（可选）</label>
            <input
              className="px-3 py-2 text-[13px] border border-border outline-none w-full focus:border-foreground"
              placeholder="输入作品名称..."
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            AI 将引导你完成 7 步创作流程，从分类到导出
          </p>
          <button
            onClick={handleManualCreate}
            disabled={isCreating}
            className="w-full px-4 py-2 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? '创建中...' : '开始创作 →'}
          </button>
        </div>

        {/* 随机创作 */}
        <div className="border border-dashed border-border p-5 bg-background">
          <div className="text-[32px] mb-4">🎲</div>
          <h2 className="font-semibold text-base mb-4">一键随机创作</h2>
          <div className="mb-4 flex flex-col gap-1.5 text-[13px]">
            <span className="text-muted-foreground">→ 随机搭配爽点 + 角色 + 背景</span>
            <span className="text-muted-foreground">→ 自动生成 3 个故事方案</span>
            <span className="text-muted-foreground">→ 快速进入写作环节</span>
          </div>
          <button
            onClick={handleRandomCreate}
            disabled={isCreating}
            className="w-full px-4 py-2 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 flex items-center justify-center mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? '创建中...' : '🎲 开始随机创作'}
          </button>
        </div>
      </div>
    </div>
  );
}
