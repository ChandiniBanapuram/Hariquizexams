export type SubjectOption = { label: string; value: string };

type SubjectsByDept = Record<string, Record<string, Record<string, SubjectOption[]>>>;

// 4 years × 2 semesters × subjects each
const SUBJECTS_BY_DEPT: SubjectsByDept = {
  'CSE(AI&ML)': {
    '1': {
      '1': [
        { label: 'Programming for Problem Solving', value: 'Programming for Problem Solving' },
        { label: 'Engineering Mathematics I', value: 'Engineering Mathematics I' },
        { label: 'Physics for Computing', value: 'Physics for Computing' },
        { label: 'Basic Electrical Engineering', value: 'Basic Electrical Engineering' },
        { label: 'Introduction to AI', value: 'Introduction to AI' },
      ],
      '2': [
        { label: 'Data Structures', value: 'Data Structures' },
        { label: 'Engineering Mathematics II', value: 'Engineering Mathematics II' },
        { label: 'Digital Logic Design', value: 'Digital Logic Design' },
        { label: 'Object Oriented Programming', value: 'Object Oriented Programming' },
        { label: 'Python for AI', value: 'Python for AI' },
      ],
    },
    '2': {
      '1': [
        { label: 'Discrete Mathematics', value: 'Discrete Mathematics' },
        { label: 'Database Management Systems', value: 'Database Management Systems' },
        { label: 'Computer Organization', value: 'Computer Organization' },
        { label: 'Probability & Statistics', value: 'Probability & Statistics' },
        { label: 'Machine Learning I', value: 'Machine Learning I' },
      ],
      '2': [
        { label: 'Discrete Mathematics', value: 'Discrete Mathematics' },
        { label: 'Object Oriented Programming through JAVA', value: 'Object Oriented Programming through JAVA' },
        { label: 'Operating Systems', value: 'Operating Systems' },
        { label: 'Computer Organization and Architecture', value: 'Computer Organization and Architecture' },
        { label: 'Artificial Intelligence', value: 'Artificial Intelligence' },
      ],
    },
    '3': {
      '1': [
        { label: 'Artificial Intelligence', value: 'Artificial Intelligence' },
        { label: 'Machine Learning II', value: 'Machine Learning II' },
        { label: 'Natural Language Processing', value: 'Natural Language Processing' },
        { label: 'Computer Vision', value: 'Computer Vision' },
        { label: 'Software Engineering', value: 'Software Engineering' },
      ],
      '2': [
        { label: 'Managerial Economics and Financial Analysis', value: 'Managerial Economics and Financial Analysis' },
        { label: 'Automata and Compiler Design', value: 'Automata and Compiler Design' },
        { label: 'Neural Networks and Deep Learning', value: 'Neural Networks and Deep Learning' },
        { label: 'Cryptography and Network Security', value: 'Cryptography and Network Security' },
        { label: 'Disaster Management', value: 'Disaster Management' },
        { label: 'Introduction to Data Analytics', value: 'Introduction to Data Analytics' },
      ],
    },
    '4': {
      '1': [
        { label: 'Advanced Deep Learning', value: 'Advanced Deep Learning' },
        { label: 'Generative AI', value: 'Generative AI' },
        { label: 'Ethics in AI', value: 'Ethics in AI' },
        { label: 'Data Mining', value: 'Data Mining' },
        { label: 'Project Management', value: 'Project Management' },
      ],
      '2': [
        { label: 'Entrepreneurship and Project Management', value: 'Entrepreneurship and Project Management' },
        { label: 'Software Testing Methodologies', value: 'Software Testing Methodologies' },
        { label: 'Environmental Impact Assessment', value: 'Environmental Impact Assessment' },
      ],
    },
  },

  'CSE(DataScience)': {
    '1': {
      '1': [
        { label: 'Programming for Problem Solving', value: 'Programming for Problem Solving' },
        { label: 'Engineering Mathematics I', value: 'Engineering Mathematics I' },
        { label: 'Physics for Data Science', value: 'Physics for Data Science' },
        { label: 'Basic Electronics', value: 'Basic Electronics' },
        { label: 'Introduction to Data Science', value: 'Introduction to Data Science' },
      ],
      '2': [
        { label: 'Data Structures', value: 'Data Structures' },
        { label: 'Engineering Mathematics II', value: 'Engineering Mathematics II' },
        { label: 'Statistics Basics', value: 'Statistics Basics' },
        { label: 'Object Oriented Programming', value: 'Object Oriented Programming' },
        { label: 'Python for Data Analysis', value: 'Python for Data Analysis' },
      ],
    },
    '2': {
      '1': [
        { label: 'Database Management Systems', value: 'Database Management Systems' },
        { label: 'Probability & Statistics', value: 'Probability & Statistics' },
        { label: 'Data Warehousing', value: 'Data Warehousing' },
        { label: 'Exploratory Data Analysis', value: 'Exploratory Data Analysis' },
        { label: 'Machine Learning I', value: 'Machine Learning I' },
      ],
      '2': [
        { label: 'Discrete Mathematics', value: 'Discrete Mathematics' },
        { label: 'Object Oriented Programming through JAVA', value: 'Object Oriented Programming through JAVA' },
        { label: 'Operating Systems', value: 'Operating Systems' },
        { label: 'Computer Organization and Architecture', value: 'Computer Organization and Architecture' },
        { label: 'Data Handling Visualization', value: 'Data Handling Visualization' },
      ],
    },
    '3': {
      '1': [
        { label: 'Data Mining', value: 'Data Mining' },
        { label: 'Machine Learning II', value: 'Machine Learning II' },
        { label: 'Business Intelligence', value: 'Business Intelligence' },
        { label: 'Time Series Analysis', value: 'Time Series Analysis' },
        { label: 'Software Engineering', value: 'Software Engineering' },
      ],
      '2': [
        { label: 'Managerial Economics and Financial Analysis', value: 'Managerial Economics and Financial Analysis' },
        { label: 'Data Science', value: 'Data Science' },
        { label: 'Predictive Analytics', value: 'Predictive Analytics' },
        { label: 'Spatial and Multimedia Databases', value: 'Spatial and Multimedia Databases' },
        { label: 'Disaster Management', value: 'Disaster Management' },
        { label: 'Introduction to Data Analytics', value: 'Introduction to Data Analytics' },
      ],
    },
    '4': {
      '1': [
        { label: 'Advanced Analytics', value: 'Advanced Analytics' },
        { label: 'Deep Learning for Data Science', value: 'Deep Learning for Data Science' },
        { label: 'NLP for Data Science', value: 'NLP for Data Science' },
        { label: 'Data Ethics', value: 'Data Ethics' },
        { label: 'Project Management', value: 'Project Management' },
      ],
      '2': [
        { label: 'Entrepreneurship and Project Management', value: 'Entrepreneurship and Project Management' },
        { label: 'Data Stream Mining', value: 'Data Stream Mining' },
        { label: 'Environmental Impact Assessment', value: 'Environmental Impact Assessment' },
      ],
    },
  },

  'CSE': {
    '1': {
      '1': [
        { label: 'Programming for Problem Solving', value: 'Programming for Problem Solving' },
        { label: 'Engineering Mathematics I', value: 'Engineering Mathematics I' },
      ],
      '2': [
        { label: 'Data Structures Using C', value: 'Data Structures Using C' },
        { label: 'Data Structures', value: 'Data Structures' },
        { label: 'Object Oriented Programming', value: 'Object Oriented Programming' },
        { label: 'Engineering Mathematics II', value: 'Engineering Mathematics II' },
      ],
    },
    '2': {
      '1': [
        { label: 'Data Structures Using C', value: 'Data Structures Using C' },
        { label: 'Database Management Systems', value: 'Database Management Systems' },
        { label: 'Discrete Mathematics', value: 'Discrete Mathematics' },
      ],
      '2': [
        { label: 'Object Oriented Programming through JAVA', value: 'Object Oriented Programming through JAVA' },
        { label: 'Operating Systems', value: 'Operating Systems' },
      ],
    },
    '3': { '1': [], '2': [] },
    '4': { '1': [], '2': [] },
  },

  'IT': {
    '1': {
      '1': [
        { label: 'Programming for Problem Solving', value: 'Programming for Problem Solving' },
        { label: 'Engineering Mathematics I', value: 'Engineering Mathematics I' },
      ],
      '2': [
        { label: 'Data Structures Using C', value: 'Data Structures Using C' },
        { label: 'Data Structures', value: 'Data Structures' },
        { label: 'Object Oriented Programming', value: 'Object Oriented Programming' },
        { label: 'Engineering Mathematics II', value: 'Engineering Mathematics II' },
      ],
    },
    '2': {
      '1': [
        { label: 'Data Structures Using C', value: 'Data Structures Using C' },
        { label: 'Database Management Systems', value: 'Database Management Systems' },
        { label: 'Discrete Mathematics', value: 'Discrete Mathematics' },
      ],
      '2': [
        { label: 'Object Oriented Programming through JAVA', value: 'Object Oriented Programming through JAVA' },
        { label: 'Operating Systems', value: 'Operating Systems' },
      ],
    },
    '3': { '1': [], '2': [] },
    '4': { '1': [], '2': [] },
  },
};

export function getSubjectOptions(department?: string, year?: string, semester?: string): SubjectOption[] {
  if (!department || !year || !semester) return [];
  return SUBJECTS_BY_DEPT?.[department]?.[year]?.[semester] ?? [];
}

export function getSubjectOptionsForFilter(department?: string, year?: string, semester?: string): SubjectOption[] {
  // If all 3 are chosen → show exact list
  const exact = getSubjectOptions(department, year, semester);
  if (exact.length > 0) return exact;

  // Else → show union based on what is selected
  const set = new Map<string, SubjectOption>();

  const depts = department ? [department] : Object.keys(SUBJECTS_BY_DEPT);
  for (const d of depts) {
    const yearsObj = SUBJECTS_BY_DEPT[d] ?? {};
    const years = year ? [year] : Object.keys(yearsObj);
    for (const y of years) {
      const semObj = yearsObj[y] ?? {};
      const sems = semester ? [semester] : Object.keys(semObj);
      for (const s of sems) {
        for (const sub of semObj[s] ?? []) {
          set.set(sub.value, sub);
        }
      }
    }
  }

  return [...set.values()].sort((a, b) => a.label.localeCompare(b.label));
}
