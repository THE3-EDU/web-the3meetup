# Nginx WebSocket 配置指南

本指南说明如何配置 Nginx 来代理 WebSocket 和 HTTP 请求到后端服务器。

## 前提条件

- 已安装 Nginx
- 后端服务器运行在 `127.0.0.1:3003`（或通过 `PORT` 环境变量配置）
- 已配置域名 DNS 指向服务器 IP

## 配置步骤

### 1. 复制配置文件

```bash
# 复制示例配置到 Nginx 配置目录
sudo cp nginx.conf.example /etc/nginx/sites-available/your-domain

# 或者直接在 /etc/nginx/nginx.conf 的 http 块中添加配置
```

### 2. 修改配置

编辑配置文件，替换以下内容：

- `your-domain.com` - 替换为您的实际域名
- `127.0.0.1:3003` - 如果后端运行在不同端口，请修改

### 3. 启用配置（如果使用 sites-available）

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/your-domain /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
# 或
sudo service nginx reload
```

### 4. 验证配置

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/access.log
```

## 关键配置说明

### WebSocket 必需的配置

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

这三个配置项对于 WebSocket 连接至关重要：
- `proxy_http_version 1.1` - 使用 HTTP/1.1 协议
- `Upgrade` 头部 - 告诉后端这是一个升级请求
- `Connection: upgrade` - 表示要升级到 WebSocket 协议

### 超时设置

```nginx
proxy_read_timeout 86400;  # WebSocket 连接超时（24小时）
proxy_send_timeout 86400;
```

WebSocket 是长连接，需要较长的超时时间。

### 请求体大小限制

```nginx
client_max_body_size 50M;
```

如果上传大文件（如图片），需要增加此限制。

## SSL/HTTPS/WSS 配置（推荐）

**重要：** 您的后端代码 (`websocket-server.js`) 保持为 HTTP/WS 即可，不需要修改。Nginx 会处理 SSL/TLS，然后转发到后端的 HTTP/WS。

### 1. 获取 SSL 证书（使用 Let's Encrypt 免费证书）

```bash
# 安装 certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书（会自动配置 Nginx）
sudo certbot --nginx -d api.the3studio.cn

# 或者手动获取证书（不自动配置 Nginx）
sudo certbot certonly --nginx -d api.the3studio.cn
```

### 2. 配置 Nginx 使用 SSL 证书

证书获取后，certbot 通常会自动更新 Nginx 配置。如果手动配置，确保在 `nginx.conf.example` 中：

- 已启用 HTTPS server 块（443 端口）
- SSL 证书路径正确：
  ```nginx
  ssl_certificate /etc/letsencrypt/live/api.the3studio.cn/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.the3studio.cn/privkey.pem;
  ```

### 3. 启用 HTTP 到 HTTPS 重定向

配置文件中的 HTTP server 块（端口 80）已配置为自动重定向到 HTTPS。

### 4. 测试 SSL 配置

```bash
# 测试 Nginx 配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx

# 测试 HTTPS 连接
curl https://api.the3studio.cn

# 测试 WebSocket (WSS) - 可以使用浏览器开发者工具
# 或使用在线工具：https://www.websocket.org/echo.html
```

### 5. 自动续期证书（重要）

Let's Encrypt 证书每 90 天过期，需要自动续期：

```bash
# 测试自动续期
sudo certbot renew --dry-run

# certbot 通常已配置自动续期定时任务，检查：
sudo systemctl status certbot.timer
```

### 工作流程说明

```
客户端                    Nginx                     后端服务器
  │                        │                          │
  │  HTTPS/WSS 请求        │                          │
  ├───────────────────────>│                          │
  │                        │  HTTP/WS 请求（内部）    │
  │                        ├─────────────────────────>│
  │                        │                          │
  │                        │  HTTP/WS 响应            │
  │                        │<─────────────────────────┤
  │  HTTPS/WSS 响应        │                          │
  │<───────────────────────┤                          │
```

**关键点：**
- 客户端访问：`https://api.the3studio.cn` 和 `wss://api.the3studio.cn`
- Nginx 处理 SSL/TLS，然后转发到：`http://127.0.0.1:3003` 和 `ws://127.0.0.1:3003`
- 后端代码无需修改，保持 HTTP/WS 即可

## 前端配置更新

配置 SSL 后，需要更新前端代码中的 WebSocket 和 API URL：

```typescript
// 从 IP 地址改为域名
const wsUrl = 'wss://api.the3studio.cn';  // 使用 WSS（WebSocket Secure）
const apiUrl = 'https://api.the3studio.cn';  // 使用 HTTPS

// 注意：
// - 如果使用 HTTPS，WebSocket 必须使用 WSS
// - 如果使用 HTTP，WebSocket 使用 WS
// - 混合使用（HTTPS + WS）会被浏览器阻止
```

## 故障排查

### WebSocket 连接失败

1. 检查 Nginx 配置是否包含 WebSocket 必需的头部
2. 检查后端服务器是否正常运行：`curl http://127.0.0.1:3003`
3. 查看 Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`

### 502 Bad Gateway

1. 检查后端服务器是否运行
2. 检查 `proxy_pass` 地址和端口是否正确
3. 检查防火墙是否允许连接

### 413 Request Entity Too Large

增加 `client_max_body_size` 限制。

## 完整配置示例（简化版）

如果只需要 HTTP/WS，可以使用这个简化配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

