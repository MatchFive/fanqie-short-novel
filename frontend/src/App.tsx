import { createBrowserRouter } from 'react-router-dom';
import ShortStoryCreatePage from './pages/ShortStoryCreatePage';
import ShortStoryRedirectPage from './pages/ShortStoryRedirectPage';
import CategoryConfigPage from './pages/CategoryConfigPage';
import HookSelectPage from './pages/HookSelectPage';
import PlanSelectPage from './pages/PlanSelectPage';
import DetailPlanPage from './pages/DetailPlanPage';
import ChapterPlanPage from './pages/ChapterPlanPage';
import WritePage from './pages/WritePage';
import IntegratePage from './pages/IntegratePage';

export const router = createBrowserRouter([
  // 创建入口
  { path: '/', element: <ShortStoryCreatePage /> },
  // 重定向入口
  { path: '/open', element: <ShortStoryRedirectPage /> },
  // 短篇小说创作流程 7 步
  { path: '/categories', element: <CategoryConfigPage /> },
  { path: '/hook', element: <HookSelectPage /> },
  { path: '/plans', element: <PlanSelectPage /> },
  { path: '/plan', element: <DetailPlanPage /> },
  { path: '/chapters', element: <ChapterPlanPage /> },
  { path: '/write', element: <WritePage /> },
  { path: '/integrate', element: <IntegratePage /> },
]);
