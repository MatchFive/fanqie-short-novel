# Fanqie Short Novel

> AI 辅助短篇小说创作工具 — 纯本地运行，一键安装使用

基于 [Novel Create](https://github.com/MatchFive/novel_creator) 项目拆分，专注于短篇小说（适合番茄小说等平台）的 AI 辅助创作。

## ✨ 特性

- **纯本地运行** — SQLite 数据库，无需安装 PostgreSQL / Neo4j / Redis
- **7步创作流程** — 分类标签 → 核心爽点 → 基础方案 → 详细规划 → 章节拆分 → 逐章写作 → 全文整合
- **多种 AI 模型支持** — 兼容任何 OpenAI 格式 API（DeepSeek / 通义千问 / 智谱 / Ollama 等）
- **爽点库** — 内置 50+ 预设爽点，覆盖 10 个分类
- **一键生成** — 配置好标签后，支持一键生成全部章节
- **开篇钩子** — AI 生成多个开篇方案供选择
- **整合修复** — 自动检测并修复伏笔、人物、逻辑等问题
- **番外章** — 支持添加背景、动机、后续等番外内容
- **打包为 .exe** — 最终交付为 Windows 可执行文件

## 🚀 快速开始

### 前置要求

- Python 3.12+
- （可选）Node.js 18+ — 仅开发前端时需要

### 安装与运行

```bash
# 1. 克隆项目
git clone git@github.com:MatchFive/fanqie-short-novel.git
cd fanqie-short-novel

# 2. 创建虚拟环境
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置环境变量
cp ../.env.example ../.env
# 编辑 .env，填入你的 API Key

# 5. 启动后端
uvicorn app.main:app --reload --port 8001

# 6. 访问 API 文档
# http://localhost:8001/docs
```

### 环境变量配置

只需配置以下变量即可使用：

```env
# LLM 模型配置（必填）
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-your-api-key-here
LLM_MODEL=deepseek-v4-flash
```

支持所有 OpenAI 兼容的 API：

| 提供商 | LLM_BASE_URL | LLM_MODEL 示例 |
|--------|-------------|---------------|
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` |

## 📋 API 概览

启动后端后，访问 `http://localhost:8001/docs` 查看完整 Swagger 文档。

### 核心端点

```
POST   /api/v1/short-stories/novels                  创建小说
GET    /api/v1/short-stories/novels                  小说列表
GET    /api/v1/short-stories/{novel_id}/progress     步骤进度
POST   /api/v1/short-stories/{novel_id}/categories   配置分类标签
POST   /api/v1/short-stories/{novel_id}/hooks/generate  生成爽点
POST   /api/v1/short-stories/{novel_id}/generate-plans  生成方案
POST   /api/v1/short-stories/{novel_id}/generate-detail  详细规划
POST   /api/v1/short-stories/{novel_id}/generate-chapters  章节拆分
POST   /api/v1/short-stories/{novel_id}/chapters/{n}/generate  生成章节
POST   /api/v1/short-stories/{novel_id}/integrate    全文整合
GET    /api/v1/short-stories/{novel_id}/export       导出小说
```

## 📁 项目结构

```
fanqie-short-novel/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI 入口
│       ├── config.py        # 配置管理
│       ├── database.py      # SQLite 异步引擎
│       ├── models.py        # ORM 模型
│       ├── api/
│       │   └── short_story.py  # API 路由
│       ├── core/
│       │   ├── errors.py         # 错误码
│       │   ├── llm_client.py     # LLM 客户端
│       │   ├── preset_data.py    # 预设数据
│       │   └── logging_config.py # 日志
│       ├── services/
│       │   ├── short_story.py           # 核心业务
│       │   ├── category_service.py      # 分类服务
│       │   ├── hook_generation_service.py  # 爽点生成
│       │   └── integration_fix_service.py  # 修复服务
│       └── schemas/
│           └── __init__.py  # Pydantic 模型
├── data/
│   ├── 番茄短篇分类.json     # 分类标签数据
│   └── fanqie_short_novel.db # SQLite 数据库（自动创建）
├── .env.example
└── README.md
```

## 🔧 开发

```bash
cd backend
pip install -r requirements.txt

# 开发模式（自动重载）
uvicorn app.main:app --reload --port 8001

# 运行测试
pytest tests/ -v
```

## 📦 打包为 .exe

```bash
pip install pyinstaller
cd backend

# 打包
pyinstaller --onefile \
  --name fanqie-short-novel \
  --add-data "../data:data" \
  --hidden-import aiosqlite \
  --hidden-import pydantic_settings \
  app/main.py
```

## 📄 License

MIT

## 🙏 致谢

本项目从 [Novel Create](https://github.com/MatchFive/novel_creator) 拆分而来，感谢原项目的贡献。
