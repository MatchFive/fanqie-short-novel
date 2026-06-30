import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNovelsApi, deleteNovelApi, type NovelListItem } from '@/api/shortStory';
import { Loader2, Trash2 } from 'lucide-react';

interface NovelCard {
  id: string;
  title: string;
  status: 'done' | 'progress' | 'draft';
  category: string;
  words: string;        // 显示用（已格式化）
  rawWords: number;     // 统计聚合用
  date: string;
  tags: string[];
  progress: number;
  steps: number;
  navigateTo: string;
}

/** 格式化字数显示 */
function formatWords(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
  if (count > 0) return `${count.toLocaleString()}字`;
  return '0 字';
}

function mapNovelToCard(n: NovelListItem): NovelCard {
  const status = n.status === 'completed'
    ? 'done' as const
    : n.status === 'draft'
      ? 'draft' as const
      : 'progress' as const;

  // 优先使用实际已写字数，无章节时回退到目标字数
  const actualWc = (n.word_count ?? 0) > 0 ? n.word_count! : (n.target_word_count || 0);

  return {
    id: n.id,
    title: n.title || '未命名作品',
    status,
    category: n.genre || '未分类',
    words: formatWords(actualWc),
    rawWords: actualWc,
    date: new Date(n.updated_at).toLocaleDateString('zh-CN'),
    tags: [],
    progress: status === 'done' ? 100 : status === 'draft' ? 0 : 50,
    steps: status === 'done' ? 7 : status === 'draft' ? 0 : 3,
    navigateTo: status === 'done'
      ? `/integrate?novelId=${n.id}`
      : `/create?novelId=${n.id}`,
  };
}

const STATUS_MAP = {
  done: { label: '已完成', className: 'text-[#16A34A] border-[#16A34A]' },
  progress: { label: '创作中', className: 'text-[#D97706] border-[#D97706]' },
  draft: { label: '草稿', className: 'text-muted-foreground border-muted-foreground' },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [novels, setNovels] = useState<NovelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'progress' | 'done' | 'draft'>('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadNovels = useCallback(() => {
    let cancelled = false;
    listNovelsApi()
      .then((res) => {
        if (cancelled) return;
        const cards = (res || []).map(mapNovelToCard);
        setNovels(cards);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || '加载失败');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { loadNovels(); }, [loadNovels]);

  /** 删除小说 */
  const handleDelete = async (e: React.MouseEvent, novel: NovelCard) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除「${novel.title}」吗？此操作不可撤销。`)) return;
    setDeletingId(novel.id);
    try {
      await deleteNovelApi(novel.id);
      setNovels((prev) => prev.filter((n) => n.id !== novel.id));
    } catch (err) {
      alert(`删除失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = novels.filter((n) => {
    if (filter !== 'all' && n.status !== filter) return false;
    if (search && !n.title.includes(search)) return false;
    return true;
  });

  const stats = {
    total: novels.length,
    done: novels.filter((n) => n.status === 'done').length,
    progress: novels.filter((n) => n.status === 'progress').length,
    totalWords: novels.reduce((sum, n) => sum + (n.rawWords || 0), 0),
  };

  return (
    <div>
      {/* 标题区 */}
      <div className="mb-7">
        <h1 className="text-xl font-bold mb-1">下午好 👋</h1>
        <p className="text-[13px] text-muted-foreground">番茄小说创作工作台</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        <div className="border border-border p-4 bg-background">
          <div className="text-[28px] font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">全部作品</div>
        </div>
        <div className="border border-border p-4 bg-background">
          <div className="text-[28px] font-bold">{stats.done}</div>
          <div className="text-xs text-muted-foreground mt-0.5">已完成</div>
        </div>
        <div className="border border-border p-4 bg-background">
          <div className="text-[28px] font-bold">{stats.progress}</div>
          <div className="text-xs text-muted-foreground mt-0.5">创作中</div>
        </div>
        <div className="border border-border p-4 bg-background">
          <div className="text-[28px] font-bold">
            {formatWords(stats.totalWords)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">累计字数</div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'progress', 'done', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs border cursor-pointer transition-colors ${
                filter === f
                  ? 'border-foreground bg-foreground text-primary-foreground'
                  : 'border-border hover:bg-hover'
              }`}
            >
              {f === 'all' ? '全部' : f === 'progress' ? '创作中' : f === 'done' ? '已完成' : '草稿'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            className="px-3 py-1.5 text-[13px] border border-border outline-none w-[200px] focus:border-foreground"
            placeholder="搜索作品..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => navigate('/create')}
            className="px-4 py-1.5 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85"
          >
            + 新建作品
          </button>
        </div>
      </div>

      {/* 加载态 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">加载作品列表...</span>
        </div>
      )}

      {/* 错误态 */}
      {error && !loading && (
        <div className="border border-[#DC2626] p-6 text-center">
          <p className="text-sm text-[#DC2626] mb-2">加载失败</p>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <button
            className="px-3 py-1.5 text-xs border border-foreground"
            onClick={() => window.location.reload()}
          >
            重试
          </button>
        </div>
      )}

      {/* 空态 */}
      {!loading && !error && filtered.length === 0 && (
        <div className="border border-border p-12 text-center">
          <div className="text-3xl mb-3 opacity-30">📝</div>
          <p className="text-sm text-muted-foreground mb-1">
            {novels.length === 0 ? '还没有作品，开始你的第一篇短篇小说吧' : '没有匹配的作品'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            使用 AI 辅助创作，从分类标签到全文整合一气呵成
          </p>
          <button
            onClick={() => navigate('/create')}
            className="px-4 py-2 text-[13px] border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85"
          >
            + 新建作品
          </button>
        </div>
      )}

      {/* 作品卡片列表 */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((novel) => {
            const status = STATUS_MAP[novel.status];

            return (
              <div
                key={novel.id}
                onClick={() => navigate(novel.navigateTo)}
                className="group relative border border-border bg-background cursor-pointer overflow-hidden rounded-sm transition-shadow hover:shadow-md"
              >
                {/* 卡片主体 */}
                <div className="p-4">
                  {/* 标题行：名称 + 状态 + 删除按钮 */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold text-[15px] truncate flex-1 mr-3 leading-tight" title={novel.title}>
                      {novel.title}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] border whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, novel)}
                        disabled={deletingId === novel.id}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-[#DC2626] transition-all disabled:opacity-50"
                        title="删除作品"
                        aria-label={`删除 ${novel.title}`}
                      >
                        <Trash2 className="w-[14px] h-[14px]" />
                      </button>
                    </div>
                  </div>

                  {/* 元信息行 */}
                  <div className="text-xs text-muted-foreground space-y-2 mb-3">
                    <div>{novel.category} · {novel.words}</div>
                    <div>更新于 {novel.date}</div>
                  </div>

                  {/* 进度条区域 */}
                  <div>
                    <div className="h-1.5 bg-secondary w-full rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          novel.status === 'done' ? 'bg-[#16A34A]' : novel.status === 'progress' ? 'bg-[#D97706]' : 'bg-border'
                        }`}
                        style={{ width: `${novel.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>进度 {novel.steps}/7 步</span>
                      <span className={novel.status === 'done' ? 'text-[#16A34A]' : ''}>{novel.progress}%</span>
                    </div>
                  </div>
                </div>

                {/* 左侧状态色条 */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  novel.status === 'done' ? 'bg-[#16A34A]' : novel.status === 'progress' ? 'bg-[#D97706]' : 'bg-border'
                }`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
