import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Assignment as AssignmentIcon, People as PeopleIcon, Code as CodeIcon,
  Quiz as QuizIcon, TrendingUp as TrendingUpIcon,
  History as HistoryIcon, EmojiEvents as TrophyIcon,
  LibraryBooks as QuestionBankIcon, BarChart as BarChartIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI } from '@/lib/api';
import AdminLayout from '@/components/layouts/AdminLayout';


function LiveCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 1000;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      
      const currentVal = Math.floor(start + (end - start) * easeProgress);
      setDisplayValue(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  const formatted = String(displayValue).padStart(6, '0');

  return (
    <div className="flex gap-1 font-mono text-2xl md:text-3xl font-black text-red-500 tracking-wider">
      {formatted.split('').map((char, index) => (
        <span 
          key={index}
          className="inline-block px-2 py-1 bg-red-950/20 border border-red-500/25 rounded-md text-red-500"
          style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.8)' }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [globalResponses, setGlobalResponses] = useState(0);
  const [stats, setStats] = useState({
    totalStudents: 0, totalExams: 0, quizExams: 0,
    activeQuizExams: 0, codingExams: 0, totalResponses: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setMounted(true);
    const loadStats = async () => {
      try {
        const statsRes = await adminAPI.getDashboardStats();
        if (statsRes && !statsRes.message && typeof statsRes.totalExams === 'number') {
          setStats({
            totalStudents: statsRes.totalStudents || 0,
            totalExams: statsRes.totalExams || 0,
            quizExams: statsRes.quizExams || 0,
            activeQuizExams: statsRes.activeQuizExams || 0,
            codingExams: statsRes.codingExams || 0,
            totalResponses: statsRes.totalResponses || 0,
          });
          setGlobalResponses(statsRes.globalResponses || statsRes.totalResponses || 0);
        } else {
          const [examConfigsRes, responsesRes, globalResponsesRes] = await Promise.allSettled([
            adminAPI.getExamConfigs(),
            adminAPI.getResponses(),
            adminAPI.getGlobalResponsesCount(),
          ]);
          const examConfigs = examConfigsRes.status === 'fulfilled' && Array.isArray(examConfigsRes.value) ? examConfigsRes.value : [];
          const responses = responsesRes.status === 'fulfilled' && Array.isArray(responsesRes.value) ? responsesRes.value : [];
          const globalRes = globalResponsesRes.status === 'fulfilled' ? globalResponsesRes.value : { count: 0 };

          const globCount = globalRes?.count || 0;
          const totalResp = Math.max(responses.length, globCount);
          const uniqueStudents = responses.length > 0
            ? new Set(responses.map((r: any) => r.roll_number)).size
            : (totalResp > 0 ? 1 : 0);
          const examList = Array.isArray(examConfigs) ? examConfigs : [];
          const theoryCount = examList.filter(e => !e.subject.toLowerCase().includes('coding')).length;
          const activeTheoryCount = examList.filter(e => !e.subject.toLowerCase().includes('coding') && e.is_active).length;
          const codingCount = examList.filter(e => e.subject.toLowerCase().includes('coding')).length;

          setStats({
            totalStudents: uniqueStudents,
            totalExams: examList.length,
            quizExams: theoryCount,
            activeQuizExams: activeTheoryCount,
            codingExams: codingCount,
            totalResponses: totalResp,
          });
          setGlobalResponses(globCount || totalResp);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();

    // Live polling every 5 seconds for real-time live count updates
    const interval = setInterval(async () => {
      try {
        const statsRes = await adminAPI.getDashboardStats();
        if (statsRes && !statsRes.message && typeof statsRes.totalResponses === 'number') {
          setStats(prev => ({
            ...prev,
            totalStudents: statsRes.totalStudents || 0,
            totalResponses: statsRes.totalResponses || 0,
            totalExams: statsRes.totalExams || prev.totalExams,
            quizExams: statsRes.quizExams || prev.quizExams,
            activeQuizExams: statsRes.activeQuizExams || prev.activeQuizExams,
            codingExams: statsRes.codingExams || prev.codingExams,
          }));
          setGlobalResponses(statsRes.globalResponses || statsRes.totalResponses || 0);
        }
      } catch (err) {
        console.error('Live polling failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'Students', value: stats.totalStudents, icon: <PeopleIcon style={{ fontSize: 18 }} />, color: '#6366F1' },
    { label: 'Responses', value: stats.totalResponses, icon: <TrendingUpIcon style={{ fontSize: 18 }} />, color: '#3B82F6' },
    { label: 'Total Exams', value: stats.totalExams, icon: <AssignmentIcon style={{ fontSize: 18 }} />, color: '#22C55E' },
    { label: 'Quiz Exams', value: stats.quizExams, icon: <QuizIcon style={{ fontSize: 18 }} />, color: '#8B5CF6' },
    { label: 'Coding Exams', value: stats.codingExams, icon: <CodeIcon style={{ fontSize: 18 }} />, color: '#F59E0B' },
  ];

  const quickActions = [
    {
      label: 'Submissions History',
      description: 'All coding attempt logs & detailed records',
      icon: <HistoryIcon style={{ fontSize: 20 }} />,
      color: '#6366F1',
      action: () => navigate('/admin/submissions'),
    },
    {
      label: 'Leaderboard',
      description: 'Top performers ranked across all exams',
      icon: <TrophyIcon style={{ fontSize: 20 }} />,
      color: '#F59E0B',
      action: () => navigate('/admin/leaderboard'),
    },
    {
      label: 'Question Banks',
      description: 'Browse & manage PDF question repositories',
      icon: <QuestionBankIcon style={{ fontSize: 20 }} />,
      color: '#22C55E',
      action: () => navigate('/admin/question-banks'),
    },
    {
      label: 'Results & Scores',
      description: 'Student performance reports and analytics',
      icon: <BarChartIcon style={{ fontSize: 20 }} />,
      color: '#3B82F6',
      action: () => navigate('/admin/results'),
    },
  ];

  return (
    <AdminLayout onLogout={logout}>
      <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        {/* Page Header */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight mb-2">
              Dashboard
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              Overview of assessment platform
            </p>
          </div>

          {/* Red Lined Glowing Box Area for Live Response Counter */}
          <div className="border border-red-500 rounded-xl p-3 bg-red-500/5 backdrop-blur-sm shadow-[0_0_12px_rgba(239,68,68,0.25)] flex flex-col items-center gap-1 min-w-[180px]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                Live Responses
              </span>
            </div>
            <LiveCounter value={globalResponses} />
          </div>
        </div>

        {(
          <>
            {/* Metrics Inline Strip */}
            <div className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden mb-8 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
                {metrics.map((m, idx) => (
                  <div
                    key={m.label}
                    className="px-6 py-5 hover:bg-[rgba(99,102,241,0.03)] transition-colors duration-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div style={{ color: m.color }} className="opacity-85">
                        {m.icon}
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                        {m.label}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[var(--text-primary)] leading-none tracking-tight">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className={`mb-6 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Quick Actions
              </h2>

              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
                {quickActions.map((action, idx) => (
                  <div key={action.label}>
                    <button
                      onClick={action.action}
                      className="w-full flex items-center px-6 py-4 gap-4 hover:bg-[rgba(99,102,241,0.04)] transition-all duration-200 group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110"
                        style={{ backgroundColor: `${action.color}15`, color: action.color }}
                      >
                        {action.icon}
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                          {action.label}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          {action.description}
                        </p>
                      </div>

                      <ChevronRightIcon className="text-[var(--text-secondary)] text-lg opacity-40 group-hover:opacity-70 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                    </button>
                    {idx < quickActions.length - 1 && (
                      <div className="border-b border-[var(--border)] mx-6"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* System Status */}
            <div className={`flex items-center gap-3 px-6 py-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl transition-all duration-500 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.7)]"></div>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                All systems operational
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                • Platform running smoothly
              </span>
              <div className="ml-auto flex gap-4">
                {['Judge0 CE', 'Database', 'Auth Service'].map((svc) => (
                  <div key={svc} className="flex items-center gap-1.5">
                    <CheckCircleIcon className="text-green-500 text-sm" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)] hidden sm:block">
                      {svc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            
          </>
        )}
      </div>
    </AdminLayout>
  );
}
