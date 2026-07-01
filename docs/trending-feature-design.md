# 🔥 紧跟时事创作 — 功能设计文档

> 版本: v1.0 | 日期: 2026-06-30 | 状态: 待实现

---

## 1. 概述

### 1.1 功能定位

在现有创作流程前端（HomePage 创作入口卡片）新增"紧跟时事创作"模式，Agent 自动抓取/分析热门事件并生成创作建议，用户确认后接通现有 7 步流水线完成短篇小说创作。

### 1.2 核心设计决策

| 决策项 | 选择 |
|--------|------|
| **自动化程度** | 半自动 — Agent 分析 → 用户确认方向 → 逐步推进 |
| **实现方案** | 后端驱动 — 新 API + 服务层 |
| **布局** | 垂直堆叠（每张卡片占一行） |
| **热点来源** | 双模式 — 自动抓取热搜 + 用户手动输入事件描述 |
| **数据持久化** | 数据库存储 — 抓取结果 + AI建议 存入 SQLite，支持缓存复用和跨模式调用 |

### 1.3 用户流程

```
HomePage 点击「紧跟时事」卡片
        ↓
┌─────────────────────────────────────────────────────┐
│  Step 0: 选择输入方式                                │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ 🔥 热点推荐      │  │ ✍️ 自由输入              │  │
│  │ Agent抓取热搜     │  │ 用户描述身边奇葩事       │  │
│  │ AI分析→创作建议   │  │ 直接AI分析→创作建议      │  │
│  └─────────────────┘  └─────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│  Step 1: AI 分析 & 用户确认创作方向                    │
│  → 热点推荐: 展示热搜榜单 + 每个事件2-3个创作建议      │
│  → 自由输入: 仅展示用户输入事件的 2-3 个创作建议       │
│  → 用户选择/调整方向                                  │
└──────────────────────┬───────────────────────────────┘
                       ↓ (创建 Novel + Setting，预填参数)
┌──────────────────────────────────────────────────────┐
│  Step 2-8: 接入现有7步流水线                           │
│  分类配置 → 爽点确认 → 方案生成                        │
│  → 详细规划 → 章节拆分 → 逐章生成                       │
│  → 全文整合                                           │
│  (每步暂停，用户确认后继续)                             │
└──────────────────────────────────────────────────────┘
```

---

## 2. 后端设计

### 2.1 新增路由: `backend/app/api/trending.py`

```python
# 路由前缀: /api/v1/trending

POST /api/v1/trending/analyze
  # 抓取当前热点 + AI 分析 OR 分析用户输入的事件
  # 模式1 (自动): Request: { sources?: string[] }
  # 模式2 (手动): Request: { custom_event: { title, description } }
  # Response: TrendingAnalysisResponse

GET /api/v1/trending/hotspots
  # 仅获取当前热点列表（不含 AI 分析，用于快速预览）
  # Response: HotspotListResponse

POST /api/v1/trending/confirm
  # 用户确认创作方向，自动创建 Novel + Setting + CategoryConfig
  # Request: TrendingConfirmRequest
  # Response: { novel_id, setting, category_config }
```

### 2.2 新增 Schema: `backend/app/schemas/trending.py`

