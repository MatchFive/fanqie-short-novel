import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  analyzeTrendingApi,
  analyzeCustomEventApi,
  confirmTrendingApi,
  markHotspotUsedApi,
  getStoredHotspotsApi,
  type TrendingAnalysis,
  type CreativeSuggestion,
  type HotspotEventResponse,
} from '@/api/trending';
import { Loader2, RefreshCw, Flame, PenLine, ArrowLeft, Sparkles, Clock, Hash, ChevronLeft, ChevronRight } from 'lucide-react';

type Phase = 'loading' | 'analysis' | 'empty' | 'error' | 'confirming';

export default function TrendingPage() {
  const navigate = useNavigate();

  // 模式: hotspot | custom | history
  const [mode, setMode] = useState<'hotspot' | 'custom' | 'history'>('hotspot');
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // 分析结果
  const [analyses, setAnalyses] = useState<TrendingAnalysis[]>([]);

  // 展开/选中状态
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // 目标字数
  const [targetLength, setTargetLength] = useState(8000);

  // 自定义事件输入
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customError, setCustomError] = useState('');

  // 历史热搜
  const [historyItems, setHistoryItems] = useState<HotspotEventResponse[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(20);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);
  const [historySortBy, setHistorySortBy] = useState<'fetched_at' | 'usage_count'>('fetched_at');
  const [historySource, setHistorySource] = useState('');

  const loadHistory = useCallback(async (page?: number, sortBy?: string, source?: string) => {
    setHistoryLoading(true);
    try {
      const result = await getStoredHotspotsApi({
        page: page ?? historyPage,
        page_size: historyPageSize,
        sort_by: sortBy ?? historySortBy,
        source: source ?? (historySource || undefined),
      });
      setHistoryItems(result.data);
      setHistoryTotal(result.total);
      setHistoryPage(page ?? historyPage);
    } catch {
      // 静默处理
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyPageSize, historySortBy, historySource]);

  // 切换到历史Tab时自动加载
  useEffect(() => {
    if (mode === 'history') {
      loadHistory(1, historySortBy, historySource);
    }
  }, [mode]);

  function handleHistoryPageChange(newPage: number) {
    const totalPages = Math.ceil(historyTotal / historyPageSize);
    if (newPage < 1 || newPage > totalPages) return;
    setHistoryPage(newPage);
    loadHistory(newPage, historySortBy, historySource);
  }

  function handleHistorySortChange(sortBy: 'fetched_at' | 'usage_count') {
    setHistorySortBy(sortBy);
    setHistoryPage(1);
    loadHistory(1, sortBy, historySource);
  }

  function handleHistorySourceChange(source: string) {
    setHistorySource(source);
    setHistoryPage(1);
    loadHistory(1, historySortBy, source);
  }

  // 历史记录中确认创作
  async function handleHistoryConfirm(event: HotspotEventResponse, suggestion: CreativeSuggestion) {
    if (!event.ai_suggestions) return;
    setPhase('confirming');
    try {
      const result = await confirmTrendingApi({
        event: { title: event.title, summary: event.summary || '', source: event.source, url: event.source_url || '', rank: event.rank },
        suggestion,
        target_length: targetLength,
      });
      markHotspotUsedApi(event.id).catch(() => {});
      if (result.data?.novel_id) {
        navigate(`/categories?novelId=${result.data.novel_id}`);
      }
    } catch (e: any) {
      setErrorMsg(e?.apiError?.message || e?.message || '创建失败，请稍后重试');
      setPhase('error');
    }
  }

  // ============ 自动模式：页面加载时抓取热搜 ============

  useEffect(() => {
    if (mode === 'hotspot') {
      loadTrendingAnalysis();
    } else {
      setPhase('analysis');
    }
  }, [mode]);

  async function loadTrendingAnalysis(forceRefresh = false) {
    setPhase('loading');
    setErrorMsg('');
    setExpandedIdx(null);
    try {
      const result = await analyzeTrendingApi(undefined, forceRefresh);
      if (!result.data || result.data.length === 0) {
        setPhase('empty');
        setAnalyses([]);
      } else {
        setAnalyses(result.data);
        setPhase('analysis');
      }
    } catch (e: any) {
      setErrorMsg(e?.apiError?.message || e?.message || '热搜抓取失败，请检查网络或稍后重试');
      setPhase('error');
    }
  }

  function handleRefresh() {
    loadTrendingAnalysis(true);
  }

  // ============ 手动模式：用户填写表单 → 分析 ============

  function validateCustomInput(): boolean {
    if (!customTitle.trim()) {
      setCustomError('请输入事件标题');
      return false;
    }
    if (customTitle.trim().length > 30) {
      setCustomError('标题不能超过 30 字');
      return false;
    }
    if (!customDescription.trim()) {
      setCustomError('请输入事件描述');
      return false;
    }
    if (customDescription.trim().length < 10) {
      setCustomError('描述至少需要 10 个字');
      return false;
    }
    if (customDescription.trim().length > 500) {
      setCustomError('描述不能超过 500 字');
      return false;
    }
    setCustomError('');
    return true;
  }

  async function handleCustomAnalyze() {
    if (!validateCustomInput()) return;
    setPhase('loading');
    setErrorMsg('');
    try {
      const result = await analyzeCustomEventApi({
        title: customTitle.trim(),
        description: customDescription.trim(),
      });
      if (!result.data || result.data.length === 0) {
        setPhase('empty');
        setAnalyses([]);
      } else {
        setAnalyses(result.data);
        setPhase('analysis');
      }
    } catch (e: any) {
      setErrorMsg(e?.apiError?.message || e?.message || '分析失败，请检查描述内容或稍后重试');
      setPhase('error');
    }
  }

  // ============ 确认创作方向 ============

  async function handleConfirm(eventIdx: number, suggestion: CreativeSuggestion) {
    const analysis = analyses[eventIdx];
    if (!analysis) return;

    setPhase('confirming');
    try {
      const result = await confirmTrendingApi({
        event: analysis.event,
        suggestion,
        target_length: targetLength,
      });

      // 标记事件被使用
      markHotspotUsedApi(analysis.event.title).catch(() => {});

      if (result.data?.novel_id) {
        // 跳转到分类配置页
        navigate(`/categories?novelId=${result.data.novel_id}`);
      }
    } catch (e: any) {
      setErrorMsg(e?.apiError?.message || e?.message || '创建失败，请稍后重试');
      setPhase('error');
    }
  }

  // ============ 情绪颜色映射 ============

  const emotionColors: Record<string, string> = {
    '爽': 'bg-amber-100 text-amber-700',
    '虐': 'bg-rose-100 text-rose-700',
    '甜': 'bg-pink-100 text-pink-700',
    '逆袭': 'bg-emerald-100 text-emerald-700',
    '反转': 'bg-purple-100 text-purple-700',
    '共鸣': 'bg-blue-100 text-blue-700',
  };

  function emotionClass(emotion: string): string {
    return emotionColors[emotion] || 'bg-slate-100 text-slate-600';
  }

  // ============ 渲染 ============

  return (
    <div>
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 border border-border hover:bg-hover transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold">🔥 紧跟时事创作</h1>
      </div>

      {/* 模式切换 Tab */}
      <div className="flex gap-1 mb-6 border border-border p-1 w-fit">
        <button
          onClick={() => setMode('hotspot')}
          className={`px-4 py-1.5 text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'hotspot'
              ? 'bg-foreground text-primary-foreground'
              : 'hover:bg-hover'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          热点推荐
        </button>
        <button
          onClick={() => setMode('history')}
          className={`px-4 py-1.5 text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'history'
              ? 'bg-foreground text-primary-foreground'
              : 'hover:bg-hover'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          历史热搜
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-4 py-1.5 text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'custom'
              ? 'bg-foreground text-primary-foreground'
              : 'hover:bg-hover'
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          自由输入
        </button>
      </div>

      {/* 目标字数设置 (hotspot / custom 模式) */}
      {mode !== 'history' && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-muted-foreground">目标字数:</span>
          <div className="flex gap-1">
            {[5000, 8000, 12000, 20000].map((len) => (
              <button
                key={len}
                onClick={() => setTargetLength(len)}
                className={`px-2.5 py-0.5 text-xs border cursor-pointer transition-colors ${
                  targetLength === len
                    ? 'border-foreground bg-foreground text-primary-foreground'
                    : 'border-border hover:bg-hover'
                }`}
              >
                {len >= 10000 ? `${len / 10000}万` : len.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === 模式1: 热点推荐 === */}
      {mode === 'hotspot' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground">
              AI 自动抓取最新热搜并生成创作建议
            </p>
            <button
              onClick={handleRefresh}
              disabled={phase === 'loading' || phase === 'confirming'}
              className="flex items-center gap-1 px-3 py-1 text-xs border border-border hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${phase === 'loading' ? 'animate-spin' : ''}`} />
              刷新热搜
            </button>
          </div>

          {/* 加载态 */}
          {phase === 'loading' && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">正在抓取热搜 & AI 分析中...</span>
            </div>
          )}

          {/* 空态 */}
          {phase === 'empty' && (
            <div className="border border-border p-12 text-center">
              <div className="text-4xl mb-3 opacity-30">😕</div>
              <p className="text-sm text-muted-foreground mb-1">暂无热搜数据</p>
              <p className="text-xs text-muted-foreground mb-4">未能获取到热搜内容，请稍后重试或切换到自由输入模式</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-xs border border-foreground hover:bg-hover cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                重试
              </button>
            </div>
          )}

          {/* 错误态 */}
          {phase === 'error' && (
            <div className="border border-[#DC2626] p-6 text-center">
              <p className="text-sm text-[#DC2626] mb-2">⚠️ {errorMsg}</p>
              <p className="text-xs text-muted-foreground mb-4">请稍后重试，或切换到自由输入模式输入你身边的故事</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 text-xs border border-foreground hover:bg-hover cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  重试
                </button>
                <button
                  onClick={() => {
                    setMode('custom');
                    setPhase('analysis');
                  }}
                  className="px-4 py-2 text-xs border border-foreground bg-foreground text-primary-foreground cursor-pointer"
                >
                  切换自由输入
                </button>
              </div>
            </div>
          )}

          {/* 确认中 */}
          {phase === 'confirming' && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">正在创建作品...</span>
            </div>
          )}

          {/* 分析结果 */}
          {phase === 'analysis' && analyses.length > 0 && (
            <div className="space-y-3">
              {analyses.map((analysis, eventIdx) => (
                <div
                  key={`${analysis.event.source}-${analysis.event.rank}`}
                  className="border border-border bg-background overflow-hidden"
                >
                  {/* 事件标题行 */}
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-hover/30 transition-colors"
                    onClick={() => setExpandedIdx(expandedIdx === eventIdx ? null : eventIdx)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground w-8 flex-shrink-0">
                        #{analysis.event.rank || '-'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 border border-border bg-secondary text-muted-foreground">
                            {analysis.event.source === 'weibo' ? '微博' :
                             analysis.event.source === 'baidu' ? '百度' :
                             analysis.event.source === 'zhihu' ? '知乎' : '用户'}
                          </span>
                          <span className="font-semibold text-sm truncate">{analysis.event.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {analysis.event.summary}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 flex-shrink-0">
                      {expandedIdx === eventIdx ? '收起 ▲' : `展开 ${analysis.suggestions.length} 个创作建议 ▼`}
                    </span>
                  </div>

                  {/* 展开的建议列表 */}
                  {expandedIdx === eventIdx && (
                    <div className="border-t border-border px-4 pb-4 pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">{analysis.analysis_summary}</p>
                      {analysis.suggestions.map((suggestion) => (
                        <div
                          key={suggestion.suggestion_id}
                          className="border border-border p-3 hover:bg-hover/20 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700">
                                  {suggestion.genre}
                                </span>
                                <span className={`text-[11px] px-1.5 py-0.5 ${emotionClass(suggestion.emotional_target)}`}>
                                  {suggestion.emotional_target}
                                </span>
                                <Sparkles className="w-3 h-3 text-amber-500" />
                              </div>
                              <p className="font-semibold text-sm mb-1">{suggestion.hook_title}</p>
                              <p className="text-xs text-muted-foreground mb-1">{suggestion.hook_description}</p>
                              <p className="text-xs text-muted-foreground">{suggestion.plot_direction}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirm(eventIdx, suggestion);
                              }}
                              disabled={phase === 'confirming'}
                              className="flex-shrink-0 px-3 py-1.5 text-xs border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 whitespace-nowrap"
                            >
                              选这个创作
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 模式2: 历史热搜 === */}
      {mode === 'history' && (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            浏览已入库的热搜事件及 AI 创作建议，按时间或使用次数排序
          </p>

          {/* 筛选 + 排序工具栏 */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {/* 来源筛选 */}
            <div className="flex gap-1">
              {[
                { value: '', label: '全部' },
                { value: 'weibo', label: '微博' },
                { value: 'baidu', label: '百度' },
                { value: 'zhihu', label: '知乎' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleHistorySourceChange(s.value)}
                  className={`px-2.5 py-0.5 text-xs border cursor-pointer transition-colors ${
                    historySource === s.value
                      ? 'border-foreground bg-foreground text-primary-foreground'
                      : 'border-border hover:bg-hover'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* 排序切换 */}
            <div className="flex gap-1">
              <button
                onClick={() => handleHistorySortChange('fetched_at')}
                className={`px-2.5 py-0.5 text-xs border cursor-pointer transition-colors ${
                  historySortBy === 'fetched_at'
                    ? 'border-foreground bg-foreground text-primary-foreground'
                    : 'border-border hover:bg-hover'
                }`}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                最新
              </button>
              <button
                onClick={() => handleHistorySortChange('usage_count')}
                className={`px-2.5 py-0.5 text-xs border cursor-pointer transition-colors ${
                  historySortBy === 'usage_count'
                    ? 'border-foreground bg-foreground text-primary-foreground'
                    : 'border-border hover:bg-hover'
                }`}
              >
                <Hash className="w-3 h-3 inline mr-1" />
                最热
              </button>
            </div>
          </div>

          {/* 加载态 */}
          {historyLoading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}

          {/* 空态 */}
          {!historyLoading && historyItems.length === 0 && (
            <div className="border border-border p-12 text-center">
              <div className="text-4xl mb-3 opacity-30">📭</div>
              <p className="text-sm text-muted-foreground">暂无历史热搜记录</p>
              <p className="text-xs text-muted-foreground mt-1">先去「热点推荐」抓取最新热搜</p>
            </div>
          )}

          {/* 列表 */}
          {!historyLoading && historyItems.length > 0 && (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-border bg-background overflow-hidden"
                >
                  {/* 事件标题行 */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-hover/30 transition-colors"
                    onClick={() => setHistoryExpandedId(historyExpandedId === item.id ? null : item.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground w-8 flex-shrink-0">
                        #{item.rank || '-'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 border border-border bg-secondary text-muted-foreground">
                            {item.source === 'weibo' ? '微博' :
                             item.source === 'baidu' ? '百度' :
                             item.source === 'zhihu' ? '知乎' : '用户'}
                          </span>
                          <span className="font-semibold text-sm truncate">{item.title}</span>
                          {item.usage_count > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-amber-100 text-amber-700 flex-shrink-0">
                              已用 {item.usage_count} 次
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground truncate max-w-md">
                            {item.summary}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                            {new Date(item.fetched_at).toLocaleString('zh-CN', {
                              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {item.tags.slice(0, 5).map((t, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground border border-border">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 flex-shrink-0">
                      {historyExpandedId === item.id
                        ? '收起 ▲'
                        : item.ai_suggestions
                          ? `展开 ${item.ai_suggestions.length} 个创作建议 ▼`
                          : '暂无建议'}
                    </span>
                  </div>

                  {/* 展开的建议列表 */}
                  {historyExpandedId === item.id && item.ai_suggestions && (
                    <div className="border-t border-border px-4 pb-4 pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">{item.analysis_summary || ''}</p>
                      {item.ai_suggestions.map((suggestion) => (
                        <div
                          key={suggestion.suggestion_id}
                          className="border border-border p-3 hover:bg-hover/20 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700">
                                  {suggestion.genre}
                                </span>
                                <span className={`text-[11px] px-1.5 py-0.5 ${emotionClass(suggestion.emotional_target)}`}>
                                  {suggestion.emotional_target}
                                </span>
                                <Sparkles className="w-3 h-3 text-amber-500" />
                              </div>
                              <p className="font-semibold text-sm mb-1">{suggestion.hook_title}</p>
                              <p className="text-xs text-muted-foreground mb-1">{suggestion.hook_description}</p>
                              <p className="text-xs text-muted-foreground">{suggestion.plot_direction}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHistoryConfirm(item, suggestion);
                              }}
                              disabled={phase === 'confirming'}
                              className="flex-shrink-0 px-3 py-1.5 text-xs border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 whitespace-nowrap"
                            >
                              选这个创作
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 分页 */}
              {historyTotal > historyPageSize && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    共 {historyTotal} 条，第 {historyPage}/{Math.ceil(historyTotal / historyPageSize)} 页
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleHistoryPageChange(historyPage - 1)}
                      disabled={historyPage <= 1}
                      className="p-1.5 border border-border hover:bg-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleHistoryPageChange(historyPage + 1)}
                      disabled={historyPage >= Math.ceil(historyTotal / historyPageSize)}
                      className="p-1.5 border border-border hover:bg-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === 模式3: 自由输入 === */}
      {mode === 'custom' && (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            描述你身边发生的事件、听说过的故事，或者热搜上没有但你觉得有趣的事情
          </p>

          <div className="border border-border p-4 bg-background">
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5">事件标题 <span className="text-[#DC2626]">*</span></label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="给事件起个标题，例如：邻居深夜总传来奇怪的敲墙声..."
                maxLength={30}
                className="w-full px-3 py-2 text-sm border border-border outline-none focus:border-foreground"
                disabled={phase === 'loading' || phase === 'confirming'}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">{customTitle.length}/30</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5">事件描述 <span className="text-[#DC2626]">*</span></label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder={`详细描述一下这个事件...

例如：
"我家住在一个老小区，每天晚上11点开始，隔壁就会传来有规律的敲墙声，三短一长。刚开始以为邻居在装修，但持续了两个月。后来物业告诉我们，隔壁根本没人住已经半年了。最后发现是..."`}
                rows={6}
                maxLength={500}
                className="w-full px-3 py-2 text-sm border border-border outline-none focus:border-foreground resize-none"
                disabled={phase === 'loading' || phase === 'confirming'}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">{customDescription.length}/500</p>
            </div>

            {customError && (
              <p className="text-xs text-[#DC2626] mb-3">{customError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleCustomAnalyze}
                disabled={phase === 'loading' || phase === 'confirming'}
                className="px-5 py-2 text-sm border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
              >
                {phase === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    开始分析
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 自定义事件分析结果 */}
          {phase === 'error' && mode === 'custom' && errorMsg && (
            <div className="border border-[#DC2626] p-4 mt-4 text-center">
              <p className="text-sm text-[#DC2626] mb-1">⚠️ {errorMsg}</p>
            </div>
          )}

          {phase === 'empty' && mode === 'custom' && (
            <div className="border border-border p-12 text-center mt-4">
              <div className="text-4xl mb-3 opacity-30">😕</div>
              <p className="text-sm text-muted-foreground mb-1">未能生成创作建议</p>
              <p className="text-xs text-muted-foreground">请尝试修改事件描述后重新分析</p>
            </div>
          )}

          {phase === 'analysis' && mode === 'custom' && analyses.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold">📋 分析结果</h3>
              {analyses.map((analysis, eventIdx) => (
                <div key={eventIdx} className="border border-border p-4 bg-background">
                  <p className="text-sm font-semibold mb-2">{analysis.event.title}</p>
                  <p className="text-xs text-muted-foreground mb-3">{analysis.analysis_summary}</p>
                  <div className="space-y-2">
                    {analysis.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.suggestion_id}
                        className="border border-border p-3 hover:bg-hover/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700">
                                {suggestion.genre}
                              </span>
                              <span className={`text-[11px] px-1.5 py-0.5 ${emotionClass(suggestion.emotional_target)}`}>
                                {suggestion.emotional_target}
                              </span>
                            </div>
                            <p className="font-semibold text-sm mb-1">{suggestion.hook_title}</p>
                            <p className="text-xs text-muted-foreground mb-1">{suggestion.hook_description}</p>
                            <p className="text-xs text-muted-foreground">{suggestion.plot_direction}</p>
                          </div>
                          <button
                            onClick={() => handleConfirm(eventIdx, suggestion)}
                            disabled={phase === 'confirming'}
                            className="flex-shrink-0 px-3 py-1.5 text-xs border border-foreground bg-foreground text-primary-foreground cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 whitespace-nowrap"
                          >
                            选这个创作
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 提示信息 */}
          <div className="border border-border p-4 mt-4 bg-secondary/30">
            <p className="text-xs font-semibold mb-1.5">💡 自由输入适用于:</p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              <li>· 身边发生的奇葩事、都市传说</li>
              <li>· 热搜上没有但你觉得有意思的事情</li>
              <li>· 朋友/同事/亲戚的狗血故事</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
