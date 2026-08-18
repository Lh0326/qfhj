package com.smarttcm.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionManager;
import org.springframework.transaction.annotation.TransactionManagementConfigurer;

/**
 * 明确指定 @Transactional 默认使用 MySQL/JPA 事务管理器。
 * 仅在 Neo4j 启用时需要（解决 JPA + Neo4j 双 TransactionManager 冲突）。
 * Neo4j 未启用时，Spring 只有一个 JPA TransactionManager，无需此配置。
 */
@Configuration
@ConditionalOnProperty(name = "NEO4J_ENABLED", havingValue = "true", matchIfMissing = true)
public class TransactionConfig implements TransactionManagementConfigurer {

    private final PlatformTransactionManager jpaTransactionManager;

    public TransactionConfig(@Qualifier("transactionManager") PlatformTransactionManager jpaTransactionManager) {
        this.jpaTransactionManager = jpaTransactionManager;
    }

    @Override
    public TransactionManager annotationDrivenTransactionManager() {
        return jpaTransactionManager;
    }
}
