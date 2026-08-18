package com.smarttcm.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI Configuration - SpringDoc OpenAPI配置
 * 配置API文档的基本信息和元数据
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI chineseBridgeOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Smart TCM API")
                        .description("Smart TCM API - 汉桥API后端服务\n\n" +
                                "这是一个为中文学习平台设计的RESTful API，提供了完整的用户认证、题目管理、测验功能。\n\n" +
                                "## 主要功能模块\n" +
                                "- **认证管理**：注册、登录、JWT Token管理\n" +
                                "- **用户管理**：用户信息查询和更新\n" +
                                "- **题库管理**：题目CRUD、分类筛选、搜索统计\n" +
                                "- **测验功能**：随机抽题、答题判定、结果统计\n" +
                                "- **健康检查**：服务状态监控\n\n" +
                                "## 认证方式\n" +
                                "除健康检查接口外，其他所有接口都需要JWT认证。\n" +
                                "请在请求头中添加：`Authorization: Bearer {token}`\n\n" +
                                "## 响应格式\n" +
                                "所有接口返回统一的JSON格式：\n" +
                                "- `success`: 操作是否成功\n" +
                                "- `message`: 提示信息\n" +
                                "- `data`: 响应数据")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Smart TCM Team")
                                .email("support@smarttcm.com"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:8080/api/v1")
                                .description("本地开发环境"),
                        new Server()
                                .url("https://api.smarttcm.com")
                                .description("生产环境")
                ));
    }
}

