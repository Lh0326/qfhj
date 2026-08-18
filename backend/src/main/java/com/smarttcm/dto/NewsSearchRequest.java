package com.smarttcm.dto;

/**
 * News Search Request DTO - 新闻搜索请求体
 */
public class NewsSearchRequest {

    /**
     * 搜索关键词
     */
    private String keyword;

    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
}
