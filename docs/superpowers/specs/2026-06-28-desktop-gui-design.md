# Fanqie Short Novel 桌面客户端设计文档

> 日期: 2026-06-28 | 状态: 待实施

## 1. 概述

将现有的 React Web 前端替换为 **PySide6 原生桌面 GUI**，将后端 FastAPI 服务层整合进客户端，最终通过 PyInstaller 打包为单个 Windows `.exe` 可执行文件。

### 1.1 目标

- 用户双击 `.exe` 即可使用，无需安装 Python/Node.js
- 纯本地运行，SQLite 数据库
- 保持原有的 7 步 AI 辅助创作流程
- 复用现有的 LLM 客户端、数据库模型、核心业务逻辑

### 1.2 非目标

- 不再保留 FastAPI HTTP 服务
- 不再保留 React 前端
- 不增加远程服务/云同步功能

---

## 2. 架构设计

### 2.1 新目录结构

```
fanqie-short-novel/
├── desktop/                              # 新建：PySide6 桌面客户端
│   ├── main.py                           # 应用入口，启动 GUI
│   ├── build.py                          # PyInstaller 打包脚本
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                     # 配置管理（复用 backend/app/config.py）
│   │   ├── database.py                   # 数据库引擎（改为同步 Session）
│   │   ├── models.py                     # ORM 模型（复用，无改动）
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── llm_client.py             # LLM 客户端（改为同步 httpx/requests）
│   │   │   ├── errors.py                 # 错误码（复用）
│   │   │   ├── logging_config.py         # 日志（复用，去掉 FastAPI 依赖）
│   │   │   └── preset_data.py            # 预设数据（复用）
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── short_story.py            # 核心业务（改为同步）
│   │   │   ├── category_service.py       # 分类服务（改为同步）
│   │   │   ├── hook_generation_service.py # 爽点生成（改为同步）
│   │   │   └── integration_fix_service.py # 整合修复（改为同步）
│   │   ├── schemas/
│   │   │   └── __init__.py               # Pydantic Schema（复用）
│   │   ├── scripts/
│   │   │   └── seed_presets.py           # 预设库初始化（改为同步）
│   │   ├── gui/
│   │   │   ├── __init__.py
│   │   │   ├── main_window.py            # 主窗口（QMainWindow）
│   │   │   ├── app_manager.py            # 应用管理器（小说列表、新建、状态管理）
│   │   │   ├── wizard_window.py          # 向导窗口（7 步流程）
│   │   │   ├── widgets/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── loading_overlay.py    # 加载动画遮罩
│   │   │   │   ├── streaming_text.py     # 流式文本显示组件
│   │   │   │   ├── novel_card.py         # 小说卡片（首页列表用）
│   │   │   │   └── step_indicator.py     # 步骤指示器
│   │   │   ├── pages/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base_page.py          # 页面基类
│   │   │   │   ├── home_page.py          # 首页：小说列表 + 新建
│   │   │   │   ├── category_page.py      # Step 1: 分类标签配置
│   │   │   │   ├── hook_page.py          # Step 2: 爽点选择
│   │   │   │   ├── plan_page.py          # Step 3: 方案选择
│   │   │   │   ├── detail_plan_page.py   # Step 4: 详细规划
│   │   │   │   ├── chapter_page.py       # Step 5: 章节拆分
│   │   │   │   ├── write_page.py         # Step 6: 逐章写作
│   │   │   │   └── integrate_page.py     # Step 7: 全文整合
│   │   │   └── dialogs/
│   │   │       ├── __init__.py
│   │   │       ├── settings_dialog.py    # 设置对话框（API Key 等）
│   │   │       └── new_novel_dialog.py   # 新建小说对话框
│   │   └── resources/
│   │       ├── styles/
│   │       │   └── light_theme.qss       # 清新亮色主题 QSS
│   │       └── icons/                    # 图标资源
├── backend/                              # 保留作为参考，逐步废弃
├── frontend/                             # 将被删除
└── data/                                 # 共用数据目录
```

### 2.2 分层架构

```
┌────────────────────────────────────────────────────┐
│  GUI Layer (PySide6)                                │
│  main_window → wizard_window → pages + widgets     │
├────────────────────────────────────────────────────┤
│  Service Layer (同步)                               │
│  short_story_service / category_service / ...       │
├────────────────────────────────────────────────────┤
│  Core Layer (同步)                                  │
│  llm_client / database / errors / preset_data       │
├────────────────────────────────────────────────────┤
│  Data Layer                                         │
│  SQLite (via SQLAlchemy sync Session)               │
└────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
用户操作 → PySide6 信号/槽
         → GUI Page 调用 Service 方法
         → Service 调用 LLMClient.chat() / LLMClient.chat_stream()
         → LLMClient 用 httpx.Client 同步请求 AI API
         → 流式结果通过 Qt 信号逐 chunk 推送到 streaming_text 组件
         → 结果保存到 SQLite（同步 Session）
```

