import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ExamProvider } from "@/context/ExamContext";
import { AdminProvider } from "@/context/AdminContext";
import { ITAdminProvider } from "@/context/ITAdminContext";
import { StudentAuthProvider } from "@/context/StudentAuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ITAdminProtectedRoute } from "@/components/ITAdminProtectedRoute";
import { StudentProtectedRoute } from "@/components/StudentProtectedRoute";
import StudentDetails from "./pages/StudentDetails";
import Exam from "./pages/Exam";
// Updated: 2026-07-30 - Frontend & Previous Scores Sync
import React from 'react';
import Result from "./pages/Result";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import ManageStudents from "./pages/admin/ManageStudents";
import ManageExams from "./pages/admin/ManageExams";
import QuizExams from "./pages/admin/QuizExams";
import CodingQuestions from "./pages/admin/CodingQuestions";
import AdminCodingExams from "./pages/admin/CodingExams";
import QuestionBanksAdmin from "./pages/admin/QuestionBanks";
import ResultsScores from "./pages/admin/ResultsScores";
import SubmissionsDashboard from "./pages/admin/SubmissionsDashboard";
import LeaderboardView from "./pages/admin/LeaderboardView";
import ITAdminLogin from "./pages/it-admin/Login";
import ITAdminDashboard from "./pages/it-admin/Dashboard";
import StudentRegister from "./pages/student/Register";
import StudentLogin from "./pages/student/Login";
import StudentDashboard from "./pages/student/Dashboard";
import MasterDashboard from "./pages/student/MasterDashboard";
import AvailableExams from "./pages/student/AvailableExams";
import PreviousScores from "./pages/student/PreviousScores";
import CodingPractice from "./pages/student/CodingPractice";
import CodingExams from "./pages/student/CodingExams";
import QuestionBanks from "./pages/student/QuestionBanks";
import Leaderboard from "./pages/student/Leaderboard";
import Performance from "./pages/student/Performance";
import ExamAnalytics from "./pages/admin/ExamAnalytics";
import CodingPracticeSetup from "./pages/student/CodingPracticeSetup";
import CodingPracticeQuestionsGlobal from "./pages/admin/CodingPracticeQuestions";
import AddQuestionForm from "./pages/admin/AddQuestionForm";
import CodingPracticeList from "./pages/admin/CodingPracticeList";
import Workshops from "./pages/admin/Workshops";
import WorkshopRegistrations from "./pages/admin/WorkshopRegistrations";
import FDPs from "./pages/admin/FDPs";
import FDPRegistrations from "./pages/admin/FDPRegistrations";
import WorkshopRegister from "./pages/public/WorkshopRegister";
import FDPRegister from "./pages/public/FDPRegister";
import NotFound from "./pages/NotFound";
import { ThemeContextProvider, useThemeContext } from '@/context/ThemeContext';
import { getTheme } from "./theme/theme";
import { BrandingProvider } from '@/context/BrandingContext';

/* AdSense Required Pages */
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";
import Contact from "./pages/Contact";
import TermsAndConditions from "./pages/TermsAndConditions";

