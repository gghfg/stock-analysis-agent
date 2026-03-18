#!/usr/bin/env python3
"""
Stock Analysis Agent - 股票数据测试脚本
测试新浪财经和东方财富 API 数据获取
"""

import urllib.request
import json
import re
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
}


def get_market_prefix(code: str) -> tuple:
    """根据股票代码判断市场前缀"""
    code = code.strip().upper()
    if code.startswith("SH") or code.startswith("SZ"):
        return code[:2].lower(), code[2:]
    code = re.sub(r"[^0-9]", "", code)
    if code.startswith(("60", "68", "51", "58")):
        return "sh", code
    elif code.startswith(("00", "30", "15", "12")):
        return "sz", code
    return "sh", code


def fetch_stock_sina(code: str) -> dict:
    """新浪财经获取股票数据"""
    prefix, clean_code = get_market_prefix(code)
    symbol = f"{prefix}{clean_code}"
    url = f"http://hq.sinajs.cn/list={symbol}"
    
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("gbk", errors="replace")
        
        match = re.search(r'"([^"]*)"', text)
        if not match:
            return {"error": "无法解析数据"}
        
        parts = match.group(1).split(",")
        if len(parts) < 32:
            return {"error": "数据格式异常"}
        
        name = parts[0]
        prev_close = float(parts[2]) if parts[2] else 0
        current = float(parts[3]) if parts[3] else 0
        change = current - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0
        
        return {
            "source": "新浪财经",
            "symbol": symbol.upper(),
            "name": name,
            "current": round(current, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "open": float(parts[1]) if parts[1] else 0,
            "high": float(parts[4]) if parts[4] else 0,
            "low": float(parts[5]) if parts[5] else 0,
            "volume": int(parts[8]) if parts[8] else 0,
            "amount": float(parts[9]) if parts[9] else 0,
            "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    except Exception as e:
        return {"error": str(e)}


def fetch_stock_em(code: str) -> dict:
    """东方财富获取股票数据"""
    prefix, clean_code = get_market_prefix(code)
    market = 1 if prefix == "sh" else 0
    url = f"http://push2.eastmoney.com/api/qt/stock/get?secid={market}.{clean_code}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170"
    
    try:
        req = urllib.request.Request(url, headers={"Referer": "https://www.eastmoney.com/"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
        
        obj = json.loads(text)
        d = obj.get("data", {}) or {}
        
        if not d.get("f43"):
            return {"error": "无数据"}
        
        return {
            "source": "东方财富",
            "symbol": f"{prefix}{clean_code}".upper(),
            "name": d.get("f58", ""),
            "current": round(d["f43"] / 100, 2),
            "change": round(d["f169"] / 100, 2),
            "change_pct": round(d["f170"] / 100, 2),
            "open": round(d["f46"] / 100, 2),
            "high": round(d["f44"] / 100, 2),
            "low": round(d["f45"] / 100, 2),
            "prev_close": round(d["f60"] / 100, 2),
            "volume": d.get("f47", 0),
            "amount": d.get("f48", 0),
            "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    except Exception as e:
        return {"error": str(e)}


def fetch_kline_em(code: str) -> list:
    """东方财富获取日 K 线数据"""
    prefix, clean_code = get_market_prefix(code)
    market = 1 if prefix == "sh" else 0
    url = f"http://push2his.eastmoney.com/api/qt/stock/kline/get?secid={market}.{clean_code}&klt=101&fqt=1&beg=20240101&end=20261231&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58"
    
    try:
        req = urllib.request.Request(url, headers={"Referer": "https://www.eastmoney.com/"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
        
        obj = json.loads(text)
        klines = obj.get("data", {}).get("klines", [])
        
        result = []
        for line in klines[-20:]:  # 最近 20 条
            parts = line.split(",")
            result.append({
                "date": parts[0],
                "open": float(parts[1]),
                "high": float(parts[2]),
                "low": float(parts[3]),
                "close": float(parts[4]),
                "volume": int(parts[5]) if parts[5] else 0,
            })
        return result
    except Exception as e:
        return []


def fmt_stock(d: dict) -> str:
    if "error" in d:
        return f"❌ {d['error']}"
    emoji = "🔴" if d["change"] >= 0 else "🟢"
    sign = "+" if d["change"] >= 0 else ""
    return (
        f"{emoji} {d['name']} ({d['symbol']})\n"
        f"  当前价：{d['current']} 元  {sign}{d['change']} ({sign}{d['change_pct']}%)\n"
        f"  今开：{d['open']}  最高：{d['high']}  最低：{d['low']}\n"
        f"  成交量：{d['volume']:,} 手  成交额：{d['amount']/1e8:.2f} 亿\n"
        f"  数据来源：{d['source']} | {d['fetch_time']}"
    )


def main():
    import sys
    code = sys.argv[1] if len(sys.argv) > 1 else "600519"
    
    print(f"📈 测试股票代码：{code}\n")
    
    # 测试新浪财经
    print("=" * 50)
    print("【新浪财经】")
    sina_data = fetch_stock_sina(code)
    print(fmt_stock(sina_data))
    print()
    
    # 测试东方财富
    print("=" * 50)
    print("【东方财富】")
    em_data = fetch_stock_em(code)
    print(fmt_stock(em_data))
    print()
    
    # 测试 K 线数据
    print("=" * 50)
    print("【K 线数据 (最近 5 日)】")
    klines = fetch_kline_em(code)
    if klines:
        for k in klines[-5:]:
            sign = "🔴" if k["close"] >= k["open"] else "🟢"
            print(f"  {sign} {k['date']}: 开{k['open']} 高{k['high']} 低{k['low']} 收{k['close']} 量{k['volume']:,}")
    else:
        print("  无 K 线数据")
    
    print()
    print("=" * 50)


if __name__ == "__main__":
    main()
