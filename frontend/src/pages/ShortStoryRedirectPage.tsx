import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { shortStoryApi } from '@/api/shortStory';

/**
 * 短篇小说入口重定向
 * 根据已有进度自动跳转到对应的步骤
 */
export default function ShortStoryRedirectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const novelId = searchParams.get('novelId');

  useEffect(() => {
    if (!novelId) {
      navigate('/');
      return;
    }

    // 检查 store 中是否已加载过（防止 StrictMode double-invoke + 页面刷新）
    const store = useShortStoryStore.getState();
    if (store.categoryConfigLoaded) {
      // 已经加载过，直接跳转
      const { categoryConfig, setting } = store;
      let targetStep = 'categories';
      if (!categoryConfig) {
        targetStep = 'categories';
      } else if (!setting?.core_hook) {
        targetStep = 'hook';
      } else if (!setting.selected_plan_id) {
        targetStep = 'plans';
      } else if (!setting.character_profiles) {
        targetStep = 'plan';
      } else if (setting.status === 'planned') {
        targetStep = 'chapters';
      } else if (setting.status === 'generating' || setting.status === 'completed') {
        // 检查是否全部完成
        const allCompleted = store.chapterPlan.length > 0 && store.chapterPlan.every(ch => ch.status === 'completed');
        targetStep = allCompleted ? 'integrate' : 'write';
      }
      navigate(`/${targetStep}?novelId=${novelId}`, { replace: true });
      return;
    }

    // 并行加载 setting 和 category config
    Promise.all([
      shortStoryApi.getSetting(novelId).catch(() => null),
      shortStoryApi.getCategoryConfig(novelId).catch(() => null),
    ]).then(([setting, categoryConfig]) => {
      // 将数据存入 store，并标记 categoryConfig 已加载
      // 这样后续页面不会再重复发起 404 请求
      store.setCategoryConfigLoaded(true);
      if (categoryConfig) {
        store.categoryConfig = categoryConfig;
      }
      if (setting) {
        store.setting = setting;
      }

      let targetStep = 'categories';

      if (!categoryConfig) {
        targetStep = 'categories';
      } else if (!setting?.core_hook) {
        targetStep = 'hook';
      } else if (!setting.selected_plan_id) {
        targetStep = 'plans';
      } else if (!setting.character_profiles) {
        targetStep = 'plan';
      } else if (setting.status === 'planned') {
        targetStep = 'chapters';
      } else if (setting.status === 'generating' || setting.status === 'completed') {
        targetStep = 'write';
      }

      navigate(`/${targetStep}?novelId=${novelId}`, { replace: true });
    }).catch(() => {
      // 如果获取失败，默认到第一步
      store.setCategoryConfigLoaded(true);
      navigate(`/categories?novelId=${novelId}`, { replace: true });
    });
  }, [novelId, navigate]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">加载中...</p>
    </div>
  );
}
