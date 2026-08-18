package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * TypeConfig - 评估题目类型配置
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypeConfig {
    private String typeName;
    private int count;
    private int scorePerQuestion;
}
