import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Settings, Package } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import SettingsDialog from '@/components/SettingsDialog';
import ExportDialog from '@/components/ExportDialog';

export default function HomeLayout() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="h-10 flex items-center border-b border-border bg-secondary px-4 gap-3 flex-shrink-0" role="banner">
        <button
          onClick={() => navigate('/')}
          className="font-bold text-[13px] whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="回到首页"
        >
          🍅 番茄小说
        </button>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="设置"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="导出数据"
            title="导出数据"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" role="main">
        <div className="p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
