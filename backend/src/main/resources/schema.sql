-- Chinese Bridge Database Schema
-- 数据库初始化脚本

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS chinesebridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chinesebridge;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题目表
CREATE TABLE IF NOT EXISTS questions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    competition VARCHAR(100),
    year_stage TEXT,
    question_type VARCHAR(50),
    question_category VARCHAR(50),
    content_category TEXT,
    question TEXT NOT NULL,
    options TEXT,
    answer TEXT,
    answer_image_url VARCHAR(500),
    question_image_url VARCHAR(500),
    media_url VARCHAR(500),
    answer_only TEXT,
    knowledge_point TEXT,
    primary_project VARCHAR(100),
    secondary_project VARCHAR(100),
    cultural_point VARCHAR(200),
    four_stage_cognition VARCHAR(100),
    bloom_cognition_level VARCHAR(100),
    core_connotation TEXT,
    why_question VARCHAR(200),
    main_focus VARCHAR(200),
    text_level VARCHAR(10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_competition (competition),
    INDEX idx_question_type (question_type),
    INDEX idx_question_category (question_category),
    INDEX idx_primary_project (primary_project),
    INDEX idx_secondary_project (secondary_project)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建默认管理员用户
-- 密码: admin123
INSERT INTO users (username, email, hashed_password, full_name, is_active, is_superuser)
VALUES ('admin', 'admin@chinesebridge.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5E', '系统管理员', TRUE, TRUE)
ON DUPLICATE KEY UPDATE username=username;

-- 添加测试用户
-- 密码: test123
INSERT INTO users (username, email, hashed_password, full_name, is_active, is_superuser)
VALUES ('testuser', 'test@chinesebridge.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '测试用户', TRUE, FALSE)
ON DUPLICATE KEY UPDATE username=username;

-- 添加示例题目
INSERT INTO questions (
    competition, year_stage, question_type, question_category, content_category,
    question, options, answer, answer_only, knowledge_point,
    primary_project, secondary_project, cultural_point, text_level
) VALUES
(
    '世界大学生中文比赛', '2023年决赛', '选择题', '选择题', '地理常识',
    '中国的最长河流是？',
    'A. 黄河 B. 长江 C. 珠江 D. 黑龙江',
    'B. 长江',
    '长江是中国第一大河，全长约6300公里，发源于青藏高原，流入东海。',
    '长江',
    '河流', '地理', '入门'
),
(
    '世界大学生中文比赛', '2023年决赛', '填空题', '填空题', '文化常识',
    '中国的首都是______。',
    NULL,
    '北京',
    '北京是中华人民共和国的首都，也是中国的政治、文化、国际交往中心。',
    '首都',
    '城市', '政治', '入门'
),
(
    '世界大学生中文比赛', '2022年复赛', '问答题', '问答题', '历史常识',
    '请简要介绍中国的四大发明。',
    NULL,
    '造纸术、印刷术、指南针、火药是中国古代的四大发明，对世界文明产生了深远影响。',
    '造纸术：西汉时期发明，蔡伦改进；印刷术：唐代出现雕版印刷，宋代毕昇发明活字印刷；指南针：战国时期的司南是前身；火药：唐代炼丹术士发明。',
    '四大发明',
    '科技', '历史', '中级'
);

SELECT '数据库初始化完成！' AS status;
SELECT '默认管理员账号: admin / admin123' AS admin_account;
SELECT '测试用户账号: testuser / test123' AS test_account;

