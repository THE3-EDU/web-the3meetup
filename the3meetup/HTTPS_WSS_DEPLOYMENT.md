# HTTPS/WSS 部署快速指南

## 核心原理

✅ **您的后端代码 (`websocket-server.js`) 不需要修改！**

- 后端保持运行在 `http://127.0.0.1:3003`（HTTP/WS）
- Nginx 监听 `443` 端口（HTTPS/WSS），处理 SSL/TLS
- Nginx 将 HTTPS/WSS 请求转发到后端的 HTTP/WS
- 客户端访问：`https://api.the3studio.cn` 和 `wss://api.the3studio.cn`

## 快速部署步骤

### 1. 确保后端正常运行

```bash
# 启动后端服务器（HTTP/WS 模式）
cd /path/to/backend
npm run websocket:pm2  # 或使用其他启动方式

# 验证后端是否运行
curl http://127.0.0.1:3003
```

### 2. 配置域名 DNS

确保 `api.the3studio.cn` 的 A 记录指向您的服务器 IP 地址。

### 3. 安装并配置 Nginx

```bash
# 安装 Nginx（如果未安装）
sudo apt-get update
sudo apt-get install nginx

# 复制配置文件
sudo cp nginx.conf.example /etc/nginx/sites-available/api.the3studio.cn

# 编辑配置文件（确认端口和域名正确）
sudo nano /etc/nginx/sites-available/api.the3studio.cn

# 启用配置
sudo ln -s /etc/nginx/sites-available/api.the3studio.cn /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t
```

### 4. 获取 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取并自动配置 SSL 证书
sudo certbot --nginx -d api.the3studio.cn

# 按照提示操作，certbot 会自动：
# - 获取 SSL 证书
# - 配置 Nginx 使用 SSL
# - 设置自动续期
```

### 5. 重启 Nginx

```bash
# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx

# 或重启
sudo systemctl restart nginx
```

### 6. 验证 HTTPS/WSS

```bash
# 测试 HTTPS API
curl https://api.the3studio.cn

# 测试 HTTP 重定向（应该自动跳转到 HTTPS）
curl -I http://api.the3studio.cn

# 在浏览器中测试
# 打开：https://api.the3studio.cn
# 检查 SSL 证书是否有效
```

### 7. 更新前端代码

在前端代码中更新 URL：

```typescript
// src/pages/TouchLivePage.tsx
const wsUrl = 'wss://api.the3studio.cn';  // 改为 WSS
const apiUrl = 'https://api.the3studio.cn';  // 改为 HTTPS

// src/pages/ReviewPage.tsx
const wsUrl = 'wss://api.the3studio.cn';
const apiUrl = 'https://api.the3studio.cn';

// src/pages/AdminPage.tsx
const wsUrl = 'wss://api.the3studio.cn';
const apiUrl = 'https://api.the3studio.cn';

// src/lib/imageUrl.ts
const apiUrl = 'https://api.the3studio.cn';
```

## 验证清单

- [ ] 后端服务器运行在 `http://127.0.0.1:3003`
- [ ] DNS 记录正确指向服务器 IP
- [ ] Nginx 配置已启用并测试通过
- [ ] SSL 证书已获取并配置
- [ ] HTTPS 访问正常：`https://api.the3studio.cn`
- [ ] HTTP 自动重定向到 HTTPS
- [ ] WebSocket 连接正常（WSS）
- [ ] 前端代码已更新为 HTTPS/WSS URL

## 常见问题

### Q: 证书续期需要手动操作吗？

A: 不需要。certbot 会自动配置定时任务，证书会在到期前自动续期。您可以用以下命令检查：

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run  # 测试续期
```

### Q: 后端需要修改代码支持 HTTPS 吗？

A: **不需要！** 后端保持 HTTP/WS 即可，Nginx 会处理所有 SSL/TLS 相关的工作。

### Q: 如何查看 Nginx 日志？

```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### Q: WebSocket 连接失败怎么办？

1. 检查 Nginx 配置是否包含 WebSocket 必需的头部：
   ```nginx
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

2. 检查后端是否正常运行：
   ```bash
   curl http://127.0.0.1:3003
   ```

3. 查看 Nginx 错误日志：
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Q: 如何临时禁用 HTTPS，只使用 HTTP？

编辑 Nginx 配置，注释掉 HTTPS server 块（443端口），取消注释 HTTP server 块中的配置部分。

## 架构图

```
┌─────────────┐
│   客户端    │
│ (浏览器)    │
└──────┬──────┘
       │
       │ HTTPS/WSS
       │ (443端口)
       ▼
┌─────────────┐
│    Nginx    │ ← SSL/TLS 处理
│  (反向代理) │
└──────┬──────┘
       │
       │ HTTP/WS
       │ (3003端口)
       ▼
┌─────────────┐
│   后端服务器 │ ← websocket-server.js
│  (Node.js)  │   (保持 HTTP/WS，无需修改)
└─────────────┘
```

## 总结

✅ **关键点：**
1. 后端代码无需修改，保持 HTTP/WS
2. Nginx 处理所有 SSL/TLS 加密
3. 客户端访问 HTTPS/WSS，Nginx 转发到后端的 HTTP/WS
4. 使用 Let's Encrypt 免费获取 SSL 证书
5. 证书自动续期，无需手动维护

