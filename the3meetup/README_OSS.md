# OSS 配置说明

本项目已集成阿里云 OSS（对象存储服务）用于图片存储。

## 环境变量配置

在 `.env.local` 或 `.env.production` 文件中添加以下 OSS 配置：

```env
# 阿里云 OSS 配置
OSS_REGION=oss-cn-hangzhou          # OSS 区域，如：oss-cn-hangzhou, oss-cn-beijing 等
OSS_ACCESS_KEY_ID=your_access_key   # 阿里云 AccessKey ID
OSS_ACCESS_KEY_SECRET=your_secret   # 阿里云 AccessKey Secret
OSS_BUCKET=your-bucket-name         # OSS 存储桶名称
OSS_ENDPOINT=                       # 可选：自定义 endpoint（如果使用非阿里云 OSS 或其他 OSS 服务）
```

## 配置步骤

### 1. 创建 OSS 存储桶

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 创建存储桶（Bucket）
3. 记录存储桶名称和所在区域

### 2. 获取 AccessKey

1. 登录阿里云控制台
2. 进入 [AccessKey 管理](https://usercenter.console.aliyun.com/#/manage/ak)
3. 创建 AccessKey 并记录 AccessKey ID 和 AccessKey Secret

### 3. 配置存储桶权限

建议将存储桶设置为**公共读**权限，以便前端可以直接访问图片：
1. 在存储桶设置中选择"读写权限"
2. 设置为"公共读"

或者使用**私有存储桶**配合签名 URL（需要额外开发）。

### 4. 配置环境变量

在项目根目录创建 `.env.local`（开发环境）或 `.env.production`（生产环境）文件：

```env
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxx
OSS_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
OSS_BUCKET=the3meetup-images
```

## OSS 区域代码

常用区域代码：
- `oss-cn-hangzhou` - 华东1（杭州）
- `oss-cn-shanghai` - 华东2（上海）
- `oss-cn-beijing` - 华北2（北京）
- `oss-cn-shenzhen` - 华南1（深圳）
- `oss-cn-hongkong` - 中国（香港）
- `oss-ap-southeast-1` - 亚太东南1（新加坡）
- `oss-us-west-1` - 美国西部1（硅谷）

更多区域代码请参考 [阿里云 OSS 区域代码文档](https://help.aliyun.com/document_detail/31837.html)。

## 功能说明

### 图片上传

- 所有上传的图片都会自动上传到 OSS
- 上传成功后，图片 URL 会自动生成并返回给前端

### 图片访问

- 前端通过 `/api/uploads/[filename]` 路由访问图片
- 该路由会自动重定向到 OSS URL
- 如果 OSS 配置为公共读，图片可以直接访问

### 图片删除

- 删除记录时，会自动从 OSS 删除对应的图片文件
- 即使 OSS 删除失败，数据库记录仍会被删除（避免数据不一致）

## 注意事项

1. **安全性**：不要将 AccessKey 提交到代码仓库，使用 `.env.local` 或 `.env.production` 文件，并确保这些文件在 `.gitignore` 中
2. **成本**：OSS 按存储量和流量计费，请根据实际使用情况选择合适的存储类型
3. **CDN**：建议为 OSS 存储桶配置 CDN 加速，提升图片加载速度
4. **备份**：重要数据建议开启 OSS 的版本控制和跨区域复制功能

## 故障排查

### 问题：上传失败，提示 "OSS configuration is missing"

**解决方案**：检查环境变量是否正确配置，确保所有必需的 OSS 配置项都已设置。

### 问题：图片无法访问

**解决方案**：
1. 检查存储桶的读写权限是否设置为"公共读"
2. 检查 OSS 区域代码是否正确
3. 检查存储桶名称是否正确

### 问题：上传成功但图片 URL 不正确

**解决方案**：检查 `OSS_ENDPOINT` 配置是否正确，或者删除该配置使用默认的 OSS 域名格式。

## 迁移现有数据

如果之前使用本地存储，需要将现有图片迁移到 OSS：

1. 将所有 `public/uploads/` 目录下的图片上传到 OSS
2. 确保 OSS 中的文件名与数据库中的 `image_name` 字段一致
3. 配置 OSS 环境变量
4. 重启应用

迁移脚本示例（需要手动编写或使用 OSS 控制台上传）：

```javascript
// 示例：批量上传脚本（需要根据实际情况调整）
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

const client = new OSS({
  region: 'oss-cn-hangzhou',
  accessKeyId: 'your_access_key',
  accessKeySecret: 'your_secret',
  bucket: 'your-bucket-name'
});

const uploadDir = path.join(__dirname, 'public', 'uploads');
const files = fs.readdirSync(uploadDir);

files.forEach(async (file) => {
  const filePath = path.join(uploadDir, file);
  await client.put(file, filePath);
  console.log(`已上传: ${file}`);
});
```

