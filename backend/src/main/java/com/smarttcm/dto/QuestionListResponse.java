package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Question List Response DTO - 题目列表分页响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionListResponse {

    private List<QuestionResponse> questions;
    private long total;
    private int page;
    private int pageSize;
    private int totalPages;
}
