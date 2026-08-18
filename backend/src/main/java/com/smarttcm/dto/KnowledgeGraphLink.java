package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeGraphLink {
    private String source;
    private String target;
    private String relation;
    private Integer weight;
}
