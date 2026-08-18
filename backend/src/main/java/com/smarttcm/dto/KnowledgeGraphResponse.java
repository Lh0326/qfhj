package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeGraphResponse {
    private List<KnowledgeGraphNode> nodes;
    private List<KnowledgeGraphLink> links;
    private List<QuestionResponse> questions;
    private Map<String, Long> stats;
    private String source;
    private String message;
}