```python
class HotspotItem(BaseModel):
    title: str           # 热点标题
    summary: str         # 事件摘要
    source: str          # 来源 (热搜来源 或 "用户输入")
    url: str = ""        # 原文链接 (用户输入时为空)
    rank: int = 0        # 热度排名 (用户输入时为0)

class CustomEvent(BaseModel):
    title: str           # 用户输入的事件标题
    description: str     # 用户描述的事件详情

class CreativeSuggestion(BaseModel):
    suggestion_id: int
    genre: str           # 题材/分类 (如: 都市、悬疑)
    hook_description: str  # 核心爽点描述
    hook_title: str      # 爽点标题
    plot_direction: str  # 剧情方向简述
    emotional_target: str  # 目标情绪

class TrendingAnalysis(BaseModel):
    event: HotspotItem
    suggestions: List[CreativeSuggestion]
    analysis_summary: str  # AI 分析总结

class TrendingAnalysisResponse(BaseModel):
    code: int = 0
    message: str = "分析完成"
    data: List[TrendingAnalysis]

class HotspotListResponse(BaseModel):
    code: int = 0
    data: List[HotspotItem]

class TrendingConfirmRequest(BaseModel):
    event: HotspotItem              # 选中的热点事件 (或用户输入包装的)
    suggestion: CreativeSuggestion  # 选中的创作建议
    target_length: int = 8000       # 目标字数

# --- 持久化查询相关 Schema ---

class HotspotEventResponse(BaseModel):
    """从 hotspot_events 表返回的完整记录"""
    id: str
    title: str
    summary: Optional[str] = None
    source: str
    source_url: Optional[str] = None
    rank: int = 0
    ai_suggestions: Optional[List[CreativeSuggestion]] = None
    analysis_summary: Optional[str] = None
    tags: Optional[List[str]] = None
    usage_count: int = 0
    fetched_at: datetime
    created_at: datetime
    updated_at: datetime

class HotspotStoredListResponse(BaseModel):
    code: int = 0
    data: List[HotspotEventResponse]
    total: int
    page: int
    page_size: int
```

### 2.3 新增服务: `backend/app/services/trending_service.py`

