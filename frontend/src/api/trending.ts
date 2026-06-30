/**
 * Trending API — 热点事件分析与创作建议
 */
import client from './client';

// ============== 类型定义 ==============

export interface HotspotItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  rank: number;
}

export interface CustomEvent {
  title: string;
  description: string;
}

export interface CreativeSuggestion {
  suggestion_id: number;
  genre: string;
  hook_description: string;
  hook_title: string;
  plot_direction: string;
  emotional_target: string;
}

export interface TrendingAnalysis {
  event: HotspotItem;
  suggestions: CreativeSuggestion[];
  analysis_summary: string;
}

export interface TrendingAnalysisResponse {
  code: number;
  message: string;
  data: TrendingAnalysis[];
}

export interface HotspotListResponse {
  code: number;
  data: HotspotItem[];
}

export interface TrendingConfirmRequest {
  event: HotspotItem;
  suggestion: CreativeSuggestion;
  target_length: number;
}

export interface ConfirmResponse {
  code: number;
  message: string;
  data: {
    novel_id: string;
    title: string;
    genre: string;
    target_word_count: number;
  };
}

export interface HotspotEventResponse {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  source_url: string | null;
  rank: number;
  ai_suggestions: CreativeSuggestion[] | null;
  analysis_summary: string | null;
  tags: string[] | null;
  usage_count: number;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface HotspotStoredListResponse {
  code: number;
  data: HotspotEventResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface StoredQueryParams {
  source?: string;
  tag?: string;
  genre?: string;
  keyword?: string;
  sort_by?: string;
  page?: number;
  page_size?: number;
}

// ============== API 方法 ==============

/** 获取热点列表（不含 AI 分析） */
export function getHotspotsApi(sources?: string[]): Promise<HotspotListResponse> {
  const params: Record<string, string> = {};
  if (sources && sources.length > 0) {
    params.sources = sources.join(',');
  }
  return client.get('/trending/hotspots', { params });
}

/** 分析热点/自定义事件（双模式） */
export function analyzeTrendingApi(
  sources?: string[],
  forceRefresh?: boolean,
): Promise<TrendingAnalysisResponse> {
  return client.post('/trending/analyze', {
    sources: sources || undefined,
    force_refresh: forceRefresh || false,
  });
}

/** 分析用户自定义事件 */
export function analyzeCustomEventApi(event: CustomEvent): Promise<TrendingAnalysisResponse> {
  return client.post('/trending/analyze', {
    custom_event: event,
  });
}

/** 确认创作方向 */
export function confirmTrendingApi(data: TrendingConfirmRequest): Promise<ConfirmResponse> {
  return client.post('/trending/confirm', data);
}

/** 查询已存储的热点事件 */
export function getStoredHotspotsApi(params?: StoredQueryParams): Promise<HotspotStoredListResponse> {
  return client.get('/trending/stored', { params });
}

/** 获取单个存储的热点事件详情 */
export function getStoredHotspotDetailApi(eventId: string): Promise<{ code: number; data: HotspotEventResponse }> {
  return client.get(`/trending/stored/${eventId}`);
}

/** 标记事件被使用 */
export function markHotspotUsedApi(eventId: string): Promise<{ code: number; message: string }> {
  return client.post(`/trending/stored/${eventId}/use`);
}
