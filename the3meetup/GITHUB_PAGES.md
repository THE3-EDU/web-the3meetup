# 部署到 GitHub Pages

## 方式一：GitHub Actions 自动部署（推荐）

1. **开启 GitHub Pages（Source 选 Actions）**
   - 打开仓库 **Settings** → **Pages**
   - **Build and deployment** → **Source** 选 **GitHub Actions**

2. **推送代码**
   - 把代码推到 `main` 分支后，会自动跑 workflow 构建并部署。
   - 或到 **Actions** 里选 “Deploy to GitHub Pages” → **Run workflow** 手动触发。

3. **访问地址**
   - 项目页：`https://<你的用户名>.github.io/<仓库名>/`
   - 展示页：`https://<你的用户名>.github.io/<仓库名>/touchliveshow`

首次部署后可能要等 1～2 分钟，地址可在 **Settings** → **Pages** 里看到。

---

## 方式二：本地构建后手动部署

1. **安装依赖**
   ```bash
   npm ci
   ```

2. **按仓库名设置 base 并构建**
   - 仓库名是 `the3meetup` 时：
   ```bash
   VITE_BASE_URL=/the3meetup/ npm run build:gh
   ```
   - 会生成 `dist/`，并把 `index.html` 复制为 `404.html`（保证 SPA 路由刷新不 404）。

3. **推送到 gh-pages 分支**
   ```bash
   npx gh-pages -d dist
   ```
   - 或在 **Settings** → **Pages** 里 **Source** 选分支 **gh-pages**，之后每次执行上面命令即可更新。

4. **一键构建+部署（同上 base）**
   ```bash
   VITE_BASE_URL=/the3meetup/ npm run deploy:gh
   ```
   - 需先安装：`npm i -D gh-pages`（`deploy:gh` 里用到了 `npx gh-pages`，不安装也可用 npx 临时跑）。

---

## 说明

- **base 路径**：项目页的根路径是 `/<仓库名>/`，所以静态资源要带这个前缀，构建时已通过 `VITE_BASE_URL` 配置。
- **SPA 路由**：`build:gh` 会复制 `dist/index.html` 为 `dist/404.html`，这样访问 `/touchliveshow` 等路径时 GitHub 会返回 404 页面（即同一个 index），再由前端路由正确展示。
- **展示页**：`/touchliveshow` 使用纯前端的 `TouchLiveShowPage`，不连后端、不连 WebSocket，适合做 GitHub 上的展示。