> 以下为方法签名概览。完整的缓存/持久化逻辑见 [2.8 服务层更新: 缓存策略](#28-服务层更新-缓存策略)。

```python
class TrendingService:
    """热点事件分析与创作建议服务"""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def fetch_hotspots(self, db, sources: List[str] = None,
                              force_refresh: bool = False) -> List[HotspotItem]:
        """抓取当前热点事件列表（优先DB缓存，详见2.8）"""
        # 数据源优先级:
        #   1. 微博热搜 (weibo.com/ajax/side/hotSearch)
        #   2. 百度热搜 (top.baidu.com)
        #   3. 知乎热榜 (zhihu.com/api/v3/feed/topstory/hot-lists)
        pass

    async def analyze_and_save_custom_event(self, db, event: CustomEvent) -> TrendingAnalysis:
        """用 LLM 分析用户手动输入的事件并存入DB，返回完整分析结果（详见2.8）"""
        # 将用户输入包装为 HotspotItem (source="user_input")
        # 使用自定义事件的 Prompt 模板 (2.5)
        pass

    async def analyze_hotspot(self, db, hotspot: HotspotItem) -> List[CreativeSuggestion]:
        """用 LLM 分析热搜事件并持久化AI结果（详见2.8）"""
        pass

    async def get_stored_hotspots(self, db, filters: dict) -> Tuple[List[HotspotEvent], int]:
        """分页查询已存储的热点事件"""
        pass

    async def mark_used(self, db, event_id: str):
        """标记事件被使用（usage_count +1）"""
        pass

    async def confirm_and_create(
        self, db, event: HotspotItem, suggestion: CreativeSuggestion, target_length: int
    ) -> Dict:
        """确认创作方向并自动创建 Novel + Setting + CategoryConfig"""
        # 1. 创建 Novel (title = event.title)
        # 2. 创建 CategoryConfig (genre = suggestion.genre)
        # 3. 创建 ShortStorySetting (hook = suggestion.hook_description)
        pass
```

### 2.4 Prompt 模板: 热点→创作建议

```
你是一位经验丰富的短篇小说编辑，擅长从社会热点事件中提取创作灵感。

请分析以下热点事件，从中提取 {count} 个不同的短篇小说创作方向：

【热点事件】
标题：{title}
摘要：{summary}

【分析要求】
1. 提取事件中的核心冲突、人性张力、道德困境
2. 每个创作方向要包含：
   - 题材/分类（如：都市、悬疑、情感、科幻、古言等番茄平台分类）
   - 核心爽点描述（一句话）
   - 爽点标题（10-15字）
   - 剧情方向简述（2-3句话）
   - 目标情绪（爽/虐/甜/逆袭/反转等）
3. 方向之间要有显著差异（不同题材、不同视角、不同结局）
4. 短篇小说要求：快速进入冲突、集中爆发、有力收尾

【输出格式 - 纯 JSON】
{
  "suggestions": [
    { "suggestion_id": 1, "genre": "...", "hook_description": "...",
      "hook_title": "...", "plot_direction": "...", "emotional_target": "..." }
  ]
}
```

### 2.5 Prompt 模板: 用户自定义事件→创作建议

```
你是一位经验丰富的短篇小说编辑，擅长从生活中各种事件提炼创作灵感。

用户讲述了ta身边发生或听说的一个事件，请从中提取 {count} 个短篇小说创作方向：

【用户描述的事件】
标题：{title}
详情：{description}

【分析要求】
1. 即使事件看似普通，也要挖掘其中的冲突、张力、情感爆发点
2. 可以适度夸张、改编、嫁接——目的是创作好看的小说,不是复述事件
3. 每个创作方向要包含：
   - 题材/分类（如：都市、悬疑、情感、科幻、古言、职场等）
   - 核心爽点描述（一句话）
   - 爽点标题（10-15字）
   - 剧情方向简述（2-3句话）
   - 目标情绪（爽/虐/甜/逆袭/反转/共鸣等）
4. 方向之间要有显著差异（不同题材、不同视角、不同结局）
5. 短篇小说要求：快速进入冲突、集中爆发、有力收尾

【输出格式 - 纯 JSON】
{
  "suggestions": [
    { "suggestion_id": 1, "genre": "...", "hook_description": "...",
      "hook_title": "...", "plot_direction": "...", "emotional_target": "..." }
  ]
}
```

### 2.6 数据库持久化: `backend/app/models.py` 新增 `HotspotEvent` 模型

```
┌───────────────── HotspotEvent 表 ─────────────────┐
│ 热点事件在首次抓取/输入时写入DB，之后二次访问      │
│ 直接从DB读取，避免频繁拉取外部API。               │
│ 存储的AI创作建议可被其他创作模式引用。             │
└───────────────────────────────────────────────────┘
```

```python
class HotspotEvent(Base):
    """热点事件表 — 存储抓取/用户输入的社会热点及AI分析结果"""
    __tablename__ = "hotspot_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, index=True)
    summary = Column(Text, nullable=True)
    source = Column(String(50), nullable=False, index=True)
    # source 取值: "weibo" / "baidu" / "zhihu" / "user_input"

    source_url = Column(String(500), nullable=True)   # 原文链接 (用户输入为空)
    rank = Column(Integer, default=0)                  # 热度排名 (用户输入=0)

    ai_suggestions = Column(JSON, nullable=True)
    # [{ suggestion_id, genre, hook_description, hook_title,
    #    plot_direction, emotional_target }, ...]

    analysis_summary = Column(Text, nullable=True)    # AI 分析总结文本

    tags = Column(JSON, nullable=True)                 # 自动提取的标签
    # ["复仇", "逆袭", "家庭伦理", ...]

    usage_count = Column(Integer, default=0)           # 被引用创作次数

    fetched_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

**关键设计**:
- `ai_suggestions` 存储完整的 AI 分析结果（JSON），避免重复调用 LLM
- `source` 区分数据来源，用户输入和自动抓取在 `source_url` 为空时表现一致
- `tags` 由 AI 自动提取，用于其他创作模式按场景/情绪检索
- `usage_count` 追踪素材被引用次数，后续可用于热度排序

### 2.7 新增 API: 存储热点查询

```python
# 新增两个端点，供其他创作模式引用已存储的热点素材

GET /api/v1/trending/stored
  # 查询已存储的热点事件列表
  # Query Params:
  #   source: str = None      过滤来源 ("weibo" / "baidu" / "user_input")
  #   tag: str = None         按标签过滤 ("复仇", "逆袭" 等)
  #   genre: str = None       按AI建议的题材过滤 ("都市", "悬疑" 等)
  #   keyword: str = None     标题/摘要关键词搜索
  #   page: int = 1           分页
  #   page_size: int = 20
  # Response: { code, data: HotspotEvent[], total, page, page_size }

GET /api/v1/trending/stored/{event_id}
  # 获取单个存储的热点事件详情（含AI建议）
  # Response: { code, data: HotspotEvent }

POST /api/v1/trending/stored/{event_id}/use
  # 标记事件被使用（usage_count +1），不需要额外参数
  # Response: { code, message: "ok" }
```

### 2.8 服务层更新: 缓存策略

```python
class TrendingService:
    # --- 新增/修改的方法 ---

    async def fetch_hotspots(self, db, sources: List[str] = None,
                              force_refresh: bool = False) -> List[HotspotItem]:
        """抓取热点（优先从DB读取缓存）"""
        # 1. 若 force_refresh=False，先从DB查最近30分钟内的记录
        #    SELECT * FROM hotspot_events
        #    WHERE source IN (sources)
        #      AND fetched_at > datetime.now() - 30min
        #    ORDER BY rank ASC
        # 2. 若缓存命中 → 直接返回
        # 3. 若缓存未命中或 force_refresh=True → 从外部API抓取
        # 4. 写入/更新 DB (upsert by title+source)
        # 5. 返回结果

    async def analyze_hotspot(self, db, hotspot: HotspotItem) -> List[CreativeSuggestion]:
        """分析热点并持久化AI结果"""
        # 1. 调用 LLM 生成创作建议
        # 2. UPDATE hotspot_events SET ai_suggestions=..., tags=..., analysis_summary=...
        #    WHERE title=hotspot.title AND source=hotspot.source
        # 3. 返回建议列表

    async def analyze_and_save_custom_event(self, db, event: CustomEvent) -> TrendingAnalysis:
        """分析用户自定义事件并存入DB"""
        # 1. INSERT INTO hotspot_events (title, summary, source="user_input", ...)
        # 2. 调用 LLM 生成建议
        # 3. UPDATE 写入 ai_suggestions, tags
        # 4. 返回完整分析结果

    async def get_stored_hotspots(self, db, filters: dict) -> Tuple[List[HotspotEvent], int]:
        """分页查询已存储的热点事件"""
        # SELECT * FROM hotspot_events
        # WHERE (source filter) AND (tag filter) AND (keyword search)
        # ORDER BY usage_count DESC, fetched_at DESC
        # LIMIT page_size OFFSET (page-1)*page_size

    async def mark_used(self, db, event_id: str):
        """标记事件被使用"""
        # UPDATE hotspot_events SET usage_count = usage_count + 1 WHERE id = event_id
```

**缓存规则总结**:

| 场景 | 行为 |
|------|------|
| 30分钟内重复访问同一源 | 直接返回 DB 缓存，不调外部 API |
| 超过30分钟 | 重新抓取，upsert 更新 DB |
| 用户手动输入 | 立即写入 DB（source="user_input"），不做外部抓取 |
| 用户在其他模式查询素材 | 查 DB，不受时间限制 |
| 用户点击"刷新"按钮 | force_refresh=True，跳过缓存 |

### 2.9 在 `main.py` 中注册路由

```python
from app.api.trending import router as trending_router
app.include_router(trending_router, prefix="/api/v1")
```

---

## 3. 前端设计

### 3.1 HomePage 创作入口改造

**现状**: 上部为统计区，下部为作品列表。需要在统计区下方、作品列表上方增加"创作入口"区域。

**布局**: 垂直堆叠（每张卡片占一行）

```
┌────────────────────────────────────────────────────────────────────┐
│  下午好 👋                                                          │
│  番茄小说创作工作台                                                     │
├──────────────────┬──────────────────┬──────────────────┬──────────┤
│ 全部作品  5       │ 已完成  2        │ 创作中  2         │ 累计 1.2万字│
└──────────────────┴──────────────────┴──────────────────┴──────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  📝 创建短篇小说                  手动配置分类→爽点→方案...     [开始]   │
├─────────────────────────────────────────────────────────────────────┐
│  🎲 一键随机创作                  随机组合预置要素快速启动         [开始]   │
├─────────────────────────────────────────────────────────────────────┐
│  🔥 紧跟时事创作  NEW              AI分析热点/你讲身边事→自动创作    [开始]   │
└─────────────────────────────────────────────────────────────────────┘

[全部] [创作中] [已完成] [草稿]              [搜索...]   [+ 新建作品]
```

### 3.2 新增页面: `frontend/src/pages/TrendingPage.tsx`

该页面支持两种输入模式，通过 Tab 切换：

```tsx
function TrendingPage() {
  // 模式切换
  const [mode, setMode] = useState<'hotspot' | 'custom'>('hotspot');

  // 状态管理
  const [phase, setPhase] = useState<'loading' | 'analysis' | 'empty' | 'error' | 'confirm' | 'creating'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [analyses, setAnalyses] = useState<TrendingAnalysis[]>([]);     // 分析结果
  const [selectedAnalysisIdx, setSelectedAnalysisIdx] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [targetLength, setTargetLength] = useState(8000);

  // 自由输入模式专用状态
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  // 自动模式: 页面加载时抓取热搜
  useEffect(() => {
    if (mode === 'hotspot') loadTrendingAnalysis();
  }, [mode]);

  async function loadTrendingAnalysis(forceRefresh = false) {
    setPhase('loading'); setErrorMsg('');
    try {
      const result = await analyzeTrendingApi(undefined, forceRefresh);
      if (!result.data || result.data.length === 0) setPhase('empty');
      else { setAnalyses(result.data); setPhase('analysis'); }
    } catch (e) {
      setErrorMsg('热搜抓取失败，请检查网络或稍后重试');
      setPhase('error');
    }
  }

  // 点击刷新按钮
  function handleRefresh() { loadTrendingAnalysis(true); }

  // 手动模式: 用户填写表单 → 点击分析
  async function handleCustomAnalyze() {
    setPhase('loading'); setErrorMsg('');
    try {
      const result = await analyzeCustomEventApi({ title: customTitle, description: customDescription });
      if (!result.data || result.data.length === 0) setPhase('empty');
      else { setAnalyses(result.data); setPhase('analysis'); }
    } catch (e) {
      setErrorMsg('分析失败，请检查描述内容或稍后重试');
      setPhase('error');
    }
  }
}
```

页面布局示意：

```
┌──────────────────────────────────────────────────────────┐
│  🔥 紧跟时事创作                                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ 🔥 热点推荐  │  │ ✍️ 自由输入  │    ← Tab 切换         │
│  └──────────────┘  └──────────────┘                      │
│                                                          │
│  ───────────────  模式1: 热点推荐  ───────────────────    │
│                                         [🔄 刷新热搜]      │
│  ┌──────────────────────────────────────────────────┐    │
│  │ #1 🔥 某明星离婚事件                          [展开] │    │
│  │   → 💡 都市·逆袭: 离婚后我成了亿万总裁...    [选这个] │    │
│  │   → 💡 悬疑·反转: 前夫的秘密地下室...        [选这个] │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ #2 🔥 高考满分作文争议                        [展开] │    │
│  │   → 💡 校园·爽文: AI写作文被清北争抢...      [选这个] │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ───────────────  模式2: 自由输入  ───────────────────    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 标题: [___________________________]              │    │
│  │ 描述: [___________________________]              │    │
│  │       [___________________________]              │    │
│  │       [___________________________]              │    │
│  │                                                  │    │
│  │  💡 例如: "邻居深夜总传来奇怪敲墙声，后来发现... │    │
│  │                                          [开始分析] │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ⚠️ 自由输入适用于:                                       │
│  · 身边发生的奇葩事、都市传说                             │
│  · 热搜上没有但你觉得有意思的事                            │
│  · 朋友/同事/亲戚的狗血故事                               │
│                                                          │
│  ───────────────  空状态 (empty)  ────────────────────    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  😕                                               │    │
│  │  暂无热搜数据 / 未能生成创作建议                    │    │
│  │  [🔄 重试]                                        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ───────────────  错误态 (error)  ───────────────────    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ⚠️  {errorMsg}                                   │    │
│  │  [🔄 重试]                                        │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 3.3 新增 API 层: `frontend/src/api/trending.ts`

```typescript
export async function getHotspotsApi(): Promise<HotspotItem[]>
export async function analyzeTrendingApi(sources?: string[], forceRefresh?: boolean): Promise<TrendingAnalysis[]>
export async function analyzeCustomEventApi(event: CustomEvent): Promise<TrendingAnalysis[]>
export async function confirmTrendingApi(data: TrendingConfirmRequest): Promise<{ novelId: string }>

// 持久化查询
export async function getStoredHotspotsApi(filters: StoredQueryParams): Promise<HotspotStoredListResponse>
export async function getStoredHotspotDetailApi(eventId: string): Promise<{ code: number, data: HotspotEventResponse }>
export async function markHotspotUsedApi(eventId: string): Promise<{ code: number, message: string }>
```

### 3.4 路由注册

```tsx
// frontend/src/App.tsx (或路由配置文件)
<TrendingPage path="/trending" />
```

---

## 4. 数据流

```
  Frontend                    Backend                    External/DB
  ────────                    ───────                    ──────────

  点击「紧跟时事」
       │
       ├── 模式切换 ────────────────────────────────────────┐
       │                                                    │
  ┌────┴──────────────┐                       ┌────────────┴──────────┐
  │  🔥 热点推荐       │                       │  ✍️ 自由输入           │
  │                    │                       │                      │
  │ GET /hotspots      │                       │ 用户填写标题+描述      │
  │  ← 热搜列表        │                       │                      │
  │     │              │                       │ POST /analyze        │
  │     │  先查DB缓存   │                       │  { custom_event }    │
  │     │  ──→ hotspot_│events (30min TTL)     │     │                │
  │     │  ←── 命中→直接返回                    │     │ INSERT INTO    │
  │     │  ←── 未命中→抓取外部API               │     │ hotspot_events │
  │     │           └──→ UPSERT DB              │     │                │
  │                    │                       │     │  ← AI分析+建议  │
  │ 自动 POST /analyze │                       │     │ UPDATE ai_     │
  │  ← AI分析+建议     │                       │     │ suggestions   │
  │     UPDATE ai_suggestions ←─────────────   │     │                │
  └────────┬───────────┘                       └──────────┬───────────┘
           │                                              │
           └──────────────── 合并展示 ─────────────────────┘
                                │
  ┌─────────────────────────────┐
  │ 用户查看分析结果 + 创作建议   │
  │ 选择创作方向                 │
  └──────────┬──────────────────┘
             │
             ├─ POST /stored/{id}/use ──→ usage_count++
             ├─ POST /trending/confirm ──→ confirm_and_create()
             │     ← { novelId } ────────     │ 
             │                              ├─ Novel(title=事件标题)
      跳转  │                              ├─ CategoryConfig(genre)
  CreatePage │                              └─ ShortStorySetting(hook=选中爽点)
   ?novelId  │
             │
             └── 现有7步流水线 (逐步确认) ──→ 完成！


  ─── 其他创作模式引用已存储热点 ───

  CreatePage / SettingsPage 等
       │
       ├─ GET /trending/stored?tag=复仇&genre=都市
       │     ← { data: HotspotEvent[], total, page }
       │
       │  展示"参考热点素材"面板
       │  → 用户浏览已存储事件及AI建议
       │  → 选中某事件的爽点作为创作参考
       │
       └─ POST /stored/{id}/use  (标记引用)
```

---

## 5. 实现计划

### Phase 1: 后端基础设施 (预计 3-4 小时)

- [ ] 1.1 在 `models.py` 新增 `HotspotEvent` ORM 模型
- [ ] 1.2 创建 `schemas/trending.py` — 数据模型定义（含 CustomEvent、HotspotEventResponse、分页查询）
- [ ] 1.3 创建 `services/trending_service.py` — 热点抓取 + 缓存逻辑 + 自定义事件分析 + 存储查询
- [ ] 1.4 创建 `api/trending.py` — 路由端点（analyze 双模式 + stored 查询 + use 标记）
- [ ] 1.5 在 `main.py` 注册新路由，确保 `Base.metadata.create_all` 自动建表
- [ ] 1.6 编写两套 Prompt 模板（热搜版 + 自定义事件版）并验证输出质量

### Phase 2: 前端实现 (预计 2-3 小时)

- [ ] 2.1 改造 `HomePage.tsx` — 新增创作入口卡片区（垂直堆叠布局）
- [ ] 2.2 创建 `TrendingPage.tsx` — 双模式 Tab 切换（热点推荐 + 自由输入）+ 分析结果展示 + 确认
- [ ] 2.3 创建 `api/trending.ts` — 前端 API 调用层（含 analyzeCustomEventApi）
- [ ] 2.4 注册新路由 `/trending`
- [ ] 2.5 确认后跳转到 CreatePage 接手后续流程

### Phase 3: 联调与优化 (预计 1 小时)

- [ ] 3.1 端到端测试：热点抓取 → 分析 → 确认 → 创作
- [ ] 3.2 处理异常：热点获取失败、LLM 分析失败
- [ ] 3.3 加载态、空态、错误态 UI

---

## 6. 关键文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `backend/app/models.py` | **修改** | 新增 `HotspotEvent` ORM 模型 |
| `backend/app/schemas/trending.py` | 新增 | Pydantic 模型（含 HotspotEventResponse） |
| `backend/app/services/trending_service.py` | 新增 | 业务逻辑（含缓存/持久化） |
| `backend/app/api/trending.py` | 新增 | API 路由（analyze + stored + use） |
| `backend/app/main.py` | 修改 | 注册新路由，自动建表 |
| `frontend/src/pages/TrendingPage.tsx` | 新增 | 热点分析页（双模式 + 历史查询入口） |
| `frontend/src/pages/HomePage.tsx` | 修改 | 新增创作入口卡片 |
| `frontend/src/api/trending.ts` | 新增 | 前端 API（含 stored/use 接口） |
| `frontend/src/App.tsx` | 修改 | 注册新路由 |
```

---

## 7. 注意事项

- **热点数据源**: 优先选无需 API Key 的公开接口（微博热搜 JSON），备选方案是从配置文件指定 RSS 源
- **外部API降级策略**:
  - 微博热搜 API 不可用时 → 自动 fallback 百度热搜 → 再 fallback 知乎热榜
  - 所有外部源全部失败 → 返回错误码，前端展示"暂无热搜数据"空状态，引导用户切换至自由输入模式
  - 建议在配置文件 `config.yaml` 中维护热搜源列表及优先级
- **SQLite JSON 查询提示**: `GET /stored` 的 `genre` 过滤需要查询 `ai_suggestions` JSON 数组中的 `genre` 字段：
  ```sql
  -- 按 genre 过滤 (ai_suggestions 是对象数组)
  SELECT * FROM hotspot_events
  WHERE EXISTS (
    SELECT 1 FROM json_each(ai_suggestions)
    WHERE json_extract(value, '$.genre') = :genre
  )

  -- 按 tag 过滤 (tags 是字符串数组)
  SELECT * FROM hotspot_events
  WHERE EXISTS (
    SELECT 1 FROM json_each(tags) WHERE value = :tag
  )
  ```
- **自定义事件输入校验**: 标题必填（1-30字），描述必填（10-500字），前端表单校验 + 后端二次校验
- **LLM 分析耗时**: 热点 + AI 分析可能耗时 10-30 秒，前端需有加载进度提示
- **DB 缓存策略**:
  - 热搜事件: 30 分钟内重复请求直接走 DB，不调外部 API
  - 自定义事件: 分析后立即写入 DB（source="user_input"），不会自动刷新
  - 用户可手动点"刷新"按钮跳过缓存重新抓取
- **跨模式复用**: 其他创作页可通过 `GET /stored` 查询已存储的热点素材，按标签/题材/关键词筛选
- **去重策略**: 同 source + title 的事件做 upsert（保留最新 fetched_at 和 ai_suggestions）
- **预填 vs 覆盖**: 确认后预填的参数用户可在后续步骤中修改
- **自定义事件 vs 热搜**: 二者共用相同的 confirm 流程，区别仅在前置的分析输入方式
- **usage_count**: 每次创作引用时 +1，用于排序和热度追踪，不涉及复杂逻辑
