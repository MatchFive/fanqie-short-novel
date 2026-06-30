import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { X } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const showToast = useAppStore((s) => s.showToast);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const handleRestoreBackup = () => {
    setConfirmDialog({
      open: true,
      title: '确认恢复备份',
      message: '恢复备份将覆盖当前所有数据（包括所有作品、配置和历史记录）。此操作不可撤销。是否继续？',
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        showToast('恢复功能将在后续版本中开放', 'info');
      },
    });
  };

  const handleHistoryRestore = (name: string) => {
    setConfirmDialog({
      open: true,
      title: '确认恢复',
      message: `从 ${name} 恢复将覆盖当前数据。是否继续？`,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        showToast('恢复功能将在后续版本中开放', 'info');
      },
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={onClose}>
      <div
        className="bg-background border border-border w-full max-w-[720px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold">数据导出与备份</h2>
            <p className="text-[12px] text-muted-foreground">导出作品为文件，或备份整个数据库</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {/* 导出选择 */}
          <div className="border border-border p-5 bg-background mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">📤 选择要导出的作品</h2>
            <div className="flex gap-2 items-center mb-4">
              <select className="px-3 py-2 text-[13px] border border-border outline-none bg-background cursor-pointer max-w-[300px] focus:border-foreground">
                <option>全部作品</option>
                <option>都市之最强赘婿</option>
                <option>异界炼丹师</option>
                <option>末日重生录</option>
              </select>
              <button className="px-4 py-2 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85">选择</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="border border-border p-4 bg-background cursor-pointer">
                <div className="text-2xl mb-2">📄</div>
                <div className="font-semibold text-sm mb-1">导出 TXT</div>
                <div className="text-xs text-muted-foreground mb-3">纯文本格式，适合阅读器导入</div>
                <button className="w-full px-3 py-1.5 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 flex items-center justify-center">导出 TXT</button>
              </div>
              <div className="border border-border p-4 bg-background cursor-pointer">
                <div className="text-2xl mb-2">📋</div>
                <div className="font-semibold text-sm mb-1">导出 JSON</div>
                <div className="text-xs text-muted-foreground mb-3">结构化数据，保留所有元信息</div>
                <button className="w-full px-3 py-1.5 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 flex items-center justify-center">导出 JSON</button>
              </div>
              <div className="border border-border p-4 bg-background">
                <div className="text-2xl mb-2">📚</div>
                <div className="font-semibold text-sm mb-1">导出 EPUB</div>
                <div className="text-xs text-muted-foreground mb-3">电子书格式，支持章节导航 · 预计 2026 Q3 上线</div>
                <button disabled className="w-full px-3 py-1.5 text-[13px] border border-border opacity-40 cursor-not-allowed flex items-center justify-center">暂未开放</button>
              </div>
            </div>
          </div>

          {/* 数据库备份 */}
          <div className="border border-border p-5 bg-background mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">🗄 数据库备份</h2>
            <p className="text-xs text-muted-foreground mb-3">
              备份整个数据库，包括所有作品、配置和历史记录。建议定期备份。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border p-4 bg-background cursor-pointer">
                <div className="font-semibold text-sm mb-1">📦 完整备份</div>
                <div className="text-xs text-muted-foreground mb-2">备份整个数据库（包含所有作品）</div>
                <div className="text-xs text-muted-foreground mb-3">上次备份: 2025/06/28 14:30</div>
                <button className="w-full px-3 py-1.5 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 flex items-center justify-center">创建备份</button>
              </div>
              <div className="border border-border p-4 bg-background">
                <div className="font-semibold text-sm mb-1">📥 恢复备份</div>
                <div className="text-xs text-muted-foreground mb-3">从备份文件恢复数据（将覆盖当前数据）</div>
                <button
                  className="w-full px-3 py-1.5 text-[13px] border border-[#DC2626] text-[#DC2626] cursor-pointer hover:bg-[#DC2626] hover:text-white flex items-center justify-center"
                  onClick={handleRestoreBackup}
                >选择备份文件</button>
              </div>
            </div>
          </div>

          {/* 备份历史 */}
          <div className="border border-border bg-background mb-4">
            <h2 className="font-semibold text-sm p-5 pb-3 flex items-center gap-1.5">📋 备份历史</h2>
            <div className="flex flex-col">
              {[
                { name: 'fanqie_backup_20250628_1430.db', date: '2025/06/28 14:30' },
                { name: 'fanqie_backup_20250625_0900.db', date: '2025/06/25 09:00' },
              ].map((b, i) => (
                <div key={i} className="border-b border-border last:border-b-0 px-5 py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-sm">{b.name}</span>
                    <span className="text-xs text-muted-foreground ml-3">{b.date}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-2.5 py-1 text-xs border border-border cursor-pointer hover:bg-hover"
                      onClick={() => handleHistoryRestore(b.name)}
                    >恢复</button>
                    <button className="px-2.5 py-1 text-xs border border-border cursor-pointer hover:bg-hover">删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-background border w-[380px]">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">{confirmDialog.title}</span>
              <button className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
                <span className="text-sm">✕</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 text-[13px] border border-border cursor-pointer hover:bg-hover"
                  onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                >取消</button>
                <button
                  className="px-3 py-1.5 text-[13px] border border-[#DC2626] text-[#DC2626] cursor-pointer hover:bg-[#DC2626] hover:text-white"
                  onClick={confirmDialog.onConfirm}
                >确认</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
