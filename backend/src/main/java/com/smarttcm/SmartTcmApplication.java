package com.smarttcm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Chinese Bridge API - Main Application
 *
 * 中文桥在线考试系统 - Java后端
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class SmartTcmApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartTcmApplication.class, args);
    }
}