### 2.4 线程模型

由于 PySide6 GUI 在主线程运行，LLM 调用（可能耗时 10-120 秒）必须在工作线程执行：

```
主线程 (GUI)                    工作线程 (QThread)
    │                                │
    │  点击"生成"按钮                │
    │ ─────────────────────────────> │
    │                                │ 调用 LLMClient.chat_stream()
    │  收到 chunk (via signal)       │ 逐 chunk yield
    │ <───────────────────────────── │
    │  更新 streaming_text           │
    │                                │
    │  收到完成 (via signal)         │ 完成
    │ <───────────────────────────── │
    │  更新 UI 显示完整结果          │
```

---

## 3. 关键设计决策

### 3.1 异步 → 同步转换

现有后端全部使用 `async/await`。桌面客户端需要改为同步模式：

| 项目 | 原来 (async) | 改为 (sync) |
|---|---|---|
| 数据库引擎 | `create_async_engine` + `aiosqlite` | `create_engine` + `sqlite3` |
| Session | `AsyncSession` | `Session` |
| 查询 | `await db.execute(select(...))` | `db.execute(select(...))` |
| 提交 | `await db.commit()` | `db.commit()` |
| HTTP 客户端 | `httpx.AsyncClient` | `httpx.Client` |
| 流式 | `async for line in response.aiter_lines()` | `for line in response.iter_lines()` |
| 服务方法 | `async def` | `def` |

### 3.2 流式输出实现

LLM 流式输出在 PySide6 中的实现方式：

```
LLMWorker(QThread)
  ├── run()
  │   └── llm_client.chat_stream(messages)
  │       └── for chunk in response.iter_lines():
  │           └── content = parse_sse(chunk)
  │           └── self.chunk_ready.emit(content)    # Qt Signal
  │       └── self.finished.emit(full_text)
  │
  ├── chunk_ready = Signal(str)    # 连接到 streaming_text.append()
  └── finished = Signal(str)       # 连接到页面 on_generation_complete()
```

`streaming_text` 组件是一个 `QTextEdit`（只读），接收 `chunk_ready` 信号后追加文本，并自动滚动到底部。

### 3.3 配置管理

配置沿用 `pydantic-settings`，但增加 GUI 设置对话框：

- **首次启动**：检测 `.env` 文件，若无则弹出设置对话框
- **设置项**：`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`
- **存储**：保存到项目根目录 `.env` 文件，`Settings` 类自动读取
- **运行时修改**：设置对话框修改后立即生效

### 3.4 主题样式

清新亮色主题，参考 Notion/微信读书风格：

- **主背景**: `#FFFFFF`
- **侧边栏/卡片**: `#F7F6F3`（暖灰）
- **主文字**: `#37352F`
- **次要文字**: `#9B9A97`
- **强调色**: `#2383E2`（蓝）
- **成功色**: `#0F7B4E`（绿）
- **边框**: `#E9E9E7`
- **圆角**: 8px（卡片）、6px（按钮）
- **字体**: Microsoft YaHei (Windows), PingFang SC (macOS)

### 3.5 打包策略

使用 PyInstaller 打包为单个 `.exe`：

```python
# build.py
PyInstaller.__main__.run([
    'desktop/main.py',
    '--name=fanqie-short-novel',
    '--onefile',
    '--windowed',              # 不显示控制台
    '--add-data=../data:data',  # 打包分类数据
    '--hidden-import=sqlalchemy',
    '--hidden-import=aiosqlite',  # 如果保留异步
    '--hidden-import=pydantic_settings',
    '--icon=desktop/app/resources/icons/app.ico',
])
```

---

## 4. 页面详细设计

### 4.1 首页 (HomePage)

