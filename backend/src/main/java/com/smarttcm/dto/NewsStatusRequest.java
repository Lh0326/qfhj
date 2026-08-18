package com.smarttcm.dto;

/**
 * News Status Update Request DTO - 新闻状态更新请求体
 */
public class NewsStatusRequest {

    /**
     * 目标状态（raw/used/expired）
     */
    private String status;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
