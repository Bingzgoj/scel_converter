# SCEL 词库转换器

将搜狗输入法 `.scel` 词库文件转换为纯文本 `.txt` 文件。

## 特点

- 🖥️ **纯前端** — 全部在浏览器内处理，无需服务器，不上传任何文件
- 📦 **批量转换** — 支持同时拖入多个 `.scel` 文件
- ⬇️ **一键下载** — 逐个下载或全部下载
- 🚀 **静态部署** — `npm run build` 后直接部署 `dist/` 目录

## 快速开始

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建静态文件 → dist/
npm run preview  # 预览构建结果
```

## Cloudflare Pages 部署

这个项目是纯静态 Vite 应用，可以直接部署到 Cloudflare Pages。

### 方式一：连接仓库自动构建

在 Cloudflare Pages 后台连接仓库时，使用以下构建设置：

- **Framework preset**: `None`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

### 方式二：Wrangler 直接上传

项目已经添加了 Cloudflare Pages 部署脚本：

```bash
npm run deploy:cloudflare:project  # 首次创建 Pages 项目
npm run deploy                     # 构建并上传 dist/ 到 Cloudflare Pages
npm run preview:cloudflare         # 用 Wrangler 本地预览 Pages 静态产物
```

首次使用前需要先登录 Cloudflare：

```bash
npx wrangler login
```

如果你是在 CI 中部署，建议显式传入 Pages 项目名：

```bash
npm run build
npx wrangler pages deploy dist --project-name "$CLOUDFLARE_PAGES_PROJECT_NAME"
```

## 静态部署

构建后将 `dist/` 目录部署到任意静态托管平台：

| 平台 | 方式 |
|------|------|
| GitHub Pages | 推送 `dist/` 到 `gh-pages` 分支 |
| Netlify | 拖拽 `dist/` 文件夹到 Netlify |
| Vercel | `vercel --prod` |
| Cloudflare Pages | 连接仓库自动构建，或使用 `npm run deploy` 直接上传 |

## 项目结构

```
scel-converter/
├── index.html          # HTML 入口
├── src/
│   ├── parser.ts       # .scel 解析核心逻辑
│   └── main.ts         # UI 交互逻辑
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## .scel 格式说明

搜狗词库 `.scel` 文件使用 UTF-16LE 编码存储汉字，主要由两部分组成：

- **全局拼音表**（偏移 `0x1540`）：所有拼音组合的索引表
- **汉语词组表**（偏移 `0x2628`）：同音词组 + 拼音索引 + 词频信息