```
┌──────────────────────────────────────────────────────┐
│  🍅 番茄短篇小说创作                    [⚙ 设置]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  ➕ 新建小说          │  │  📂 打开已有小说     │ │
│  │                      │  │                      │ │
│  │  开始一个新的短篇     │  │  继续之前未完成的    │ │
│  │  创作项目             │  │  创作项目            │ │
│  └──────────────────────┘  └──────────────────────┘ │
│                                                      │
│  我的小说                                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📖 霸道总裁的替身新娘    进行中 · 3/7 步 · 2h前  │ │
│  │ 目标字数: 8000  当前字数: 2456                    │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📖 重生之都市修仙        已完成 · 7/7 步 · 1d前  │ │
│  │ 目标字数: 10000  当前字数: 10234                  │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📖 悬疑笔记                草稿 · 1/7 步 · 3d前   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**功能**：
- 新建小说 → 弹出 `NewNovelDialog`（输入标题、目标字数、类型）
- 点击已有小说 → 打开 `WizardWindow`，跳转到上次进度
- 双击/右键 → 删除小说
- 设置按钮 → 打开 `SettingsDialog`

### 4.2 向导窗口 (WizardWindow)

```
┌──────────────────────────────────────────────────────┐
│  番茄短篇小说创作 — 霸道总裁的替身新娘       [— □ ✕] │
├──────────────────────────────────────────────────────┤
│  ● 分类标签 ── ○ 核心爽点 ── ○ 基础方案 ── ○ 详细规划 │
│  ── ○ 章节拆分 ── ○ 逐章写作 ── ○ 全文整合           │
├──────────────────────────────────────────────────────┤
│                                                      │
│                  当前步骤的页面内容                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [保存进度]              [← 上一步]  [下一步 →]      │
└──────────────────────────────────────────────────────┘
```

**功能**：
- 顶部步骤指示器：当前步骤高亮，已完成步骤显示 ✓
- 中间区域：`QStackedWidget` 切换 7 个页面
- 底部按钮栏：保存进度、上一步、下一步/生成
- 窗口标题动态显示当前小说标题

### 4.3 各步骤页面设计

#### Step 1: 分类标签 (CategoryPage)

- 左侧：主分类选择（下拉列表/列表）
- 中间：情节标签选择（多选树形结构，3 级联动）
- 右侧：角色标签、情绪过程、故事背景
- 底部：已选标签汇总预览

#### Step 2: 爽点选择 (HookPage)

- 上方：预设爽点库（按分类 tabs 展示）
- 下方：AI 生成爽点候选（点击生成后流式显示 5 个候选）
- 每个爽点卡片显示：标题、描述、情绪目标
- 选中后高亮，可微调编辑

#### Step 3: 方案选择 (PlanPage)

- AI 生成 3-5 个基础设定方案
- 每个方案卡片：叙事顺序、情节概要、结局类型、情绪曲线、预计字数
- 选中方案后高亮

#### Step 4: 详细规划 (DetailPlanPage)

- 分三个标签页：角色人设 / 关键场景 / 伏笔反转
- 角色人设：列表展示，每个角色可展开查看详情
- 关键场景：卡片列表，显示场景序号、标题、目的、情绪
- 伏笔反转：配对列表，显示伏笔位置+内容 → 反转位置+揭示

#### Step 5: 章节拆分 (ChapterPage)

- 上方：章节结构预览（树形列表）
- 每章显示：序号、标题、核心目标、预计字数、章节类型
- 支持手动增删改章节
- 支持添加番外章（背景/动机/后续）

#### Step 6: 逐章写作 (WritePage)

- 左侧：章节列表（可切换）
- 右侧：写作区
  - 上方：章节信息（标题、目标字数、情绪目标、结尾钩子）
  - 中间：文本编辑区（`QTextEdit`，支持编辑）
  - 下方：生成按钮 + 重新生成按钮
- 生成时：流式显示 AI 写作过程
- 完成后：可手动编辑润色

#### Step 7: 全文整合 (IntegratePage)

- 上方：整合结果摘要（发现问题数、修复建议数）
- 中间：问题列表（每个问题显示：类型、描述、涉及章节、原文/修复后对比）
- 每个问题可：接受修复 / 拒绝 / 手动修改
- 底部：导出按钮（导出为 .txt 文件）

### 4.4 对话框

#### 新建小说对话框 (NewNovelDialog)

```
┌──────────────────────────────────┐
│  新建短篇小说                     │
│                                  │
│  作品标题: [________________]    │
│  目标字数: [8000    ] 字         │
│                                  │
│         [取消]    [创建]         │
└──────────────────────────────────┘
```

#### 设置对话框 (SettingsDialog)

```
┌──────────────────────────────────┐
│  设置                            │
│                                  │
│  API 地址: [________________]    │
│  API Key:  [________________]    │
│  模型名称: [________________]    │
│  温度:     [0.7]    (0-2)        │
│  最大 Token: [4000]              │
│                                  │
│         [取消]    [保存]         │
└──────────────────────────────────┘
```

---

## 5. 组件清单

### 5.1 通用组件

| 组件 | 文件 | 说明 |
|---|---|---|
| `LoadingOverlay` | `widgets/loading_overlay.py` | 半透明遮罩 + 旋转动画，覆盖在页面上方 |
| `StreamingText` | `widgets/streaming_text.py` | 只读 QTextEdit，接收信号追加文本 |
| `NovelCard` | `widgets/novel_card.py` | 首页小说卡片，显示标题/进度/时间 |
| `StepIndicator` | `widgets/step_indicator.py` | 向导顶部步骤指示器 |

### 5.2 页面

| 页面 | 文件 | 对应原前端页面 | 说明 |
|---|---|---|---|
| `HomePage` | `pages/home_page.py` | `ShortStoryCreatePage` | 小说列表 + 新建入口 |
| `CategoryPage` | `pages/category_page.py` | `CategoryConfigPage` | 分类标签配置 |
| `HookPage` | `pages/hook_page.py` | `HookSelectPage` | 爽点生成与选择 |
| `PlanPage` | `pages/plan_page.py` | `PlanSelectPage` | 方案生成与选择 |
| `DetailPlanPage` | `pages/detail_plan_page.py` | `DetailPlanPage` | 详细规划查看 |
| `ChapterPage` | `pages/chapter_page.py` | `ChapterPlanPage` | 章节拆分与管理 |
| `WritePage` | `pages/write_page.py` | `WritePage` | 逐章写作 |
| `IntegratePage` | `pages/integrate_page.py` | `IntegratePage` | 全文整合修复 |

### 5.3 对话框

| 对话框 | 文件 | 说明 |
|---|---|---|
| `NewNovelDialog` | `dialogs/new_novel_dialog.py` | 新建小说 |
| `SettingsDialog` | `dialogs/settings_dialog.py` | 全局设置 |

---

## 6. 文件改动清单

### 6.1 新建文件

| 文件 | 说明 |
|---|---|
| `desktop/main.py` | 应用入口 |
| `desktop/build.py` | PyInstaller 打包脚本 |
| `desktop/app/config.py` | 配置管理 |
| `desktop/app/database.py` | 同步数据库引擎 |
| `desktop/app/models.py` | ORM 模型 |
| `desktop/app/core/llm_client.py` | 同步 LLM 客户端 |
| `desktop/app/core/errors.py` | 错误码 |
| `desktop/app/core/logging_config.py` | 日志配置 |
| `desktop/app/core/preset_data.py` | 预设数据 |
| `desktop/app/services/short_story.py` | 核心业务服务 |
| `desktop/app/services/category_service.py` | 分类服务 |
| `desktop/app/services/hook_generation_service.py` | 爽点生成 |
| `desktop/app/services/integration_fix_service.py` | 整合修复 |
| `desktop/app/schemas/__init__.py` | Pydantic Schema |
| `desktop/app/scripts/seed_presets.py` | 预设初始化 |
| `desktop/app/gui/*.py` | 所有 GUI 文件 |
| `desktop/app/resources/styles/light_theme.qss` | 主题样式 |

### 6.2 删除/废弃

| 路径 | 说明 |
|---|---|
| `frontend/` | 整个目录删除 |
| `backend/app/api/` | FastAPI 路由，不再需要 |
| `backend/app/main.py` | FastAPI 入口，不再需要 |

### 6.3 保留（参考）

| 路径 | 说明 |
|---|---|
| `backend/` | 保留原有代码作为参考 |
| `data/` | 共用数据目录 |
| `README.md` | 更新文档 |

---

## 7. 实施顺序

1. **基础设施层** — 配置、数据库、模型、错误码
2. **核心层** — LLM 客户端（同步 + 流式）、预设数据、日志
3. **服务层** — 逐个服务改为同步（按依赖顺序）
4. **GUI 框架** — 主窗口、向导窗口、步骤指示器
5. **GUI 页面** — 首页 → Step 1~7 逐个实现
6. **GUI 组件** — 加载动画、流式文本、小说卡片
7. **对话框** — 设置、新建小说
8. **主题样式** — QSS 样式表
9. **打包** — PyInstaller 配置与测试

---

## 8. 风险与注意事项

1. **同步转换风险**：原有大量 async/await 代码，转换时需要仔细处理每个 `await` 点
2. **流式输出线程安全**：Qt 信号从工作线程 emit 到主线程，需要确保线程安全
3. **数据库连接**：SQLite 默认不支持多线程写入，需要在服务层加锁或使用单连接
4. **PyInstaller 打包**：PySide6 打包体积较大（约 80-120MB），需要测试
5. **LLM 超时**：单章生成可能需要 1-2 分钟，需要合理的超时设置和进度提示
