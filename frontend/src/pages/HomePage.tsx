import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNovelsApi, type NovelListItem } from '@/api/shortStory';
import { Loader2 } from 'lucide-react';

interface NovelCard {
  id: string;
  title: string;
  status: 'done' | 'progress' | 'draft';
  category: string;
  words: string;
  date: string;
  tags: string[];
  progress: number;
  steps: number;
  navigateTo: string;
}

function mapNovelToCard(n: NovelListItem): NovelCard {
  const status = n.status === 'completed'
    ? 'done' as const
    : n.status === 'draft'
      ? 'draft' as const
      : 'progress' as const;

  return {
    id: n.id,
    title: n.title || '未命名作品',
    status,
    category: n.genre || '未分类',
    words: `${((n.target_word_count || 0) / 10000).toFixed(1)}万字`,
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

  useEffect(() => {
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

  const filtered = novels.filter((n) => {
    if (filter !== 'all' && n.status !== filter) return false;
    if (search && !n.title.includes(search)) return false;
    return true;
  });

  const stats = {
    total: novels.length,
    done: novels.filter((n) => n.status === 'done').length,
    progress: novels.filter((n) => n.status === 'progress').length,
    totalWords: novels.reduce((sum, n) => {
      const match = n.words.match(/[\d.]+/);
      return sum + (match ? parseFloat(match[0]) : 0);
    }, 0),
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
            {stats.totalWords.toFixed(1)}<span className="text-sm font-normal"> 万字</span>
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
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((novel) => {
            const status = STATUS_MAP[novel.status];
            const bgStyle =
              novel.status === 'done'
                ? { background: 'var(--foreground)', color: 'var(--primary-foreground)' }
                : novel.status === 'progress'
                  ? { background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }
                  : { background: 'var(--hover)', borderBottom: '1px solid var(--border)' };

            return (
              <div
                key={novel.id}
                className="border border-border bg-background cursor-pointer overflow-hidden"
                onClick={() => navigate(novel.navigateTo)}
              >
                {/* 顶图 */}
                <div
                  className="h-[100px] flex items-center justify-center relative"
                  style={bgStyle}
                >
                  <span className={`font-bold text-lg ${novel.status === 'done' ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {novel.title}
                  </span>
                </div>
                {/* 内容 */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm truncate flex-1 mr-2">{novel.title}</span>
                    <span className={`inline-flex px-2 py-0.5 text-[11px] border whitespace-nowrap ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {novel.category} ｜ {novel.words} ｜ {novel.date}
                  </div>
                  {novel.tags.length > 0 && (
                    <div className="mb-2 flex gap-1">
                      {novel.tags.map((tag) => (
                        <span key={tag} className="inline-flex px-2 py-0.5 text-[11px] border border-[#2563EB] text-[#2563EB]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="h-1 bg-secondary w-full mb-2">
                    <div className="h-full bg-foreground" style={{ width: `${novel.progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{novel.steps}/7 步骤</span>
                    <span>{novel.progress}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
