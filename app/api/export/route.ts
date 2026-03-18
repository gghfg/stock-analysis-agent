import { NextResponse } from "next/server";

interface ExportRequest {
  stockCode: string;
  stockData: {
    name: string;
    price: number;
    changePercent: number;
    industry: string;
    sector: string;
  };
  report: string;
  format: "html" | "pdf";
}

function generateStyledHtml(stockData: ExportRequest["stockData"], report: string, stockCode: string) {
  // 简单的 Markdown 转 HTML
  const htmlContent = report
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/^\|(.+)\|$/gim, '<table><tr>$1</tr></table>')
    .replace(/\|/g, '</td><td>')
    .replace(/<tr>/g, '<tr><td>')
    .replace(/<\/td><\/tr>/g, '</td></tr>')
    .replace(/\n/g, '<br>');

  const changeColor = stockData.changePercent >= 0 ? '#ef4444' : '#22c55e';
  const changeSign = stockData.changePercent >= 0 ? '↑' : '↓';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${stockData.name} (${stockCode}) - 股票分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif; 
      line-height: 1.8; 
      color: #1f2937; 
      max-width: 900px; 
      margin: 0 auto; 
      padding: 40px 20px;
      background: #f9fafb;
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      color: white;
      padding: 40px;
      border-radius: 20px;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
    }
    .stock-title { font-size: 36px; font-weight: bold; margin-bottom: 15px; }
    .stock-code { 
      display: inline-block; 
      background: rgba(255,255,255,0.2); 
      padding: 6px 16px; 
      border-radius: 20px; 
      font-family: monospace;
      font-size: 16px;
    }
    .stock-price { 
      font-size: 48px; 
      font-weight: bold; 
      margin: 20px 0;
    }
    .stock-change { 
      font-size: 24px; 
      color: ${changeColor};
      font-weight: 600;
    }
    .stock-info { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
      gap: 15px; 
      margin-top: 25px;
    }
    .info-item { 
      background: rgba(255,255,255,0.15); 
      padding: 15px; 
      border-radius: 12px; 
      backdrop-filter: blur(10px);
    }
    .info-label { font-size: 12px; opacity: 0.8; margin-bottom: 5px; }
    .info-value { font-size: 16px; font-weight: 600; }
    .content {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    h1 { font-size: 28px; color: #111827; margin: 30px 0 20px; padding-bottom: 10px; border-bottom: 3px solid #6366f1; }
    h2 { font-size: 22px; color: #1f2937; margin: 25px 0 15px; font-weight: 600; }
    h3 { font-size: 18px; color: #374151; margin: 20px 0 12px; font-weight: 600; }
    p { margin-bottom: 15px; color: #4b5563; text-align: justify; }
    strong { color: #dc2626; font-weight: 600; }
    em { color: #7c3aed; }
    ul, ol { margin: 15px 0 15px 25px; color: #4b5563; }
    li { margin-bottom: 8px; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 25px 0; 
      background: white;
      border-radius: 10px;
      overflow: hidden;
    }
    th { 
      background: linear-gradient(135deg, #6366f1, #8b5cf6); 
      color: white; 
      padding: 14px; 
      text-align: left; 
      font-weight: 600;
      font-size: 14px;
    }
    td { 
      padding: 12px 14px; 
      border-bottom: 1px solid #e5e7eb; 
      color: #4b5563;
      font-size: 14px;
    }
    tr:hover { background: #f9fafb; }
    tr:last-child td { border-bottom: none; }
    .footer {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }
    .disclaimer {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      margin: 30px 0;
      border-radius: 8px;
      color: #92400e;
      font-size: 13px;
    }
    @media print {
      body { background: white; padding: 0; }
      .header { box-shadow: none; }
      .content { box-shadow: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="stock-title">${stockData.name}</div>
    <span class="stock-code">${stockCode}</span>
    <div class="stock-price">¥${stockData.price.toFixed(2)}</div>
    <div class="stock-change">${changeSign} ${Math.abs(stockData.changePercent).toFixed(2)}%</div>
    <div class="stock-info">
      <div class="info-item">
        <div class="info-label">所属行业</div>
        <div class="info-value">${stockData.industry}</div>
      </div>
      <div class="info-item">
        <div class="info-label">所属板块</div>
        <div class="info-value">${stockData.sector}</div>
      </div>
      <div class="info-item">
        <div class="info-label">报告生成时间</div>
        <div class="info-value">${new Date().toLocaleString('zh-CN')}</div>
      </div>
    </div>
  </div>
  
  <div class="content">
    ${htmlContent}
    
    <div class="disclaimer">
      <strong>⚠️ 免责声明：</strong>本报告由 AI 自动生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。请结合专业顾问意见进行决策。
    </div>
  </div>
  
  <div class="footer">
    <p>Generated by Stock Analysis Agent | Powered by Qwen3.5-Plus</p>
    <p style="margin-top:10px;">${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ExportRequest;
    const { stockCode, stockData, report, format } = body;

    if (!stockCode || !report) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const htmlContent = generateStyledHtml(stockData, report, stockCode);

    if (format === "html") {
      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${stockCode}_analysis.html"`,
        },
      });
    }

    if (format === "pdf") {
      // 使用 Puppeteer 或 html2pdf 的思路，这里返回 HTML 供前端转换
      // 由于服务器端生成 PDF 需要额外依赖，我们返回一个带打印样式的 HTML
      // 用户可以浏览器打印为 PDF
      return new NextResponse(htmlContent + `
        <script>
          // 自动触发打印对话框
          window.onload = () => {
            setTimeout(() => window.print(), 500);
          };
        </script>
      `, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${stockCode}_analysis.html"`,
        },
      });
    }

    return NextResponse.json({ error: "不支持的格式" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
