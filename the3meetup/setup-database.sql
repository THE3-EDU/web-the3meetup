-- 创建数据库
CREATE DATABASE IF NOT EXISTS the3meetup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE the3meetup;

-- 创建上传信息表
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_name VARCHAR(255) NULL COMMENT '图片文件名（存储在OSS）',
    text_content VARCHAR(10) NOT NULL COMMENT '文字内容（最多10个字符）',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '状态：pending-待审核, approved-已通过, rejected-已拒绝',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    reviewed_at TIMESTAMP NULL COMMENT '审核时间',
    review_comment TEXT NULL COMMENT '审核备注',
    INDEX idx_status (status),
    INDEX idx_image_name (image_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片上传信息表';
