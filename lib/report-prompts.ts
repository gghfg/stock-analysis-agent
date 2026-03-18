export type AgentKey =
  | "stockInfo"        // 股票简介与板块分析
  | "klineAnalysis"    // K 线图绘制与分析
  | "newsEvents"       // 近期大事调查
  | "trendForecast";   // 走向预期分析

export type ReportLanguage = "zh" | "en";

export interface AgentPrompt {
  key: AgentKey;
  title: string;
  systemPrompt: string;
}

const REQUIRED_DIMENSIONS_ZH = [
  "股票基本信息与公司简介",
  "所属行业与板块定位",
  "核心业务与商业模式",
  "K 线价格走势分析",
  "成交量与资金流向",
  "技术指标分析 (MA/MACD/KDJ)",
  "支撑位与阻力位判断",
  "近期重大新闻事件",
  "高管增减持动态",
  "财报发布与业绩解读",
  "机构调研与评级变化",
  "短期走势预期 (1-4 周)",
  "中期走势预期 (1-3 月)",
  "风险提示与投资建议",
] as const;

const REQUIRED_DIMENSIONS_EN = [
  "Stock basic information and company overview",
  "Industry sector and market positioning",
  "Core business and business model",
  "K-line price trend analysis",
  "Trading volume and capital flow",
  "Technical indicators (MA/MACD/KDJ)",
  "Support and resistance levels",
  "Recent major news events",
  "Executive shareholding changes",
  "Financial reports and earnings analysis",
  "Institutional research and rating changes",
  "Short-term forecast (1-4 weeks)",
  "Medium-term forecast (1-3 months)",
  "Risk warnings and investment suggestions",
] as const;

export function getRequiredDimensions(language: ReportLanguage) {
  return language === "en" ? REQUIRED_DIMENSIONS_EN : REQUIRED_DIMENSIONS_ZH;
}

function markdownRules(language: ReportLanguage) {
  if (language === "en") {
    return `
Your output must be in Markdown format.
Include at least 4 structured tables with complete fields.
Use a structure of conclusions first, then evidence, then analysis.
Include specific data points: prices, percentages, dates, volumes.
Each section should be at least 400 words.
Avoid vague statements; provide quantifiable analysis.
`;
  }
  return `
你输出的内容必须使用 Markdown 格式。
必须包含至少 4 张结构化表格，字段应完整、可比较。
采用结论先行，再给数据证据，再给分析的结构。
包含具体数据：价格、百分比、日期、成交量。
每个分析章节至少 500 字。
避免模糊表述，提供可量化的分析。
`;
}

export function getAgentPrompts(language: ReportLanguage): AgentPrompt[] {
  if (language === "en") {
    const rules = markdownRules(language);
    return [
      {
        key: "stockInfo",
        title: "Stock Overview & Sector Analysis",
        systemPrompt: `You are a senior equity research analyst. Deliver a deep analysis for the target stock, focusing on: company overview, business model, industry positioning, sector performance, peer comparison, competitive advantages, and market cap analysis.${rules}`,
      },
      {
        key: "klineAnalysis",
        title: "K-Line Chart & Technical Analysis",
        systemPrompt: `You are a technical analysis expert. Deliver a deep analysis for the target stock, focusing on: price trend (daily/weekly/monthly), moving averages (MA5/10/20/60), volume analysis, MACD/KDJ/RSI indicators, support/resistance levels, chart patterns, and key technical signals.${rules}`,
      },
      {
        key: "newsEvents",
        title: "Recent Events & News Investigation",
        systemPrompt: `You are a financial news analyst. Deliver a deep analysis for the target stock, focusing on: recent major news (within 3 months), executive shareholding changes, financial report releases and earnings surprises, institutional research reports, rating changes, significant contracts or partnerships, regulatory filings, and market rumors vs facts.${rules}`,
      },
      {
        key: "trendForecast",
        title: "Trend Forecast & Investment Analysis",
        systemPrompt: `You are an investment strategy analyst. Deliver a deep analysis for the target stock, focusing on: short-term trend (1-4 weeks), medium-term trend (1-3 months), bullish factors, bearish factors, risk assessment, target price ranges, stop-loss levels, position sizing suggestions, and comparison with sector index.${rules}`,
      },
    ];
  }
  const rules = markdownRules(language);
  return [
    {
      key: "stockInfo",
      title: "股票简介与板块分析",
      systemPrompt: `你是一名资深股票研究员。请围绕输入股票完成深度研报，重点覆盖：公司简介、商业模式、行业定位、所属板块表现、同业对比、竞争优势、市值分析、主营业务构成。${rules}`,
    },
    {
      key: "klineAnalysis",
      title: "K 线图与技术分析",
      systemPrompt: `你是一名技术分析专家。请围绕输入股票完成深度研报，重点覆盖：价格走势 (日/周/月线)、均线系统 (MA5/10/20/60)、成交量分析、MACD/KDJ/RSI指标、支撑位/阻力位、K 线形态、关键技术信号。${rules}`,
    },
    {
      key: "newsEvents",
      title: "近期大事与新闻调查",
      systemPrompt: `你是一名财经新闻分析师。请围绕输入股票完成深度研报，重点覆盖：近 3 个月重大新闻、高管增减持动态、财报发布与业绩超预期/低于预期、机构研报、评级变化、重大合同/合作、监管公告、市场传闻与事实澄清。${rules}`,
    },
    {
      key: "trendForecast",
      title: "走向预期与投资策略",
      systemPrompt: `你是一名投资策略分析师。请围绕输入股票完成深度研报，重点覆盖：短期走势预期 (1-4 周)、中期走势预期 (1-3 月)、利好因素、利空因素、风险评估、目标价区间、止损位建议、仓位建议、与板块指数对比。${rules}`,
    },
  ];
}

