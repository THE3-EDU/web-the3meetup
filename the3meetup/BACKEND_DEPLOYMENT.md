# 后端部署文件清单

## 必需文件

### 1. 核心程序文件
```
websocket-server.js          # 主程序文件（必需）
```

### 2. 配置文件
```
package.json                 # Node.js 依赖配置（必需）
package-lock.json           # 依赖版本锁定文件（必需，用于确保依赖版本一致）
ecosystem.config.js         # PM2 配置文件（推荐）
```

### 3. SSL 证书文件（如果使用 HTTPS/WSS）
```
C:\ssl\server.crt           # SSL 证书文件（HTTPS 必需）
C:\ssl\server.key           # SSL 私钥文件（HTTPS 必需）
```
或者使用环境变量指定路径：
- `SSL_CERT_PATH`
- `SSL_KEY_PATH`

### 4. 环境变量配置
创建 `.env` 或 `.env.production` 文件（可选，也可以直接设置系统环境变量）：

```env
# 数据库配置
DB_PASSWORD=your_database_password
DB_NAME=the3meetup
DB_HOST=localhost

# OSS 配置（阿里云对象存储）
OSS_REGION=cn-hongkong
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=your_endpoint  # 可选

# SSL 证书路径（可选，如果不使用默认路径）
SSL_CERT_PATH=C:\ssl\server.crt
SSL_KEY_PATH=C:\ssl\server.key

# WebSocket 配置（可选）
WS_HOST=your_domain_or_ip
WS_DOMAIN=your_domain.com
PORT=3001
```

## 服务器上执行

### 方式一：安装所有依赖（推荐用于生产环境）

1. **上传文件到服务器**
```bash
# 上传以下文件到服务器：
websocket-server.js
package.json
package-lock.json
ecosystem.config.js
.env 或 .env.production  # 如果使用环境变量文件
```

2. **在服务器上安装依赖**
```bash
cd /path/to/backend
npm install --production
```

这会安装以下依赖包（根据 package.json）：
- `ws` - WebSocket 服务器
- `mysql2` - MySQL 数据库客户端
- `ali-oss` - 阿里云 OSS SDK
- `express` - HTTP 服务器框架
- 以及它们的子依赖

3. **使用 PM2 启动**
```bash
# 使用配置文件启动
npm run websocket:pm2

# 或直接使用 PM2 命令
pm2 start ecosystem.config.js --only websocket-server

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 方式二：打包 node_modules（不推荐，文件较大）

如果网络环境限制无法在服务器上安装依赖，可以打包 node_modules：

```bash
# 在本地打包（会很大，通常几百MB）
tar -czf backend.tar.gz \
  websocket-server.js \
  package.json \
  package-lock.json \
  ecosystem.config.js \
  node_modules/

# 上传到服务器后解压
tar -xzf backend.tar.gz
```

## 目录结构示例

服务器上的目录结构应该是：

```
/path/to/backend/
├── websocket-server.js
├── package.json
├── package-lock.json
├── ecosystem.config.js
├── .env                    # 或 .env.production
├── node_modules/          # npm install 后生成
└── logs/                  # PM2 自动创建（如果不存在）
    ├── pm2-websocket-error.log
    └── pm2-websocket-out.log
```

## 最小文件列表（仅核心文件）

如果只想上传最小文件集，只需要：

```
websocket-server.js
package.json
package-lock.json
```

然后在服务器上运行：
```bash
npm install --production
node websocket-server.js
```

## 注意事项

1. **不要上传 node_modules**：文件太大，建议在服务器上 `npm install`
2. **保护敏感信息**：`.env` 文件包含敏感信息，不要提交到版本控制
3. **SSL 证书安全**：确保 SSL 证书文件的权限设置正确（仅管理员可读）
4. **防火墙**：确保服务器开放端口 3001（或你配置的端口）
5. **数据库连接**：确保数据库服务正在运行且可访问

## 快速部署命令

```bash
# 1. 上传文件（使用 scp）
scp websocket-server.js package.json package-lock.json ecosystem.config.js user@server:/path/to/backend/

# 2. 登录服务器
ssh user@server

# 3. 进入目录并安装依赖
cd /path/to/backend
npm install --production

# 4. 配置环境变量（编辑 .env 或设置系统环境变量）

# 5. 启动服务
pm2 start ecosystem.config.js --only websocket-server
pm2 save
pm2 startup
```

## 验证部署

```bash
# 检查 PM2 状态
pm2 status

# 查看日志
pm2 logs websocket-server

# 测试 HTTPS API
curl https://your-domain:3001/

# 测试 WebSocket（使用 wscat）
npm install -g wscat
wscat -c wss://your-domain:3001
```

