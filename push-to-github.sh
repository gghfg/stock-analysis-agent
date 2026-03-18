#!/bin/bash
# GitHub 推送脚本
# 使用方法：bash push-to-github.sh

set -e

GITHUB_USER="gghfg"
REPO_NAME="stock-analysis-agent"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "🚀 准备推送到 GitHub..."
echo "仓库：${REPO_URL}"
echo ""

cd /home/bob/Stock-Analysis-Agent

# 检查 Git 状态
echo "📋 检查 Git 状态..."
git status

# 添加所有更改
echo ""
echo "📦 添加文件..."
git add -A

# 提交
echo ""
echo "💾 提交更改..."
git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')" || echo "没有新更改需要提交"

# 推送
echo ""
echo "⬆️  推送到 GitHub..."
echo "提示：如果需要认证，请使用 GitHub Personal Access Token"
echo "创建 Token: https://github.com/settings/tokens (勾选 repo 权限)"
echo ""

git push -u origin main

echo ""
echo "✅ 推送完成！"
echo "查看仓库：https://github.com/${GITHUB_USER}/${REPO_NAME}"
