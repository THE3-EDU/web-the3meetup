#!/bin/bash

# 后端文件打包脚本
# 用法: ./package-backend.sh

set -e

BACKEND_DIR="backend-package"
ARCHIVE_NAME="backend-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "📦 开始打包后端文件..."

# 创建临时目录
mkdir -p "$BACKEND_DIR"

# 复制必需文件
echo "📋 复制核心文件..."
cp websocket-server.js "$BACKEND_DIR/"
cp package.json "$BACKEND_DIR/"
cp package-lock.json "$BACKEND_DIR/"
cp ecosystem.config.js "$BACKEND_DIR/" 2>/dev/null || echo "⚠️  ecosystem.config.js 不存在，跳过"

# 检查是否有 .env.production 文件
if [ -f ".env.production" ]; then
    echo "📋 复制环境变量文件..."
    cp .env.production "$BACKEND_DIR/.env.example"
    echo "⚠️  已复制 .env.production 为 .env.example，请在生产环境重命名为 .env 并修改配置"
elif [ -f ".env" ]; then
    echo "📋 复制环境变量文件..."
    cp .env "$BACKEND_DIR/.env.example"
    echo "⚠️  已复制 .env 为 .env.example，请在生产环境重命名为 .env 并修改配置"
else
    echo "⚠️  未找到 .env 或 .env.production 文件，请手动创建环境变量配置文件"
fi

# 创建部署说明文件
cat > "$BACKEND_DIR/README.md" << 'EOF'
# 后端部署说明

## 部署步骤

1. 上传文件到服务器后，解压并进入目录：
```bash
tar -xzf backend-*.tar.gz
cd backend-package
```

2. 安装依赖：
```bash
npm install --production
```

3. 配置环境变量：
```bash
# 如果打包时包含了 .env.example，请重命名并修改配置
cp .env.example .env
nano .env  # 或使用你喜欢的编辑器
```

4. 准备 SSL 证书（如果使用 HTTPS/WSS）：
```bash
# Windows 服务器
# 将证书放在 C:\ssl\server.crt 和 C:\ssl\server.key
# 或通过环境变量 SSL_CERT_PATH 和 SSL_KEY_PATH 指定路径
```

5. 使用 PM2 启动：
```bash
npm run websocket:pm2
# 或
pm2 start ecosystem.config.js --only websocket-server
pm2 save
pm2 startup
```

6. 查看日志：
```bash
pm2 logs websocket-server
```
EOF

# 打包
echo "📦 创建压缩包..."
tar -czf "$ARCHIVE_NAME" "$BACKEND_DIR/"

# 显示文件大小
FILE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo ""
echo "✅ 打包完成！"
echo "📁 压缩包: $ARCHIVE_NAME ($FILE_SIZE)"
echo "📋 包含的文件："
ls -lh "$BACKEND_DIR/" | tail -n +2
echo ""
echo "🚀 上传到服务器后，解压并按照 README.md 中的说明进行部署"
echo ""
echo "清理临时文件..."
rm -rf "$BACKEND_DIR"

echo "✨ 完成！"

