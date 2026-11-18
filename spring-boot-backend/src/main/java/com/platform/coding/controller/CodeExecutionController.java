package com.platform.coding.controller;

import com.platform.coding.dto.CodeExecutionRequest;
import com.platform.coding.dto.CodeExecutionResponse;
import com.platform.coding.service.Judge0Service;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CodeExecutionController {

    private final Judge0Service judge0Service;

    public CodeExecutionController(Judge0Service judge0Service) {
        this.judge0Service = judge0Service;
    }

    @PostMapping("/execute")
    public ResponseEntity<?> executeCode(@RequestBody CodeExecutionRequest request) {
        try {
            CodeExecutionResponse response = judge0Service.executeCode(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            CodeExecutionResponse errorResponse = new CodeExecutionResponse();
            errorResponse.setError(true);
            errorResponse.setMessage(e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}
