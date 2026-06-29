import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';

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
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.8,
  chapterWords: 1000,
  totalWords: 15000,
  writingStyle: '流畅自然',
  narrativeView: '第三人称',
};

function loadSettings(): SettingsForm {
  try {
    const saved = localStorage.getItem('fanqie_settings');
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export default function SettingsPage() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const showToast = useAppStore((s) => s.showToast);

  const [form, setForm] = useState<SettingsForm>(loadSettings);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');

  const update = (patch: Partial<SettingsForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    localStorage.setItem('fanqie_settings', JSON.stringify(form));
    showToast('设置已保存', 'success');
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
    localStorage.removeItem('fanqie_settings');
    showToast('已恢复默认设置', 'info');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      // 简单测试：尝试调用后端健康检查或 API ping
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

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">设置</h1>
      <p className="text-[13px] text-muted-foreground mb-6">配置 LLM 接口、写作偏好和应用外观</p>

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
            className="px-3 py-1.5 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85"
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

      <div className="flex justify-between mt-4">
        <button
          className="px-4 py-2 text-[13px] border border-border cursor-pointer hover:bg-hover"
          onClick={handleReset}
        >
          恢复默认设置
        </button>
        <button
          className="px-4 py-2 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85"
          onClick={handleSave}
        >
          保存设置
        </button>
      </div>
    </div>
  );
}
