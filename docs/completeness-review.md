# 功能完善度评估报告

> 检查日期: 2025-06-30  
> 检查范围: 全栈代码审查（后端 FastAPI + 前端 React + SQLite）

---

## 总体评估

项目整体架构清晰，7 步创作流程完整，"紧跟时事创作"功能已集成为后端驱动的半自动模式。**当前版本适合本地单人使用**，主要问题集中在错误处理一致性、部分 UX 细节和安全加固上。

- **功能完整度**: 85%
- **代码质量**: 80%  
- **UX 完善度**: 75%
- **安全性（本地场景）**: 70%

---

## 一、严重问题（需优先修复）

### 1.1 前后端错误码定义严重不一致 ⚠️ 高

`frontend/src/api/client.ts` 和 `backend/app/core/errors.py` 中的错误码数值不同：

| 错误 | 前端码值 | 后端码值 |
|------|---------|---------|
| NOVEL_NOT_FOUND | 3000 | 2000 |
| NOVEL_TITLE_EMPTY | 3001 | 2001 |
| CHAPTER_NOT_FOUND | 3100 | 2100 |
| AI_NO_API_KEY | 6004 (名为 AI_NO_MODEL_CONFIG) | 6001 |
| AI_TIMEOUT | 6007 | 6003 |
| CONFIG_INVALID_URL | 7001 | 7000 |
| CONFIG_INVALID_KEY | 7002 | 7001 |

前端还定义了后端不存在的错误码: `AI_STREAM_INTERRUPTED(6001)`, `AI_CONTEXT_TOO_LONG(6002)`, `AI_RATE_LIMIT(6006)`, `AI_CONTENT_FILTER(6008)`, `CONFIG_NOT_FOUND(7000)`, `CONFIG_INVALID_MODEL(7003)`。

**影响**: 前端错误消息映射与后端实际返回不匹配，用户可能看到错误码而非中文提示。

**修复建议**: 统一以 `backend/app/core/errors.py` 为准，更新前端 `client.ts` 的 `ERROR_CODES`。

---

### 1.2 侧边栏缺少"紧跟时事"导航入口

`Layout.tsx` 的侧边栏只有创作 7 步 + 首页 + 设置 + 导出，**没有 `/trending` 的入口**。用户只能从首页的"🔥 紧跟时事创作"卡片进入。

**影响**: 用户在创作流程中无法快速跳到时事功能，降低可用性。

**修复建议**: 在 `Layout.tsx` 侧边栏底部区域（设置上方）增加"🔥 紧跟时事"导航项。

---

## 二、中等问题

### 2.1 SettingsPage 绕过统一 Axios 客户端

`SettingsPage.tsx` 使用原生 `fetch()` 而非项目统一的 `client.ts`：
- `loadServerConfig()` (第31行) — 获取服务端配置
- `handleTestConnection()` (第91行) — 测试 LLM 连接

**影响**: 绕过统一拦截器，错误处理不一致，无法复用错误码映射。

**修复建议**: 将 `/api/v1/config` 和测试连接端点加入 API 层，通过 `client.get/post` 调用。

### 2.2 API Key 明文存储在 localStorage

`SettingsPage.tsx` 第77行: `localStorage.setItem('fanqie_settings', JSON.stringify(form))`，API Key 以明文存储。

**影响**: 任何能访问浏览器本地存储的脚本/扩展都能读取。

**修复建议**: 将 API Key 只后端读取（从 `.env`），前端设置页改为主机地址和模型选择。

### 2.3 数据库路径可能无父目录

`database.py` 中 `DATABASE_PATH = "data/fanqie_short_novel.db"`，如果 `data/` 目录不存在，SQLAlchemy 不会自动创建。

**影响**: 首次启动时如果手动删除了 `data/` 目录会报错。

**修复建议**: 在 `database.py` 初始化时添加 `os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)`。

### 2.4 `any` 类型使用

`shortStory.ts` 第142行 `applyAllFixes` 返回类型中 `data: any`。

**修复建议**: 定义具体的返回类型接口 `ApplyAllFixesResult`。

### 2.5 HTTPStatusError 处理器硬编码错误码

`exception_handlers.py` 第44行，所有 `HTTPStatusError` 都返回 `AI_GENERATE_FAILED`，但该异常可能来自非 AI 调用。

