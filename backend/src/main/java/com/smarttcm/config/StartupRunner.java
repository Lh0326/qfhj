package com.smarttcm.config;

import com.smarttcm.entity.User;
import com.smarttcm.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Startup Runner - 应用启动时执行的任务
 */
@Component
public class StartupRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(StartupRunner.class);
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_PASSWORD = "admin123";
    private static final String ADMIN_EMAIL = "admin@smarttcm.com";
    private static final String ADMIN_FULLNAME = "System Administrator";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public StartupRunner(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        logger.info("========== 应用启动完成 ==========");

        boolean anySuperuser = userRepository.existsByIsSuperuserTrue();

        if (!anySuperuser) {
            if (userRepository.existsByUsername(ADMIN_USERNAME)) {
                logger.warn("========== [警告] 用户名 '{}' 已存在，无法创建默认管理员，请手动设置 is_superuser=true ==========", ADMIN_USERNAME);
                return;
            }

            User admin = User.builder()
                    .username(ADMIN_USERNAME)
                    .email(ADMIN_EMAIL)
                    .hashedPassword(passwordEncoder.encode(ADMIN_PASSWORD))
                    .fullName(ADMIN_FULLNAME)
                    .isActive(true)
                    .isSuperuser(true)
                    .build();

            userRepository.save(admin);
            logger.info("========== [安全提醒] 已自动创建超级管理员账户 ==========");
            logger.info("========== 用户名: {}  密码: {} ==========", ADMIN_USERNAME, ADMIN_PASSWORD);
            logger.info("========== 请在生产环境中立即修改默认密码！ ==========");
        } else {
            logger.info("========== 检测到已存在超级管理员，跳过自动创建 ==========");
        }
    }
}
