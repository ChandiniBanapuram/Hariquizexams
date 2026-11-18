-- it_admin_schema.sql
-- MySQL schema for IT Admin managed lookup tables.
-- Run this AFTER online_exam_schema.sql.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ==============================
-- Lookup tables (IT Admin managed)
-- ==============================

CREATE TABLE IF NOT EXISTS departments (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(128) NOT NULL,
  value VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(64) NOT NULL,
  value VARCHAR(8) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS years (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(32) NOT NULL,
  value VARCHAR(2) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS semesters (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(32) NOT NULL,
  value VARCHAR(2) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id INT NOT NULL AUTO_INCREMENT,
  department_value VARCHAR(64) NOT NULL,
  year_value VARCHAR(2) NOT NULL,
  semester_value VARCHAR(2) NOT NULL,
  label VARCHAR(255) NOT NULL,
  value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_subject (department_value, year_value, semester_value, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================
-- Seed existing data (skip duplicates)
-- ==============================

INSERT IGNORE INTO departments (label, value) VALUES
  ('CSE (AI & ML)', 'CSE(AI&ML)'),
  ('CSE (Data Science)', 'CSE(DataScience)');

INSERT IGNORE INTO sections (label, value) VALUES
  ('Section A', 'A'),
  ('Section B', 'B');

INSERT IGNORE INTO years (label, value) VALUES
  ('1st Year', '1'),
  ('2nd Year', '2'),
  ('3rd Year', '3'),
  ('4th Year', '4');

INSERT IGNORE INTO semesters (label, value) VALUES
  ('Sem I', '1'),
  ('Sem II', '2');

-- CSE(AI&ML) subjects
INSERT IGNORE INTO subjects (department_value, year_value, semester_value, label, value) VALUES
  ('CSE(AI&ML)', '1', '1', 'Programming for Problem Solving', 'Programming for Problem Solving'),
  ('CSE(AI&ML)', '1', '1', 'Engineering Mathematics I', 'Engineering Mathematics I'),
  ('CSE(AI&ML)', '1', '1', 'Physics for Computing', 'Physics for Computing'),
  ('CSE(AI&ML)', '1', '1', 'Basic Electrical Engineering', 'Basic Electrical Engineering'),
  ('CSE(AI&ML)', '1', '1', 'Introduction to AI', 'Introduction to AI'),
  ('CSE(AI&ML)', '1', '2', 'Data Structures', 'Data Structures'),
  ('CSE(AI&ML)', '1', '2', 'Engineering Mathematics II', 'Engineering Mathematics II'),
  ('CSE(AI&ML)', '1', '2', 'Digital Logic Design', 'Digital Logic Design'),
  ('CSE(AI&ML)', '1', '2', 'Object Oriented Programming', 'Object Oriented Programming'),
  ('CSE(AI&ML)', '1', '2', 'Python for AI', 'Python for AI'),
  ('CSE(AI&ML)', '2', '1', 'Discrete Mathematics', 'Discrete Mathematics'),
  ('CSE(AI&ML)', '2', '1', 'Database Management Systems', 'Database Management Systems'),
  ('CSE(AI&ML)', '2', '1', 'Computer Organization', 'Computer Organization'),
  ('CSE(AI&ML)', '2', '1', 'Probability & Statistics', 'Probability & Statistics'),
  ('CSE(AI&ML)', '2', '1', 'Machine Learning I', 'Machine Learning I'),
  ('CSE(AI&ML)', '2', '2', 'Discrete Mathematics', 'Discrete Mathematics'),
  ('CSE(AI&ML)', '2', '2', 'Object Oriented Programming through JAVA', 'Object Oriented Programming through JAVA'),
  ('CSE(AI&ML)', '2', '2', 'Operating Systems', 'Operating Systems'),
  ('CSE(AI&ML)', '2', '2', 'Computer Organization and Architecture', 'Computer Organization and Architecture'),
  ('CSE(AI&ML)', '2', '2', 'Artificial Intelligence', 'Artificial Intelligence'),
  ('CSE(AI&ML)', '3', '1', 'Artificial Intelligence', 'Artificial Intelligence'),
  ('CSE(AI&ML)', '3', '1', 'Machine Learning II', 'Machine Learning II'),
  ('CSE(AI&ML)', '3', '1', 'Natural Language Processing', 'Natural Language Processing'),
  ('CSE(AI&ML)', '3', '1', 'Computer Vision', 'Computer Vision'),
  ('CSE(AI&ML)', '3', '1', 'Software Engineering', 'Software Engineering'),
  ('CSE(AI&ML)', '3', '2', 'Managerial Economics and Financial Analysis', 'Managerial Economics and Financial Analysis'),
  ('CSE(AI&ML)', '3', '2', 'Automata and Compiler Design', 'Automata and Compiler Design'),
  ('CSE(AI&ML)', '3', '2', 'Neural Networks and Deep Learning', 'Neural Networks and Deep Learning'),
  ('CSE(AI&ML)', '3', '2', 'Cryptography and Network Security', 'Cryptography and Network Security'),
  ('CSE(AI&ML)', '3', '2', 'Disaster Management', 'Disaster Management'),
  ('CSE(AI&ML)', '3', '2', 'Introduction to Data Analytics', 'Introduction to Data Analytics'),
  ('CSE(AI&ML)', '4', '1', 'Advanced Deep Learning', 'Advanced Deep Learning'),
  ('CSE(AI&ML)', '4', '1', 'Generative AI', 'Generative AI'),
  ('CSE(AI&ML)', '4', '1', 'Ethics in AI', 'Ethics in AI'),
  ('CSE(AI&ML)', '4', '1', 'Data Mining', 'Data Mining'),
  ('CSE(AI&ML)', '4', '1', 'Project Management', 'Project Management'),
  ('CSE(AI&ML)', '4', '2', 'Entrepreneurship and Project Management', 'Entrepreneurship and Project Management'),
  ('CSE(AI&ML)', '4', '2', 'Software Testing Methodologies', 'Software Testing Methodologies'),
  ('CSE(AI&ML)', '4', '2', 'Environmental Impact Assessment', 'Environmental Impact Assessment');

-- CSE(DataScience) subjects
INSERT IGNORE INTO subjects (department_value, year_value, semester_value, label, value) VALUES
  ('CSE(DataScience)', '1', '1', 'Programming for Problem Solving', 'Programming for Problem Solving'),
  ('CSE(DataScience)', '1', '1', 'Engineering Mathematics I', 'Engineering Mathematics I'),
  ('CSE(DataScience)', '1', '1', 'Physics for Data Science', 'Physics for Data Science'),
  ('CSE(DataScience)', '1', '1', 'Basic Electronics', 'Basic Electronics'),
  ('CSE(DataScience)', '1', '1', 'Introduction to Data Science', 'Introduction to Data Science'),
  ('CSE(DataScience)', '1', '2', 'Data Structures', 'Data Structures'),
  ('CSE(DataScience)', '1', '2', 'Engineering Mathematics II', 'Engineering Mathematics II'),
  ('CSE(DataScience)', '1', '2', 'Statistics Basics', 'Statistics Basics'),
  ('CSE(DataScience)', '1', '2', 'Object Oriented Programming', 'Object Oriented Programming'),
  ('CSE(DataScience)', '1', '2', 'Python for Data Analysis', 'Python for Data Analysis'),
  ('CSE(DataScience)', '2', '1', 'Database Management Systems', 'Database Management Systems'),
  ('CSE(DataScience)', '2', '1', 'Probability & Statistics', 'Probability & Statistics'),
  ('CSE(DataScience)', '2', '1', 'Data Warehousing', 'Data Warehousing'),
  ('CSE(DataScience)', '2', '1', 'Exploratory Data Analysis', 'Exploratory Data Analysis'),
  ('CSE(DataScience)', '2', '1', 'Machine Learning I', 'Machine Learning I'),
  ('CSE(DataScience)', '2', '2', 'Discrete Mathematics', 'Discrete Mathematics'),
  ('CSE(DataScience)', '2', '2', 'Object Oriented Programming through JAVA', 'Object Oriented Programming through JAVA'),
  ('CSE(DataScience)', '2', '2', 'Operating Systems', 'Operating Systems'),
  ('CSE(DataScience)', '2', '2', 'Computer Organization and Architecture', 'Computer Organization and Architecture'),
  ('CSE(DataScience)', '2', '2', 'Data Handling Visualization', 'Data Handling Visualization'),
  ('CSE(DataScience)', '3', '1', 'Data Mining', 'Data Mining'),
  ('CSE(DataScience)', '3', '1', 'Machine Learning II', 'Machine Learning II'),
  ('CSE(DataScience)', '3', '1', 'Business Intelligence', 'Business Intelligence'),
  ('CSE(DataScience)', '3', '1', 'Time Series Analysis', 'Time Series Analysis'),
  ('CSE(DataScience)', '3', '1', 'Software Engineering', 'Software Engineering'),
  ('CSE(DataScience)', '3', '2', 'Managerial Economics and Financial Analysis', 'Managerial Economics and Financial Analysis'),
  ('CSE(DataScience)', '3', '2', 'Data Science', 'Data Science'),
  ('CSE(DataScience)', '3', '2', 'Predictive Analytics', 'Predictive Analytics'),
  ('CSE(DataScience)', '3', '2', 'Spatial and Multimedia Databases', 'Spatial and Multimedia Databases'),
  ('CSE(DataScience)', '3', '2', 'Disaster Management', 'Disaster Management'),
  ('CSE(DataScience)', '3', '2', 'Introduction to Data Analytics', 'Introduction to Data Analytics'),
  ('CSE(DataScience)', '4', '1', 'Advanced Analytics', 'Advanced Analytics'),
  ('CSE(DataScience)', '4', '1', 'Deep Learning for Data Science', 'Deep Learning for Data Science'),
  ('CSE(DataScience)', '4', '1', 'NLP for Data Science', 'NLP for Data Science'),
  ('CSE(DataScience)', '4', '1', 'Data Ethics', 'Data Ethics'),
  ('CSE(DataScience)', '4', '1', 'Project Management', 'Project Management'),
  ('CSE(DataScience)', '4', '2', 'Entrepreneurship and Project Management', 'Entrepreneurship and Project Management'),
  ('CSE(DataScience)', '4', '2', 'Data Stream Mining', 'Data Stream Mining'),
  ('CSE(DataScience)', '4', '2', 'Environmental Impact Assessment', 'Environmental Impact Assessment');
