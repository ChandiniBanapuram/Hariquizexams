package com.platform.coding.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class Judge0SubmissionRequest {
    private String source_code;
    private int language_id;
    private String stdin;
    private String expected_output;
}
