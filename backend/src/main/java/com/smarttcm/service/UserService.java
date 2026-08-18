package com.smarttcm.service;

import com.smarttcm.dto.*;
import com.smarttcm.entity.User;
import com.smarttcm.exception.CustomException;
import com.smarttcm.repository.UserRepository;
import com.smarttcm.security.JwtUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * User Service - 用户服务层
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    /**
     * 用户注册
     */
    @Transactional
    public User register(UserRegisterRequest request) {
        // 检查用户名是否存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new CustomException("用户名已存在");
        }

        // 检查邮箱是否存在
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new CustomException("邮箱已被注册");
        }

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .isSuperuser(request.getIsSuperuser() != null ? request.getIsSuperuser() : false)
                .language(request.getLanguage() != null ? request.getLanguage() : "zh")
                .build();

        return userRepository.save(user);
    }

    /**
     * 用户登录
     */
    public TokenResponse login(UserLoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername())
                .orElseThrow(() -> new CustomException("用户名或密码错误")));

        if (!passwordEncoder.matches(request.getPassword(), user.getHashedPassword())) {
            throw new CustomException("用户名或密码错误");
        }

        if (!user.getIsActive()) {
            throw new CustomException("用户已被禁用");
        }

        String token = jwtUtils.generateToken(user.getUsername());
        return TokenResponse.builder()
                .accessToken(token)
                .tokenType("bearer")
                .build();
    }

    /**
     * 获取当前用户信息
     */
    public UserResponse getCurrentUser(User user) {
        return mapToResponse(user);
    }

    /**
     * 更新当前用户信息
     */
    @Transactional
    public User updateCurrentUser(User user, UserUpdateRequest request) {
        // 检查邮箱是否已被其他用户使用
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new CustomException("邮箱已被其他用户使用");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }

        if (request.getLanguage() != null) {
            user.setLanguage(request.getLanguage());
        }

        return userRepository.save(user);
    }

    /**
     * 修改密码
     */
    @Transactional
    public void changePassword(User user, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.getOldPassword(), user.getHashedPassword())) {
            throw new CustomException("旧密码错误");
        }

        user.setHashedPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    /**
     * 获取所有用户（管理员）
     */
    public List<UserResponse> getAllUsers(int skip, int limit) {
        return userRepository.findAll()
                .stream()
                .skip(skip)
                .limit(limit)
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * 获取用户总数
     */
    public long getUserCount() {
        return userRepository.count();
    }

    /**
     * 根据ID获取用户（管理员）
     */
    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException("用户不存在"));
        return mapToResponse(user);
    }

    /**
     * 更新指定用户（管理员）
     */
    @Transactional
    public User updateUser(Long userId, UserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException("用户不存在"));

        // 检查邮箱是否已被其他用户使用
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new CustomException("邮箱已被其他用户使用");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }

        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }

        if (request.getIsSuperuser() != null) {
            user.setIsSuperuser(request.getIsSuperuser());
        }

        if (request.getLanguage() != null) {
            user.setLanguage(request.getLanguage());
        }

        return userRepository.save(user);
    }

    /**
     * 检查邮箱是否已被注册
     */
    public boolean emailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    /**
     * 根据用户名查找用户
     */
    public User findByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    /**
     * 根据邮箱重置密码（用于忘记密码场景）
     */
    @Transactional
    public void resetPasswordByEmail(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new CustomException("该邮箱尚未注册"));
        user.setHashedPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * 转换为响应对象
     */
    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
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
    }

}

