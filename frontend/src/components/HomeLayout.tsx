import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import SettingsDialog from '@/components/SettingsDialog';
import ExportDialog from '@/components/ExportDialog';

export default function HomeLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto" role="main">
        <div className="px-8 py-6">
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