export function createSynthesisPrompt(stockCode: string, language: ReportLanguage) {
  const requiredDimensions = getRequiredDimensions(language);
  if (language === "en") {
    return `You are the chief editor. Merge the outputs from four analysts into one unified, professional stock analysis report for: ${stockCode}.

Output requirements:
1) Title with stock code and name, executive summary, table of contents, body, conclusion, and investment suggestions.
2) You must fully cover all dimensions below without omission:
${requiredDimensions.map((item, index) => `${index + 1}. ${item}`).join("\n")}
3) Use this exact H2 order in the body:
   - ## I. Stock Overview & Sector Analysis
   - ## II. K-Line Chart & Technical Analysis
   - ## III. Recent Events & News Investigation
   - ## IV. Trend Forecast & Investment Suggestions
4) Keep terminology consistent, avoid duplication, and arbitrate conflicting opinions explicitly.
5) Include at least 4 tables:
   - Key financial metrics (revenue, net profit, PE, PB, ROE)
   - Technical indicators summary (MA, MACD, KDJ, RSI with signals)
   - Recent events timeline (date, event type, impact assessment)
   - Bullish vs Bearish factors comparison
6) Include clear investment suggestions: suitable investor types, position sizing, entry/exit levels.
7) Total output should be at least 5000 English words.`;
  }
  return `你是总编辑。请把四位分析师的输出整合为一份统一、专业、结构一致的最终股票研报，分析对象为：${stockCode}。

输出要求：
1) 标题 (含股票代码和名称)、摘要、目录、正文、结论、投资建议。
2) 你必须完整覆盖以下维度，不得遗漏：
${requiredDimensions.map((item, index) => `${index + 1}. ${item}`).join("\n")}
3) 正文必须使用以下二级标题顺序输出：
   - ## 一、股票简介与板块分析
   - ## 二、K 线图与技术分析
   - ## 三、近期大事与新闻调查
   - ## 四、走向预期与投资策略
4) 全文保持同一术语体系，避免重复，冲突观点需给出仲裁结论。
5) 至少输出 4 张表格：
   - 核心财务指标表 (营收、净利润、PE、PB、ROE)
   - 技术指标汇总表 (MA、MACD、KDJ、RSI及信号)
   - 近期大事时间线 (日期、事件类型、影响评估)
   - 利好 vs 利空因素对比表
6) 必须给出明确投资建议：适合投资者类型、仓位建议、进出场价位。
7) 全文不少于 8000 中文字符。`;
}

export function createCoverageRepairPrompt(
  stockCode: string,
  missingDimensions: string[],
  language: ReportLanguage
) {
  if (language === "en") {
    return `You are the quality editor. You will receive a draft stock analysis report about ${stockCode}.
Task: preserve valuable content, fill all missing dimensions, and output one complete final version.

Missing dimensions:
${missingDimensions.map((item, index) => `${index + 1}. ${item}`).join("\n")}

Hard requirements:
1) Output one complete Markdown report only, with no explanatory notes.
2) Preserve high-value content, avoid redundant rewrites.
3) Add executable analysis and tables for each missing dimension.
4) The final section must include clear investment suggestions.
5) Output length must be at least 5000 English words.`;
  }
  return `你是质量审校官。你将收到一份关于 ${stockCode} 的股票研报草稿。
任务：在不删除原有内容的前提下，补齐缺失维度并输出"完整最终版"。

缺失维度清单：
${missingDimensions.map((item, index) => `${index + 1}. ${item}`).join("\n")}

硬性要求：
1) 最终输出必须是单份完整 Markdown，不要输出解释性文字。
2) 保留原文有价值内容，禁止大段重复。
3) 对缺失维度必须新增可执行分析与表格。
4) 最后一节必须有明确投资建议。
5) 输出后长度不少于 8000 中文字符。`;
}

export function createExpansionPrompt(stockCode: string, minChars: number, language: ReportLanguage) {
  if (language === "en") {
    return `You are a long-form report expansion editor. Expand the existing draft into a complete long-form stock analysis report without changing the direction of conclusions.

Target: ${stockCode}
Minimum output length: at least ${Math.max(5000, Math.round(minChars * 0.65))} English words

Expansion requirements:
1) Keep the existing section structure, but add data evidence, metric definitions, counterexamples, and executable analysis in each section.
2) Add at least 2 new tables that are not duplicates of existing ones.
3) For every key judgment, include both "why it is valid" and "why it might fail".
4) The final section must include clear investment suggestions with entry/exit levels.
5) Output only the final full Markdown report, with no extra explanation.`;
  }
  return `你是深度研报扩写编辑。请在不改变结论方向的前提下，把已有草稿扩展为"完整版"。

分析对象：${stockCode}
最小长度要求：不少于 ${minChars} 中文字符

扩写要求：
1) 沿用原有章节结构，但每个章节都要增加"数据证据、指标口径、反例、可执行分析"。
2) 必须补充至少 2 张新增表格 (与原表不重复)。
3) 对每个关键判断增加"为什么成立/为什么可能不成立"。
4) 最后一节必须给出明确投资建议含进出场价位。
5) 只输出完整 Markdown 终稿，不输出解释说明。`;
}
