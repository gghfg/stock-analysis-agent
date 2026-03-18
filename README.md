<div align="center">
  <h1>📈 STOCK-ANALYSIS-AGENT</h1>
  <p>股票代码 → 深度研报</p>
</div>

面向"股票代码 → 深度研报"场景的多 Agent 并行分析应用。输入任意股票代码（A 股/港股/美股）后，系统会获取股票实时数据、K 线数据、新闻事件，并调用 4 个专业 Agent 并发分析，最终输出结构化 Markdown 报告和 HTML 可视化报告。

## ⚡ 项目概述

这个项目把"股票代码"自动转换为"可执行的投资分析研报"。  
适用于个股深度研究、投资决策辅助、投研报告生成等场景。

## ✅ 核心功能

- **4 Agent 并行分析**
  - 📊 股票简介与板块分析 Agent
  - 📉 K 线图与技术分析 Agent
  - 📰 近期大事与新闻调查 Agent
  - 🔮 走向预期与投资策略 Agent

- **实时数据获取**
  - 股票实时行情（价格、涨跌幅、成交量）
  - K 线历史数据（日 K 线）
  - 财经新闻与公告

- **灵活配置**
  - 支持三档生成：`fast` / `standard` / `deep`
  - 支持统一配置与分阶段配置
  - 支持多模型供应商：OpenAI / SiliconFlow / DeepSeek / 阿里百炼

- **报告输出**
  - Markdown 格式研报
  - HTML 可视化报告
  - 历史记录保存

- **多语言**
  - 支持中英文一键切换

## 🚀 快速开始

### 1. 安装依赖

```bash
cd Stock-Analysis-Agent
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
# 默认使用阿里百炼（推荐）
BAILIAN_API_KEY=sk-xxx
BAILIAN_MODEL=qwen-plus

# 或使用 OpenAI
# OPENAI_API_KEY=sk-xxx
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini

# 或使用 DeepSeek
# DEEPSEEK_API_KEY=sk-xxx
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat

# 或使用 SiliconFlow
# SILICONFLOW_API_KEY=xxx
# SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3

# 报告配置
REPORT_MIN_CHARS=8000
REPORT_MAX_TOKENS=8192
```

### 3. 启动开发环境

```bash
npx next dev -p 3000
```

访问地址：`http://localhost:3000`

### 4. 生产部署

```bash
npm install
npm run build
npx next start -p 3000
```

## 📁 项目结构

```
Stock-Analysis-Agent/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # 核心 API（多 Agent 并行）
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # 主页面
├── lib/
│   └── report-prompts.ts         # Agent Prompt 定义
├── analysis-history/             # 历史报告存储
├── package.json
└── README.md
```

## 🔀 多 Agent 并行架构

```
用户输入股票代码
       │
       ▼
┌──────────────────┐
│  获取股票数据     │
│  - 实时行情       │
│  - K 线数据       │
│  - 新闻事件       │
└──────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         4 Agent 并行分析 (Promise.all) │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │ 股票简介 │ │ K 线分析 │ │ 新闻调查 │ │ 走向预期 │ │
│  │  Agent  │ │  Agent  │ │  Agent  │ │  Agent  │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  合成最终报告     │
│  - 覆盖修复       │
│  - 质量评估       │
│  - HTML 生成      │
└──────────────────┘
```

## 📊 支持股票类型

| 市场 | 代码格式 | 示例 |
|------|---------|------|
| 沪市 A 股 | 6 位数字 或 `sh`+6 位 | `600519`, `sh600519` |
| 深市 A 股 | 6 位数字 或 `sz`+6 位 | `000858`, `sz000858` |
| 创业板 | 6 位数字 | `300750` |
| 科创板 | 6 位数字 | `688001` |

**数据源：**
- 新浪财经（主）- 实时行情
- 东方财富（备）- 实时行情 + K 线数据 + 新闻

## 🔧 API 配置说明

### 生成模式

| 模式 | 说明 | 耗时 | 字数 |
|------|------|------|------|
| `fast` | 快速版，不做修复扩展 | ~60 秒 | ~5000 字 |
| `standard` | 标准版，含修复扩展 | ~120 秒 | ~8000 字 |
| `deep` | 深度版，完整质量控制 | ~180 秒 | ~10000 字 |

### 模型路由

支持为每个 Agent 单独配置模型：

```json
{
  "modelRouting": {
    "agentModels": {
      "stockInfo": "gpt-4o",
      "klineAnalysis": "qwen-max",
      "newsEvents": "deepseek-chat",
      "trendForecast": "gpt-4o"
    }
  }
}
```

## 📄 输出报告结构

```markdown
# [股票名称] ([代码]) - 股票分析报告

## 摘要
...

## 一、股票简介与板块分析
- 公司简介
- 行业定位
- 商业模式
- 同业对比

## 二、K 线图与技术分析
- 价格走势
- 均线系统
- 技术指标
- 支撑/阻力位

## 三、近期大事与新闻调查
- 重大新闻
- 高管增减持
- 财报解读
- 机构评级

## 四、走向预期与投资策略
- 短期预期
- 中期预期
- 利好/利空因素
- 投资建议
```

## ⚠️ 免责声明

- 本报告由 AI 自动生成，仅供参考
- 不构成任何投资建议或推荐
- 股市有风险，投资需谨慎
- 请结合专业顾问意见进行决策

## 📄 开源协议

GPL-3.0

## 🔭 未来计划

- [ ] K 线图可视化（Chart.js / TradingView）
- [ ] 更多数据源（东方财富、同花顺）
- [ ] 财务数据深度分析
- [ ] 机构持仓追踪
- [ ] 批量股票对比分析