**修复建议**: 区分错误来源，或使用更通用的错误码。

### 2.6 TrendingPage 热搜分析是串行的

`backend/app/api/trending.py` 第109行 `for hotspot in hotspots:` 逐个调用 LLM 分析，如果有 10 个热搜就是 10 次串行 LLM 调用。

**影响**: 等待时间长，用户体验差。

**修复建议**: 用 `asyncio.gather` 并行分析多个热搜。

### 2.7 搜索框无防抖

`HomePage.tsx` 搜索输入 `onChange` 直接设置 state 触发过滤，没有 debounce。

**影响**: 输入较快时有轻微性能抖动。

---

## 三、低优先级问题

### 3.1 SQLite 写入锁

SQLite 在写入时锁整个数据库，多标签页同时操作可能冲突。不过本地单人使用场景影响极小。

### 3.2 通用异常处理器过于宽泛

`exception_handlers.py` 中 `handle_generic_exception` 捕获所有未处理异常，可能掩盖业务逻辑 bug。建议增加结构化日志上报。

### 3.3 错误日志中可能暴露敏感信息

`handle_sqlalchemy_error` 中 `exc_info=True` 可能输出完整 SQL（含数据）。

### 3.4 SECRET_KEY 硬编码

`config.py` 中 `SECRET_KEY = "fanqie-short-novel-local"`，虽然注释说明纯本地，但建议改为从环境变量读取。

### 3.5 删除操作缺少二次确认

TrendingPage 历史记录无删除功能（合理），但如果有清理缓存的需求，缺少入口。

### 3.6 加载状态不够细粒度

TrendingPage 只有全局 `phase` 状态，无法知道某个热搜的分析进度。建议增加每个热搜的独立加载状态。

### 3.7 定时任务

没有热榜自动刷新/定时抓取机制，需要手动点"刷新热搜"。

---

## 四、功能性缺失

### 4.1 未实现的功能

| 功能 | 文件 | 状态 |
|------|------|------|
| ShortStoryCreatePage | `frontend/src/pages/ShortStoryCreatePage.tsx` | 存在但未注册路由 |
| 错误码 STREAM_INTERRUPTED | `client.ts` | 定义但无后端实现 |
| 错误码 RATE_LIMIT | `client.ts` | 定义但无后端实现 |
| 错误码 CONTENT_FILTER | `client.ts` | 定义但无后端实现 |

### 4.2 设计文档中的功能

对照 `docs/trending-feature-design.md`：
- ✅ 自动抓取热搜 — 已实现
- ✅ AI 分析生成创作建议 — 已实现
- ✅ 确认后自动创建作品 — 已实现
- ✅ 用户自定义事件 — 已实现
- ✅ 历史热搜查询 — 已实现
- ⚠️ 全自动模式 — 设计为"半自动"，符合预期
- ❌ 定时刷新 — 未实现

---

## 五、修复优先级排序

| 优先级 | 问题 | 预计耗时 |
|--------|------|---------|
| P0 | 1.1 前后端错误码统一 | 30min |
| P0 | 1.2 侧边栏增加 Trending 入口 | 10min |
| P1 | 2.1 Settings 使用统一 client | 20min |
| P1 | 2.6 热搜分析并行化 | 15min |
| P1 | 2.3 数据库路径创建 | 5min |
| P2 | 2.2 API Key 存储安全 | 1h |
| P2 | 2.5 HTTPStatusError 错误码修正 | 10min |
| P2 | 2.7 搜索防抖 | 10min |
| P3 | 其余低优先级项 | 按需 |

---

## 六、整体建议

1. **错误处理体系重构**: 以 `backend/app/core/errors.py` 为单一真相来源，前端从后端获取错误码映射（或保持硬编码同步）
2. **配置管理**: API Key 应只从后端 .env 读取，前端不要存储
3. **日志分级**: 区分 DEBUG/INFO/WARNING/ERROR，生产环境关闭 DEBUG
4. **添加 `.gitignore`**: 确保 `data/` 目录下的 `.db` 文件被 gitignore
5. **前端测试**: 暂无测试用例，建议至少为 API 层和关键页面添加 E2E 测试
