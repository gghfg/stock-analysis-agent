import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createCoverageRepairPrompt,
  createExpansionPrompt,
  createSynthesisPrompt,
  getAgentPrompts,
  getRequiredDimensions,
} from "@/lib/report-prompts";
import type { AgentKey, ReportLanguage } from "@/lib/report-prompts";

// ============ 类型定义 ============

interface AnalyzeRequest {
  stockCode?: string;
  provider?: ModelProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  generationMode?: GenerationMode;
  modelStrategy?: ModelStrategy;
  modelRouting?: ModelRoutingInput;
  providerRouting?: ProviderRoutingInput;
  keyRouting?: KeyRoutingInput;
  language?: ReportLanguage;
  async?: boolean;
}

interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type ModelProvider = "openai" | "siliconflow" | "deepseek" | "bailian" | "sina";
type GenerationMode = "fast" | "standard" | "deep";
type ModelStrategy = "uniform" | "mixed";
type AgentModelRouting = Partial<Record<AgentKey, string>>;

interface ModelRoutingInput {
  agentModels?: AgentModelRouting;
  synthesisModel?: string;
  repairModel?: string;
  expansionModel?: string;
}

type AgentKeyRouting = Partial<Record<AgentKey, string>>;
type AgentProviderRouting = Partial<Record<AgentKey, ModelProvider>>;

interface ProviderRoutingInput {
  agentProviders?: AgentProviderRouting;
  synthesisProvider?: ModelProvider;
  repairProvider?: ModelProvider;
  expansionProvider?: ModelProvider;
}

interface KeyRoutingInput {
  agentApiKeys?: AgentKeyRouting;
  synthesisApiKey?: string;
  repairApiKey?: string;
  expansionApiKey?: string;
}

interface ResolvedModels {
  agentModels: Record<AgentKey, string>;
  synthesisModel: string;
  repairModel: string;
  expansionModel: string;
}

interface ResolvedApiKeys {
  agentApiKeys: Record<AgentKey, string>;
  synthesisApiKey: string;
  repairApiKey: string;
  expansionApiKey: string;
}

interface ResolvedProviders {
  agentProviders: Record<AgentKey, ModelProvider>;
  synthesisProvider: ModelProvider;
  repairProvider: ModelProvider;
  expansionProvider: ModelProvider;
}

type KeySource = "global" | "custom";

interface ResolvedKeySources {
  agentApiKeys: Record<AgentKey, KeySource>;
  synthesisApiKey: KeySource;
  repairApiKey: KeySource;
  expansionApiKey: KeySource;
}

interface StockData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  marketCap: number;
  pe: number;
  pb: number;
  high52w: number;
  low52w: number;
  industry: string;
  sector: string;
  description: string;
  klineData?: KlinePoint[];
  newsList?: NewsItem[];
}

interface KlinePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NewsItem {
  date: string;
  title: string;
  source: string;
  summary: string;
  type: "earnings" | "executive" | "contract" | "regulatory" | "other";
}

interface GenerationLimits {
  maxTokens: number;
  minChars: number;
}

interface QualityMetrics {
  missingDimensions: string[];
  coverageRate: number;
  tableCount: number;
  dataSignals: number;
  actionSignals: number;
  lengthRate: number;
  overallScore: number;
}

interface GenerationModePlan {
  mode: GenerationMode;
  maxTokensScale: number;
  minCharsScale: number;
  qualityThreshold: number;
  enableCoverageRepair: boolean;
  enableExpansion: boolean;
  enableQualityRepair: boolean;
}

// ============ 常量配置 ============

const DEFAULT_REPORT_MIN_CHARS = Number(process.env.REPORT_MIN_CHARS ?? "8000");
const DEFAULT_MAX_OUTPUT_TOKENS = Number(process.env.REPORT_MAX_TOKENS ?? "8192");

const COVERAGE_KEYWORDS: Record<ReportLanguage, Array<{ dimension: string; keywords: string[] }>> = {
  zh: [
    { dimension: getRequiredDimensions("zh")[0], keywords: ["公司简介", "公司概况", "主营业务"] },
    { dimension: getRequiredDimensions("zh")[1], keywords: ["行业", "板块", "所属"] },
    { dimension: getRequiredDimensions("zh")[2], keywords: ["商业模式", "盈利模式", "收入构成"] },
    { dimension: getRequiredDimensions("zh")[3], keywords: ["K 线", "价格走势", "日线", "周线"] },
    { dimension: getRequiredDimensions("zh")[4], keywords: ["成交量", "资金流向", "换手率"] },
    { dimension: getRequiredDimensions("zh")[5], keywords: ["MA", "MACD", "KDJ", "RSI", "均线"] },
    { dimension: getRequiredDimensions("zh")[6], keywords: ["支撑位", "阻力位", "压力位"] },
    { dimension: getRequiredDimensions("zh")[7], keywords: ["新闻", "公告", "消息"] },
    { dimension: getRequiredDimensions("zh")[8], keywords: ["高管", "增持", "减持", "持股"] },
    { dimension: getRequiredDimensions("zh")[9], keywords: ["财报", "业绩", "营收", "净利润"] },
    { dimension: getRequiredDimensions("zh")[10], keywords: ["机构", "评级", "调研", "目标价"] },
    { dimension: getRequiredDimensions("zh")[11], keywords: ["短期", "走势", "预期", "周"] },
    { dimension: getRequiredDimensions("zh")[12], keywords: ["中期", "走势", "预期", "月"] },
    { dimension: getRequiredDimensions("zh")[13], keywords: ["风险", "建议", "投资", "仓位"] },
  ],
  en: [
    { dimension: getRequiredDimensions("en")[0], keywords: ["company overview", "business description"] },
    { dimension: getRequiredDimensions("en")[1], keywords: ["industry", "sector"] },
    { dimension: getRequiredDimensions("en")[2], keywords: ["business model", "revenue"] },
    { dimension: getRequiredDimensions("en")[3], keywords: ["K-line", "price trend", "chart"] },
    { dimension: getRequiredDimensions("en")[4], keywords: ["volume", "turnover", "capital flow"] },
    { dimension: getRequiredDimensions("en")[5], keywords: ["MA", "MACD", "KDJ", "RSI", "moving average"] },
    { dimension: getRequiredDimensions("en")[6], keywords: ["support", "resistance"] },
    { dimension: getRequiredDimensions("en")[7], keywords: ["news", "announcement"] },
    { dimension: getRequiredDimensions("en")[8], keywords: ["executive", "shareholding", "insider"] },
    { dimension: getRequiredDimensions("en")[9], keywords: ["earnings", "financial report", "revenue"] },
    { dimension: getRequiredDimensions("en")[10], keywords: ["institutional", "rating", "target price"] },
    { dimension: getRequiredDimensions("en")[11], keywords: ["short-term", "forecast", "weeks"] },
    { dimension: getRequiredDimensions("en")[12], keywords: ["medium-term", "forecast", "months"] },
    { dimension: getRequiredDimensions("en")[13], keywords: ["risk", "investment", "position"] },
  ],
};

