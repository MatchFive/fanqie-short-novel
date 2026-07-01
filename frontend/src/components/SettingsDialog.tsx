import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import client from '@/api/client';
import { X } from 'lucide-react';

interface SettingsForm {
  apiUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  chapterWords: number;
  totalWords: number;
  writingStyle: string;
  narrativeView: string;
}

const DEFAULTS: SettingsForm = {
  apiUrl: '',
  apiKey: '',
  modelName: '',
  maxTokens: 4096,
  temperature: 0.7,
  chapterWords: 1000,
  totalWords: 15000,
  writingStyle: '流畅自然',
  narrativeView: '第三人称',
};

interface ServerConfigResponse {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
}

async function loadServerConfig(): Promise<Partial<SettingsForm>> {
  try {
    const data = await client.get<ServerConfigResponse>('/config');
    return {
      apiUrl: data.apiUrl || DEFAULTS.apiUrl,
      apiKey: '', // 服务端返回脱敏 key，不回填
      modelName: data.modelName || DEFAULTS.modelName,
      maxTokens: data.maxTokens ?? DEFAULTS.maxTokens,
      temperature: data.temperature ?? DEFAULTS.temperature,
    };
  } catch {
    return {};
  }
}

function loadSettings(): SettingsForm {
  try {
    const saved = localStorage.getItem('fanqie_settings');
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const showToast = useAppStore((s) => s.showToast);

  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');

  useEffect(() => {
    if (!open) return;

    // Dialog 不会随关闭卸载，每次打开时重新加载最新配置
    const saved = loadSettings();
    setForm(saved);
    setConnectionStatus('idle');

    loadServerConfig().then((cfg) => {
      if (Object.keys(cfg).length > 0) {
        setForm((prev) => ({ ...prev, ...cfg }));
      }
    }).catch(() => {
      showToast('无法读取服务端配置，请检查后端是否运行', 'warning');
    });
  }, [open, showToast]);

  const update = (patch: Partial<SettingsForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    // 1. 先存 localStorage
    localStorage.setItem('fanqie_settings', JSON.stringify(form));

    // 2. 同步到后端写入 .env（API Key 需要后端读取）
    const payload: Record<string, string | number> = {};
    if (form.apiUrl) payload.apiUrl = form.apiUrl;
    if (form.apiKey) payload.apiKey = form.apiKey;
    if (form.modelName) payload.modelName = form.modelName;
    if (form.maxTokens) payload.maxTokens = form.maxTokens;
    if (form.temperature !== undefined) payload.temperature = form.temperature;

    try {
      await client.post('/config', payload);
      showToast('设置已保存到 .env', 'success');
    } catch (err: any) {
      const detail = err?.apiError?.detail || '保存到服务端失败';
      showToast(detail, 'warning');
    }
    onClose();
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
    localStorage.removeItem('fanqie_settings');
    showToast('已恢复默认设置', 'info');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(`${form.apiUrl}/models`, {
        headers: { Authorization: `Bearer ${form.apiKey}` },
      });
      if (res.ok) {
        setConnectionStatus('connected');
        showToast('连接成功', 'success');
      } else {
        setConnectionStatus('failed');
        showToast('连接失败: ' + res.status, 'error');
      }
    } catch {
      setConnectionStatus('failed');
      showToast('无法连接到 API 服务器', 'error');
    }
  };

  const statusDisplay = {
    idle: null,
    testing: <span className="ml-3 text-[13px] text-[#D97706]">● 测试中...</span>,
    connected: <span className="ml-3 text-[13px] text-[#16A34A]">● 已连接</span>,
    failed: <span className="ml-3 text-[13px] text-[#DC2626]">● 连接失败</span>,
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
            <h2 className="text-base font-bold">设置</h2>
            <p className="text-[12px] text-muted-foreground">配置 LLM 接口、写作偏好和应用外观</p>
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
          {/* LLM 配置 */}
          <div className="border border-border p-5 bg-background mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">🤖 LLM API 配置</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">API 地址</label>
                <input
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full focus:border-foreground"
                  value={form.apiUrl}
                  onChange={(e) => update({ apiUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">API Key</label>
                <input
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full focus:border-foreground"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">模型名称</label>
                <input
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full focus:border-foreground"
                  value={form.modelName}
                  onChange={(e) => update({ modelName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">最大 Token</label>
                <input
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full focus:border-foreground"
                  type="number"
                  value={form.maxTokens}
                  onChange={(e) => update({ maxTokens: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">温度 (0-2)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={form.temperature}
                    onChange={(e) => update({ temperature: Number(e.target.value) })}
                    className="flex-1 accent-foreground"
                  />
                  <span className="text-[13px] font-semibold min-w-[40px] text-right">{form.temperature}</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1.5 text-[13px] border border-primary bg-primary text-primary-foreground rounded-sm cursor-pointer hover:opacity-85"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
              >
                {connectionStatus === 'testing' ? '测试中...' : '测试连接'}
              </button>
              {statusDisplay[connectionStatus]}
            </div>
          </div>

          {/* 写作偏好 */}
          <div className="border border-border p-5 bg-background mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">✍️ 写作偏好</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">默认每章字数</label>
                <select
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full bg-background cursor-pointer focus:border-foreground"
                  value={form.chapterWords}
                  onChange={(e) => update({ chapterWords: Number(e.target.value) })}
                >
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={1500}>1500</option>
                  <option value={2000}>2000</option>
                  <option value={3000}>3000</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">默认总字数目标</label>
                <select
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full bg-background cursor-pointer focus:border-foreground"
                  value={form.totalWords}
                  onChange={(e) => update({ totalWords: Number(e.target.value) })}
                >
                  <option value={10000}>10000</option>
                  <option value={15000}>15000</option>
                  <option value={20000}>20000</option>
                  <option value={30000}>30000</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">写作风格</label>
                <select
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full bg-background cursor-pointer focus:border-foreground"
                  value={form.writingStyle}
                  onChange={(e) => update({ writingStyle: e.target.value })}
                >
                  <option>流畅自然</option>
                  <option>网文风格</option>
                  <option>文学化表达</option>
                  <option>极简白描</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">默认叙事视角</label>
                <select
                  className="px-3 py-2 text-[13px] border border-border outline-none w-full bg-background cursor-pointer focus:border-foreground"
                  value={form.narrativeView}
                  onChange={(e) => update({ narrativeView: e.target.value })}
                >
                  <option>第三人称</option>
                  <option>第一人称</option>
                  <option>多视角</option>
                </select>
              </div>
            </div>
          </div>

          {/* 主题 */}
          <div className="border border-border p-5 bg-background mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">🎨 主题</h2>
            <div className="flex gap-3">
              <div
                className={`p-3 cursor-pointer transition-colors ${theme === 'light' ? 'border-2 border-foreground' : 'border border-border hover:border-foreground'}`}
                onClick={() => useAppStore.getState().setTheme('light')}
              >
                <div className="w-20 h-10 bg-white border border-border mb-1" />
                <div className="text-center text-xs font-semibold">浅色模式</div>
              </div>
              <div
                className={`p-3 cursor-pointer transition-colors ${theme === 'dark' ? 'border-2 border-foreground' : 'border border-border hover:border-foreground'}`}
                onClick={toggleTheme}
              >
                <div className="w-20 h-10 bg-[#1a1a1a] border border-[#333] mb-1" />
                <div className="text-center text-xs font-semibold">深色模式</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              当前: {theme === 'light' ? '浅色模式' : '深色模式'}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-between flex-shrink-0">
          <button
            className="px-4 py-2 text-[13px] border border-border rounded-sm cursor-pointer hover:bg-muted"
            onClick={handleReset}
          >
            恢复默认设置
          </button>
          <button
            className="px-4 py-2 text-[13px] border border-primary bg-primary text-primary-foreground rounded-sm cursor-pointer hover:opacity-85"
            onClick={handleSave}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
