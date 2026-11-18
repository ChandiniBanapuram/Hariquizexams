-- ==================== STUDENTS TABLE ====================
-- Run this SQL on your Aiven MySQL database

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_number VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  plain_password VARCHAR(255) DEFAULT NULL,
  full_name VARCHAR(100) NOT NULL,
  department VARCHAR(50) NOT NULL,
  section VARCHAR(10) NOT NULL,
  year VARCHAR(5) NOT NULL,
  semester VARCHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index for fast login lookups
CREATE INDEX idx_students_roll ON students(roll_number);

-- Index for filtering by department/year/semester/section
CREATE INDEX idx_students_filter ON students(department, year, semester, section);
