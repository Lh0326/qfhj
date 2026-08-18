package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Category List Response - 分类选项列表响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryListResponse {

    private List<String> competitions;
    private List<String> yearStages;
    private List<String> questionTypes;
    private List<String> questionCategories;
    private List<String> contentCategories;
    private List<String> primaryProjects;
    private List<String> secondaryProjects;

}

