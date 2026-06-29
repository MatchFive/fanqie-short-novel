import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const HEADER_TABS = [
  { path: '/', label: '🏠 首页' },
  { path: '/create', label: '📝 创建' },
  { path: '/categories', label: '① 分类标签' },
  { path: '/hook', label: '② 核心爽点' },
  { path: '/plans', label: '③ 基础方案' },
  { path: '/plan', label: '④ 详细规划' },
  { path: '/chapters', label: '⑤ 章节拆分' },
  { path: '/write', label: '⑥ 逐章写作' },
  { path: '/integrate', label: '⑦ 全文整合' },
  { path: '/settings', label: '⚙ 设置' },
  { path: '/export', label: '📦 导出' },
];

const STEP_ITEMS = [
  { path: '/categories', label: '分类标签', step: 1 },
  { path: '/hook', label: '核心爽点', step: 2 },
  { path: '/plans', label: '基础方案', step: 3 },
  { path: '/plan', label: '详细规划', step: 4 },
  { path: '/chapters', label: '章节拆分', step: 5 },
  { path: '/write', label: '逐章写作', step: 6 },
  { path: '/integrate', label: '全文整合', step: 7 },
];

// 模拟作品列表
const MOCK_NOVELS = [
  { id: '1', name: '都市之最强赘婿', status: 'done' as const },
  { id: '2', name: '异界炼丹师', status: 'progress' as const },
  { id: '3', name: '末日重生录', status: 'draft' as const },
];