const PROVIDER_CONFIG = {
  openai: {
    baseUrl: process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  },
  siliconflow: {
    baseUrl: process.env.SILICONFLOW_BASE_URL?.replace(/\/$/, "") ?? "https://api.siliconflow.cn/v1",
    apiKey: process.env.SILICONFLOW_API_KEY,
    model: process.env.SILICONFLOW_MODEL ?? "deepseek-ai/DeepSeek-V3",
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, "") ?? "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  },
  bailian: {
    baseUrl: process.env.BAILIAN_BASE_URL?.replace(/\/$/, "") ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.BAILIAN_API_KEY ?? process.env.DASHSCOPE_API_KEY,
    model: process.env.BAILIAN_MODEL ?? "qwen-plus",
  },
  sina: {
    baseUrl: "https://hq.sinajs.cn",
    apiKey: "",
    model: "sina-stock-api",
  },
} as const;

const FETCH_TIMEOUT_MS = 30_000;
const MODEL_TIMEOUT_MS = 480_000;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_RETRIES = 2;

const MAIN_SECTION_TITLES: Record<ReportLanguage, string[]> = {
  zh: [
    "一、股票简介与板块分析",
    "二、K 线图与技术分析",
    "三、近期大事与新闻调查",
    "四、走向预期与投资策略",
  ],
  en: [
    "I. Stock Overview & Sector Analysis",
    "II. K-Line Chart & Technical Analysis",
    "III. Recent Events & News Investigation",
    "IV. Trend Forecast & Investment Suggestions",
  ],
};

// ============ 任务队列 ============

type TaskStage =
  | "queued"
  | "fetching"
  | "agents"
  | "synthesizing"
  | "repairing"
  | "expanding"
  | "quality_repair"
  | "persisting"
  | "completed"
  | "failed";

interface AnalyzeTask {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: TaskStage;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  request: AnalyzeRequest;
  result?: AnalyzeTaskResult;
  error?: string;
}

interface AnalyzeTaskResult {
  success: boolean;
  stockCode: string;
  provider: ModelProvider;
  model: string;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  repairedMissingDimensions: string[];
  reportLength: number;
  limits: GenerationLimits;
  quality: QualityMetrics;
  generationMode: GenerationMode;
  modelStrategy: ModelStrategy;
  providerRouting: ProviderRoutingInput;
  modelRouting: ModelRoutingInput;
  resolvedProviders: ResolvedProviders;
  resolvedModels: ResolvedModels;
  keyRoutingSummary: ResolvedKeySources;
  history: {
    dir: string;
    markdownFile: string;
    htmlFile: string;
    metadataFile: string;
  };
  sections: Array<{ key: string; title: string }>;
  report: string;
  stockData: StockData;
}

const TASK_QUEUE_CONCURRENCY = 1;
const TASK_STORE_LIMIT = 200;
const reportTasks = new Map<string, AnalyzeTask>();
const taskQueue: string[] = [];
let runningTaskCount = 0;

// ============ 工具函数 ============

function resolveProviderConfig(
  provider: ModelProvider,
  options?: { model?: string; apiKey?: string; baseUrl?: string }
) {
  const config = PROVIDER_CONFIG[provider];
  const resolvedApiKey = options?.apiKey?.trim() || config.apiKey;
  const resolvedBaseUrl = options?.baseUrl?.trim()
    ? options.baseUrl.trim().replace(/\/$/, "")
    : config.baseUrl;
  if (!resolvedApiKey && provider !== "sina") {
    throw new Error(`缺少 ${provider} 对应的 API Key 环境变量`);
  }
  return {
    baseUrl: resolvedBaseUrl,
    apiKey: resolvedApiKey,
    model: options?.model?.trim() ? options.model.trim() : config.model,
  };
}

function parseProvider(input?: string): ModelProvider {
  if (input === "openai" || input === "siliconflow" || input === "deepseek" || input === "bailian") {
    return input;
  }
  return "bailian";
}

function parseGenerationMode(input?: string): GenerationMode {
  if (input === "fast" || input === "standard" || input === "deep") {
    return input;
  }
  return "standard";
}

function parseModelStrategy(input?: string): ModelStrategy {
  if (input === "mixed") {
    return "mixed";
  }
  return "uniform";
}

function parseLanguage(input?: string): ReportLanguage {
  if (input === "en") {
    return "en";
  }
  return "zh";
}

function sanitizeModelName(input?: string | null) {
  const normalized = (input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 160);
  return normalized || undefined;
}

function sanitizeApiKey(input?: string | null) {
  const normalized = (input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 400);
  return normalized || undefined;
}

function sanitizeModelRouting(input?: ModelRoutingInput): ModelRoutingInput {
  const agentModels: AgentModelRouting = {};
  if (input?.agentModels) {
    for (const key of ["stockInfo", "klineAnalysis", "newsEvents", "trendForecast"] as AgentKey[]) {
      if (input.agentModels[key]) {
        const value = sanitizeModelName(input.agentModels[key]);
        if (value) agentModels[key] = value;
      }
    }
  }
  const synthesisModel = sanitizeModelName(input?.synthesisModel);
  const repairModel = sanitizeModelName(input?.repairModel);
  const expansionModel = sanitizeModelName(input?.expansionModel);
  return {
    ...(Object.keys(agentModels).length > 0 ? { agentModels } : {}),
    ...(synthesisModel ? { synthesisModel } : {}),
    ...(repairModel ? { repairModel } : {}),
    ...(expansionModel ? { expansionModel } : {}),
  };
}

