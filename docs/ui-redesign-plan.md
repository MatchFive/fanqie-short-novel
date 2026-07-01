# UI 重新设计规划：番茄小说 AI 创作助手

> 设计日期：2026-07-01
> 设计目标：在保持现有功能不变的前提下，优化视觉体验，建立统一的设计语言
> 当前风格：Lovart（极简黑白灰 / 零圆角 / 零阴影）
> 目标风格：**文学温润风 (Literary Warmth)**

---

## 一、设计分析

### 1.1 现有设计回顾

| 维度 | 当前状态 | 评价 |
|------|----------|------|
| 色彩 | 纯黑白灰 (HSL 0 0% X%) | ✅ 极简统一 ❌ 长时间写作刺眼 |
| 圆角 | `border-radius: 0 !important` | ✅ 几何感强 ❌ 冰冷、缺乏亲和力 |
| 阴影 | `box-shadow: none !important` | ✅ 无视觉噪音 ❌ 层次扁平、无深度感 |
| 字体 | Inter + PingFang SC / YaHei | ✅ 可读性良好 |
| 间距 | 8px 基准网格 | ✅ 合理 |
| 主题 | 支持亮/暗切换 | ✅ 已连通 |
| 唯一彩色 | 状态色 (绿 #16A34A / 橙 #D97706) + Trending NEW 红 | ⚠️ 与 B&W 体系不成体系 |

### 1.2 目标用户画像

- **身份**：在番茄小说等平台创作的短篇小说写作者
- **场景**：桌面端长时间写作（单次 1-4 小时）
- **需求**：AI 辅助构思 → 快速产出 → 保持专注
- **痛点**：纯白界面长时间使用导致视觉疲劳，零装饰风格缺乏创作温度

### 1.3 设计目标

| # | 目标 | 说明 |
|---|------|------|
| 1 | **降低视觉疲劳** | 暖色底替代纯白，适合长时间写作 |
| 2 | **建立品牌识别** | 融入番茄小说品牌基因（暖橙/红色调） |
| 3 | **增加深度层次** | 微妙圆角 + 轻微阴影区分元素层级 |
| 4 | **保持极简理念** | 不引入装饰性元素，不破坏专注感 |
| 5 | **功能零改动** | 所有页面布局、交互逻辑保持不变 |
| 6 | **暗色模式同步** | 亮/暗双模均体现温润感 |

---

## 二、设计方向

### Style: Literary Warmth（文学温润风）

```
个性关键词:  温润 · 专注 · 书卷气
核心比喻:    深夜书桌前，一盏暖灯下的稿纸
```

**选型理由**：

| 风格候选 | 适合度 | 理由 |
|----------|--------|------|
| Modern Professional | ⭐⭐⭐ | 干净但太"企业化"，缺少创作温度 |
| Warm Organic | ⭐⭐⭐⭐ | 温暖有机，但可能过于"田园" |
| Dark Premium | ⭐⭐ | 开发者工具风格，不适合文学创作 |
| Playful Product | ⭐⭐ | 过于活泼，分散写作注意力 |
| **Literary Warmth** ✅ | ⭐⭐⭐⭐⭐ | 在极简基础上增加温润感，保留专注力，融入品牌基因 |

### 设计原则

1. **少即是多** — 不添加装饰元素，只在现有基础上"软化"
2. **纸张质感** — 背景像旧书页，不是手术台
3. **品牌自然融入** — 暖橙色调作为功能性强调色，不喧宾夺主
4. **层次渐进** — 用微妙的圆角/阴影区分信息层级
5. **移动不优先** — 桌面端写作工具，以 1280px+ 为基准设计

---

## 三、色彩系统

### 3.1 亮色模式：「晨曦书房」

| Token | HSL 值 | 色值 | 用途 |
|-------|--------|------|------|
| `--background` | `30 15% 98%` | `#FAF7F4` | 页面底色（暖白，如旧纸） |
| `--foreground` | `30 15% 8%` | `#1A1512` | 主文字（暖黑） |
| `--card` | `30 20% 100%` | `#FFFFFF` | 卡片/面板表面 |
| `--card-foreground` | `30 15% 8%` | `#1A1512` | 卡片文字 |
| `--primary` | `22 82% 48%` | `#DE6B1C` | 主操作色（暖橙，品牌色） |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | 主色上的文字 |
| `--secondary` | `30 10% 94%` | `#F2EEE9` | 次级背景（暖灰） |
| `--secondary-foreground` | `30 10% 18%` | `#2F2A26` | 次级文字 |
| `--muted` | `30 8% 94%` | `#F1EDE9` | 弱化背景 |
| `--muted-foreground` | `30 5% 46%` | `#7A736D` | 弱化文字（暖灰） |
| `--accent` | `22 30% 94%` | `#F5EDE5` | 强调背景 |
| `--accent-foreground` | `22 70% 35%` | `#B85A14` | 强调文字 |
| `--border` | `30 8% 86%` | `#DFD9D2` | 边框 |
| `--input` | `30 8% 86%` | `#DFD9D2` | 输入框边框 |
| `--ring` | `22 82% 48%` | `#DE6B1C` | 聚焦环（同 primary） |
| `--destructive` | `0 72% 48%` | `#DC2626` | 危险操作 |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | 危险操作文字 |
| `--radius` | - | `0.375rem` | 全局圆角 (6px) |

**语义色彩**（保持功能色，但统一色调）：

| 用途 | 色值 | HSL |
|------|------|-----|
| 成功/已完成 | `#16A34A` | `142 76% 36%` |
| 警告/进行中 | `#D97706` | `32 95% 44%` |
| 错误/删除 | `#DC2626` | `0 72% 48%` |

### 3.2 暗色模式：「夜灯书案」

| Token | HSL 值 | 色值 | 用途 |
|-------|--------|------|------|
| `--background` | `30 8% 6%` | `#100E0C` | 页面底色（暖黑） |
| `--foreground` | `30 12% 92%` | `#EEEAE5` | 主文字 |
| `--card` | `30 6% 9%` | `#1A1815` | 卡片表面 |
| `--card-foreground` | `30 12% 92%` | `#EEEAE5` | 卡片文字 |
| `--primary` | `25 85% 55%` | `#ED7D26` | 主操作色（暗色下稍亮） |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | 主色上的文字 |
| `--secondary` | `30 6% 14%` | `#262320` | 次级背景 |
| `--secondary-foreground` | `30 10% 85%` | `#DED8D0` | 次级文字 |
| `--muted` | `30 6% 14%` | `#262320` | 弱化背景 |
| `--muted-foreground` | `30 5% 55%` | `#8F8981` | 弱化文字 |
| `--accent` | `25 15% 18%` | `#302923` | 强调背景 |
| `--accent-foreground` | `25 70% 60%` | `#E8944D` | 强调文字 |
| `--border` | `30 5% 20%` | `#35312E` | 边框 |
| `--input` | `30 5% 20%` | `#35312E` | 输入框边框 |
| `--ring` | `25 85% 55%` | `#ED7D26` | 聚焦环 |

---

## 四、排版系统

### 4.1 字体

| 用途 | 字体栈 | 备注 |
|------|--------|------|
| UI 正文 | Inter → -apple-system → PingFang SC → Microsoft YaHei | 保持不变 |
| 等宽 | JetBrains Mono → SF Mono → Fira Code | 代码/编辑器区 |
| 写作区（可选） | 思源宋体 / Noto Serif SC → STSong → SimSun | 未来阶段：阅读/预览模式 |

### 4.2 字号阶梯

| 层级 | 大小 | 行高 | 用途 |
|------|------|------|------|
| H1 | `20px` (1.25rem) | 1.4 | 页面大标题 |
| H2 | `16px` (1rem) | 1.5 | 区块标题 |
| Body | `14px` (0.875rem) | 1.6 | 正文/卡片内容 |
| Small | `13px` (0.8125rem) | 1.5 | 导航/标签 |
| Caption | `11px` (0.6875rem) | 1.4 | 辅助说明/面包屑 |

### 4.3 字重

| 等级 | 值 | 用途 |
|------|-----|------|
| Regular | `400` | 正文 |
| Medium | `500` | 强调文字/标签 |
| Semibold | `600` | 标题/按钮 |
| Bold | `700` | 页面主标题 |

---

## 五、间距系统

延续 8px 基准网格，微调部分间距以匹配新圆角/阴影的视觉节奏。

```
4px   — 图标内边距、紧凑间距
8px   — 组件内元素间距
12px  — 按钮内边距、表单项间距
16px  — 卡片内边距、标准间距
20px  — 区块内间距
24px  — 区块间距
32px  — 大区块间距
40px  — 页面分区
48px  — 主区块分隔
```

### 关键页面间距调整

| 区域 | 当前 | 建议 | 理由 |
|------|------|------|------|
| 侧边栏宽度 | `220px` | `224px` | 匹配 8px 网格 |
| 页面内容内边距 | `p-6` (24px) | `p-8` (32px) | 更宽松，适合长时间写作 |
| 卡片间距 | `gap-4` (16px) | `gap-4` (16px) | 保持不变 |
| 卡片内边距 | `p-4` (16px) | `p-5` (20px) | 略微增加呼吸感 |

---

## 六、组件设计规范

### 6.1 圆角 (Border Radius)

| 元素 | 当前 | 建议 | 值 |
|------|------|------|-----|
| 全局 `--radius` | `0rem` | `0.375rem` | `6px` |
| 按钮 | `0` | `6px` (rounded-md) | 继承 `--radius` |
| 卡片/面板 | `0` | `6px` (rounded-md) | 继承 `--radius` |
| 输入框 | `0` | `6px` | 继承 `--radius` |
| 对话框 | `0` | `8px` (rounded-lg) | `--radius + 2px` |
| 布局容器 | `0` | `0` | 保持直角，维持结构感 |
| 进度条 | 4px | `3px` (rounded-sm) | `--radius - 2px` |
| Badge/标签 | `0` | `4px` (rounded-sm) | 轻微圆角 |

### 6.2 阴影 (Box Shadow)

极克制地使用阴影——仅用于需要区分层级的浮层元素。

| 层级 | 使用场景 | Shadow 值 |
|------|----------|-----------|
| 0 | 页面内容、卡片 | `none` |
| 1 | Hover 态卡片 | `0 1px 3px rgba(26,21,18,0.06)` |
| 2 | 下拉菜单、Popup | `0 2px 8px rgba(26,21,18,0.08)` |
| 3 | 对话框/Modal | `0 4px 16px rgba(26,21,18,0.10)` |
| 4 | Toast | `0 4px 12px rgba(26,21,18,0.12)` |

**关键原则**：阴影颜色使用 `--foreground` 的 RGB 值，确保亮/暗模式自动适配。

### 6.3 按钮

| 变体 | 背景 | 文字 | 边框 | Hover |
|------|------|------|------|-------|
| Primary | `bg-primary` | `text-primary-foreground` | 无 | `brightness(1.1)` |
| Secondary | `bg-secondary` | `text-secondary-foreground` | 无 | `brightness(0.97)` |
| Outline | 透明 | `text-foreground` | `border-border` | `bg-secondary` |
| Ghost | 透明 | `text-muted-foreground` | 无 | `text-foreground bg-secondary` |
| Destructive | `bg-destructive` | `text-destructive-foreground` | 无 | `brightness(1.1)` |

**尺寸**：
- 标准：`h-10` (40px)，`px-4`
- 紧凑：`h-8` (32px)，`px-3`
- 大号：`h-11` (44px)，`px-6`

### 6.4 输入框

```
height: 40px (h-10)
padding-x: 12px (px-3)
padding-y: 8px
border: 1px solid var(--border)
background: var(--background)
border-radius: 6px (rounded-md)

focus:
  border-color: var(--ring)
  box-shadow: 0 0 0 1px var(--ring)
  (替代默认的 ring-2，更克制)

error:
  border-color: var(--destructive)
placeholder:
  color: var(--muted-foreground), opacity 0.6
```

### 6.5 卡片（作品卡片）

```
background: var(--card)
border: 1px solid var(--border)
border-radius: 6px
box-shadow: none (default)

hover:
  border-color: var(--primary) / 30% opacity
  box-shadow: 0 1px 3px rgba(26,21,18,0.06)
  transition: 150ms ease

左侧状态色条：
  width: 3px → 4px
  border-radius: 4px 0 0 4px (左侧圆角，融入卡片)
```

### 6.6 导航侧边栏

```
宽度: 224px (匹配 8px 网格)
背景: var(--secondary)
边框: right 1px solid var(--border)

步骤项:
  height: 44px (min-h 保持 WCAG 标准)
  padding: 8px 12px
  border-radius: 6px (仅步骤项有圆角)
  margin-bottom: 2px

  default: text-muted-foreground
  active: bg-primary text-primary-foreground
  done: text-foreground
  hover (非active): bg-muted

步骤序号/勾选标记:
  width: 20px, height: 20px
  border: 1px solid currentColor
  border-radius: 4px
```

### 6.7 顶栏 (Header)

```
高度: 40px (h-10) → 保持不变
背景: var(--secondary)
底边框: 1px solid var(--border)

品牌名: font-bold, 13px
操作图标: 16px (w-4 h-4), hover 变色
```

### 6.8 进度条

```
容器:
  height: 6px
  background: var(--muted)
  border-radius: 3px

填充:
  background: var(--primary)
  border-radius: 3px
  transition: width 300ms ease-out

状态色变体:
  已完成: bg-[#16A34A]
  进行中: bg-primary
  草稿: bg-border
```

### 6.9 状态标签 (Badge)

```
padding: 2px 8px
font-size: 11px
border-radius: 4px
border: 1px solid

已完成: text-[#16A34A] border-[#16A34A]/40 bg-[#16A34A]/8
创作中: text-primary border-primary/40 bg-primary/8
草稿:   text-muted-foreground border-border bg-muted
```

### 6.10 对话框 (Dialog/Modal)

```
background: var(--background)
border: 1px solid var(--border)
border-radius: 8px (rounded-lg)
box-shadow: 0 4px 16px rgba(26,21,18,0.10)
max-width: 480px
padding: 24px

遮罩:
  background: rgba(26,21,18,0.3)
  backdrop-filter: blur(2px)
```

---

## 七、页面级设计调整

### 7.1 首页仪表盘 (`/`)

**统计卡片** → 保持 4 列网格，增加微妙圆角和浅色强调背景：

```
当前: border border-border p-2 bg-background
建议: border border-border rounded-md p-3 bg-card

数字: text-[18px] font-bold → 保持不变
标签: text-[10px] text-muted-foreground
hover: border-color → primary/20
```

**创作入口卡片** → 增加圆角和阴影：

```
当前: border border-border p-4
建议: border border-border rounded-md p-5 bg-card
      hover:shadow-sm hover:border-primary/30 transition-all
```

**作品卡片** → 保持 3 列网格，调整卡片样式：

```
标题: font-semibold text-[15px] → 保持不变
元信息: text-xs, 增加行间距
进度条: 使用新 primary 色
删除按钮: 保持 hover 出现
左侧色条: width 4px, 圆角融入卡片
```

**NEW 标签** (Trending 入口) → 使用 primary 色替代硬编码的 `#DC2626`：

```
当前: bg-[#DC2626]
建议: bg-primary rounded-sm text-[10px] font-bold text-primary-foreground
```

### 7.2 创作工作台 (StudioLayout)

**侧边栏** → 步骤项增加圆角：

```
当前: 直角矩形
建议: rounded-md (6px), active 态使用 primary 色填充
步骤数字框: rounded-sm (4px)
```

**面包屑** → 保持不变，仅 `<` 分隔符颜色使用 muted-foreground/40

**内容区** → 增加水平内边距：

```
当前: p-6 (24px)
建议: px-8 py-6 (水平 32px, 垂直 24px)
```

### 7.3 写作工作台 (`/write`)

**三栏布局** → 保持结构：

```
左侧章节列表: 宽度 240px, bg-secondary
中间编辑器: flex-1
右侧上下文面板: 宽度 280px, bg-secondary
```

**编辑器区域**：

```
textarea:
  font-size: 15px (方便长时间阅读)
  line-height: 1.8
  padding: 24px
  background: var(--card)
  border: 1px solid var(--border)
  border-radius: 6px
  focus: border-primary ring-1 ring-primary
```

**章节列表项**：

```
height: 44px
border-radius: 6px
margin-bottom: 2px

active: bg-primary text-primary-foreground
done: text-foreground
```

### 7.4 紧跟时事 (`/trending`)

保持垂直堆叠布局，调整热点条目标签：

```
标签颜色: 统一使用 primary 色系
分析结果区域: 保持现有结构
```

---

## 八、动画与过渡

### 8.1 过渡时间

| 类型 | 时长 | 缓动 | 用途 |
|------|------|------|------|
| 微交互 | `150ms` | `ease-out` | 按钮 hover、图标变色 |
| 标准 | `200ms` | `ease-out` | 卡片 hover、输入框 focus |
| 入场 | `300ms` | `ease-out` | 对话框、Toast |
| 进度 | `400ms` | `ease-out` | 进度条、骨架屏 |

### 8.2 关键动画

```
按钮 hover:  background 150ms
卡片 hover:  border-color + shadow 200ms
输入 focus:  border + ring 150ms
导航 active:  background 150ms
对话框入场:  opacity 0→1 + scale 0.97→1, 200ms
Toast 入场:   translateY(8px)→0 + opacity 0→1, 300ms
页面切换:     无动画 (桌面工具，瞬时响应优先)
```

---

## 九、实施计划

### Phase 1：主题系统改造（影响全局）

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 更新 CSS 变量 (亮/暗) | `index.css` | 🟢 低 |
| 移除 `border-radius: 0 !important` | `index.css` | 🟢 低 |
| 移除 `box-shadow: none !important` | `index.css` | 🟢 低 |
| 更新 `--radius: 0.375rem` | `index.css` | 🟢 低 |
| 更新 tailwind 颜色引用 | `tailwind.config.js` | 🟢 低 |

### Phase 2：组件适配（按影响面排序）

| 任务 | 文件 | 工作量 |
|------|------|--------|
| Sidebar 步骤导航 | `StudioLayout.tsx` | 🟡 中 |
| Header 顶栏 | `HomeLayout.tsx`, `StudioLayout.tsx` | 🟢 低 |
| 按钮全局样式 | `components/ui/button.tsx` | 🟢 低 |
| 输入框全局样式 | `components/ui/input.tsx` | 🟢 低 |
| Dialog 样式 | `components/ui/dialog.tsx` | 🟢 低 |

### Phase 3：页面微调

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 首页仪表盘 | `HomePage.tsx` | 🟡 中 |
| 紧跟时事页 | `TrendingPage.tsx` | 🟢 低 |
| 写作工作台 | `WritePage.tsx` | 🟡 中 |
| 其余 5 个创作步骤页 | 各 Step 页面 | 🟢 低 |
| 设置/导出 Dialog | `SettingsDialog.tsx`, `ExportDialog.tsx` | 🟢 低 |

### Phase 4：细节打磨（可选）

| 任务 | 说明 |
|------|------|
| 写作区预览模式用衬线体 | `Noto Serif SC` 用于阅读模式 |
| Focus 模式 | 隐藏侧边栏和顶栏，全屏编辑器 |
| 微交互 | 字数达成目标时的颜色变化 |

---

## 十、对比一览

| 维度 | 当前 (Lovart) | 目标 (Literary Warmth) |
|------|---------------|------------------------|
| 底色 | 纯白 `#FFFFFF` | 暖白 `#FAF7F4` |
| 主文字 | 纯黑 `#000000` | 暖黑 `#1A1512` |
| 强调色 | **无**（全黑白） | 暖橙 `#DE6B1C` |
| 圆角 | 全部 `0` | 组件 `6px`，布局 `0` |
| 阴影 | 全部 `none` | 浮层才有，极克制 |
| 暗色底色 | 纯黑 `#000000` | 暖黑 `#100E0C` |
| 暗色表面 | `#262626` | `#1A1815` |
| 品牌感 | 无 | 暖橙色唤起"番茄"联想 |
| 写作疲劳度 | 较高（纯白刺眼） | 降低（暖色柔和） |
| 层级清晰度 | 依赖边框 | 边框 + 微妙阴影 |

---

## 十一、风险与回退

| 风险 | 缓解措施 |
|------|----------|
| 暖色底在部分显示器显"脏" | 保持低饱和度 (8-15%)，肉眼几乎感知不到色相 |
| 圆角破坏现有几何感 | 仅 6px（几乎不可见），并保留布局容器直角 |
| 阴影在暗色模式下显脏 | 使用 `foreground` RGB 值半透明，自动适配 |
| 改动影响面大 | 先改 CSS 变量（Phase 1），观察效果后再逐组件调整 |

### 回退方案

所有改动通过 CSS 变量控制，如需回退到 Lovart 风格，只需还原 `index.css` 中的变量值即可，组件代码无需改动。

---

## 附录 A：设计灵感参考

- **Notion** — 极简 + 微妙圆角 + 温暖中性色
- **iA Writer** — 专注写作工具，暖色背景选项
- **Apple Books** — 书页质感、暖色调阅读模式
- **Linear** — 现代专业工具的克制设计
- **番茄小说 App** — 品牌色（橙红）+ 暗色阅读模式

## 附录 B：CSS 变量对比

### 亮色模式

```css
/* 当前 */
--background: 0 0% 100%;        /* #FFFFFF */
--foreground: 0 0% 0%;          /* #000000 */
--primary: 0 0% 0%;             /* #000000 */
--secondary: 0 0% 96%;          /* #F5F5F5 */
--muted: 0 0% 96%;              /* #F5F5F5 */
--muted-foreground: 0 0% 45%;   /* #737373 */
--border: 0 0% 90%;             /* #E6E6E6 */

/* 目标 */
--background: 30 15% 98%;       /* #FAF7F4 — 暖白 */
--foreground: 30 15% 8%;        /* #1A1512 — 暖黑 */
--primary: 22 82% 48%;          /* #DE6B1C — 暖橙 */
--secondary: 30 10% 94%;        /* #F2EEE9 — 暖灰 */
--muted: 30 8% 94%;             /* #F1EDE9 */
--muted-foreground: 30 5% 46%;  /* #7A736D */
--border: 30 8% 86%;            /* #DFD9D2 */
```

### 暗色模式

```css
/* 当前 */
--background: 0 0% 0%;          /* #000000 */
--foreground: 0 0% 100%;        /* #FFFFFF */
--primary: 0 0% 100%;           /* #FFFFFF */
--secondary: 0 0% 15%;          /* #262626 */
--muted: 0 0% 15%;              /* #262626 */
--muted-foreground: 0 0% 65%;   /* #A6A6A6 */
--border: 0 0% 20%;             /* #333333 */

/* 目标 */
--background: 30 8% 6%;         /* #100E0C — 暖黑 */
--foreground: 30 12% 92%;       /* #EEEAE5 */
--primary: 25 85% 55%;          /* #ED7D26 */
--secondary: 30 6% 14%;         /* #262320 */
--muted: 30 6% 14%;             /* #262320 */
--muted-foreground: 30 5% 55%;  /* #8F8981 */
--border: 30 5% 20%;            /* #35312E */
```
