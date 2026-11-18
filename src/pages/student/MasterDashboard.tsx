import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Box, Card, CardContent, Grid, Typography, Stack, Chip, CircularProgress,
  Avatar, Divider, TextField, MenuItem, InputAdornment,
} from '@mui/material';
import {
  Workspaces as WorkspacesIcon,
  Search as SearchIcon,
  AutoAwesome as AutoAwesomeIcon,
  School as SchoolIcon,
  Code as CodeIcon,
  Bolt as BoltIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { useExam } from '@/context/ExamContext';
import { studentAuthAPI, AvailableExam } from '@/lib/student-auth-api';
import { studentAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import StudentLayout from '@/components/layouts/StudentLayout';

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { student, logout, isAuthenticated } = useStudentAuth();
  const { setStudentDetails, setQuestions, setTimeLimit } = useExam();

  const [exams, setExams] = useState<(AvailableExam & { examType?: 'quiz' | 'coding' })[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | number | null>(null);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/student/login'); return; }
    if (!student?.isMaster) { navigate('/student/dashboard'); return; }
    (async () => {
      setLoading(true);
      try {
        const [quizList, codingList] = await Promise.all([
          studentAuthAPI.getAvailableExams(),
          studentAuthAPI.getAvailableCodingExams(),
        ]);
        const quizzes = (Array.isArray(quizList) ? quizList : []).map(e => ({ ...e, examType: 'quiz' as const }));
        const codings = (Array.isArray(codingList) ? codingList : []).map(e => ({ ...e, examType: 'coding' as const }));
        setExams([...quizzes, ...codings]);
      } catch {
        setExams([]);
      } finally { setLoading(false); }
    })();
  }, [isAuthenticated, student, navigate]);

  const departments = useMemo(() => Array.from(new Set(exams.map(e => e.department).filter(Boolean))), [exams]);
  const years = useMemo(() => Array.from(new Set(exams.map(e => e.year).filter(Boolean))), [exams]);
  const semesters = useMemo(() => Array.from(new Set(exams.map(e => e.semester).filter(Boolean))), [exams]);

  const filtered = useMemo(() => exams.filter(e => {
    if (deptFilter !== 'ALL' && e.department !== deptFilter) return false;
    if (yearFilter !== 'ALL' && e.year !== yearFilter) return false;
    if (semFilter !== 'ALL' && e.semester !== semFilter) return false;
    if (search && !`${e.subject} ${e.department} ${e.section}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [exams, deptFilter, yearFilter, semFilter, search]);

  const groupedByDept = useMemo(() => {
    const map = new Map<string, AvailableExam[]>();
    filtered.forEach(e => {
      const key = e.department || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleStart = async (exam: AvailableExam & { examType?: 'quiz' | 'coding' }) => {
    if (!student) return;
    setStarting(exam.id);
    if (exam.examType === 'coding') {
      navigate('/student/coding-exams', { state: { autoStartExam: exam } });
      return;
    }
    try {
      setStudentDetails({
        rollNumber: student.rollNumber,
        name: student.fullName,
        department: exam.department,
        section: exam.section,
        year: exam.year,
        semester: exam.semester,
        subject: exam.subject,
        examDate: exam.exam_date || '',
      });
      setTimeLimit(exam.time_limit);

      const qs = await studentAPI.getQuestions(
        exam.department, exam.section, exam.year, exam.semester, exam.subject, exam.exam_date
      );

      if (Array.isArray(qs) && qs.length > 0) {
        setQuestions(qs);
        navigate('/exam', { state: { examSubject: exam.subject, examDate: exam.exam_date } });
      } else {
        toast({ title: 'No Questions', description: 'No questions found for this exam.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start exam.', variant: 'destructive' });
    } finally {
      setStarting(null);
    }
  };

  return (
    <StudentLayout user={student} onLogout={logout}>
      {/* Hero */}
      <Card
        className="premium-glass-card"
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(42,255,255,0.08))',
          border: '1px solid rgba(99,102,241,0.25)',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: 'rgba(99,102,241,0.2)', border: '2px solid rgba(99,102,241,0.5)' }}>
            <AutoAwesomeIcon sx={{ fontSize: 40, color: '#a78bfa' }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Chip
              icon={<BoltIcon sx={{ fontSize: 16 }} />}
              label="MASTER ACCESS"
              size="small"
              sx={{
                mb: 1,
                bgcolor: 'rgba(167,139,250,0.15)',
                color: '#a78bfa',
                fontWeight: 900,
                letterSpacing: 1,
                border: '1px solid rgba(167,139,250,0.3)',
              }}
            />
            <Typography variant="h3" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              Welcome, <Box component="span" className="teal-accent-text">{student?.fullName || 'Master'}</Box>
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.5 }}>
              Roll {student?.rollNumber} · Access to every department · year · semester · subject
            </Typography>
          </Box>
          <Stack spacing={1} sx={{ minWidth: 160 }}>
            <StatChip icon={<WorkspacesIcon />} label="Active Exams" value={exams.length} color="#2affff" />
            <StatChip icon={<SchoolIcon />} label="Departments" value={departments.length} color="#a78bfa" />
          </Stack>
        </Stack>
      </Card>

      {/* Filters */}
      <Card className="premium-glass-card" sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth size="small" placeholder="Search subject, dept, section…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField select fullWidth size="small" label="Department" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <MenuItem value="ALL">All Departments</MenuItem>
              {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2.5}>
            <TextField select fullWidth size="small" label="Year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <MenuItem value="ALL">All Years</MenuItem>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2.5}>
            <TextField select fullWidth size="small" label="Semester" value={semFilter} onChange={(e) => setSemFilter(e.target.value)}>
              <MenuItem value="ALL">All Semesters</MenuItem>
              {semesters.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Quick links */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Coding Exams',    icon: <CodeIcon />,    color: '#f472b6', path: '/student/coding-exams' },
          { label: 'Coding Practice', icon: <BoltIcon />,    color: '#a78bfa', path: '/student/coding-practice' },
          { label: 'Question Bank',   icon: <SchoolIcon />,  color: '#2affff', path: '/student/question-bank' },
          { label: 'Previous Scores', icon: <HistoryIcon />, color: '#34d399', path: '/student/previous-scores' },
        ].map(q => (
          <Grid key={q.label} item xs={6} md={3}>
            <Card
              onClick={() => navigate(q.path)}
              className="premium-glass-card"
              sx={{
                p: 2.5, cursor: 'pointer', height: '100%',
                transition: 'transform .2s ease',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ bgcolor: `${q.color}22`, color: q.color, width: 40, height: 40 }}>{q.icon}</Avatar>
                <Typography sx={{ fontWeight: 800 }}>{q.label}</Typography>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Exam list grouped by department */}
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.02em' }}>
        All <Box component="span" className="teal-accent-text">Active Exams</Box>
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#a78bfa' }} />
        </Box>
      ) : groupedByDept.length === 0 ? (
        <Card className="premium-glass-card" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            No exams match your filters.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={4}>
          {groupedByDept.map(([dept, deptExams]) => (
            <Box key={dept}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Chip label={dept} sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a78bfa', fontWeight: 900, letterSpacing: 0.5 }} />
                <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{deptExams.length} exams</Typography>
              </Stack>
              <Grid container spacing={3}>
                {deptExams.map(exam => (
                  <Grid key={exam.id} item xs={12} sm={6} md={4}>
                    <Card className="premium-glass-card" sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                      transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-6px)' } }}>
                      <CardContent sx={{ flexGrow: 1, p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, color: 'text.primary' }}>
                          {exam.subject}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 2 }}>
                          {exam.year} · {exam.semester} · Sec {exam.section}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontWeight: 600 }}>
                          Scheduled: <span style={{ color: '#6366f1', fontWeight: 800 }}>
                            {exam.exam_date ? format(new Date(exam.exam_date), 'dd MMM yyyy') : 'TBD'}
                          </span>
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={exam.examType === 'coding' ? 'CODING' : 'QUIZ'} size="small"
                            sx={{
                              bgcolor: exam.examType === 'coding' ? 'rgba(244,114,182,0.15)' : 'rgba(167,139,250,0.15)',
                              color: exam.examType === 'coding' ? '#f472b6' : '#a78bfa',
                              fontWeight: 900,
                              fontSize: '0.65rem',
                              border: `1px solid ${exam.examType === 'coding' ? 'rgba(244,114,182,0.3)' : 'rgba(167,139,250,0.3)'}`
                            }}
                          />
                          <Chip label={`${exam.time_limit} MIN`} size="small"
                            sx={{ bgcolor: 'rgba(99,102,241,0.1)', color: 'primary.main', fontWeight: 900, fontSize: '0.65rem' }} />
                          <Chip label={`${exam.question_count} Qs`} size="small"
                            sx={{ bgcolor: 'rgba(42,255,255,0.1)', color: '#2affff', fontWeight: 900, fontSize: '0.65rem' }} />
                        </Stack>
                      </CardContent>
                      <Box sx={{ p: 2.5, pt: 0 }}>
                        <button
                          className="pill-btn-teal"
                          style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
                          onClick={() => handleStart(exam)}
                          disabled={starting === exam.id}
                        >
                          {starting === exam.id ? 'STARTING…' : 'START EXAM'}
                        </button>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </StudentLayout>
  );
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.2}
      sx={{ px: 1.5, py: 0.8, borderRadius: 2, bgcolor: `${color}12`, border: `1px solid ${color}33` }}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', lineHeight: 1 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 900, color, lineHeight: 1.2 }}>{value}</Typography>
      </Box>
    </Stack>
  );
}
