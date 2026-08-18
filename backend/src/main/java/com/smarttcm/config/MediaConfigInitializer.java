package com.smarttcm.config;

import com.smarttcm.util.MediaUrlHelper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;

/**
 * Media Configuration Initializer - 媒体配置初始化
 * 在应用启动时将 FileConfig 注入到 MediaUrlHelper
 */
@Configuration
@EnableConfigurationProperties(FileConfig.class)
public class MediaConfigInitializer {

    private final FileConfig fileConfig;

    public MediaConfigInitializer(FileConfig fileConfig) {
        this.fileConfig = fileConfig;
    }

    @PostConstruct
    public void init() {
        MediaUrlHelper.setFileConfig(fileConfig);
    }
}