function sanitizeKeyRouting(input?: KeyRoutingInput): KeyRoutingInput {
  const agentApiKeys: AgentKeyRouting = {};
  if (input?.agentApiKeys) {
    for (const key of ["stockInfo", "klineAnalysis", "newsEvents", "trendForecast"] as AgentKey[]) {
      if (input.agentApiKeys[key]) {
        const value = sanitizeApiKey(input.agentApiKeys[key]);
        if (value) agentApiKeys[key] = value;
      }
    }
  }
  const synthesisApiKey = sanitizeApiKey(input?.synthesisApiKey);
  const repairApiKey = sanitizeApiKey(input?.repairApiKey);
  const expansionApiKey = sanitizeApiKey(input?.expansionApiKey);
  return {
    ...(Object.keys(agentApiKeys).length > 0 ? { agentApiKeys } : {}),
    ...(synthesisApiKey ? { synthesisApiKey } : {}),
    ...(repairApiKey ? { repairApiKey } : {}),
    ...(expansionApiKey ? { expansionApiKey } : {}),
  };
}

function sanitizeProviderRouting(input?: ProviderRoutingInput): ProviderRoutingInput {
  const agentProviders: AgentProviderRouting = {};
  if (input?.agentProviders) {
    for (const key of ["stockInfo", "klineAnalysis", "newsEvents", "trendForecast"] as AgentKey[]) {
      if (input.agentProviders[key]) {
        agentProviders[key] = parseProvider(input.agentProviders[key]);
      }
    }
  }
  return {
    ...(Object.keys(agentProviders).length > 0 ? { agentProviders } : {}),
    ...(input?.synthesisProvider ? { synthesisProvider: parseProvider(input.synthesisProvider) } : {}),
    ...(input?.repairProvider ? { repairProvider: parseProvider(input.repairProvider) } : {}),
    ...(input?.expansionProvider ? { expansionProvider: parseProvider(input.expansionProvider) } : {}),
  };
}

function resolveStageModels(
  strategy: ModelStrategy,
  globalModel: string,
  routing: ModelRoutingInput
): ResolvedModels {
  const fallback = sanitizeModelName(globalModel) ?? globalModel;
  if (strategy === "uniform") {
    return {
      agentModels: {
        stockInfo: fallback,
        klineAnalysis: fallback,
        newsEvents: fallback,
        trendForecast: fallback,
      },
      synthesisModel: fallback,
      repairModel: fallback,
      expansionModel: fallback,
    };
  }
  return {
    agentModels: {
      stockInfo: routing.agentModels?.stockInfo ?? fallback,
      klineAnalysis: routing.agentModels?.klineAnalysis ?? fallback,
      newsEvents: routing.agentModels?.newsEvents ?? fallback,
      trendForecast: routing.agentModels?.trendForecast ?? fallback,
    },
    synthesisModel: routing.synthesisModel ?? fallback,
    repairModel: routing.repairModel ?? fallback,
    expansionModel: routing.expansionModel ?? fallback,
  };
}

function resolveStageApiKeys(
  strategy: ModelStrategy,
  globalApiKey: string,
  routing: KeyRoutingInput
): ResolvedApiKeys {
  if (strategy === "uniform") {
    return {
      agentApiKeys: {
        stockInfo: globalApiKey,
        klineAnalysis: globalApiKey,
        newsEvents: globalApiKey,
        trendForecast: globalApiKey,
      },
      synthesisApiKey: globalApiKey,
      repairApiKey: globalApiKey,
      expansionApiKey: globalApiKey,
    };
  }
  return {
    agentApiKeys: {
      stockInfo: routing.agentApiKeys?.stockInfo ?? globalApiKey,
      klineAnalysis: routing.agentApiKeys?.klineAnalysis ?? globalApiKey,
      newsEvents: routing.agentApiKeys?.newsEvents ?? globalApiKey,
      trendForecast: routing.agentApiKeys?.trendForecast ?? globalApiKey,
    },
    synthesisApiKey: routing.synthesisApiKey ?? globalApiKey,
    repairApiKey: routing.repairApiKey ?? globalApiKey,
    expansionApiKey: routing.expansionApiKey ?? globalApiKey,
  };
}

function resolveStageProviders(
  strategy: ModelStrategy,
  globalProvider: ModelProvider,
  routing: ProviderRoutingInput
): ResolvedProviders {
  if (strategy === "uniform") {
    return {
      agentProviders: {
        stockInfo: globalProvider,
        klineAnalysis: globalProvider,
        newsEvents: globalProvider,
        trendForecast: globalProvider,
      },
      synthesisProvider: globalProvider,
      repairProvider: globalProvider,
      expansionProvider: globalProvider,
    };
  }
  return {
    agentProviders: {
      stockInfo: routing.agentProviders?.stockInfo ?? globalProvider,
      klineAnalysis: routing.agentProviders?.klineAnalysis ?? globalProvider,
      newsEvents: routing.agentProviders?.newsEvents ?? globalProvider,
      trendForecast: routing.agentProviders?.trendForecast ?? globalProvider,
    },
    synthesisProvider: routing.synthesisProvider ?? globalProvider,
    repairProvider: routing.repairProvider ?? globalProvider,
    expansionProvider: routing.repairProvider ?? globalProvider,
  };
}

function resolveKeySources(resolvedApiKeys: ResolvedApiKeys, globalApiKey: string): ResolvedKeySources {
  const resolveSource = (value: string): KeySource => (value === globalApiKey ? "global" : "custom");
  return {
    agentApiKeys: {
      stockInfo: resolveSource(resolvedApiKeys.agentApiKeys.stockInfo),
      klineAnalysis: resolveSource(resolvedApiKeys.agentApiKeys.klineAnalysis),
      newsEvents: resolveSource(resolvedApiKeys.agentApiKeys.newsEvents),
      trendForecast: resolveSource(resolvedApiKeys.agentApiKeys.trendForecast),
    },
    synthesisApiKey: resolveSource(resolvedApiKeys.synthesisApiKey),
    repairApiKey: resolveSource(resolvedApiKeys.repairApiKey),
    expansionApiKey: resolveSource(resolvedApiKeys.expansionApiKey),
  };
}

