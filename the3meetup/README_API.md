# 上传API使用说明

## 数据库设置

1. 首先创建数据库表：
```sql
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_name VARCHAR(255) NOT NULL,
    text_content VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_image_name (image_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片上传信息表';
```

2. 配置环境变量：
   - 复制 `env.example` 为 `.env.local`
   - 修改数据库连接信息

## API 端点

### POST /api/upload
上传图片和文字

**请求参数：**
- `image`: 图片文件 (multipart/form-data)
- `textContent`: 文字内容 (最多10个字符)

**响应示例：**
```json
{
  "success": true,
  "message": "上传成功",
  "data": {
    "id": 1,
    "imageName": "upload_1234567890.jpg",
    "textContent": "Hello 😊",
    "imageUrl": "/uploads/upload_1234567890.jpg"
  }
}
```

### GET /api/upload
获取所有上传记录

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "image_name": "upload_1234567890.jpg",
      "text_content": "Hello 😊",
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## 功能特点

- 支持图片文件上传
- 文字内容限制在10个字符以内
- 支持emoji表情
- 自动生成唯一文件名
- 图片保存在 `public/uploads/` 目录
- 数据存储在MySQL数据库
- 完整的错误处理和验证

## 使用步骤

1. 安装依赖：`npm install`
2. 配置数据库连接
3. 运行开发服务器：`npm run dev`
4. 访问应用，使用上传表单

## 文件结构

```
├── lib/database.ts          # 数据库连接配置
├── app/api/upload/route.ts  # 上传API路由
├── app/components/UploadForm.tsx  # 上传表单组件
└── env.example              # 环境变量示例
``` 