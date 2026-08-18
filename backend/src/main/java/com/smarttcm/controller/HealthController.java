package com.smarttcm.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/**
 * Health Controller - 健康检查控制器
 */
@RestController
@Tag(name = "健康检查", description = "服务健康状态检查接口")
public class HealthController {

    /**
     * 健康检查
     * GET /health
     */
    @Operation(summary = "健康检查", description = "检查服务是否正常运行，无需认证")
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "healthy"));
    }

    /**
     * 根路径
     * GET /
     */
    @Operation(summary = "欢迎信息", description = "API根路径欢迎信息")
    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        return ResponseEntity.ok(Map.of("message", "Welcome to Chinese Bridge API"));
    }

}

