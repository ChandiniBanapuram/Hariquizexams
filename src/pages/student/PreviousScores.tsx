import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Visibility as VisibilityIcon, Done as DoneIcon, Warning as WarningIcon, Close as CloseIcon } from '@mui/icons-material';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { studentAuthAPI, PreviousScore, ScoreDetail } from '@/lib/student-auth-api';
import StudentLayout from '@/components/layouts/StudentLayout';

export default function PreviousScores() {
  const navigate = useNavigate();
  const { student, logout, isAuthenticated } = useStudentAuth();

  const [scores, setScores] = useState<PreviousScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const [scoreDetail, setScoreDetail] = useState<ScoreDetail | null>(null);
  const [codingDetail, setCodingDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'mcq' | 'coding'>('mcq');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/student/login');
      return;
    }
    fetchScores();
  }, [isAuthenticated, navigate]);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const data = await studentAuthAPI.getPreviousScores();
      setScores(Array.isArray(data) ? data : []);
    } catch {
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (row: any) => {
    setLoadingDetail(true);
    setDetailOpen(true);
    setDetailType(row.type === 'coding' ? 'coding' : 'mcq');
    try {
      if (row.type === 'coding') {
        const data = await studentAuthAPI.getCodingScoreDetails(row.id);
        setCodingDetail(data);
      } else {
        const data = await studentAuthAPI.getScoreDetails(row.id);
        setScoreDetail(data);
      }
    } catch {
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const quizScores = useMemo(() => scores.filter(s => (s as any).type === 'mcq'), [scores]);
  const codingScores = useMemo(() => scores.filter(s => (s as any).type === 'coding'), [scores]);

  const getScoreColor = (score: number, total: number) => {
    return score >= total / 2 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <StudentLayout user={student} onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6 mt-2">
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight mb-1">
            Performance <span className="text-cyan-400">History</span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] font-medium">
            Review your past examination scores and detailed analysis.
          </p>
        </div>

        {/* Tabs & Table */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-[var(--border)]">
            <div className="flex">
              <button
                onClick={() => setTabValue(0)}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-colors ${
                  tabValue === 0
                    ? 'text-cyan-500 border-b-2 border-cyan-500'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Quiz Results
              </button>
              <button
                onClick={() => setTabValue(1)}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-colors ${
                  tabValue === 1
                    ? 'text-cyan-500 border-b-2 border-cyan-500'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Coding Results
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[var(--text-secondary)]">Loading scores...</p>
              </div>
            ) : (tabValue === 0 ? quizScores : codingScores).length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[var(--text-secondary)]">No scores found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[rgba(99,102,241,0.02)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Score</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Submitted</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Tab Switched</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(tabValue === 0 ? quizScores : codingScores).map((score) => (
                      <tr key={score.id} className="hover:bg-[rgba(99,102,241,0.02)] transition-colors">
                        <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{score.subject}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScoreColor(score.score, score.total_marks)}`}>
                            {score.score}/{score.total_marks}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                          {format(new Date(score.submitted_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                            score.tab_switched
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {score.tab_switched ? <WarningIcon style={{ fontSize: 12 }} /> : <DoneIcon style={{ fontSize: 12 }} />}
                            {score.tab_switched ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleViewDetails(score)}
                            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-full transition-colors"
                          >
                            VIEW
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-large)] max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Exam <span className="text-cyan-400">Analysis</span>
              </h2>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
              >
                <CloseIcon className="text-[var(--text-secondary)]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {loadingDetail ? (
                <div className="text-center py-16">
                  <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[var(--text-secondary)]">Loading details...</p>
                </div>
              ) : detailType === 'coding' ? (
                codingDetail && (
                  <div className="space-y-8">
                    {codingDetail.submissions.map((sub: any, sIdx: number) => (
                      <div key={sub.id} className="p-6 bg-[rgba(99,102,241,0.05)] border border-[var(--border)] rounded-2xl">
                        <div className="flex items-center justify-between mb-6">
                           <div>
                              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                                <span className="text-cyan-400 mr-2">Q{sIdx + 1}.</span> {sub.question.title}
                              </h3>
                              <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-widest">{sub.subject}</p>
                           </div>
                           <div className="text-right">
                              <div className="text-2xl font-extrabold text-cyan-500">{sub.score}%</div>
                              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">{sub.passed_test_cases}/{sub.total_test_cases} Test Cases</p>
                           </div>
                        </div>

                        <div className="mb-6">
                          <h4 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2">Problem Description</h4>
                          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{sub.question.description}</p>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2">Submitted Code ({sub.language})</h4>
                          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-x-auto shadow-inner">
                            <pre className="text-cyan-400 text-sm font-mono whitespace-pre-wrap leading-relaxed">{sub.code}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : scoreDetail ? (
                <div className="space-y-4">
                  <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{scoreDetail.response.subject}</h3>
                    <div className="text-2xl font-extrabold text-cyan-500">
                      {scoreDetail.response.score} <span className="text-sm text-[var(--text-secondary)] font-normal">/ {scoreDetail.response.total_marks} Marks</span>
                    </div>
                  </div>

                  {scoreDetail.questions.map((q, idx) => {
                    const rawStudentAns = scoreDetail.studentAnswers[q.id];
                    
                    // Normalize option letters and numeric string indices (e.g. '0' -> 'A', '1' -> 'B', etc.)
                    const normalizeOption = (ans: any) => {
                      if (ans === undefined || ans === null) return '';
                      const s = String(ans).trim();
                      if (/^\d+$/.test(s)) {
                        const numericIdx = parseInt(s, 10);
                        return ['A', 'B', 'C', 'D'][numericIdx] || s;
                      }
                      return s.toUpperCase();
                    };

                    const studentAnsLetter = (q as any).student_answer_letter || normalizeOption(rawStudentAns);
                    const correctOptionLetter = (q as any).correct_option_letter || normalizeOption(
                      q.correct_option !== undefined && q.correct_option !== null && q.correct_option !== ''
                        ? q.correct_option
                        : (q as any).correct_answer_index
                    );

                    const isCorrect = (q as any).is_correct !== undefined ? (q as any).is_correct : (studentAnsLetter === correctOptionLetter);
                    const hasAttempted = rawStudentAns !== undefined && rawStudentAns !== null && rawStudentAns !== '';

                    return (
                      <div key={q.id} className={`p-4 border-l-4 rounded-lg ${
                        !hasAttempted 
                          ? 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10' 
                          : isCorrect 
                            ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' 
                            : 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-bold text-[var(--text-primary)]">
                            <span className="text-cyan-500 mr-2">Q{idx + 1}.</span> <span className="whitespace-pre-wrap">{q.question}</span>
                          </h4>
                          {!hasAttempted ? (
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 dark:bg-gray-900/30 px-2.5 py-1 rounded-full">
                              Not Answered
                            </span>
                          ) : isCorrect ? (
                            <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                              Correct
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
                              Incorrect
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {['A', 'B', 'C', 'D'].map((opt) => {
                            const optText = q[`option_${opt.toLowerCase()}` as keyof typeof q] as string;
                            if (!optText) return null;

                            const isThisCorrect = opt === correctOptionLetter;
                            const isThisSelected = opt === studentAnsLetter;

                            let classes = 'p-3 border rounded-lg transition-colors ';
                            if (isThisCorrect) {
                              classes += 'border-green-300 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
                            } else if (isThisSelected && !isCorrect) {
                              classes += 'border-red-300 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
                            } else {
                              classes += 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)]';
                            }

                            return (
                              <div key={opt} className={classes}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    <span className="opacity-60 mr-2">{opt}.</span> {optText}
                                  </span>
                                  {isThisCorrect && <DoneIcon className="text-green-600 dark:text-green-400 text-lg" />}
                                  {isThisSelected && !isThisCorrect && <CloseIcon className="text-red-600 dark:text-red-400 text-lg" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-red-500">Failed to load details.</p>
              )}
            </div>
            <div className="p-6 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-full transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
