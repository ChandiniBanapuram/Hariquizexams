-- submissions_scoring_leaderboard.sql
-- Run this on your MySQL database to support exams and scoring.

USE exam_db;

-- 1. Add exam_id to code_submissions
DROP PROCEDURE IF EXISTS migrate_submissions_v2;
DELIMITER $$
CREATE PROCEDURE migrate_submissions_v2()
BEGIN
    -- Add exam_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = 'code_submissions' AND column_name = 'exam_id'
    ) THEN
        ALTER TABLE code_submissions ADD COLUMN exam_id INT NULL AFTER question_id;
    END IF;

    -- Add indexes for performance
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'code_submissions' AND index_name = 'idx_cs_exam') THEN
        CREATE INDEX idx_cs_exam ON code_submissions(exam_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'code_submissions' AND index_name = 'idx_cs_composite') THEN
        CREATE INDEX idx_cs_composite ON code_submissions(student_id, question_id, exam_id);
    END IF;

END$$
DELIMITER ;
CALL migrate_submissions_v2();
DROP PROCEDURE IF EXISTS migrate_submissions_v2;

-- 2. Update Leaderboard View (Global and Exam-specific)
-- This view aggregates BEST scores per question per student.
CREATE OR REPLACE VIEW v_leaderboard_best AS
WITH BestSubmissions AS (
    SELECT 
        student_id, 
        question_id, 
        exam_id,
        MAX(score) as max_score,
        MIN(exec_time) as min_time,
        MAX(submitted_at) as last_submit
    FROM code_submissions
    WHERE is_submit = 1
    GROUP BY student_id, question_id, exam_id
)
SELECT 
    s.id as student_id,
    s.full_name as name,
    s.roll_number,
    s.department,
    bs.exam_id,
    SUM(bs.max_score) as total_score,
    COUNT(DISTINCT bs.question_id) as problems_solved,
    SUM(bs.min_time) as total_time,
    MAX(bs.last_submit) as last_activity
FROM students s
JOIN BestSubmissions bs ON s.id = bs.student_id
GROUP BY s.id, bs.exam_id
ORDER BY total_score DESC, total_time ASC;
