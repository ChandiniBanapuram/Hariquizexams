-- Enhancing coding_practice_questions table for stability and UX
ALTER TABLE coding_practice_questions
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Index for performance in filtered queries
CREATE INDEX idx_cpq_is_deleted ON coding_practice_questions(is_deleted);
