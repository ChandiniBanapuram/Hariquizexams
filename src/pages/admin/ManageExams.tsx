import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon, FilterList as FilterIcon,
  AccessTime as AccessTimeIcon, Assignment as AssignmentIcon,
  ToggleOn as ToggleOnIcon, ToggleOff as ToggleOffIcon
} from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI, ExamConfig } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLookupData } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Switch, Tooltip } from '@mui/material';

interface GroupedCodingExam {
  id: string;
  subject: string;
  department: string;
  section: string;
  year: string;
  semester: string;
  exam_date: string;
  time_limit: number;
  question_count: number;
  is_active: boolean;
  rawQuestions: any[];
}

export default function ManageExams() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, isAuthenticated } = useAdmin();
  const { toast } = useToast();
  const { departments, semesters, years, sections } = useLookupData();

  // Active tab state: 'quiz' | 'coding'
  const activeTab = searchParams.get('tab') === 'coding' ? 'coding' : 'quiz';

  const [quizExams, setQuizExams] = useState<ExamConfig[]>([]);
  const [codingExams, setCodingExams] = useState<GroupedCodingExam[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    date: '',
    department: '',
    semester: '',
    year: '',
    section: ''
  });

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
    else fetchData();
  }, [isAuthenticated, navigate, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'quiz') {
        const data = await adminAPI.getExamConfigs();
        setQuizExams(Array.isArray(data) ? data : []);
      } else {
        const data = await adminAPI.getQuestions();
        if (Array.isArray(data)) {
          // Filter only coding exam questions
          const examQs = data.filter(q => {
            try {
              const parsed = JSON.parse(q.question);
              return parsed.usageType === 'exam';
            } catch {
              return false;
            }
          });

          // Group by: date, department, section, year, semester, subject
          const groups = new Map<string, GroupedCodingExam>();
          examQs.forEach(q => {
            try {
              const parsed = JSON.parse(q.question);
              const dateOnly = q.exam_date ? q.exam_date.split('T')[0] : 'no-date';
              const key = `${dateOnly}_${q.department}_${q.section}_${q.year}_${q.semester}_${q.subject}`;

              if (!groups.has(key)) {
                groups.set(key, {
                  id: key,
                  subject: q.subject || 'Coding Assessment',
                  department: q.department,
                  section: q.section,
                  year: q.year,
                  semester: q.semester,
                  exam_date: q.exam_date,
                  time_limit: parsed.timer || 60,
                  question_count: 0,
                  is_active: parsed.isActive || false,
                  rawQuestions: []
                });
              }

              const group = groups.get(key)!;
              group.question_count += 1;
              group.rawQuestions.push(q);
              // Inherit active status if any question is active
              if (parsed.isActive) {
                group.is_active = true;
              }
            } catch {}
          });

          setCodingExams(Array.from(groups.values()));
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch exam data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQuizStatus = async (exam: ExamConfig, newValue: boolean) => {
    try {
      setLoading(true);
      await adminAPI.toggleExamStatus(
        exam.department, exam.section, exam.year, exam.semester, exam.subject, newValue, exam.exam_date
      );
      toast({
        title: 'Status Updated',
        description: `${exam.subject} is now ${newValue ? 'ON (Published)' : 'OFF (Draft)'}`
      });
      // Refresh list
      const data = await adminAPI.getExamConfigs();
      setQuizExams(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to update quiz exam status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCodingStatus = async (group: GroupedCodingExam, newValue: boolean) => {
    try {
      setLoading(true);
      await Promise.all(group.rawQuestions.map((q: any) => {
        let parsed = JSON.parse(q.question);
        parsed.isActive = newValue;
        return adminAPI.updateQuestion(q.id, {
          department: q.department,
          section: q.section,
          year: q.year,
          semester: q.semester,
          subject: q.subject,
          question: JSON.stringify(parsed),
          optionA: q.option_a || 'N/A',
          optionB: q.option_b || 'N/A',
          optionC: q.option_c || 'N/A',
          optionD: q.option_d || 'N/A',
          correctOption: q.correct_option || 'A',
          examDate: q.exam_date
        });
      }));

      toast({
        title: 'Status Updated',
        description: `${group.subject} is now ${newValue ? 'ON (Published)' : 'OFF (Draft)'}`
      });

      // Refresh list
      const data = await adminAPI.getQuestions();
      if (Array.isArray(data)) {
        const examQs = data.filter(q => {
          try {
            const parsed = JSON.parse(q.question);
            return parsed.usageType === 'exam';
          } catch { return false; }
        });
        const groups = new Map<string, GroupedCodingExam>();
        examQs.forEach(q => {
          try {
            const parsed = JSON.parse(q.question);
            const dateOnly = q.exam_date ? q.exam_date.split('T')[0] : 'no-date';
            const key = `${dateOnly}_${q.department}_${q.section}_${q.year}_${q.semester}_${q.subject}`;
            if (!groups.has(key)) {
              groups.set(key, {
                id: key,
                subject: q.subject || 'Coding Assessment',
                department: q.department,
                section: q.section,
                year: q.year,
                semester: q.semester,
                exam_date: q.exam_date,
                time_limit: parsed.timer || 60,
                question_count: 0,
                is_active: parsed.isActive || false,
                rawQuestions: []
              });
            }
            const group = groups.get(key)!;
            group.question_count += 1;
            group.rawQuestions.push(q);
            if (parsed.isActive) group.is_active = true;
          } catch {}
        });
        setCodingExams(Array.from(groups.values()));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update coding exam status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredQuizExams = useMemo(() => {
    return quizExams.filter(exam => {
      const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            exam.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = !filters.date || exam.exam_date?.includes(filters.date);
      const matchesDept = !filters.department || exam.department === filters.department;
      const matchesSem = !filters.semester || exam.semester === filters.semester;
      const matchesYear = !filters.year || String(exam.year) === filters.year;
      const matchesSection = !filters.section || exam.section === filters.section;
      return matchesSearch && matchesDate && matchesDept && matchesSem && matchesYear && matchesSection;
    });
  }, [quizExams, searchTerm, filters]);

  const filteredCodingExams = useMemo(() => {
    return codingExams.filter(exam => {
      const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            exam.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = !filters.date || exam.exam_date?.includes(filters.date);
      const matchesDept = !filters.department || exam.department === filters.department;
      const matchesSem = !filters.semester || exam.semester === filters.semester;
      const matchesYear = !filters.year || String(exam.year) === filters.year;
      const matchesSection = !filters.section || exam.section === filters.section;
      return matchesSearch && matchesDate && matchesDept && matchesSem && matchesYear && matchesSection;
    });
  }, [codingExams, searchTerm, filters]);

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              Manage Exam Status
            </h1>
            <p className="text-[var(--text-secondary)] font-medium mt-1">
              Easily view and toggle ON/OFF states for all scheduled Quiz and Coding exams.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setSearchParams({ tab: 'quiz' })}
            className={`px-6 py-3 font-bold text-sm tracking-wide transition-colors duration-200 border-b-2 ${
              activeTab === 'quiz'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            QUIZ EXAMS ({quizExams.length})
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'coding' })}
            className={`px-6 py-3 font-bold text-sm tracking-wide transition-colors duration-200 border-b-2 ${
              activeTab === 'coding'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            CODING EXAMS ({codingExams.length})
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-medium)]">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="text-[var(--text-secondary)] text-lg" />
              </div>
              <input
                type="text"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Date Filter */}
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              className="px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            />

            {/* Department Filter */}
            <select
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              className="px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.value} value={dept.value}>{dept.label}</option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
              className="px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            >
              <option value="">All Years</option>
              {years.map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>

            {/* Semester Filter */}
            <select
              value={filters.semester}
              onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
              className="px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem.value} value={sem.value}>{sem.label}</option>
              ))}
            </select>

            {/* Section Filter */}
            <select
              value={filters.section}
              onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value }))}
              className="px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            >
              <option value="">All Sections</option>
              {sections.map(sec => (
                <option key={sec.value} value={sec.value}>{sec.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table / Grid */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : (activeTab === 'quiz' ? filteredQuizExams.length === 0 : filteredCodingExams.length === 0) ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-[rgba(99,102,241,0.1)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FilterIcon className="text-[var(--primary)] text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">No exams found</h3>
              <p className="text-[var(--text-secondary)]">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Exam Title</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Year / Semester</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Section</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Questions</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Exam Date</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Status (ON/OFF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {activeTab === 'quiz' ? (
                    filteredQuizExams.map((exam) => (
                      <tr key={exam.id} className="table-row hover:bg-[rgba(99,102,241,0.02)]">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--text-primary)]">{exam.subject}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">{exam.department}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">Year {exam.year} · Sem {exam.semester}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">{exam.section || 'ALL'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                            <AssignmentIcon sx={{ fontSize: 16 }} />
                            -
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                            <AccessTimeIcon sx={{ fontSize: 16 }} />
                            {exam.time_limit} mins
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">
                            {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              exam.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {exam.is_active ? 'ON' : 'OFF'}
                            </span>
                            <Tooltip title={exam.is_active ? "Turn OFF Exam" : "Turn ON Exam"}>
                              <Switch
                                checked={!!exam.is_active}
                                onChange={(e) => handleToggleQuizStatus(exam, e.target.checked)}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10B981' }
                                }}
                              />
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredCodingExams.map((exam) => (
                      <tr key={exam.id} className="table-row hover:bg-[rgba(99,102,241,0.02)]">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--text-primary)]">{exam.subject}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">{exam.department}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">Year {exam.year} · Sem {exam.semester}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">{exam.section || 'ALL'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                            <AssignmentIcon sx={{ fontSize: 16 }} />
                            {exam.question_count}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                            <AccessTimeIcon sx={{ fontSize: 16 }} />
                            {exam.time_limit} mins
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-secondary)]">
                            {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              exam.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {exam.is_active ? 'ON' : 'OFF'}
                            </span>
                            <Tooltip title={exam.is_active ? "Turn OFF Exam" : "Turn ON Exam"}>
                              <Switch
                                checked={exam.is_active}
                                onChange={(e) => handleToggleCodingStatus(exam, e.target.checked)}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10B981' }
                                }}
                              />
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
