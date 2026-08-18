package com.smarttcm.controller;

import com.smarttcm.dto.*;
import com.smarttcm.entity.User;
import com.smarttcm.service.EmailService;
import com.smarttcm.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Auth Controller - 用户认证控制器
 * 处理用户注册、登录等认证相关接口
 */
@RestController
@RequestMapping("/auth")
@Tag(name = "认证管理", description = "用户注册、登录、Token管理等认证相关接口")
public class AuthController {

    private final UserService userService;
    private final EmailService emailService;

    public AuthController(UserService userService, EmailService emailService) {
        this.userService = userService;
        this.emailService = emailService;
    }

    /**
     * 用户注册
     * POST /api/v1/auth/register
     */
    @Operation(summary = "用户注册", description = "创建新用户账号，需要提供用户名、邮箱、密码等信息")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(
            @Valid @RequestBody UserRegisterRequest request) {
        User user = userService.register(request);
        UserResponse response = UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .isActive(user.getIsActive())
                .isSuperuser(user.getIsSuperuser())
                .language(user.getLanguage())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("用户注册成功", response));
    }

    /**
     * 用户登录
     * POST /api/v1/auth/login
     */
    @Operation(summary = "用户登录", description = "使用用户名和密码登录，获取JWT Token")
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody UserLoginRequest request) {
        TokenResponse token = userService.login(request);
        return ResponseEntity.ok(ApiResponse.success("登录成功", token));
    }

    /**
     * 获取当前用户信息
     * GET /api/v1/auth/me
     */
    @Operation(summary = "获取当前用户信息", description = "获取已登录用户的详细信息，需要JWT认证")
    @SecurityRequirement(name = "Bearer Authentication")
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.<UserResponse>error("请先登录后再访问当前用户信息"));
        }
        UserResponse response = userService.getCurrentUser(currentUser);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 更新当前用户信息
     * PUT /api/v1/auth/me
     */
    @Operation(summary = "更新当前用户信息", description = "修改当前登录用户的个人信息，需要JWT认证")
    @SecurityRequirement(name = "Bearer Authentication")
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateCurrentUser(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UserUpdateRequest request) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.<UserResponse>error("请先登录后再更新用户信息"));
        }
        User updatedUser = userService.updateCurrentUser(currentUser, request);
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

    /**
     * 修改密码
     * POST /api/v1/auth/change-password
     */
    @Operation(summary = "修改密码", description = "修改当前登录用户的密码，需要JWT认证")
    @SecurityRequirement(name = "Bearer Authentication")
    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ChangePasswordRequest request) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.<Void>error("请先登录后再修改密码"));
        }
        userService.changePassword(currentUser, request);
        return ResponseEntity.ok(ApiResponse.success("密码修改成功", null));
    }

    /**
     * 发送邮箱验证码
     * POST /api/v1/auth/send-verification-code
     */
    @Operation(summary = "发送邮箱验证码",
            description = "向指定邮箱发送验证码，支持注册和密码重置两种类型")
    @PostMapping("/send-verification-code")
    public ResponseEntity<ApiResponse<Void>> sendVerificationCode(
            @Valid @RequestBody SendVerificationCodeRequest request) {
        String type = request.getType().toUpperCase();
        switch (type) {
            case "REGISTRATION" -> {
                if (userService.emailExists(request.getEmail())) {
                    throw new com.smarttcm.exception.CustomException("该邮箱已被注册");
                }
                emailService.sendRegistrationVerificationCode(request.getEmail());
            }
            case "PASSWORD_RESET" -> emailService.sendPasswordResetCode(request.getEmail());
            default -> throw new com.smarttcm.exception.CustomException("无效的验证码类型");
        }
        return ResponseEntity.ok(ApiResponse.success("验证码已发送至邮箱", null));
    }

    /**
     * 验证邮箱验证码（用于注册）
     * POST /api/v1/auth/verify-email
     */
    @Operation(summary = "验证邮箱验证码",
            description = "验证注册验证码，验证通过后用户可用相同邮箱完成注册")
    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request) {
        emailService.verifyRegistrationCode(request.getEmail(), request.getCode());
        return ResponseEntity.ok(ApiResponse.success("邮箱验证成功，可以使用该邮箱注册", null));
    }

    /**
     * 发送密码重置邮件
     * POST /api/v1/auth/forgot-password
     */
    @Operation(summary = "发送密码重置邮件",
            description = "向已注册邮箱发送密码重置链接/验证码")
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        emailService.sendPasswordResetCode(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("密码重置邮件已发送至邮箱", null));
    }

    /**
     * 重置密码
     * POST /api/v1/auth/reset-password
     */
    @Operation(summary = "重置密码",
            description = "使用邮箱和重置令牌（验证码）重置密码")
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        String email = emailService.validatePasswordResetToken(request.getEmail(), request.getToken());
        userService.resetPasswordByEmail(email, request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success("密码重置成功", null));
    }

}

