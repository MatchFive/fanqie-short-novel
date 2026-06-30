import { createHashRouter } from 'react-router-dom';
import HomeLayout from './components/HomeLayout';
import StudioLayout from './components/StudioLayout';
import HomePage from './pages/HomePage';
import ShortStoryRedirectPage from './pages/ShortStoryRedirectPage';
import CategoryConfigPage from './pages/CategoryConfigPage';
import HookSelectPage from './pages/HookSelectPage';
import PlanSelectPage from './pages/PlanSelectPage';
import DetailPlanPage from './pages/DetailPlanPage';
import ChapterPlanPage from './pages/ChapterPlanPage';
import WritePage from './pages/WritePage';
import IntegratePage from './pages/IntegratePage';
import TrendingPage from './pages/TrendingPage';

export const router = createHashRouter([
  // 首页工作台：无侧边栏，设置/导出以 Dialog 形式打开
  {
    element: <HomeLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/trending', element: <TrendingPage /> },
    ],
  },
  // 创作工作台：带左侧步骤导航（仅在创作流程中出现）
  {
    element: <StudioLayout />,
    children: [
      { path: '/categories', element: <CategoryConfigPage /> },
      { path: '/hook', element: <HookSelectPage /> },
      { path: '/plans', element: <PlanSelectPage /> },
      { path: '/plan', element: <DetailPlanPage /> },
      { path: '/chapters', element: <ChapterPlanPage /> },
      { path: '/write', element: <WritePage /> },
      { path: '/integrate', element: <IntegratePage /> },
    ],
  },
  // 重定向入口（不需要 Layout 壳）
  { path: '/open', element: <ShortStoryRedirectPage /> },
]);
