-- =============================================================================
-- Migration: AI/ML Coding Examination Platform Infrastructure
-- Run ONCE on your MySQL database.
-- =============================================================================

-- ─── 1. execution_results ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `execution_results` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`      INT             NOT NULL,
  `question_id`     INT             NULL,
  `exam_id`         VARCHAR(64)     NULL,
  `language`        VARCHAR(32)     NOT NULL,
  `domain`          VARCHAR(64)     NULL  COMMENT 'e.g. machine_learning, cvpr, rl',
  `code`            MEDIUMTEXT      NULL,
  `stdout`          TEXT            NULL,
  `stderr`          TEXT            NULL,
  `compile_error`   TEXT            NULL,
  `status`          VARCHAR(32)     NOT NULL DEFAULT 'Pending',
  `passed_cases`    SMALLINT        NOT NULL DEFAULT 0,
  `total_cases`     SMALLINT        NOT NULL DEFAULT 0,
  `score`           FLOAT           NOT NULL DEFAULT 0,
  `execution_time_ms` INT           NOT NULL DEFAULT 0,
  `memory_kb`       INT             NOT NULL DEFAULT 0,
  `has_graphs`      TINYINT(1)      NOT NULL DEFAULT 0,
  `has_images`      TINYINT(1)      NOT NULL DEFAULT 0,
  `has_metrics`     TINYINT(1)      NOT NULL DEFAULT 0,
  `sandbox_id`      VARCHAR(128)    NULL  COMMENT 'Docker container ID',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_student`   (`student_id`),
  KEY `idx_question`  (`question_id`),
  KEY `idx_exam`      (`exam_id`),
  KEY `idx_created`   (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 2. runtime_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `runtime_logs` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `execution_id`    BIGINT UNSIGNED NOT NULL,
  `log_level`       ENUM('INFO','WARN','ERROR','DEBUG') NOT NULL DEFAULT 'INFO',
  `message`         TEXT NOT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exec_id` (`execution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 3. student_metrics ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `student_metrics` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `execution_id`    BIGINT UNSIGNED NOT NULL,
  `student_id`      INT             NOT NULL,
  `question_id`     INT             NULL,
  `exam_id`         VARCHAR(64)     NULL,
  `metric_name`     VARCHAR(64)     NOT NULL  COMMENT 'accuracy | mse | r2 | loss | precision | recall | f1 | reward | episode_count',
  `metric_value`    DOUBLE          NOT NULL,
  `metric_unit`     VARCHAR(32)     NULL  COMMENT '%% | score | seconds | reward_units',
  `domain`          VARCHAR(64)     NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_execution` (`execution_id`),
  KEY `idx_student`   (`student_id`),
  KEY `idx_exam`      (`exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 4. graph_outputs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `graph_outputs` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `execution_id`    BIGINT UNSIGNED NOT NULL,
  `student_id`      INT             NOT NULL,
  `question_id`     INT             NULL,
  `exam_id`         VARCHAR(64)     NULL,
  `graph_title`     VARCHAR(255)    NULL,
  `graph_type`      VARCHAR(64)     NULL  COMMENT 'accuracy | loss | reward | scatter | bar | custom',
  `file_path`       VARCHAR(512)    NULL  COMMENT 'Relative path under /student_outputs/graphs/',
  `base64_data`     MEDIUMTEXT      NULL  COMMENT 'base64-encoded PNG for quick rendering',
  `width_px`        SMALLINT        NULL,
  `height_px`       SMALLINT        NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_execution` (`execution_id`),
  KEY `idx_student`   (`student_id`),
  KEY `idx_exam`      (`exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 5. image_outputs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `image_outputs` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `execution_id`    BIGINT UNSIGNED NOT NULL,
  `student_id`      INT             NOT NULL,
  `question_id`     INT             NULL,
  `exam_id`         VARCHAR(64)     NULL,
  `image_label`     VARCHAR(255)    NULL  COMMENT 'original | processed | edge_detected | bounding_box',
  `file_path`       VARCHAR(512)    NULL,
  `base64_data`     MEDIUMTEXT      NULL,
  `mime_type`       VARCHAR(32)     NOT NULL DEFAULT 'image/png',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_execution` (`execution_id`),
  KEY `idx_student`   (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 6. plagiarism_results ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `plagiarism_results` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exam_id`         VARCHAR(64)     NULL,
  `question_id`     INT             NULL,
  `student_id_a`    INT             NOT NULL,
  `student_id_b`    INT             NOT NULL,
  `similarity_pct`  FLOAT           NOT NULL DEFAULT 0,
  `detection_method` VARCHAR(64)    NOT NULL DEFAULT 'token_comparison',
  `flagged`         TINYINT(1)      NOT NULL DEFAULT 0,
  `details`         TEXT            NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exam`    (`exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 7. Add programming_language to questions (safe ALTER) ───────────────────
ALTER TABLE `questions`
  ADD COLUMN IF NOT EXISTS `programming_language` VARCHAR(64) NULL
    COMMENT 'Locked language/domain for coding exam'
    AFTER `subject`;

-- ─── 8. question_datasets (if not created by previous migration) ──────────────
CREATE TABLE IF NOT EXISTS `question_datasets` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `question_id`  INT             NULL,
  `dataset_type` ENUM('csv', 'image', 'rl') NOT NULL,
  `dataset_name` VARCHAR(255)    NOT NULL,
  `dataset_path` VARCHAR(512)    NOT NULL,
  `dataset_size` BIGINT          NOT NULL DEFAULT 0,
  `uploaded_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_question_id` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Done ─────────────────────────────────────────────────────────────────────
SELECT 'AI/ML Infrastructure migration complete ✓' AS status;

-- =============================================================================
-- v2 Additions (run once — safe with IF NOT EXISTS / IGNORE)
-- =============================================================================

-- Add ai_suspected and auto-grade columns to execution_results
ALTER TABLE `execution_results`
  ADD COLUMN IF NOT EXISTS `ai_suspected`       TINYINT(1)  NOT NULL DEFAULT 0
    COMMENT 'Heuristic: possible AI-generated code'       AFTER `has_metrics`,
  ADD COLUMN IF NOT EXISTS `auto_grade_score`   FLOAT       NULL
    COMMENT 'Score 0-100 from auto-evaluator'             AFTER `ai_suspected`,
  ADD COLUMN IF NOT EXISTS `auto_grade_passed`  TINYINT(1)  NULL
    COMMENT '1 if all thresholds passed'                  AFTER `auto_grade_score`,
  ADD COLUMN IF NOT EXISTS `auto_grade_detail`  TEXT        NULL
    COMMENT 'JSON breakdown from autoEvaluator'           AFTER `auto_grade_passed`;

-- Add evaluation_rules column to questions (admin-configurable thresholds)
ALTER TABLE `questions`
  ADD COLUMN IF NOT EXISTS `evaluation_rules`  TEXT        NULL
    COMMENT 'JSON: {"accuracy":{"min":0.8,"weight":50}}'  AFTER `programming_language`;

-- Add UNIQUE constraint to plagiarism_results to support ON DUPLICATE KEY UPDATE
ALTER TABLE `plagiarism_results`
  ADD UNIQUE INDEX IF NOT EXISTS `uq_pair_question`
    (`question_id`, `student_id_a`, `student_id_b`);

-- Index for fast submission locking queries
CREATE INDEX IF NOT EXISTS `idx_exec_lock`
  ON `execution_results` (`student_id`, `question_id`, `exam_id`, `status`);

SELECT 'v2 migration complete ✓' AS status;