function getStepStatus(stepPath: string, currentPath: string, doneSteps: number) {
  const isActive = currentPath === stepPath;
  const stepIdx = STEP_ITEMS.findIndex(s => s.path === stepPath);
  const isDone = stepIdx >= 0 && stepIdx < doneSteps;
  return { isActive, isDone };
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId') || '';
  const [activeNovel, setActiveNovel] = useState('1');

  // 动态步骤进度 — 从 store 读取实际完成的步骤数
  const stepProgress = useShortStoryStore((s) => s.stepProgress);
  const doneSteps = stepProgress ? stepProgress.filter(Boolean).length : 0;

  // 当有 novelId 时自动加载进度
  const loadProgress = useShortStoryStore((s) => s.loadProgress);
  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  const isStepPage = STEP_ITEMS.some(s => location.pathname.startsWith(s.path));
  const currentStepItem = STEP_ITEMS.find(s => location.pathname.startsWith(s.path));

  // 跳转时携带 novelId
  const navWithNovel = (path: string) => {
    if (novelId) {
      navigate(`${path}?novelId=${novelId}`);
    } else {
      navigate(path);
    }
  };

  // 面包屑导航
  const breadcrumb = currentStepItem
    ? [
        { label: '首页', path: '/' },
        { label: '创建', path: '/create' },
        { label: `Step ${currentStepItem.step}: ${currentStepItem.label}`, path: currentStepItem.path },
      ]
    : [];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-10 flex items-center border-b border-border bg-secondary px-4 gap-1 flex-shrink-0 overflow-x-auto" role="navigation" aria-label="主导航">
        <span className="font-bold text-[13px] mr-4 whitespace-nowrap">🍅 番茄小说</span>
        {HEADER_TABS.map(tab => (
          <button
            key={tab.path}
            onClick={() => navWithNovel(tab.path)}
            aria-current={location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path)) ? 'page' : undefined}
            className={`px-3 py-1.5 text-xs border-b-2 whitespace-nowrap transition-colors ${
              location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path))
                ? 'text-foreground border-foreground font-semibold'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] border-r border-border bg-secondary flex flex-col flex-shrink-0" role="navigation" aria-label="侧边栏导航">
          {/* 作品列表 */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">作品列表</div>
            {MOCK_NOVELS.map(novel => (
              <div
                key={novel.id}
                onClick={() => setActiveNovel(novel.id)}
                role="button"
                tabIndex={0}
                aria-label={`${novel.name} - ${novel.status === 'done' ? '已完成' : novel.status === 'progress' ? '创作中' : '草稿'}`}
                onKeyDown={(e) => { if (e.key === 'Enter') setActiveNovel(novel.id); }}
                className={`min-h-[44px] px-2 py-1.5 text-[13px] cursor-pointer flex items-center gap-1.5 ${
                  activeNovel === novel.id ? 'bg-foreground text-primary-foreground' : 'hover:bg-hover'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 inline-block flex-shrink-0 rounded-full"
                  aria-hidden="true"
                  style={{
                    background:
                      novel.status === 'done'
                        ? '#16A34A'
                        : novel.status === 'progress'
                          ? '#D97706'
                          : 'var(--border)',
                  }}
                />
                {novel.name}
              </div>
            ))}
            <div
              className="min-h-[44px] px-2 py-1.5 text-[13px] cursor-pointer text-muted-foreground hover:text-foreground flex items-center"
              onClick={() => navWithNovel('/create')}
              role="button"
              tabIndex={0}
              aria-label="新建作品"
              onKeyDown={(e) => { if (e.key === 'Enter') navWithNovel('/create'); }}
            >
              + 新建作品
            </div>
          </div>

          {/* 创作步骤 */}
          <div className="p-3 border-b border-border flex-1 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">创作步骤</div>
            {STEP_ITEMS.map(item => {
              const { isActive, isDone } = getStepStatus(item.path, location.pathname, doneSteps);
              return (
                <div
                  key={item.path}
                  onClick={() => navWithNovel(item.path)}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`步骤${item.step}: ${item.label}${isDone ? ' - 已完成' : ''}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') navWithNovel(item.path); }}
                  className={`min-h-[44px] px-2 py-1.5 text-[13px] cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-foreground text-primary-foreground'
                      : isDone
                        ? 'text-foreground hover:bg-hover'
                        : 'text-muted-foreground hover:bg-hover'
                  }`}
                >
                  <span
                    className={`w-5 h-5 border text-[10px] flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'border-primary-foreground' : isDone ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border'
                    }`}
                    aria-hidden="true"
                  >
                    {isDone ? '✓' : item.step}
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>

          {/* 底部 */}
          <div className="p-3 border-t border-border">
            <div
              onClick={() => navWithNovel('/settings')}
              role="button"
              tabIndex={0}
              aria-label="设置"
              onKeyDown={(e) => { if (e.key === 'Enter') navWithNovel('/settings'); }}
              className={`min-h-[44px] px-2 py-1.5 text-[13px] cursor-pointer flex items-center ${
                location.pathname === '/settings' ? 'bg-foreground text-primary-foreground' : 'hover:bg-hover'
              }`}
            >
              ⚙ 设置
            </div>
            <div
              onClick={() => navWithNovel('/export')}
              role="button"
              tabIndex={0}
              aria-label="导出数据"
              onKeyDown={(e) => { if (e.key === 'Enter') navWithNovel('/export'); }}
              className={`min-h-[44px] px-2 py-1.5 text-[13px] cursor-pointer flex items-center ${
                location.pathname === '/export' ? 'bg-foreground text-primary-foreground' : 'hover:bg-hover'
              }`}
            >
              📦 导出数据
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" role="main">
          {/* 面包屑导航 */}
          {breadcrumb.length > 0 && (
            <nav className="px-6 pt-4 pb-0 flex items-center gap-1 text-[11px] text-muted-foreground" aria-label="面包屑导航">
              {breadcrumb.map((bc, i) => (
                <span key={bc.path} className="flex items-center gap-1">
                  {i > 0 && <span className="opacity-40" aria-hidden="true">›</span>}
                  <button
                    onClick={() => navWithNovel(bc.path)}
                    className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}`}
                  >
                    {bc.label}
                  </button>
                </span>
              ))}
            </nav>
          )}
          <div className="p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
