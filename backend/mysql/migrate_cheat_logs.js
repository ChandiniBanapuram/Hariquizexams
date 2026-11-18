require('dotenv').config({ path: '../.env' });
const db = require('../config/db');

async function migrate() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS cheat_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(100) NOT NULL,
                exam_id VARCHAR(100) NOT NULL,
                event_type ENUM('TAB_SWITCH', 'COPY', 'PASTE', 'EXIT_FULLSCREEN') NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cheat_student (student_id),
                INDEX idx_cheat_exam (exam_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.query(sql);
        console.log('✅ cheat_logs table created successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
