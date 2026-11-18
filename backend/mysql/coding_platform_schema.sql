-- coding_platform_schema.sql
-- Adds tables required for the coding platform leaderboard and submissions.
-- Run this after online_exam_schema.sql

SET NAMES utf8mb4;

-- =====================================================
-- CODE SUBMISSIONS TABLE
-- Stores every code run/submit attempt by students
-- =====================================================
CREATE TABLE IF NOT EXISTS code_submissions (
  id            INT          NOT NULL AUTO_INCREMENT,
  student_id    INT          NOT NULL,
  question_id   INT          NOT NULL,
  language      VARCHAR(20)  NOT NULL DEFAULT 'python',
  code          MEDIUMTEXT   NOT NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'Pending',
  score         INT          NOT NULL DEFAULT 0,
  total_score   INT          NOT NULL DEFAULT 0,
  passed        INT          NOT NULL DEFAULT 0,
  total         INT          NOT NULL DEFAULT 0,
  exec_time     FLOAT        NULL,
  memory_bytes  INT          NULL,
  is_submit     TINYINT(1)   NOT NULL DEFAULT 0,
  submitted_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cs_student  (student_id),
  INDEX idx_cs_question (question_id),
  INDEX idx_cs_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LEADERBOARD VIEW  (aggregated per student per question)
-- =====================================================
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  s.id           AS student_id,
  s.name,
  s.roll_number,
  s.department,
  SUM(cs.score)  AS total_score,
  COUNT(*)       AS submissions,
  MIN(cs.exec_time) AS best_time,
  MIN(cs.memory_bytes) AS best_memory,
  MAX(cs.submitted_at) AS last_submitted
FROM code_submissions cs
JOIN students s ON s.id = cs.student_id
WHERE cs.is_submit = 1
GROUP BY cs.student_id
ORDER BY total_score DESC, best_time ASC;
