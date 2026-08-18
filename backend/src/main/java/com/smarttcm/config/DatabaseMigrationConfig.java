package com.smarttcm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import jakarta.annotation.PostConstruct;

/**
 * 数据库迁移配置 - 清理遗留列
 */
@Configuration
public class DatabaseMigrationConfig {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMigrationConfig.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationConfig(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void migrateLegacyColumns() {
        migrateDropPasswordColumn();
    }

    private void migrateDropPasswordColumn() {
        try {
            int count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password'",
                    Integer.class);

            if (count > 0) {
                jdbcTemplate.execute("ALTER TABLE users DROP COLUMN `password`");
                logger.info("========== [迁移] 已删除遗留的 password 列 ==========");
            }
        } catch (Exception e) {
            logger.warn("========== [迁移] 检查/删除 password 列时出现非致命错误: {} ==========", e.getMessage());
        }
    }
}
