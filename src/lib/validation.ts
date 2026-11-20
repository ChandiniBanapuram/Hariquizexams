import { z } from 'zod';

// Roll number pattern: 26ET103061 (2 digits, 2 letters, 6 digits)
const rollNumberPattern = /^[0-9]{2}[A-Z]{2}[0-9]{6}$/;

export const studentDetailsSchema = z.object({
  rollNumber: z
    .string()
    .min(1, 'Roll number is required')
    .regex(rollNumberPattern, 'Invalid roll number format (e.g., 26ET103061)'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  department: z.string().min(1, 'Department is required'),
  section: z.string().min(1, 'Section is required'),
  year: z.string().min(1, 'Year is required'),
  semester: z.string().min(1, 'Semester is required'),
  subject: z.string().min(1, 'Subject is required'),
  examDate: z.string().min(1, 'Exam date is required'),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const questionSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  section: z.string().min(1, 'Section is required'),
  year: z.string().min(1, 'Year is required'),
  semester: z.string().min(1, 'Semester is required'),
  subject: z.string().min(1, 'Subject is required'),
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  questionType: z.enum(['mcq', 'fill_blank']).default('mcq'),
  // MCQ fields (validated conditionally in the form)
  options: z.array(z.string()).optional(),
  correctIndex: z.coerce.number().int().min(0).optional(),
  // Fill-in-the-blank fields
  acceptedAnswers: z.array(z.string()).optional(),
  // Legacy MCQ fields kept for backward compatibility (not required)
  optionA: z.string().optional(),
  optionB: z.string().optional(),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  correctOption: z.enum(['A', 'B', 'C', 'D']).optional(),
  imageUrl: z.string().optional(),
  examDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.questionType === 'fill_blank') {
    const list = (data.acceptedAnswers || []).map((s) => (s || '').trim()).filter(Boolean);
    if (list.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['acceptedAnswers'], message: 'Add at least one accepted answer' });
    }
    return;
  }
  // MCQ: accept EITHER new options[]/correctIndex OR legacy A-D/correctOption
  const opts = (data.options || []).map((s) => (s || '').trim());
  const hasNew = opts.length >= 2;
  const legacy = [data.optionA, data.optionB, data.optionC, data.optionD].map((s) => (s || '').trim());
  const hasLegacy = legacy.every(Boolean) && !!data.correctOption;

  if (hasNew) {
    if (opts.length > 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'MCQ allows at most 6 options' });
    } else if (opts.some((v) => !v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'All option texts are required' });
    }
    if (data.correctIndex == null || data.correctIndex < 0 || data.correctIndex >= opts.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctIndex'], message: 'Select the correct option' });
    }
  } else if (!hasLegacy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['optionA'], message: 'Provide options A–D and pick the correct one' });
  }
});

export const examConfigSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  section: z.string().min(1, 'Section is required'),
  year: z.string().min(1, 'Year is required'),
  semester: z.string().min(1, 'Semester is required'),
  subject: z.string().min(1, 'Subject is required'),
  timeLimit: z.coerce.number().min(1, 'Time limit must be at least 1 minute').max(30, 'Time limit cannot exceed 30 minutes'),
  isActive: z.boolean(),
});

export type StudentDetails = z.infer<typeof studentDetailsSchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type QuestionForm = z.infer<typeof questionSchema>;
export type ExamConfigForm = z.infer<typeof examConfigSchema>;

export const DEPARTMENTS = [
  {
    label: 'CSE (AI & ML)',
    value: 'CSE(AI&ML)',
  },
  {
    label: 'CSE (Data Science)',
    value: 'CSE(DataScience)',
  }
];

export const SECTIONS = [
  {
    label: 'Section A',
    value: 'A',
  },
  {
    label: 'Section B',
    value: 'B',
  }
];

export const YEARS = [
  { label: '1st Year', value: '1' },
  { label: '2nd Year', value: '2' },
  { label: '3rd Year', value: '3' },
  { label: '4th Year', value: '4' },
];

export const SEMESTERS = [
  { label: 'Sem I', value: '1' },
  { label: 'Sem II', value: '2' },
];
