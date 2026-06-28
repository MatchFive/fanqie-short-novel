import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import { shortStoryApi } from '@/api/shortStory';
import { BookOpen, Sparkles, ArrowRight, Shuffle, Zap, Loader2 } from 'lucide-react';

/**
 * 短篇小说创建入口页面
 * 支持手动创建和一键随机生成
 */
export default function ShortStoryCreatePage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const [title, setTitle] = useState('');
  const [isRandomCreating, setIsRandomCreating] = useState(false);
  const { createShortStory, randomCombine } = useShortStoryStore();

  const handleCreate = async () => {
    try {
      const novelId = await createShortStory(title);
      showToast('短篇小说创建成功', 'success');
      navigate(`/categories?novelId=${novelId}`);
    } catch (err) {
      showToast('创建失败', 'error');
    }
  };

  const handleRandomCreate = async () => {
    setIsRandomCreating(true);
    try {
      // 1. 创建短篇项目（标题传空，后端会用默认名）
      const novelId = await createShortStory('');

      // 2. 自动创建默认分类配置（一键随机跳过手动配置，但后端进度检查需要）
      await shortStoryApi.createCategoryConfig(novelId, {
        main_category: '都市脑洞',
        gender_orientation: '男频',
      });

      // 3. 获取随机组合
      await randomCombine();
      const combo = useShortStoryStore.getState().randomCombination;
      if (!combo) {
        throw new Error('随机组合失败');
      }

      // 4. 将随机爽点保存到后端（同时同步到 store）
      const setting = await shortStoryApi.setCoreHook(novelId, {
        custom_hook: combo.hook.description,
        category: combo.hook.category,
        emotional_target: '爽',
      });

      // 同步更新 store 中的 selectedHook 和 setting
      useShortStoryStore.setState({
        selectedHook: {
          id: 'custom',
          category: combo.hook.category,
          description: combo.hook.description,
          emotional_target: '爽',
          is_custom: true,
        },
        setting,
      });

      // 5. 触发生成方案
      await shortStoryApi.generatePlans(novelId, { count: 3, target_length: 8000 });

      // 6. 刷新 setting 以获取生成的方案（写入 store 供 PlanSelectPage 使用）
      await useShortStoryStore.getState().loadSetting(novelId);

      showToast('随机短篇小说已生成', 'success');
      // 跳转到方案选择页面
      navigate(`/plans?novelId=${novelId}`);
    } catch (err) {
      showToast('随机生成失败', 'error');
    } finally {
      setIsRandomCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md space-y-4">
        {/* 手动创建 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>创建短篇小说</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">作品名称（可选）</label>
              <Input
                placeholder="输入作品名称"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>AI 将引导你完成 7 步创作流程</span>
            </div>
            <Button className="w-full" onClick={handleCreate}>
              开始创作
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* 一键随机 */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-base">
              <Shuffle className="w-5 h-5" />
              <span>一键随机创作</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              不想选？让 AI 随机组合生成完整设定：
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">随机爽点 + 随机角色 + 随机背景</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">自动生成 3 个方案供选择</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">快速进入写作阶段</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRandomCreate}
              disabled={isRandomCreating}
            >
              {isRandomCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4 mr-2" />
                  开始随机创作
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
