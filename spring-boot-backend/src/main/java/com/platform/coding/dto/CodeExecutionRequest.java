package com.platform.coding.dto;

public class CodeExecutionRequest {
    private String source_code;
    private String language;   // preferred: "python", "java", "cpp", "c", "js"
    private int language_id;   // legacy Judge0 id (still supported as fallback)
    private String stdin;
    private String expected_output;

    public CodeExecutionRequest() {}

    public String getSource_code() { return source_code; }
    public void setSource_code(String source_code) { this.source_code = source_code; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public int getLanguage_id() { return language_id; }
    public void setLanguage_id(int language_id) { this.language_id = language_id; }

    public String getStdin() { return stdin; }
    public void setStdin(String stdin) { this.stdin = stdin; }

    public String getExpected_output() { return expected_output; }
    public void setExpected_output(String expected_output) { this.expected_output = expected_output; }
}
