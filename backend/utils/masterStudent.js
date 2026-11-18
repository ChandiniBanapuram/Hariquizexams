// Master student — a single privileged roll number that can see and attempt
// exams across ALL departments / sections / years / semesters / subjects.
// Kept as a constant (not stored in the DB) so it never appears in admin
// student lists and can never be accidentally deleted.

const MASTER_ROLL_NUMBER = '22251A6601';
const MASTER_PASSWORD = '453123';

const MASTER_PROFILE = {
  id: 0,
  rollNumber: MASTER_ROLL_NUMBER,
  roll_number: MASTER_ROLL_NUMBER,
  email: 'master@gnits.local',
  fullName: 'Master Student',
  full_name: 'Master Student',
  department: 'ALL',
  section: 'ALL',
  year: 'ALL',
  semester: 'ALL',
  isMaster: true,
};

function isMasterRoll(roll) {
  return String(roll || '').trim().toUpperCase() === MASTER_ROLL_NUMBER;
}

module.exports = {
  MASTER_ROLL_NUMBER,
  MASTER_PASSWORD,
  MASTER_PROFILE,
  isMasterRoll,
};
