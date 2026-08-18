package com.smarttcm.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.neo4j.repository.config.EnableNeo4jRepositories;

/**
 * Neo4j 配置类。仅当 NEO4J_ENABLED=true 时启用。
 * 默认不启用，避免服务器未安装 Neo4j 时启动失败。
 */
@Configuration
@ConditionalOnProperty(name = "NEO4J_ENABLED", havingValue = "true", matchIfMissing = true)
@EnableNeo4jRepositories(basePackages = "com.smarttcm.repository.neo4j")
public class Neo4jConfig {
}