function resolveGenerationModePlan(mode: GenerationMode): GenerationModePlan {
  if (mode === "fast") {
    return {
      mode,
      maxTokensScale: 0.72,
      minCharsScale: 0.68,
      qualityThreshold: 70,
      enableCoverageRepair: false,
      enableExpansion: false,
      enableQualityRepair: false,
    };
  }
  if (mode === "deep") {
    return {
      mode,
      maxTokensScale: 1.25,
      minCharsScale: 1.25,
      qualityThreshold: 84,
      enableCoverageRepair: true,
      enableExpansion: true,
      enableQualityRepair: true,
    };
  }
  return {
    mode,
    maxTokensScale: 1,
    minCharsScale: 1,
    qualityThreshold: 78,
    enableCoverageRepair: true,
    enableExpansion: true,
    enableQualityRepair: true,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryByStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  requestLabel: string
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (!response.ok && shouldRetryByStatus(response.status)) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${errorText}`);
      }
      return response;
    } catch (error) {
      const currentError = error instanceof Error ? error : new Error("请求失败");
      if (currentError.name === "AbortError" || currentError.message.includes("aborted")) {
        lastError = new Error(`${requestLabel}超时（单次 ${Math.floor(timeoutMs / 1000)} 秒）`);
      } else {
        lastError = currentError;
      }
      if (attempt === MAX_RETRIES) {
        throw lastError;
      }
      const jitter = Math.floor(Math.random() * 300);
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt + jitter;
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error("请求失败");
}

// ============ 股票数据获取（参考 a-stock-trading-assistant）============

function getMarketPrefix(code: string): { prefix: string; cleanCode: string } {
  const c = code.trim().toUpperCase();
  if (c.startsWith("SH") || c.startsWith("SZ")) {
    return { prefix: c.slice(0, 2).toLowerCase(), cleanCode: c.slice(2) };
  }
  const digits = c.replace(/[^0-9]/g, "");
  if (digits.startsWith("60") || digits.startsWith("68") || digits.startsWith("51") || digits.startsWith("58")) {
    return { prefix: "sh", cleanCode: digits };
  }
  if (digits.startsWith("00") || digits.startsWith("30") || digits.startsWith("15") || digits.startsWith("12")) {
    return { prefix: "sz", cleanCode: digits };
  }
  return { prefix: "sh", cleanCode: digits };
}

async function fetchStockBasicInfo(stockCode: string): Promise<StockData> {
  const { prefix, cleanCode } = getMarketPrefix(stockCode);
  const symbol = `${prefix}${cleanCode}`;
  
  // 主数据源：新浪财经
  const sinaUrl = `http://hq.sinajs.cn/list=${symbol}`;
  let text = "";
  
  try {
    const response = await fetchWithTimeout(sinaUrl, {
      headers: { "Referer": "https://finance.sina.com.cn/" },
    }, FETCH_TIMEOUT_MS);
    if (response.ok) {
      text = await response.text();
    }
  } catch {
    text = "";
  }

  // 备用数据源：东方财富
  if (!text) {
    const market = prefix === "sh" ? 1 : 0;
    const eastmoneyUrl = `http://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${cleanCode}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f107,f169,f170,f171,f530`;
    try {
      const response = await fetchWithTimeout(eastmoneyUrl, {
        headers: { "Referer": "https://www.eastmoney.com/" },
      }, FETCH_TIMEOUT_MS);
      if (response.ok) {
        const json = await response.json();
        const d = json.data || {};
        if (d.f43) {
          const prevClose = (d.f60 || 0) / 100;
          const current = (d.f43 || 0) / 100;
          return {
            code: symbol.toUpperCase(),
            name: d.f58 || stockCode,
            price: current,
            change: (d.f169 || 0) / 100,
            changePercent: (d.f170 || 0) / 100,
            volume: d.f47 || 0,
            turnover: d.f48 || 0,
            marketCap: (d.f116 || 0),
            pe: (d.f162 || 0),
            pb: (d.f167 || 0),
            high52w: (d.f179 || 0) / 100,
            low52w: (d.f180 || 0) / 100,
            industry: d.f1871 || "未知",
            sector: d.f1872 || "未知",
            description: `${d.f58 || stockCode} (${symbol.toUpperCase()}) 是一家 A 股上市公司。`,
          };
        }
      }
    } catch {
      // 忽略错误
    }
    throw new Error(`无法获取股票 ${stockCode} 的数据，请检查代码是否正确`);
  }

  // 解析新浪财经数据
  const match = text.match(/var hq_str_.*?="(.*?)"/);
  if (!match || !match[1]) {
    throw new Error(`无法解析股票 ${stockCode} 的数据`);
  }

  const elements = match[1].split(",");
  if (elements.length < 32) {
    throw new Error(`股票数据格式异常：${stockCode}`);
  }

  const name = elements[0] || stockCode;
  const prevClose = parseFloat(elements[2]) || 0;
  const open = parseFloat(elements[1]) || 0;
  const current = parseFloat(elements[3]) || 0;
  const high = parseFloat(elements[4]) || 0;
  const low = parseFloat(elements[5]) || 0;
  const volume = parseInt(elements[8]) || 0; // 手
  const amount = parseFloat(elements[9]) || 0; // 元

  const change = current - prevClose;
  const changePercent = prevClose ? (change / prevClose * 100) : 0;

  return {
    code: symbol.toUpperCase(),
    name,
    price: current,
    change,
    changePercent,
    volume,
    turnover: amount,
    marketCap: parseFloat(elements[39]) || 0,
    pe: parseFloat(elements[38]) || 0,
    pb: parseFloat(elements[46]) || 0,
    high52w: parseFloat(elements[44]) || 0,
    low52w: parseFloat(elements[45]) || 0,
    industry: elements[58] || "未知",
    sector: elements[59] || "未知",
    description: `${name} (${symbol.toUpperCase()}) 是一家 A 股上市公司，所属行业为${elements[58] || "未知"}。`,
  };
}

async function fetchKlineData(stockCode: string): Promise<KlinePoint[]> {
  const { prefix, cleanCode } = getMarketPrefix(stockCode);
  const market = prefix === "sh" ? "1" : "0";
  
  // 东方财富日 K 线数据
  const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${market}.${cleanCode}&klt=101&fqt=1&beg=20230101&end=20261231&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60`;
  
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "Referer": "https://www.eastmoney.com/" },
    }, FETCH_TIMEOUT_MS);
    
    if (!response.ok) return [];
    
    const json = await response.json();
    const klines = json.data?.klines || [];
    
    return klines.map((line: string) => {
      const parts = line.split(",");
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        high: parseFloat(parts[2]),
        low: parseFloat(parts[3]),
        close: parseFloat(parts[4]),
        volume: parseInt(parts[5]) || 0,
      };
    });
  } catch {
    return [];
  }
}

async function fetchNewsData(stockCode: string): Promise<NewsItem[]> {
  const { prefix, cleanCode } = getMarketPrefix(stockCode);
  const market = prefix === "sh" ? "1" : "0";
  
  // 东方财富个股新闻
  const url = `http://push2.eastmoney.com/api/qt/stock/relation/get?secid=${market}.${cleanCode}&type=news&pageSize=20`;
  
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "Referer": "https://www.eastmoney.com/" },
    }, FETCH_TIMEOUT_MS);
    
    if (!response.ok) return [];
    
    const json = await response.json();
    const items = json.data?.list || [];
    
    return items.slice(0, 15).map((item: any) => ({
      date: item.ctime || new Date().toISOString().split("T")[0],
      title: item.title || "",
      source: item.source || "东方财富",
      summary: item.abstract || "",
      type: classifyNewsType(item.title),
    }));
  } catch {
    return [];
  }
}

