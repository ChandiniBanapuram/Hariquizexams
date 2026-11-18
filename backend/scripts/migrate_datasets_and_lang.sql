-- =============================================================================
-- Migration: Add question_datasets table for ML/CVPR/RL exam dataset support
-- Run this on your MySQL database once.
-- =============================================================================

-- Create the question_datasets table
CREATE TABLE IF NOT EXISTS `question_datasets` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `question_id`  INT             NULL COMMENT 'Foreign key to questions.id (nullable during draft)',
  `dataset_type` ENUM('csv', 'image', 'rl') NOT NULL COMMENT 'csv | image | rl',
  `dataset_name` VARCHAR(255)    NOT NULL COMMENT 'Original filename',
  `dataset_path` VARCHAR(512)    NOT NULL COMMENT 'Stored filename (on disk)',
  `dataset_size` BIGINT          NOT NULL DEFAULT 0 COMMENT 'File size in bytes',
  `uploaded_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_question_id` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- Migration: Add programming_language column to questions table
-- This stores which language/domain is required for each coding exam question.
-- =============================================================================

ALTER TABLE `questions`
  ADD COLUMN IF NOT EXISTS `programming_language` VARCHAR(64) NULL
    COMMENT 'Locked programming language/domain for coding exam questions'
    AFTER `subject`;

-- Values stored: c | cpp | java | python | data_structures_c | machine_learning |
--                data_science | reinforcement_learning | cvpr

-- =============================================================================
-- Verify
-- =============================================================================
SELECT 'question_datasets table ready' AS status;
SELECT 'programming_language column ready' AS status;
