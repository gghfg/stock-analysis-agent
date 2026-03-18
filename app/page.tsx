"use client";

import { useState } from "react";
import { marked } from "marked";

interface AnalysisResult {
  success: boolean;
  stockCode: string;
  report: string;
  stockData: {
    name: string;
    price: number;
    changePercent: number;
    industry: string;
    sector: string;
  };
  durationMs: number;
}

export default function Home() {
  const [stockCode, setStockCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<"fast" | "standard" | "deep">("standard");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockCode: stockCode.trim().toUpperCase(),
          generationMode,
          language: "zh",
          async: false,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "分析失败");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生未知错误");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "html" | "pdf") => {
    if (!result) return;
    
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockCode: result.stockCode,
          stockData: result.stockData,
          report: result.report,
          format,
        }),
      });

      if (!response.ok) throw new Error("导出失败");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.stockCode}_analysis.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分${seconds % 60}秒`;
  };

  // 使用 marked 解析 Markdown
  const renderMarkdown = (content: string) => {
    return { __html: marked(content) as string };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <main className="relative z-10">
        {/* Navigation */}
        <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">Stock Analysis</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-purple-300/70">Powered by Qwen3.5-Plus</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              AI 股票深度分析
            </h1>
            <p className="text-xl text-purple-200/70 max-w-2xl mx-auto">
              4 个 AI Agent 并行分析 · 实时数据 · 深度研报
            </p>
          </div>

          {/* Input Form */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 mb-8">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5">
                  <label className="block text-sm font-medium text-purple-200 mb-2">股票代码</label>
                  <input
                    type="text"
                    value={stockCode}
                    onChange={(e) => setStockCode(e.target.value.toUpperCase())}
                    placeholder="如：600519"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium text-purple-200 mb-2">分析模式</label>
                  <select
                    value={generationMode}
                    onChange={(e) => setGenerationMode(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                    disabled={loading}
                  >
                    <option value="fast" className="bg-slate-800">⚡ 快速版 (1 分钟)</option>
                    <option value="standard" className="bg-slate-800">📊 标准版 (2 分钟)</option>
                    <option value="deep" className="bg-slate-800">🔬 深度版 (3 分钟)</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={loading || !stockCode.trim()}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        分析中...
                      </span>
                    ) : (
                      "开始分析"
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Select */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-purple-300/60">热门：</span>
                  {["600519", "000858", "300750", "601318", "000001"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setStockCode(code)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-purple-200 text-sm transition-all"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-6">
              {/* Stock Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <h2 className="text-4xl font-bold text-white">{result.stockData.name}</h2>
                      <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white font-mono">
                        {result.stockCode}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="text-5xl font-bold text-white">
                        ¥{result.stockData.price.toFixed(2)}
                      </span>
                      <span className={`text-2xl font-semibold ${result.stockData.changePercent >= 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {result.stockData.changePercent >= 0 ? '↑' : '↓'} {Math.abs(result.stockData.changePercent).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                      <div className="text-purple-200/70 text-xs">行业</div>
                      <div className="text-white font-semibold">{result.stockData.industry}</div>
                    </div>
                    <div className="px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                      <div className="text-purple-200/70 text-xs">板块</div>
                      <div className="text-white font-semibold">{result.stockData.sector}</div>
                    </div>
                    <div className="px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                      <div className="text-purple-200/70 text-xs">耗时</div>
                      <div className="text-white font-semibold">{formatDuration(result.durationMs)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => handleExport("pdf")}
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-pink-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出 PDF
                </button>
                <button
                  onClick={() => handleExport("html")}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  导出 HTML
                </button>
              </div>

              {/* Report Content */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
                <div className="px-8 py-6 border-b border-white/10">
                  <h3 className="text-2xl font-bold text-white">分析报告</h3>
                </div>
                <div className="p-8">
                  <div 
                    className="prose prose-invert prose-lg max-w-none
                      prose-headings:text-white prose-headings:font-bold
                      prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8
                      prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:pb-2 prose-h2:border-b prose-h2:border-purple-500/30
                      prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-6
                      prose-p:text-purple-100/90 prose-p:mb-4 prose-p:leading-relaxed
                      prose-strong:text-pink-300 prose-strong:font-semibold
                      prose-em:text-purple-300
                      prose-ul:text-purple-100/90 prose-ul:my-4
                      prose-li:text-purple-100/90 prose-li:mb-2
                      prose-table:w-full prose-table:my-6 prose-table:border-collapse
                      prose-th:bg-white/10 prose-th:text-white prose-th:font-semibold prose-th:p-3 prose-th:border prose-th:border-white/20
                      prose-td:text-purple-100/90 prose-td:p-3 prose-td:border prose-td:border-white/20
                      prose-tr:hover:bg-white/5
                      prose-a:text-indigo-400 prose-a:hover:text-indigo-300"
                    dangerouslySetInnerHTML={renderMarkdown(result.report)}
                  />
                </div>
                <div className="px-8 py-6 bg-white/5 border-t border-white/10">
                  <p className="text-purple-300/60 text-sm text-center">
                    ⚠️ 免责声明：本报告由 AI 生成，仅供参考，不构成投资建议。股市有风险，入市需谨慎。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Features */}
          {!result && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
              {[
                { icon: "🤖", title: "4 Agent 并行", desc: "同时分析多个维度" },
                { icon: "📊", title: "实时数据", desc: "新浪财经 + 东财" },
                { icon: "⚡", title: "快速生成", desc: "1-3 分钟出报告" },
                { icon: "📄", title: "多格式导出", desc: "PDF / HTML" },
              ].map((f) => (
                <div key={f.title} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                  <div className="text-4xl mb-3">{f.icon}</div>
                  <div className="text-white font-semibold mb-1">{f.title}</div>
                  <div className="text-purple-300/60 text-sm">{f.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
