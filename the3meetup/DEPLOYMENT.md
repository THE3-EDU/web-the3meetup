# 部署说明

## 服务器要求

- Node.js 18+ 
- MySQL 8.0+
- 至少 1GB RAM
- 支持 WebSocket 的服务器

## 部署步骤

### 1. 环境准备

```bash
# 安装 Node.js 和 npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 MySQL
sudo apt-get install mysql-server

# 安装 PM2 (进程管理器)
npm install -g pm2
```

### 2. 项目部署

```bash
# 克隆项目
git clone <your-repo-url>
cd the3meetup

# 安装依赖
npm install

# 构建项目
npm run build
```

### 3. 数据库配置

```sql
-- 创建数据库
CREATE DATABASE the3meetup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'the3meetup'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON the3meetup.* TO 'the3meetup'@'localhost';
FLUSH PRIVILEGES;

-- 导入数据库结构
mysql -u the3meetup -p the3meetup < setup-database.sql
```

### 4. 环境变量配置

编辑 `.env.production` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=the3meetup
DB_PASSWORD=your_secure_password
DB_NAME=the3meetup
DB_PORT=3306

# WebSocket配置 (替换为你的域名)
WS_SERVER_URL=ws://your-domain.com:3001
WS_API_URL=http://your-domain.com:3001
NEXT_PUBLIC_WS_URL=ws://your-domain.com:3001

# Next.js配置
NEXT_PUBLIC_API_URL=http://your-domain.com
```

### 5. 防火墙配置

```bash
# 开放端口
sudo ufw allow 3000  # Next.js
sudo ufw allow 3001  # WebSocket
sudo ufw allow 3306  # MySQL (如果需要远程访问)
```

### 6. 使用 PM2 启动服务

```bash
# 启动 WebSocket 服务器
pm2 start websocket-server.js --name "websocket-server"

# 启动 Next.js 应用
pm2 start npm --name "next-app" -- start

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 7. Nginx 配置 (可选)

创建 `/etc/nginx/sites-available/the3meetup`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket API 路径转发
    location /new-upload {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /delete-upload {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /new-pending {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /status {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 连接
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /path/to/your/project/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/the3meetup /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL 证书 (推荐)

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

## 监控和维护

### 查看服务状态

```bash
# 查看 PM2 进程
pm2 status

# 查看日志
pm2 logs websocket-server
pm2 logs next-app

# 重启服务
pm2 restart all
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 安装依赖
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart all
```

### 备份数据库

```bash
# 创建备份脚本
mysqldump -u the3meetup -p the3meetup > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 故障排除

### 常见问题

1. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确认端口 3001 已开放
   - 检查环境变量配置

2. **数据库连接失败**
   - 检查 MySQL 服务状态
   - 确认数据库用户权限
   - 检查环境变量中的数据库配置

3. **上传功能失败**
   - 检查 `public/uploads` 目录权限
   - 确认磁盘空间充足

### 日志查看

```bash
# PM2 日志
pm2 logs

# Next.js 日志
pm2 logs next-app

# WebSocket 日志
pm2 logs websocket-server

# 系统日志
sudo journalctl -u nginx
sudo journalctl -u mysql
``` 