package com.smarttcm.util;

import com.smarttcm.config.FileConfig;

import java.util.Set;

/**
 * MediaUrl Helper - 媒体文件URL处理工具类
 * 将数据库中存储的相对文件名转换为前端可访问的完整URL
 */
public class MediaUrlHelper {

    private static FileConfig fileConfig;

    private static final Set<String> VIDEO_EXTENSIONS = Set.of(
            "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "m4v", "3gp"
    );

    private static final Set<String> AUDIO_EXTENSIONS = Set.of(
            "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"
    );

    public static void setFileConfig(FileConfig config) {
        fileConfig = config;
    }

    /**
     * 判断URL是否为外部URL（以http://或https://开头）
     */
    private static boolean isExternalUrl(String url) {
        return url != null && (url.startsWith("http://") || url.startsWith("https://"));
    }

    /**
     * 根据文件扩展名获取文件类型
     * @return "video", "audio", 或 "image"，无法判断时返回 null
     */
    private static String getFileType(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return null;
        }
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex == -1 || dotIndex == fileName.length() - 1) {
            return null;
        }
        String extension = fileName.substring(dotIndex + 1).toLowerCase();
        if (VIDEO_EXTENSIONS.contains(extension)) {
            return "video";
        }
        if (AUDIO_EXTENSIONS.contains(extension)) {
            return "audio";
        }
        return "image";
    }

    /**
     * 将数据库中的媒体文件名转换为可访问的完整URL
     *
     * @param fileName 数据库中存储的文件名（如 "audio/test.mp3" 或 "video/intro.mp4"）
     *                 也可能是完整的外部URL（如 "https://example.com/image.png"）
     * @return 完整的媒体访问URL（如 "http://localhost:8080/api/v1/media/video/test.mp3"）
     *         如果是外部URL则直接返回原值
     */
    public static String toMediaUrl(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return null;
        }

        // 如果是外部URL，直接返回，不进行拼接
        if (isExternalUrl(fileName)) {
            return fileName;
        }

        if (fileConfig == null) {
            return fileName;
        }

        String baseUrl = fileConfig.getBaseUrl();
        // 移除末尾的斜杠
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        // 文件名直接作为路径即可，ResourceHandler 已配置 /api/v1/media/** 映射到 downloads 目录
        // 如果文件名没有子目录前缀，根据文件类型添加
        // 例如: video_88b0c7dc3147.mp4 -> /video_88b0c7dc3147.mp4
        String filePath = fileName;
        if (!fileName.startsWith("/")) {
            String fileType = getFileType(fileName);
            if (fileType != null && !fileName.contains("/")) {
                filePath = "/" + fileType + "/" + fileName;
            } else {
                filePath = "/" + fileName;
            }
        }

        return baseUrl + filePath;
    }

    /**
     * 批量转换媒体URL
     */
    public static String[] toMediaUrls(String[] fileNames) {
        if (fileNames == null) {
            return null;
        }
        String[] urls = new String[fileNames.length];
        for (int i = 0; i < fileNames.length; i++) {
            urls[i] = toMediaUrl(fileNames[i]);
        }
        return urls;
    }
}