function classifyNewsType(title: string): NewsItem["type"] {
  const lower = title.toLowerCase();
  if (lower.includes("财报") || lower.includes("业绩") || lower.includes("营收") || lower.includes("净利润")) return "earnings";
  if (lower.includes("高管") || lower.includes("增持") || lower.includes("减持") || lower.includes("持股")) return "executive";
  if (lower.includes("合同") || lower.includes("合作") || lower.includes("签约") || lower.includes("中标")) return "contract";
  if (lower.includes("公告") || lower.includes("监管") || lower.includes("处罚") || lower.includes("问询")) return "regulatory";
  return "other";
}

// ============ AI 模型调用 ============

async function callModel(
  messages: ModelMessage[],
  providerConfig: { baseUrl: string; apiKey: string; model: string },
  limits: GenerationLimits
) {
  const payload = {
    model: providerConfig.model,
    temperature: 0.4,
    messages,
    max_tokens: limits.maxTokens > 0 ? limits.maxTokens : undefined,
  };

  const response = await fetchWithRetry(`${providerConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerConfig.apiKey}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }, MODEL_TIMEOUT_MS, "模型调用");

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`模型调用失败：HTTP ${response.status} ${errorText}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("模型返回空内容");
  }
  return content;
}

function isModelUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/HTTP 404/.test(message)) return true;
  if (!/HTTP 400/.test(message) && !/model|模型/i.test(message)) return false;
  return /(model|模型).*(not found|does not exist|invalid|unsupported|不存在|不可用)/i.test(message);
}

async function callModelWithFallback(
  messages: ModelMessage[],
  providerConfig: { baseUrl: string; apiKey: string; model: string },
  limits: GenerationLimits,
  preferredModel: string,
  fallbackModel: string,
  preferredApiKey: string,
  fallbackApiKey: string
) {
  try {
    const content = await callModel(messages, providerConfig, limits);
    return { content, usedModel: preferredModel, usedApiKey: preferredApiKey };
  } catch (error) {
    if (!isModelUnavailableError(error)) throw error;
    const content = await callModel(messages, { ...providerConfig, model: fallbackModel, apiKey: fallbackApiKey }, limits);
    return { content, usedModel: fallbackModel, usedApiKey: fallbackApiKey };
  }
}

function sanitizeReportMarkdown(report: string) {
  const trimmed = report.trim();
  const startFence = /^```markdown\s*/i;
  const endFence = /\s*```$/;
  if (startFence.test(trimmed) && endFence.test(trimmed)) {
    return trimmed.replace(startFence, "").replace(endFence, "").trim();
  }
  return trimmed;
}

function normalizeModelMarkdown(content: string) {
  return sanitizeReportMarkdown(content)
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n")
    .trim();
}

function resolveGenerationLimits(provider: ModelProvider, model: string): GenerationLimits {
  let maxTokens = DEFAULT_MAX_OUTPUT_TOKENS;
  let minChars = DEFAULT_REPORT_MIN_CHARS;

  const modelLower = model.toLowerCase();
  if (modelLower.includes("reasoner") || modelLower.includes("r1")) {
    maxTokens = Math.max(maxTokens, 12000);
    minChars = Math.max(minChars, 12000);
  } else if (modelLower.includes("gpt-4") || modelLower.includes("qwen-max") || modelLower.includes("deepseek-v3")) {
    maxTokens = Math.max(maxTokens, 10000);
    minChars = Math.max(minChars, 10000);
  }

  return { maxTokens, minChars };
}

function applyGenerationModeToLimits(limits: GenerationLimits, modePlan: GenerationModePlan): GenerationLimits {
  const maxTokens = Math.max(2500, Math.round(limits.maxTokens * modePlan.maxTokensScale));
  const minChars = Math.max(4000, Math.round(limits.minChars * modePlan.minCharsScale));
  return { maxTokens, minChars };
}

function getMissingDimensions(report: string, language: ReportLanguage) {
  return COVERAGE_KEYWORDS[language]
    .filter((item) => item.keywords.every((keyword) => !report.toLowerCase().includes(keyword.toLowerCase())))
    .map((item) => item.dimension);
}

function countRegexMatches(input: string, regex: RegExp) {
  return (input.match(regex) || []).length;
}

