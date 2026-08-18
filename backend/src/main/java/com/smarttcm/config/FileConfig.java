package com.smarttcm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

/**
 * File Configuration - 文件服务配置
 */
@Configuration
@ConfigurationProperties(prefix = "app.file")
public class FileConfig {

    /**
     * 文件服务基础URL，前端访问媒体文件时使用
     * 如果未配置，自动从当前请求推断
     */
    private String baseUrl;

    /**
     * 本地文件存储根目录
     */
    private String storagePath = "downloads";

    /**
     * 获取 baseUrl，未配置时自动推断
     */
    public String getBaseUrl() {
        if (baseUrl != null && !baseUrl.isEmpty()) {
            return baseUrl;
        }
        // 动态推断当前服务器地址
        try {
            URI uri = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUri();
            return uri.toString() + "/media";
        } catch (Exception e) {
            return "http://localhost:8080/api/v1/media";
        }
    }

    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getStoragePath() { return storagePath; }
    public void setStoragePath(String storagePath) { this.storagePath = storagePath; }
}
