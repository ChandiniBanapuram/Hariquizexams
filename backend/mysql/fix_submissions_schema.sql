-- fix_submissions_schema.sql
-- Strictly follows user requirements for field names and types.

USE exam_db;

-- Drop and recreate to ensure exact schema compliance
DROP TABLE IF EXISTS code_submissions;

CREATE TABLE code_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(100) NOT NULL,
    question_id VARCHAR(100) NOT NULL,
    exam_id VARCHAR(100) NULL, -- NULL indicates practice mode
    code MEDIUMTEXT NOT NULL,
    language VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL, -- Accepted, Wrong Answer, etc.
    passed_test_cases INT DEFAULT 0,
    total_test_cases INT DEFAULT 0,
    score FLOAT DEFAULT 0,
    execution_time FLOAT DEFAULT 0,
    memory INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add b-tree indexes to optimize retrieval
CREATE INDEX idx_sub_student ON code_submissions(student_id);
CREATE INDEX idx_sub_exam ON code_submissions(exam_id);
CREATE INDEX idx_sub_question ON code_submissions(question_id);
CREATE INDEX idx_sub_composite ON code_submissions(student_id, question_id, exam_id);
