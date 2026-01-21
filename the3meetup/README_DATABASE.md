# 数据库设置说明

## 问题诊断

如果API无法获取数据，请按以下步骤检查：

### 1. 检查数据库连接

访问测试API：`http://localhost:3000/api/test-db`

这个API会检查：
- 数据库连接是否正常
- uploads表是否存在
- 是否有数据

### 2. 设置数据库

#### 方法一：使用MySQL命令行

```bash
# 连接到MySQL
mysql -u root -p

# 执行SQL文件
source setup-database.sql
```

#### 方法二：手动执行SQL

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS the3meetup;
USE the3meetup;

-- 创建表
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_name VARCHAR(255) NOT NULL,
    text_content VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_image_name (image_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试数据
INSERT INTO uploads (image_name, text_content) VALUES 
('test_image_1.jpg', 'Hello 😊'),
('test_image_2.png', '测试文字');
```

### 3. 检查环境变量

确保数据库配置正确：

```bash
# 创建.env.local文件
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=12345678
DB_NAME=the3meetup
DB_PORT=3306
```

### 4. 常见问题

#### 问题1：数据库连接失败
- 检查MySQL服务是否运行
- 验证用户名和密码
- 确认端口号

#### 问题2：表不存在
- 执行setup-database.sql文件
- 检查数据库名称是否正确

#### 问题3：权限问题
```sql
-- 给用户授权
GRANT ALL PRIVILEGES ON the3meetup.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### 5. 测试步骤

1. 启动服务器：`npm run dev`
2. 访问：`http://localhost:3000/api/test-db`
3. 检查返回结果
4. 如果正常，访问：`http://localhost:3000/api/uploads`

### 6. 调试信息

服务器控制台会显示：
- 数据库连接状态
- 表检查结果
- 数据获取数量
- 错误详情

如果仍有问题，请检查服务器控制台的错误信息。 