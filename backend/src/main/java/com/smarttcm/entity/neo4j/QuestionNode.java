package com.smarttcm.entity.neo4j;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Property;

@Node("Question")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionNode {

    @Id
    @GeneratedValue
    private Long id;

    @Property("mysqlId")
    private Long mysqlId;

    @Property("questionText")
    private String questionText;

    @Property("questionType")
    private String questionType;

    @Property("knowledgePoint")
    private String knowledgePoint;

    @Property("primaryProject")
    private String primaryProject;

    @Property("contentCategory")
    private String contentCategory;

    @Property("coreConnotation")
    private String coreConnotation;

    @Property("embedding")
    private float[] embedding;
}
