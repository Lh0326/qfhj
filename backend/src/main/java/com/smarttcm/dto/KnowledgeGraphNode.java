package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeGraphNode {
    private String id;
    private String label;
    private String type;
    private Long questionId;
    private Integer count;
    private String description;
}
