-- online_exam_schema.sql
-- Complete MySQL schema + safe, re-runnable migrations for date-based exams.
--
-- HOW TO USE
-- 1) Select the correct database: USE your_db_name;
-- 2) Run this whole file.
--
-- This script:
-- - Creates tables if they do not exist
-- - Adds missing columns (exam_date, shuffle_questions, etc.) only if missing
-- - Adds indexes only if missing

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ==============================
-- Base tables (create-if-missing)
-- ==============================

CREATE TABLE IF NOT EXISTS questions (
  id INT NOT NULL AUTO_INCREMENT,
  department VARCHAR(64) NOT NULL,
  section VARCHAR(8) NOT NULL,
  year VARCHAR(2) NOT NULL DEFAULT '1',
  semester VARCHAR(2) NOT NULL DEFAULT '1',
  subject VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL,
  image_url TEXT NULL,
  exam_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_configs (
  id INT NOT NULL AUTO_INCREMENT,
  department VARCHAR(64) NOT NULL,
  section VARCHAR(8) NOT NULL,
  year VARCHAR(2) NOT NULL,
  semester VARCHAR(2) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  time_limit INT NOT NULL DEFAULT 15,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  shuffle_questions TINYINT(1) NOT NULL DEFAULT 0,
  exam_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS responses (
  id INT NOT NULL AUTO_INCREMENT,
  roll_number VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  department VARCHAR(64) NOT NULL,
  section VARCHAR(8) NOT NULL,
  year VARCHAR(2) NOT NULL DEFAULT '1',
  semester VARCHAR(2) NOT NULL DEFAULT '1',
  subject VARCHAR(255) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  total_marks INT NOT NULL DEFAULT 0,
  tab_switched TINYINT(1) NOT NULL DEFAULT 0,
  answers JSON NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================
-- Safe migrations (idempotent)
-- ==============================

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_create_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index
  ) THEN
    SET @sql = p_create_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- Ensure required columns exist (for older databases)
CALL add_column_if_missing('questions', 'exam_date', '`exam_date` DATE NULL');

CALL add_column_if_missing('exam_configs', 'exam_date', '`exam_date` DATE NULL');
CALL add_column_if_missing('exam_configs', 'time_limit', '`time_limit` INT NOT NULL DEFAULT 15');
CALL add_column_if_missing('exam_configs', 'is_active', '`is_active` TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('exam_configs', 'shuffle_questions', '`shuffle_questions` TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('exam_configs', 'show_previous_scores', '`show_previous_scores` TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('responses', 'answers', '`answers` JSON NULL');

-- Helpful indexes for your exact filter patterns
CALL add_index_if_missing(
  'questions',
  'idx_questions_filters',
  'CREATE INDEX idx_questions_filters ON questions (department, section, year, semester, subject, exam_date)'
);

CALL add_index_if_missing(
  'exam_configs',
  'idx_exam_configs_filters',
  'CREATE INDEX idx_exam_configs_filters ON exam_configs (department, section, year, semester, subject, exam_date)'
);

-- Optional: unique config per (dept, section, year, semester, subject, exam_date)
-- NOTE: MySQL allows multiple NULLs in UNIQUE indexes. If you always use a date (recommended), this enforces uniqueness.
CALL add_index_if_missing(
  'exam_configs',
  'uniq_exam_configs_key',
  'CREATE UNIQUE INDEX uniq_exam_configs_key ON exam_configs (department, section, year, semester, subject, exam_date)'
);

-- Cleanup
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
