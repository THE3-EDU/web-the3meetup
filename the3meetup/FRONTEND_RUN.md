# 前端运行说明

本项目使用 **Vite + React + TypeScript** 构建。

## 开发环境运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量（可选）

创建 `.env` 或 `.env.local` 文件：

```env
# API 服务器地址（用于开发环境代理）
VITE_API_URL=http://localhost:3001

# WebSocket 服务器地址（前端直接连接，不通过代理）
VITE_WS_URL=ws://localhost:3001
```

### 3. 启动开发服务器

```bash
# 方式一：只启动前端
npm run dev

# 方式二：同时启动前端和后端 WebSocket 服务器
npm run dev:all
```

开发服务器会在 `http://localhost:3000` 启动。

## 路由说明

- `/` - 自动重定向到 `/loading`
- `/loading` - 加载页面
- `/touchlive` - 触摸直播页面（用户上传页面）
- `/admin` - 后台管理页面
- `/review` - 内容审核页面

## 生产环境构建

### 1. 构建前端

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 2. 预览构建结果（可选）

```bash
npm run preview
```

### 3. 部署构建产物

将 `dist/` 目录的内容部署到静态文件服务器（如 Nginx、Apache 等）。

#### 使用 Nginx 部署示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # 支持前端路由（React Router）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 代理 API 请求到后端
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理（如果需要通过 Nginx 转发）
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 使用 PM2 运行（生产环境）

如果需要用 PM2 运行前端预览服务器（通常不推荐，建议使用 Nginx）：

### 1. 安装 serve（静态文件服务器）

```bash
npm install -g serve
```

### 2. 使用 PM2 运行

```bash
pm2 serve dist 3000 --spa --name "frontend"
pm2 save
```

## 环境变量配置

### 开发环境

创建 `.env.local`：

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 生产环境

创建 `.env.production`：

```env
VITE_API_URL=https://your-api-domain.com
VITE_WS_URL=wss://your-api-domain.com:3001
```

**注意**：Vite 要求环境变量必须以 `VITE_` 开头才能在客户端代码中访问。

## 常见问题

### 1. 端口被占用

如果 3000 端口被占用，Vite 会自动尝试下一个可用端口。你也可以手动指定：

```bash
# 方式一：修改 vite.config.ts 中的 port
# 方式二：使用环境变量
PORT=3002 npm run dev
```

### 2. API 代理不工作

确保 `vite.config.ts` 中的代理配置正确，并且后端服务正在运行。

### 3. WebSocket 连接失败

- 检查后端 WebSocket 服务器是否运行
- 检查防火墙是否开放了相应端口
- 确认 WebSocket URL 配置正确（ws:// 或 wss://）

### 4. 构建后路由不工作

确保服务器配置了正确的 `try_files` 规则，将所有路由请求转发到 `index.html`（见上方 Nginx 配置示例）。

## 项目结构

```
src/
├── components/          # 组件
│   └── ImageCropModal.tsx
├── pages/              # 页面
│   ├── TouchLivePage.tsx
│   ├── AdminPage.tsx
│   ├── ReviewPage.tsx
│   └── LoadingPage.tsx
├── lib/                # 工具库
│   ├── api.ts
│   └── imageUrl.ts
├── styles/             # 样式
│   └── index.css
├── App.tsx             # 根组件
└── main.tsx            # 入口文件
```

## 开发建议

1. **热更新**：Vite 支持 HMR（热模块替换），修改代码会自动刷新浏览器
2. **TypeScript**：项目使用 TypeScript，建议在开发时启用类型检查
3. **代码规范**：使用 ESLint 检查代码规范
4. **构建优化**：生产构建会自动进行代码分割和优化

