import { createHashRouter } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CreatePage from './pages/CreatePage';
import ShortStoryRedirectPage from './pages/ShortStoryRedirectPage';
import CategoryConfigPage from './pages/CategoryConfigPage';
import HookSelectPage from './pages/HookSelectPage';
import PlanSelectPage from './pages/PlanSelectPage';
import DetailPlanPage from './pages/DetailPlanPage';
import ChapterPlanPage from './pages/ChapterPlanPage';
import WritePage from './pages/WritePage';
import IntegratePage from './pages/IntegratePage';
import SettingsPage from './pages/SettingsPage';
import ExportPage from './pages/ExportPage';

export const router = createHashRouter([
  // 全局 Layout 包裹的所有页面
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/create', element: <CreatePage /> },
      { path: '/categories', element: <CategoryConfigPage /> },
      { path: '/hook', element: <HookSelectPage /> },
      { path: '/plans', element: <PlanSelectPage /> },
      { path: '/plan', element: <DetailPlanPage /> },
      { path: '/chapters', element: <ChapterPlanPage /> },
      { path: '/write', element: <WritePage /> },
      { path: '/integrate', element: <IntegratePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/export', element: <ExportPage /> },
    ],
  },
  // 重定向入口（不需要 Layout 壳）
  { path: '/open', element: <ShortStoryRedirectPage /> },
]);
