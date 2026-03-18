# 上传到 GitHub 的步骤

## 1. 在 GitHub 创建新仓库

访问 https://github.com/new 创建新仓库，建议名称：
- `stock-analysis-agent`
- `ai-stock-analyst`
- `multi-agent-stock-report`

**注意：**
- ✅ 创建**空仓库**（不要勾选 "Add README"、".gitignore"、"license"）
- 仓库设为 **Public** 或 **Private** 均可

## 2. 创建后获取仓库地址

GitHub 会显示类似这样的命令：
```bash
git remote add origin https://github.com/YOUR_USERNAME/stock-analysis-agent.git
```

## 3. 执行推送命令

```bash
cd /home/bob/Stock-Analysis-Agent
git remote add origin https://github.com/YOUR_USERNAME/stock-analysis-agent.git
git branch -M main
git push -u origin main
```

## 4. 使用 Token 认证（推荐）

如果提示需要认证，使用 GitHub Personal Access Token：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 生成后复制 token
5. 推送时使用：
```bash
git push -u origin main
# 用户名输入你的 GitHub 用户名
# 密码粘贴你的 Token（不会显示）
```

## 5. 或者使用 SSH（如果已配置）

```bash
git remote add origin git@github.com:YOUR_USERNAME/stock-analysis-agent.git
git push -u origin main
```

---

## 快速命令（替换 YOUR_USERNAME 为你的 GitHub 用户名）

```bash
cd /home/bob/Stock-Analysis-Agent
git remote add origin https://github.com/YOUR_USERNAME/stock-analysis-agent.git
git push -u origin main
```

## ⚠️ 注意事项

1. **.env.local 不会上传** - 已在 .gitignore 中排除，包含 API Key
2. **node_modules 不会上传** - 已在 .gitignore 中排除
3. **.next 不会上传** - 构建目录，已在 .gitignore 中排除
4. **analysis-history 不会上传** - 历史记录目录，已在 .gitignore 中排除

## 📦 上传后可分享的功能

- 完整的源代码
- README 文档
- 测试脚本
- 环境配置示例

其他人可以：
1. `git clone` 克隆项目
2. `npm install` 安装依赖
3. 配置自己的 `.env.local`
4. `npm run dev` 启动服务
