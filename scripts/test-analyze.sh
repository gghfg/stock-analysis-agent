#!/bin/bash

# 股票分析 Agent 测试脚本

echo "📈 Stock Analysis Agent - API 测试"
echo "=================================="

# 测试股票代码
STOCK_CODE="${1:-sh600519}"

echo "测试股票代码：$STOCK_CODE"
echo ""

# 调用 API
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"stockCode\": \"$STOCK_CODE\",
    \"generationMode\": \"fast\",
    \"language\": \"zh\",
    \"async\": false
  }" | jq '.'

echo ""
echo "=================================="
echo "测试完成"