const ThemeWrapper = ({ children }: { children: React.ReactNode }) => {
  const { mode } = useThemeContext();
  const theme = getTheme(mode);
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeContextProvider>
      <ThemeWrapper>
        <BrandingProvider>
          <CssBaseline />
        <TooltipProvider>
          <AdminProvider>
            <ITAdminProvider>
              <StudentAuthProvider>
                <ExamProvider>
                  <Toaster />
                  <Sonner />
                  <Routes>
                    {/* Student Auth Routes */}
                    <Route path="/" element={<StudentLogin />} />
                    <Route path="/student/register" element={<StudentRegister />} />
                    <Route path="/student/login" element={<StudentLogin />} />
                    <Route path="/student/dashboard" element={<StudentProtectedRoute><StudentDashboard /></StudentProtectedRoute>} />
                    <Route path="/student/master-dashboard" element={<StudentProtectedRoute><MasterDashboard /></StudentProtectedRoute>} />
                    <Route path="/student/available-exams" element={<StudentProtectedRoute><AvailableExams /></StudentProtectedRoute>} />
                    <Route path="/student/previous-scores" element={<StudentProtectedRoute><PreviousScores /></StudentProtectedRoute>} />
                    <Route path="/student/coding-practice" element={<StudentProtectedRoute><CodingPracticeSetup /></StudentProtectedRoute>} />
                    <Route path="/student/coding-practice/active" element={<StudentProtectedRoute><CodingPractice /></StudentProtectedRoute>} />
                    <Route path="/student/coding-exams" element={<StudentProtectedRoute><CodingExams /></StudentProtectedRoute>} />
                    <Route path="/student/question-bank" element={<StudentProtectedRoute><QuestionBanks /></StudentProtectedRoute>} />
                    <Route path="/student/leaderboard" element={<StudentProtectedRoute><Leaderboard /></StudentProtectedRoute>} />
                    <Route path="/student/performance" element={<StudentProtectedRoute><Performance /></StudentProtectedRoute>} />

                    {/* Direct Exam Routes (still accessible for exam flow) */}
                    <Route path="/direct-exam" element={<StudentDetails />} />
                    <Route path="/exam" element={<Exam />} />
                    <Route path="/result" element={<Result />} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/students" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />
                    <Route path="/admin/exams" element={<ProtectedRoute><ManageExams /></ProtectedRoute>} />
                    
                    {/* New Structured Admin Routes */}
                    <Route path="/admin/quiz-questions" element={<ProtectedRoute><QuizExams /></ProtectedRoute>} />
                    <Route path="/admin/quiz-responses" element={<ProtectedRoute><ResultsScores /></ProtectedRoute>} />
                    
                    <Route path="/admin/coding-practice-questions" element={<ProtectedRoute><CodingPracticeQuestionsGlobal /></ProtectedRoute>} />
                    <Route path="/admin/coding-practice-questions/add" element={<ProtectedRoute><AddQuestionForm /></ProtectedRoute>} />
                    <Route path="/admin/coding-practice-questions/list" element={<ProtectedRoute><CodingPracticeList /></ProtectedRoute>} />
                    <Route path="/admin/coding-practice-responses" element={<ProtectedRoute><SubmissionsDashboard type="Practice" /></ProtectedRoute>} />
                    
                    <Route path="/admin/coding-exam-questions" element={<ProtectedRoute><AdminCodingExams /></ProtectedRoute>} />
                    <Route path="/admin/coding-exam-responses" element={<ProtectedRoute><SubmissionsDashboard type="Exams" /></ProtectedRoute>} />
                    <Route path="/admin/exam-analytics/:examId" element={<ProtectedRoute><ExamAnalytics /></ProtectedRoute>} />

                    {/* Legacy / Catch-all Admin Routes */}
                    <Route path="/admin/quiz-exams" element={<ProtectedRoute><QuizExams /></ProtectedRoute>} />
                    <Route path="/admin/coding-questions" element={<ProtectedRoute><CodingQuestions /></ProtectedRoute>} />
                    <Route path="/admin/coding-exams" element={<ProtectedRoute><AdminCodingExams /></ProtectedRoute>} />
                    <Route path="/admin/question-banks" element={<ProtectedRoute><QuestionBanksAdmin /></ProtectedRoute>} />
                    <Route path="/admin/results" element={<ProtectedRoute><ResultsScores /></ProtectedRoute>} />
                    <Route path="/admin/submissions" element={<ProtectedRoute><SubmissionsDashboard /></ProtectedRoute>} />
                    <Route path="/admin/leaderboard" element={<ProtectedRoute><LeaderboardView /></ProtectedRoute>} />

                    {/* Event Registration Routes */}
                    <Route path="/admin/workshops" element={<ProtectedRoute><Workshops /></ProtectedRoute>} />
                    <Route path="/admin/workshop-registrations" element={<ProtectedRoute><WorkshopRegistrations /></ProtectedRoute>} />
                    <Route path="/admin/fdps" element={<ProtectedRoute><FDPs /></ProtectedRoute>} />
                    <Route path="/admin/fdp-registrations" element={<ProtectedRoute><FDPRegistrations /></ProtectedRoute>} />

                    {/* Public Event Registration Pages (no login required) */}
                    <Route path="/events/workshop/:id" element={<WorkshopRegister />} />
                    <Route path="/events/fdp/:id" element={<FDPRegister />} />

                    {/* IT Admin Routes */}
                    <Route path="/it-admin" element={<ITAdminLogin />} />
                    <Route path="/it-admin/dashboard" element={<ITAdminProtectedRoute><ITAdminDashboard /></ITAdminProtectedRoute>} />

                    {/* Legal Pages */}
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ExamProvider>
              </StudentAuthProvider>
            </ITAdminProvider>
          </AdminProvider>
        </TooltipProvider>
        </BrandingProvider>
      </ThemeWrapper>
    </ThemeContextProvider>
  </QueryClientProvider>
);

export default App;
