<p align="center">
  <img src="assets/app-icon.ico" width="80" alt="logo" />
</p>

<h1 align="center">Fanqie Short Novel</h1>
<p align="center">
  <em>AI 辅助短篇小说创作工具 — 纯本地运行，从灵感到完稿</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.12%2B-green" alt="Python" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-18%2B-brightgreen" alt="Node" /></a>
  <a href="https://github.com/MatchFive/fanqie-short-novel/releases"><img src="https://img.shields.io/badge/release-v0.1.0-orange" alt="Release" /></a>
  <a href="https://github.com/MatchFive/fanqie-short-novel"><img src="https://img.shields.io/github/stars/MatchFive/fanqie-short-novel?style=social" alt="Stars" /></a>
</p>

---

##  🎯 这是什么

专为**番茄小说**等短篇内容平台设计的 AI 创作助手。配置好你的 LLM API Key，就能在 7 步之内把灵感变成一篇完整的短篇小说——分类标签 → 爽点 → 大纲 → 逐章写作 → 全文整合，全程 AI 驱动，每一步都可视可控。

基于 [Novel Create](https://github.com/MatchFive/novel_creator) 拆分而来，专注于短篇内容的高效产出。

## ✨ 核心特性

<table>
<tr>
<td width="50%">

### 🧠 AI 创作管线
- **7 步标准化流程** — 分类标签 → 核心爽点 → 基础方案 → 详细规划 → 章节拆分 → 逐章写作 → 全文整合
- **多模型切换** — 兼容 OpenAI 格式 API，DeepSeek / 通义千问 / 智谱 / Ollama 任意切换
- **一键全流程** — 配置好标签后，一键生成全部章节

</td>
<td width="50%">

### 🎨 内容质量
- **内置爽点库** — 50+ 预设爽点覆盖 10 个分类，确保故事"有料"
- **开篇钩子** — AI 同时生成多个开篇方案，选择最吸引人的
- **整合修复** — 自动检测伏笔断裂、人物不一致、逻辑漏洞并修复
- **热点追踪** — 根据实时热点事件启发创作选题

</td>
</tr>
<tr>
<td width="50%">

### 🔒 本地优先
- **纯本地运行** — SQLite 存储，零外部依赖
- **数据自主可控** — 所有创作内容保存在本地，隐私安全

</td>
<td width="50%">

### 🎁 额外亮点
- **番外章节** — 支持角色背景、动机、后续等扩展内容
- **用户自定义标签** — 自定义分类持久化保存
- **一键 .exe 打包** — Windows 桌面版开箱即用

</td>
</tr>
</table>

## 📸 界面预览

<details>
<summary>点击展开截图（设计稿）</summary>
<br/>
<p align="center"><em>功能页面设计稿请查看 <code>designs/</code> 目录</em></p>
</details>

## 🚀 快速开始

### 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | ≥ 3.12 | 后端运行 |
| Node.js | ≥ 18 | 仅开发/构建前端时需要 |

### 3 步启动

```bash
# 1. 克隆 & 安装依赖
git clone git@github.com:MatchFive/fanqie-short-novel.git
cd fanqie-short-novel/backend
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # macOS / Linux
pip install -r requirements.txt

# 2. 配置 API Key
cp ../.env.example ../.env
# 编辑 .env，填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL

# 3. 启动
uvicorn app.main:app --reload --port 8001
# 浏览器打开 http://localhost:8001
```

### Windows 桌面版

如果你下载了 Release 中的 `.exe`，只需两步：

1. 在 `.exe` 同目录创建 `.env`，填入 API Key
2. 双击运行 → 浏览器自动打开

### 支持的 LLM 提供商

| 提供商 | `LLM_BASE_URL` | 模型示例 |
|--------|---------------|---------|
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Ollama (本地) | `http://localhost:11434/v1` | `qwen2.5:7b` |

## 📁 项目结构

```
fanqie-short-novel/
├── backend/app/
│   ├── main.py                  # FastAPI 入口
│   ├── config.py                # 环境变量配置
│   ├── database.py              # SQLite 异步引擎
│   ├── models.py                # SQLAlchemy ORM
│   ├── api/short_story.py       # REST API 路由
│   ├── core/
│   │   ├── errors.py            # 统一错误码
│   │   ├── llm_client.py        # LLM 调用封装
│   │   └── preset_data.py       # 内置爽点/分类数据
│   ├── services/                # 业务逻辑层
│   │   ├── short_story.py       # 核心创作流程
│   │   ├── category_service.py  # 分类标签管理
│   │   └── integration_fix_service.py  # 整合修复
│   └── schemas/                 # Pydantic 请求/响应模型
├── frontend/                    # React 19 + Tailwind CSS 4
│   └── src/pages/               # 各步骤页面组件
├── data/                        # 预设数据 & 运行时数据库
├── designs/                     # UI 设计稿
└── docs/                        # 设计文档 & 审计报告
```

## 🔧 开发

```bash
# 后端开发（热重载）
cd backend
uvicorn app.main:app --reload --port 8001

# 前端开发（热重载）
cd frontend
npm install
npm run dev

# API 文档
# http://localhost:8001/docs
```

### 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | FastAPI + Uvicorn |
| 数据库 | SQLite + aiosqlite |
| ORM | SQLAlchemy 2.0 (async) |
| 前端框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 构建工具 | Vite 6 |
| 桌面壳 | Electron 34 |

## 📦 打包

```bash
# Windows .exe
pip install pyinstaller
cd backend
pyinstaller --onefile \
  --name fanqie-short-novel \
  --add-data "../data:data" \
  --hidden-import aiosqlite \
  --hidden-import pydantic_settings \
  app/main.py
```

## 🤝 贡献

欢迎提交 Issue 和 PR！大改动请先开 Issue 讨论。

## 📄 License

[MIT](LICENSE)

## 🙏 致谢

本项目从 [Novel Create](https://github.com/MatchFive/novel_creator) 拆分而来，感谢原项目的贡献。