function evaluateReportQuality(report: string, minChars: number, language: ReportLanguage): QualityMetrics {
  const requiredDimensions = getRequiredDimensions(language);
  const missingDimensions = getMissingDimensions(report, language);
  const coverageRate = (requiredDimensions.length - missingDimensions.length) / requiredDimensions.length;
  const tableCount = countRegexMatches(report, /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/gm);
  const dataSignals = countRegexMatches(report, language === "en" ? /\d+%|\d+元|\d+亿|\$[\d.]+/g : /\d+%|\d+元|\d+亿/);
  const actionSignals = countRegexMatches(report, language === "en" ? /(buy|sell|hold|target|stop-loss)/gi : /(买入 | 卖出 | 持有 | 目标价 | 止损)/g);
  const lengthRate = Math.min(1, report.length / Math.max(minChars, 1));

  const overallScore = Math.round(
    coverageRate * 100 * 0.35 +
    Math.min(100, tableCount * 20) * 0.2 +
    Math.min(100, dataSignals * 5) * 0.2 +
    Math.min(100, actionSignals * 15) * 0.15 +
    lengthRate * 100 * 0.1
  );

  return {
    missingDimensions,
    coverageRate,
    tableCount,
    dataSignals,
    actionSignals,
    lengthRate,
    overallScore,
  };
}

// ============ HTML 生成 ============

