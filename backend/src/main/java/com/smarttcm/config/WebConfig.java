package com.smarttcm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.time.Duration;
import java.net.URISyntaxException;
import java.security.ProtectionDomain;

/**
 * Web Configuration - Web 相关配置
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.file.storage-path:downloads}")
    private String storagePath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String baseDir = determineBaseDir();
        String absolutePath = baseDir + File.separator + storagePath + File.separator;
        // 注意：这里只写 /media/**，Spring Boot 会自动加上 context-path (/api/v1)
        registry.addResourceHandler("/media/**")
                .addResourceLocations("file:" + absolutePath);
    }

    /**
     * 动态确定下载目录
     * - 打包后运行：jar 包所在目录
     * - IDE 开发时：user.dir（项目根目录）
     */
    private String determineBaseDir() {
        try {
            ProtectionDomain pd = WebConfig.class.getProtectionDomain();
            if (pd != null && pd.getCodeSource() != null) {
                java.net.URL codeSourceUrl = pd.getCodeSource().getLocation();
                String protocol = codeSourceUrl.getProtocol();
                String path = codeSourceUrl.getPath();

                // jar 包运行时
                if ("file".equals(protocol) && path != null && path.endsWith(".jar")) {
                    java.net.URI uri = new java.net.URI(codeSourceUrl.toString());
                    File jarFile = new File(uri.getSchemeSpecificPart());
                    if (jarFile.isFile()) {
                        return jarFile.getParentFile().getAbsolutePath();
                    }
                }
            }
        } catch (Exception e) {
            // 忽略，fallback
        }

        // IDE 开发时或其他情况，使用 user.dir
        return System.getProperty("user.dir");
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(45))
                .build();
    }
}
