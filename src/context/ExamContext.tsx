import React, { createContext, useContext, useState, ReactNode } from 'react';
import { StudentDetails } from '@/lib/validation';
import { Question } from '@/lib/api';

interface ExamResult {
  name: string;
  rollNumber: string;
  department: string;
  section: string;
  score: number;
  totalMarks: number;
}

interface ExamContextType {
  studentDetails: StudentDetails | null;
  setStudentDetails: (details: StudentDetails | null) => void;
  questions: Question[];
  setQuestions: (questions: Question[]) => void;
  timeLimit: number; // in minutes
  setTimeLimit: (minutes: number) => void;
  examResult: ExamResult | null;
  setExamResult: (result: ExamResult | null) => void;
  resetExam: () => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(() => {
    const saved = localStorage.getItem('examStudentDetails');
    return saved ? JSON.parse(saved) : null;
  });
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('examQuestions');
    return saved ? JSON.parse(saved) : [];
  });
  const [timeLimit, setTimeLimit] = useState<number>(() => {
    const saved = localStorage.getItem('examTimeLimit');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [examResult, setExamResult] = useState<ExamResult | null>(() => {
    const saved = localStorage.getItem('examResult');
    return saved ? JSON.parse(saved) : null;
  });

  React.useEffect(() => {
    if (studentDetails) {
      localStorage.setItem('examStudentDetails', JSON.stringify(studentDetails));
    } else {
      localStorage.removeItem('examStudentDetails');
    }
  }, [studentDetails]);

  React.useEffect(() => {
    if (questions && questions.length > 0) {
      localStorage.setItem('examQuestions', JSON.stringify(questions));
    } else {
      localStorage.removeItem('examQuestions');
    }
  }, [questions]);

  React.useEffect(() => {
    localStorage.setItem('examTimeLimit', timeLimit.toString());
  }, [timeLimit]);

  React.useEffect(() => {
    if (examResult) {
      localStorage.setItem('examResult', JSON.stringify(examResult));
    } else {
      localStorage.removeItem('examResult');
    }
  }, [examResult]);

  const resetExam = () => {
    setStudentDetails(null);
    setQuestions([]);
    setTimeLimit(5);
    setExamResult(null);
    localStorage.removeItem('examStudentDetails');
    localStorage.removeItem('examQuestions');
    localStorage.removeItem('examTimeLimit');
    localStorage.removeItem('examResult');
    localStorage.removeItem('examStarted');
    localStorage.removeItem('examEndTime');
    localStorage.removeItem('examAnswers');
    localStorage.removeItem('examCurrentQuestionIndex');
  };

  return (
    <ExamContext.Provider
      value={{
        studentDetails,
        setStudentDetails,
        questions,
        setQuestions,
        timeLimit,
        setTimeLimit,
        examResult,
        setExamResult,
        resetExam,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (context === undefined) {
    throw new Error('useExam must be used within an ExamProvider');
  }
  return context;
}