function generateHtmlReport(stockData: StockData, markdownReport: string, language: ReportLanguage): string {
  const title = language === "en" 
    ? `${stockData.name} (${stockData.code}) - Stock Analysis Report`
    : `${stockData.name} (${stockData.code}) - 股票分析报告`;

  const stockInfoCard = `
    <div class="stock-card">
      <h2>${stockData.name} (${stockData.code})</h2>
      <div class="stock-price ${stockData.change >= 0 ? 'up' : 'down'}">
        <span class="price">¥${stockData.price.toFixed(2)}</span>
        <span class="change">${stockData.change >= 0 ? '+' : ''}${stockData.change.toFixed(2)} (${stockData.changePercent.toFixed(2)}%)</span>
      </div>
      <div class="stock-details">
        <div><span>成交量:</span> ${(stockData.volume / 10000).toFixed(2)}万手</div>
        <div><span>成交额:</span> ${(stockData.turnover / 100000000).toFixed(2)}亿</div>
        <div><span>市盈率:</span> ${stockData.pe.toFixed(2)}</div>
        <div><span>市净率:</span> ${stockData.pb.toFixed(2)}</div>
        <div><span>行业:</span> ${stockData.industry}</div>
        <div><span>板块:</span> ${stockData.sector}</div>
      </div>
    </div>
  `;

  // 简单的 Markdown 转 HTML
  const htmlContent = markdownReport
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { font-size: 28px; margin-bottom: 20px; color: #1a1a1a; border-bottom: 3px solid #007bff; padding-bottom: 15px; }
    h2 { font-size: 22px; margin: 30px 0 15px; color: #2c3e50; }
    h3 { font-size: 18px; margin: 20px 0 10px; color: #34495e; }
    p { margin-bottom: 15px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:nth-child(even) { background: #f8f9fa; }
    .stock-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 30px; }
    .stock-card h2 { color: white; margin-bottom: 15px; border-bottom: none; }
    .stock-price { display: flex; align-items: baseline; gap: 15px; margin-bottom: 20px; }
    .stock-price .price { font-size: 36px; font-weight: bold; }
    .stock-price .change { font-size: 20px; }
    .stock-price.up .change { color: #ff6b6b; }
    .stock-price.down .change { color: #51cf66; }
    .stock-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .stock-details div { background: rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 6px; }
    .stock-details span { opacity: 0.8; margin-right: 8px; }
    .summary { background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 14px; }
    strong { color: #c0392b; }
    ul, ol { margin: 15px 0 15px 25px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    ${stockInfoCard}
    <div class="content">${htmlContent}</div>
    <div class="footer">
      <p>Generated by Stock Analysis Agent | ${new Date().toLocaleString("zh-CN")}</p>
      <p style="margin-top:10px;font-size:12px;">免责声明：本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。</p>
    </div>
  </div>
</body>
</html>`;
}

// ============ 任务持久化 ============

async function persistReportHistory(params: {
  stockCode: string;
  stockData: StockData;
  report: string;
  htmlReport: string;
  provider: ModelProvider;
  model: string;
  durationMs: number;
  reportLength: number;
  repairedMissingDimensions: string[];
  limits: GenerationLimits;
  quality: QualityMetrics;
  generationMode: GenerationMode;
  modelStrategy: ModelStrategy;
  providerRouting: ProviderRoutingInput;
  modelRouting: ModelRoutingInput;
  resolvedProviders: ResolvedProviders;
  resolvedModels: ResolvedModels;
  keyRoutingSummary: ResolvedKeySources;
}) {
  const historyDir = path.join(process.cwd(), "analysis-history");
  await mkdir(historyDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeCode = params.stockCode.replace(/[^\w.-]+/g, "_").slice(0, 20);
  const baseName = `${timestamp}__${safeCode}`;
  
  const mdPath = path.join(historyDir, `${baseName}.md`);
  const htmlPath = path.join(historyDir, `${baseName}.html`);
  const metaPath = path.join(historyDir, `${baseName}.json`);

  await writeFile(mdPath, params.report, "utf-8");
  await writeFile(htmlPath, params.htmlReport, "utf-8");
  await writeFile(metaPath, JSON.stringify({
    stockCode: params.stockCode,
    stockData: params.stockData,
    provider: params.provider,
    model: params.model,
    durationMs: params.durationMs,
    reportLength: params.reportLength,
    repairedMissingDimensions: params.repairedMissingDimensions,
    limits: params.limits,
    quality: params.quality,
    generationMode: params.generationMode,
    modelStrategy: params.modelStrategy,
    providerRouting: params.providerRouting,
    modelRouting: params.modelRouting,
    resolvedProviders: params.resolvedProviders,
    resolvedModels: params.resolvedModels,
    keyRoutingSummary: params.keyRoutingSummary,
    createdAt: new Date().toISOString(),
    markdownFile: path.basename(mdPath),
    htmlFile: path.basename(htmlPath),
  }, null, 2), "utf-8");

  return {
    dir: historyDir,
    markdownFile: path.basename(mdPath),
    htmlFile: path.basename(htmlPath),
    metadataFile: path.basename(metaPath),
  };
}

// ============ 主分析流程 ============

async function runAnalyzePipeline(
  body: AnalyzeRequest,
  hooks?: { onStage?: (stage: TaskStage) => void }
) {
  const startedAt = Date.now();
  const stockCode = (body.stockCode ?? "").trim().toUpperCase();
  
  if (!stockCode) {
    throw new Error("股票代码不能为空");
  }

  const provider = parseProvider(body.provider);
  const providerConfig = resolveProviderConfig(provider, { model: body.model, apiKey: body.apiKey, baseUrl: body.baseUrl });
  const generationMode = parseGenerationMode(body.generationMode);
  const modelStrategy = parseModelStrategy(body.modelStrategy);
  const language = parseLanguage(body.language);
  const agentPrompts = getAgentPrompts(language);
  const providerRouting = sanitizeProviderRouting(body.providerRouting);
  const modelRouting = sanitizeModelRouting(body.modelRouting);
  const keyRouting = sanitizeKeyRouting(body.keyRouting);
  const generationModePlan = resolveGenerationModePlan(generationMode);
  
  let generationLimits = resolveGenerationLimits(provider, providerConfig.model);
  generationLimits = applyGenerationModeToLimits(generationLimits, generationModePlan);
  
  const resolvedProviders = resolveStageProviders(modelStrategy, provider, providerRouting);
  const resolvedModels = resolveStageModels(modelStrategy, providerConfig.model, modelRouting);
  const resolvedApiKeys = resolveStageApiKeys(modelStrategy, providerConfig.apiKey, keyRouting);

  const resolveStageProviderConfig = (stageProvider: ModelProvider, stageModel: string, stageApiKey: string) => {
    return resolveProviderConfig(stageProvider, { model: stageModel, apiKey: stageApiKey, baseUrl: stageProvider === provider ? body.baseUrl : undefined });
  };

  // 1. 获取股票数据
  hooks?.onStage?.("fetching");
  const [stockData, klineData, newsList] = await Promise.all([
    fetchStockBasicInfo(stockCode),
    fetchKlineData(stockCode),
    fetchNewsData(stockCode),
  ]);
  
  stockData.klineData = klineData;
  stockData.newsList = newsList;

  const userPayload = language === "en"
    ? `Analysis target: ${stockCode} (${stockData.name})

Current Price: ¥${stockData.price.toFixed(2)} (${stockData.changePercent >= 0 ? "+" : ""}${stockData.changePercent.toFixed(2)}%)
Industry: ${stockData.industry} | Sector: ${stockData.sector}
PE: ${stockData.pe.toFixed(2)} | PB: ${stockData.pb.toFixed(2)}
Volume: ${(stockData.volume / 10000).toFixed(2)}万 shares
Market Cap: ${(stockData.marketCap / 100000000).toFixed(2)}亿

Recent News (${newsList.length} items):
${newsList.map(n => `- [${n.date}] ${n.title}`).join("\n")}

K-Line Data (last ${klineData.length} days):
${klineData.slice(-10).map(k => `${k.date}: O=${k.open} H=${k.high} L=${k.low} C=${k.close}`).join("\n")}

Please provide comprehensive analysis based on this information.`
    : `分析目标：${stockCode} (${stockData.name})

当前价格：¥${stockData.price.toFixed(2)} (${stockData.changePercent >= 0 ? "+" : ""}${stockData.changePercent.toFixed(2)}%)
所属行业：${stockData.industry} | 所属板块：${stockData.sector}
市盈率：${stockData.pe.toFixed(2)} | 市净率：${stockData.pb.toFixed(2)}
成交量：${(stockData.volume / 10000).toFixed(2)}万手
市值：${(stockData.marketCap / 100000000).toFixed(2)}亿

近期新闻 (${newsList.length}条):
${newsList.map(n => `- [${n.date}] ${n.title}`).join("\n")}

K 线数据 (近${klineData.length}个交易日):
${klineData.slice(-10).map(k => `${k.date}: 开=${k.open} 高=${k.high} 低=${k.low} 收=${k.close}`).join("\n")}

请基于以上信息进行全面分析。`;

  // 2. 4 Agent 并行分析
  hooks?.onStage?.("agents");
  const agentResults = await Promise.all(
    agentPrompts.map(async (agent) => {
      const modelResult = await callModelWithFallback(
        [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: userPayload },
        ],
        resolveStageProviderConfig(
          resolvedProviders.agentProviders[agent.key],
          resolvedModels.agentModels[agent.key],
          resolvedApiKeys.agentApiKeys[agent.key]
        ),
        generationLimits,
        resolvedModels.agentModels[agent.key],
        resolvedModels.agentModels[agent.key],
        resolvedApiKeys.agentApiKeys[agent.key],
        resolvedApiKeys.agentApiKeys[agent.key]
      );
      resolvedModels.agentModels[agent.key] = modelResult.usedModel;
      resolvedApiKeys.agentApiKeys[agent.key] = modelResult.usedApiKey;
      return { key: agent.key, title: agent.title, content: modelResult.content };
    })
  );

  const combinedDraft = agentResults.map((item) => `## ${item.title}\n\n${item.content}`).join("\n\n---\n\n");

  // 3. 合成报告
  hooks?.onStage?.("synthesizing");
  const synthesisResult = await callModelWithFallback(
    [
      { role: "system", content: createSynthesisPrompt(stockCode, language) },
      { role: "user", content: combinedDraft },
    ],
    resolveStageProviderConfig(resolvedProviders.synthesisProvider, resolvedModels.synthesisModel, resolvedApiKeys.synthesisApiKey),
    generationLimits,
    resolvedModels.synthesisModel,
    resolvedModels.synthesisModel,
    resolvedApiKeys.synthesisApiKey,
    resolvedApiKeys.synthesisApiKey
  );
  resolvedModels.synthesisModel = synthesisResult.usedModel;
  resolvedApiKeys.synthesisApiKey = synthesisResult.usedApiKey;

  let completedReport = normalizeModelMarkdown(synthesisResult.content);
  const repairedMissingDimensions = getMissingDimensions(completedReport, language);

  // 4. 覆盖修复
  if (generationModePlan.enableCoverageRepair && repairedMissingDimensions.length > 0) {
    hooks?.onStage?.("repairing");
    const repairResult = await callModelWithFallback(
      [
        { role: "system", content: createCoverageRepairPrompt(stockCode, repairedMissingDimensions, language) },
        { role: "user", content: `请基于以下草稿补齐缺失维度并输出完整终稿：\n\n${completedReport}` },
      ],
      resolveStageProviderConfig(resolvedProviders.repairProvider, resolvedModels.repairModel, resolvedApiKeys.repairApiKey),
      generationLimits,
      resolvedModels.repairModel,
      resolvedModels.repairModel,
      resolvedApiKeys.repairApiKey,
      resolvedApiKeys.repairApiKey
    );
    resolvedModels.repairModel = repairResult.usedModel;
    resolvedApiKeys.repairApiKey = repairResult.usedApiKey;
    completedReport = normalizeModelMarkdown(repairResult.content);
  }

  // 5. 扩展
  if (generationModePlan.enableExpansion && completedReport.length < generationLimits.minChars) {
    hooks?.onStage?.("expanding");
    const expansionResult = await callModelWithFallback(
      [
        { role: "system", content: createExpansionPrompt(stockCode, generationLimits.minChars, language) },
        { role: "user", content: `请基于以下草稿扩写为完整版：\n\n${completedReport}` },
      ],
      resolveStageProviderConfig(resolvedProviders.expansionProvider, resolvedModels.expansionModel, resolvedApiKeys.expansionApiKey),
      generationLimits,
      resolvedModels.expansionModel,
      resolvedModels.expansionModel,
      resolvedApiKeys.expansionApiKey,
      resolvedApiKeys.expansionApiKey
    );
    resolvedModels.expansionModel = expansionResult.usedModel;
    resolvedApiKeys.expansionApiKey = expansionResult.usedApiKey;
    completedReport = normalizeModelMarkdown(expansionResult.content);
  }

  // 6. 质量评估与修订
  let quality = evaluateReportQuality(completedReport, generationLimits.minChars, language);
  if (generationModePlan.enableQualityRepair && quality.overallScore < generationModePlan.qualityThreshold) {
    hooks?.onStage?.("quality_repair");
    // 简化处理，实际可添加质量修订逻辑
  }

  // 7. 生成 HTML
  const htmlReport = generateHtmlReport(stockData, completedReport, language);

  // 8. 持久化
  hooks?.onStage?.("persisting");
  const finishedAt = Date.now();
  const reportLength = completedReport.length;
  const durationMs = finishedAt - startedAt;
  
  const history = await persistReportHistory({
    stockCode,
    stockData,
    report: completedReport,
    htmlReport,
    provider,
    model: providerConfig.model,
    durationMs,
    reportLength,
    repairedMissingDimensions,
    limits: generationLimits,
    quality,
    generationMode,
    modelStrategy,
    providerRouting,
    modelRouting,
    resolvedProviders,
    resolvedModels,
    keyRoutingSummary: resolveKeySources(resolvedApiKeys, providerConfig.apiKey),
  });

  return {
    success: true,
    stockCode,
    provider,
    model: providerConfig.model,
    durationMs,
    startedAt,
    finishedAt,
    repairedMissingDimensions,
    reportLength,
    limits: generationLimits,
    quality,
    generationMode,
    modelStrategy,
    providerRouting,
    modelRouting,
    resolvedProviders,
    resolvedModels,
    keyRoutingSummary: resolveKeySources(resolvedApiKeys, providerConfig.apiKey),
    history,
    sections: agentResults.map((item) => ({ key: item.key, title: item.title })),
    report: completedReport,
    stockData,
  } satisfies AnalyzeTaskResult;
}

// ============ 任务队列处理 ============

async function processTaskQueue() {
  while (runningTaskCount < TASK_QUEUE_CONCURRENCY && taskQueue.length > 0) {
    const taskId = taskQueue.shift();
    if (!taskId) continue;
    const task = reportTasks.get(taskId);
    if (!task || task.status !== "queued") continue;
    
    runningTaskCount += 1;
    task.status = "running";
    task.stage = "fetching";
    task.startedAt = Date.now();
    
    void runAnalyzePipeline(task.request, { onStage: (stage) => {
      const t = reportTasks.get(taskId);
      if (t) { t.stage = stage; t.status = stage === "queued" ? "queued" : "running"; }
    }})
    .then((result) => {
      const t = reportTasks.get(taskId);
      if (t) { t.status = "completed"; t.stage = "completed"; t.result = result; t.finishedAt = Date.now(); }
    })
    .catch((error) => {
      const t = reportTasks.get(taskId);
      if (t) { t.status = "failed"; t.stage = "failed"; t.error = error instanceof Error ? error.message : "未知错误"; t.finishedAt = Date.now(); }
    })
    .finally(() => {
      runningTaskCount = Math.max(0, runningTaskCount - 1);
      void processTaskQueue();
    });
  }
}

function createTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneOldTasks() {
  if (reportTasks.size <= TASK_STORE_LIMIT) return;
  const sorted = Array.from(reportTasks.values()).sort((a, b) => a.createdAt - b.createdAt);
  const removable = reportTasks.size - TASK_STORE_LIMIT;
  for (let i = 0; i < removable; i++) {
    const t = sorted[i];
    if (t.status !== "queued" && t.status !== "running") reportTasks.delete(t.taskId);
  }
}

// ============ API 路由 ============

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") ?? "";
  if (!taskId) {
    return NextResponse.json({ success: false, error: "缺少 taskId" }, { status: 400 });
  }
  const task = reportTasks.get(taskId);
  if (!task) {
    return NextResponse.json({ success: false, error: "任务不存在或已过期" }, { status: 404 });
  }
  return NextResponse.json({ success: true, task });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AnalyzeRequest;
    
    if (body.async) {
      const taskId = createTaskId();
      const task: AnalyzeTask = {
        taskId,
        status: "queued",
        stage: "queued",
        createdAt: Date.now(),
        request: { ...body, async: undefined },
      };
      reportTasks.set(taskId, task);
      taskQueue.push(taskId);
      pruneOldTasks();
      void processTaskQueue();
      return NextResponse.json({ success: true, async: true, taskId, status: task.status, stage: task.stage });
    }
    
    const result = await runAnalyzePipeline(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
