package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeGraphSyncResponse {
    private int requested;
    private int syncedQuestions;
    private long questionNodes;
    private long entityNodes;
    private long relationCount;
    private String message;
}
