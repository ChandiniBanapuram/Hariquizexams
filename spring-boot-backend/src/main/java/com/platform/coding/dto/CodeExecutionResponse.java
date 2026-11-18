package com.platform.coding.dto;

public class CodeExecutionResponse {
    private String stdout;
    private String stderr;
    private String compile_output;
    private String message;
    private Status status;
    private boolean isError;
    private String time;
    private Integer memory;

    public static class Status {
        private int id;
        private String description;

        public int getId() { return id; }
        public void setId(int id) { this.id = id; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public String getStdout() { return stdout; }
    public void setStdout(String stdout) { this.stdout = stdout; }

    public String getStderr() { return stderr; }
    public void setStderr(String stderr) { this.stderr = stderr; }

    public String getCompile_output() { return compile_output; }
    public void setCompile_output(String compile_output) { this.compile_output = compile_output; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public boolean isError() { return isError; }
    public void setError(boolean isError) { this.isError = isError; }

    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }

    public Integer getMemory() { return memory; }
    public void setMemory(Integer memory) { this.memory = memory; }
}
