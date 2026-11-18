package com.platform.coding.dto;

import lombok.Data;

@Data
public class ExecutionRequest {
    private String source_code;
    private int language_id;
    private String stdin;
    private String expected_output;
}
