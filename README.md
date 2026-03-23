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
npm run deploy   # 构建并部署到 Cloudflare
```

## Cloudflare 部署

这个项目已经配置为通过 Wrangler 将 `dist/` 作为 Cloudflare Workers Static Assets 部署。

首次使用前先登录 Cloudflare：

```bash
npx wrangler login
```

常用命令：

```bash
npm run deploy              # 等价于: npm run build && wrangler deploy
npx wrangler deploy         # 直接使用 Wrangler 部署
npm run preview:cloudflare  # 本地用 Wrangler 预览 dist/
```

项目根目录中的 `wrangler.jsonc` 已包含以下关键配置：

- Worker 名称：`scel-converter`
- 静态资源目录：`./dist`
- SPA 回退：`not_found_handling = "single-page-application"`

如果你在 CI 中部署，可以直接使用：

```bash
npm run build
npx wrangler deploy
```

如果你更喜欢纯静态托管，也可以继续把 `dist/` 发布到其他静态平台。

## 静态部署

构建后将 `dist/` 目录部署到任意静态托管平台：

| 平台 | 方式 |
|------|------|
| GitHub Pages | 推送 `dist/` 到 `gh-pages` 分支 |
| Netlify | 拖拽 `dist/` 文件夹到 Netlify |
| Vercel | `vercel --prod` |
| Cloudflare Workers | `npm run deploy` 或 `npx wrangler deploy` |
| Cloudflare Pages | 连接仓库，构建命令 `npm run build`，输出目录 `dist` |

## 项目结构

```
scel-converter/
├── index.html          # HTML 入口
├── src/
│   ├── parser.ts       # .scel 解析核心逻辑
│   └── main.ts         # UI 交互逻辑
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc      # Cloudflare Workers 静态资源配置
```

## .scel 格式说明

搜狗词库 `.scel` 文件使用 UTF-16LE 编码存储汉字，主要由两部分组成：

- **全局拼音表**（偏移 `0x1540`）：所有拼音组合的索引表
- **汉语词组表**（偏移 `0x2628`）：同音词组 + 拼音索引 + 词频信息
