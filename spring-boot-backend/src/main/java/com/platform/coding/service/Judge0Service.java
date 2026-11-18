package com.platform.coding.service;

import com.platform.coding.dto.CodeExecutionRequest;
import com.platform.coding.dto.CodeExecutionResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class Judge0Service {

    // Official Judge0 CE community server — NO API KEY, NO RATE LIMITS!
    @Value("${judge0.base.url:https://ce.judge0.com/submissions?base64_encoded=false&wait=true}")
    private String judge0Url;

    private final RestTemplate restTemplate;

    // Language string → Judge0 language_id
    private static final Map<String, Integer> LANG_MAP = new HashMap<>();
    static {
        LANG_MAP.put("python", 71);
        LANG_MAP.put("java",   62);
        LANG_MAP.put("cpp",    54);
        LANG_MAP.put("c",      50);
        LANG_MAP.put("js",     63);
    }

    public Judge0Service(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public CodeExecutionResponse executeCode(CodeExecutionRequest request) {
        // Resolve numeric language_id
        int langId = request.getLanguage_id();
        if (langId == 0 && request.getLanguage() != null) {
            langId = LANG_MAP.getOrDefault(request.getLanguage().toLowerCase(), 71);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("source_code",     request.getSource_code());
        body.put("language_id",     langId);
        body.put("stdin",           request.getStdin() != null ? request.getStdin() : "");
        body.put("cpu_time_limit",  5);
        body.put("wall_time_limit", 10);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<CodeExecutionResponse> response = restTemplate.exchange(
                    judge0Url, HttpMethod.POST, entity, CodeExecutionResponse.class);
            return response.getBody();

        } catch (ResourceAccessException e) {
            throw new RuntimeException("Judge0 CE timeout or unreachable: " + e.getMessage());
        } catch (Exception e) {
            throw new RuntimeException("Execution error: " + e.getMessage());
        }
    }
}
