package com.platform.coding.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ExecutionResponse {
    private String stdout;
    private String stderr;
    private String compile_output;
    private String status_id;
    private String status_description;
    private String time;
    private String memory;
    private boolean passed;
}
