/**
 * seed_coding_questions.js
 * Seeds the database with 3 Practice and 3 Exam coding practice questions.
 * Each question includes 3 test cases.
 *
 * Usage: node seed_coding_questions.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

async function seed() {
  console.log('🔌 Connecting to Database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const questions = [
    // Practice Questions
    {
      department: 'General', section: 'ALL', year: '1', semester: '1', subject: 'Coding Practice',
      title: 'Sum of Two Numbers',
      description: 'Given two integers as input (one per line), print their sum.',
      inputFormat: 'Two integers a and b.',
      outputFormat: 'The sum of a and b.',
      testCases: [
        { input: '2\n3', output: '5' },
        { input: '10\n20', output: '30' },
        { input: '-1\n5', output: '4' }
      ],
      usageType: 'practice', difficulty: 'Easy'
    },
    {
      department: 'General', section: 'ALL', year: '1', semester: '1', subject: 'Coding Practice',
      title: 'Reverse a String',
      description: 'Given a string, return its reverse.',
      inputFormat: 'A single string.',
      outputFormat: 'The reversed string.',
      testCases: [
        { input: 'hello', output: 'olleh' },
        { input: 'world', output: 'dlrow' },
        { input: 'abc', output: 'cba' }
      ],
      usageType: 'practice', difficulty: 'Easy'
    },
    {
      department: 'General', section: 'ALL', year: '1', semester: '1', subject: 'Coding Practice',
      title: 'Factorial',
      description: 'Given a non-negative integer N, return its factorial (N!).',
      inputFormat: 'An integer N.',
      outputFormat: 'N! (Factorial of N).',
      testCases: [
        { input: '0', output: '1' },
        { input: '5', output: '120' },
        { input: '3', output: '6' }
      ],
      usageType: 'practice', difficulty: 'Medium'
    },
    // Exam Questions
    {
      department: 'CSE', section: 'A', year: '2', semester: '1', subject: 'Data Structures Exam',
      title: 'Palindrome Check',
      description: 'Check if a given string is a palindrome. Return "Yes" if it is, "No" otherwise.',
      inputFormat: 'A single string.',
      outputFormat: 'Yes or No.',
      testCases: [
        { input: 'madam', output: 'Yes' },
        { input: 'hello', output: 'No' },
        { input: 'racecar', output: 'Yes' }
      ],
      usageType: 'exam', difficulty: 'Easy'
    },
    {
      department: 'CSE', section: 'A', year: '2', semester: '1', subject: 'Data Structures Exam',
      title: 'Find Maximum in Array',
      description: 'Given N (size of array) followed by N integers, find the maximum element.',
      inputFormat: 'N on first line, then N space-separated integers.',
      outputFormat: 'The maximum integer.',
      testCases: [
        { input: '5\n1 2 3 4 5', output: '5' },
        { input: '3\n10 5 8', output: '10' },
        { input: '4\n-1 -5 -2 -3', output: '-1' }
      ],
      usageType: 'exam', difficulty: 'Medium'
    },
    {
      department: 'CSE', section: 'A', year: '2', semester: '1', subject: 'Data Structures Exam',
      title: 'Nth Fibonacci Number',
      description: 'Given N, find the Nth Fibonacci number in the sequence 0, 1, 1, 2, 3, 5...',
      inputFormat: 'An integer N.',
      outputFormat: 'The Nth Fibonacci number.',
      testCases: [
        { input: '0', output: '0' },
        { input: '1', output: '1' },
        { input: '5', output: '5' }
      ],
      usageType: 'exam', difficulty: 'Medium'
    }
  ];

  console.log(`🚀 Seeding ${questions.length} coding practice questions...`);

  for (const q of questions) {
    const payload = JSON.stringify({
      title: q.title,
      description: q.description,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      testCases: q.testCases,
      usageType: q.usageType,
      difficulty: q.difficulty,
      hiddenCases: []
    });

    try {
      // Check if already exists to prevent duplicates
      const [existing] = await conn.execute(
        'SELECT id FROM questions WHERE department = ? AND subject = ? AND question LIKE ?',
        [q.department, q.subject, `%${q.title}%`]
      );

      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO questions (department, section, year, semester, subject, question, option_a, option_b, option_c, option_d, correct_option)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.department, q.section, q.year, q.semester, q.subject, payload, 'N/A', 'N/A', 'N/A', 'N/A', 'A']
        );
        console.log(`✅ Seeded: ${q.title} (${q.usageType})`);
      } else {
        console.log(`⚠️ Skipped (Already exists): ${q.title}`);
      }
    } catch (err) {
      console.error(`❌ Error seeding ${q.title}:`, err.message);
    }
  }

  await conn.end();
  console.log('\n🏁 Seeding complete!');
}

seed().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
