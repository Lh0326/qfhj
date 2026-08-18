package com.smarttcm.controller;

import com.smarttcm.dto.*;
import com.smarttcm.entity.User;
import com.smarttcm.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * User Controller - 用户管理控制器
 * 处理用户列表查询、用户信息更新等管理接口
 */
@RestController
@RequestMapping("/users")
@Tag(name = "用户管理", description = "用户列表查询、信息更新等管理接口（仅管理员）")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 获取用户列表（仅管理员）
     * GET /api/v1/users
     */
    @Operation(summary = "获取用户列表", description = "分页获取所有用户列表，仅管理员可访问")
    @SecurityRequirement(name = "Bearer Authentication")
    @PreAuthorize("hasRole('SUPERUSER')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<UserResponse>>> getUsers(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "100") int limit) {
        List<UserResponse> users = userService.getAllUsers(skip, limit);
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    /**
     * 获取指定用户信息（仅管理员）
     * GET /api/v1/users/{userId}
     */
    @Operation(summary = "获取用户详情", description = "根据用户ID获取指定用户的详细信息，仅管理员可访问")
    @SecurityRequirement(name = "Bearer Authentication")
    @PreAuthorize("hasRole('SUPERUSER')")
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(
            @PathVariable Long userId) {
        UserResponse user = userService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    /**
     * 更新指定用户信息（仅管理员）
     * PUT /api/v1/users/{userId}
     */
    @Operation(summary = "更新用户信息", description = "修改指定用户的个人信息，仅管理员可访问")
    @SecurityRequirement(name = "Bearer Authentication")
    @PreAuthorize("hasRole('SUPERUSER')")
    @PutMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody UserUpdateRequest request) {
        User updatedUser = userService.updateUser(userId, request);
        UserResponse response = UserResponse.builder()
                .id(updatedUser.getId())
                .username(updatedUser.getUsername())
                .email(updatedUser.getEmail())
                .fullName(updatedUser.getFullName())
                .isActive(updatedUser.getIsActive())
                .isSuperuser(updatedUser.getIsSuperuser())
                .language(updatedUser.getLanguage())
                .createdAt(updatedUser.getCreatedAt())
                .updatedAt(updatedUser.getUpdatedAt())
                .build();
        return ResponseEntity.ok(ApiResponse.success("用户信息更新成功", response));
    }

}

