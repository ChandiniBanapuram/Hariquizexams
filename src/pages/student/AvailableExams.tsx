import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Box, Card, CardContent, Grid, Typography, Button, CircularProgress, Stack, Chip, Dialog, DialogTitle, DialogContent, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import DialogActions from '@mui/material/DialogActions';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { useExam } from '@/context/ExamContext';
import { studentAuthAPI, AvailableExam } from '@/lib/student-auth-api';
import { studentAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import StudentLayout from '@/components/layouts/StudentLayout';

export default function AvailableExams() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { student, logout, isAuthenticated } = useStudentAuth();
  const { setStudentDetails, setQuestions, setTimeLimit } = useExam();

  const [quizExams, setQuizExams] = useState<any[]>([]);
  const [codingExams, setCodingExams] = useState<any[]>([]);
  const [attemptedSubjects, setAttemptedSubjects] = useState<Set<string>>(new Set());
  const [loadingExams, setLoadingExams] = useState(true);
  const [startingExam, setStartingExam] = useState<number | null>(null);
  const [showAttemptedDialog, setShowAttemptedDialog] = useState(false);

  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/student/login');
      return;
    }
    fetchExams();
  }, [isAuthenticated, navigate]);

  const normalizeDateStr = (dateVal: any) => {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  };

  const getExamKey = (subject: string, examDate: string) => {
    const normSub = (subject || '').trim().toLowerCase();
    const normD = normalizeDateStr(examDate);
    return normD ? `${normSub}__${normD}` : normSub;
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const [quizList, codingList, previousScores] = await Promise.all([
        studentAuthAPI.getAvailableExams().catch(() => []),
        studentAuthAPI.getAvailableCodingExams().catch(() => []),
        studentAuthAPI.getPreviousScores().catch(() => []),
      ]);
      setQuizExams(Array.isArray(quizList) ? quizList.map(e => ({ ...e, type: 'quiz' })) : []);
      setCodingExams(Array.isArray(codingList) ? codingList.map(e => ({ ...e, type: 'coding' })) : []);

      const attempted = new Set<string>();
      if (Array.isArray(previousScores)) {
        previousScores.forEach((score: any) => {
          if (score.subject) {
            const scoreDate = score.exam_date || score.submitted_at || '';
            attempted.add(getExamKey(score.subject, scoreDate));
            if (score.submitted_at) {
              attempted.add(getExamKey(score.subject, score.submitted_at));
            }
          }
        });
      }
      setAttemptedSubjects(attempted);
    } catch {
      setQuizExams([]);
      setCodingExams([]);
      setAttemptedSubjects(new Set());
    } finally {
      setLoadingExams(false);
    }
  };

  const departments = useMemo(() => {
    const set = new Set<string>();
    quizExams.forEach(e => { if (e.department) set.add(e.department); });
    codingExams.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [quizExams, codingExams]);

  const years = useMemo(() => {
    const set = new Set<string>();
    quizExams.forEach(e => { if (e.year) set.add(e.year); });
    codingExams.forEach(e => { if (e.year) set.add(e.year); });
    return Array.from(set).sort();
  }, [quizExams, codingExams]);

  const semesters = useMemo(() => {
    const set = new Set<string>();
    quizExams.forEach(e => { if (e.semester) set.add(e.semester); });
    codingExams.forEach(e => { if (e.semester) set.add(e.semester); });
    return Array.from(set).sort();
  }, [quizExams, codingExams]);

  const sections = useMemo(() => {
    const set = new Set<string>();
    quizExams.forEach(e => { if (e.section) set.add(e.section); });
    codingExams.forEach(e => { if (e.section) set.add(e.section); });
    return Array.from(set).sort();
  }, [quizExams, codingExams]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    quizExams.forEach(e => { if (e.subject) set.add(e.subject); });
    codingExams.forEach(e => { if (e.subject) set.add(e.subject); });
    return Array.from(set).sort();
  }, [quizExams, codingExams]);

  const isMaster = !!student?.isMaster;

  const examsToDisplay = useMemo(() => {
    if (isMaster) {
      const all = [...quizExams, ...codingExams];
      return all.filter(e => {
        if (filterDept && e.department !== filterDept) return false;
        if (filterYear && e.year !== filterYear) return false;
        if (filterSem && e.semester !== filterSem) return false;
        if (filterSection && e.section !== filterSection) return false;
        if (filterSubject && e.subject !== filterSubject) return false;
        return true;
      });
    } else {
      return quizExams.filter(e => !e.subject.toLowerCase().includes('coding'));
    }
  }, [isMaster, quizExams, codingExams, filterDept, filterYear, filterSem, filterSection, filterSubject]);

  const handleStartExam = async (exam: any) => {
    if (exam.type === 'coding') {
      navigate('/student/coding-exams', { state: { autoStartExam: exam } });
      return;
    }

    if (!student) return;
    setStartingExam(exam.id);

    // Master student is context-less; use the exam's own dept/section/year/sem
    const isMasterUser = !!student.isMaster;
    const ctxDepartment = isMasterUser ? exam.department : (student.department || '');
    const ctxSection    = isMasterUser ? exam.section    : (student.section || '');
    const ctxYear       = isMasterUser ? exam.year       : (student.year || '1');
    const ctxSemester   = isMasterUser ? exam.semester   : (student.semester || '1');

    try {
      if (!isMasterUser) {
        const duplicateRes = await studentAPI.checkDuplicateAttempt(
          student.rollNumber || student.roll_number || '',
          ctxDepartment,
          ctxSection,
          ctxYear,
          ctxSemester,
          exam.subject,
          exam.exam_date || undefined
        );

        if (duplicateRes.isDuplicate) {
          toast({ title: 'Already Attempted', description: 'You already attempted this test.', variant: 'destructive' });
          setShowAttemptedDialog(true);
          setStartingExam(null);
          return;
        }
      }

      // Clean up previous exam session data so new exam starts completely fresh
      localStorage.removeItem('examStarted');
      localStorage.removeItem('examEndTime');
      localStorage.removeItem('examAnswers');
      localStorage.removeItem('examCurrentQuestionIndex');
      localStorage.removeItem('examVisitedQuestions');
      localStorage.removeItem('examMarkedForReview');
      localStorage.removeItem('examHasSubmitted');
      localStorage.removeItem('examResult');

      setStudentDetails({
        rollNumber: student.rollNumber || student.roll_number || '',
        name: student.fullName || student.full_name || '',
        department: ctxDepartment,
        section: ctxSection,
        year: ctxYear,
        semester: ctxSemester,
        subject: exam.subject,
        examDate: exam.exam_date || '',
      });
      setTimeLimit(exam.time_limit);

      const qs = await studentAPI.getQuestions(
        ctxDepartment,
        ctxSection,
        ctxYear,
        ctxSemester,
        exam.subject,
        exam.exam_date
      );

      if (Array.isArray(qs) && qs.length > 0) {
        let finalQs = [...qs];
        try {
            const confMap = localStorage.getItem(`quiz_config_${exam.subject}`);
            if (confMap) {
               const parsed = JSON.parse(confMap);
               if (parsed.shuffle) {
                   finalQs = finalQs.sort(() => Math.random() - 0.5);
               }
            }
        } catch (e) {}

        setQuestions(finalQs);
        navigate('/exam', { state: { examSubject: exam.subject, examDate: exam.exam_date } });
      } else {
        toast({ title: 'No Questions', description: 'No questions found for this exam.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to start exam.', variant: 'destructive' });
    } finally {
      setStartingExam(null);
    }
  };

  return (
    <StudentLayout user={student} onLogout={logout}>
      <Box sx={{ mb: 6, mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: 'text.primary', letterSpacing: '-0.02em' }}>
          Available <Box component="span" className="teal-accent-text">Exams</Box>
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Select and start your scheduled examinations below.
        </Typography>
      </Box>

      {isMaster && (
        <Box className="premium-glass-card" sx={{ p: 3, mb: 4, borderRadius: '16px' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: '#2affff' }, '&.Mui-focused fieldset': { borderColor: '#2affff' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}>
                <InputLabel id="dept-filter-label">Department</InputLabel>
                <Select
                  labelId="dept-filter-label"
                  id="dept-filter"
                  value={filterDept}
                  label="Department"
                  onChange={(e) => setFilterDept(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(42, 255, 255, 0.1)' } } } } }}
                >
                  <MenuItem value=""><em>All Departments</em></MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: '#2affff' }, '&.Mui-focused fieldset': { borderColor: '#2affff' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}>
                <InputLabel id="year-filter-label">Year</InputLabel>
                <Select
                  labelId="year-filter-label"
                  id="year-filter"
                  value={filterYear}
                  label="Year"
                  onChange={(e) => setFilterYear(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(42, 255, 255, 0.1)' } } } } }}
                >
                  <MenuItem value=""><em>All Years</em></MenuItem>
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: '#2affff' }, '&.Mui-focused fieldset': { borderColor: '#2affff' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}>
                <InputLabel id="sem-filter-label">Semester</InputLabel>
                <Select
                  labelId="sem-filter-label"
                  id="sem-filter"
                  value={filterSem}
                  label="Semester"
                  onChange={(e) => setFilterSem(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(42, 255, 255, 0.1)' } } } } }}
                >
                  <MenuItem value=""><em>All Semesters</em></MenuItem>
                  {semesters.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: '#2affff' }, '&.Mui-focused fieldset': { borderColor: '#2affff' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}>
                <InputLabel id="sec-filter-label">Section</InputLabel>
                <Select
                  labelId="sec-filter-label"
                  id="sec-filter"
                  value={filterSection}
                  label="Section"
                  onChange={(e) => setFilterSection(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(42, 255, 255, 0.1)' } } } } }}
                >
                  <MenuItem value=""><em>All Sections</em></MenuItem>
                  {sections.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={12} md={2.4}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: '#2affff' }, '&.Mui-focused fieldset': { borderColor: '#2affff' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}>
                <InputLabel id="subject-filter-label">Subject</InputLabel>
                <Select
                  labelId="subject-filter-label"
                  id="subject-filter"
                  value={filterSubject}
                  label="Subject"
                  onChange={(e) => setFilterSubject(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(42, 255, 255, 0.1)' } } } } }}
                >
                  <MenuItem value=""><em>All Subjects</em></MenuItem>
                  {subjects.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}

      {loadingExams ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#2affff' }} /></Box>
      ) : examsToDisplay.length === 0 ? (
        <Card className="premium-glass-card" sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: 'text.secondary', opacity: 0.6, fontWeight: 700 }}>No Exams Available at the Moment</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.5, mt: 1 }}>Check back later for scheduled assessments.</Typography>
        </Card>
      ) : (
        <Grid container spacing={4}>
          {examsToDisplay.map((exam) => (
            <Grid key={exam.id} item xs={12} sm={6} md={4}>
              <Card 
                className="premium-glass-card" 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-8px)' }
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5, color: 'text.primary' }}>
                    {exam.subject}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontWeight: 600 }}>
                    Scheduled: <span style={{ color: '#6366f1', fontWeight: 800 }}>{exam.exam_date ? format(new Date(exam.exam_date), 'dd MMM yyyy') : 'TBD'}</span>
                  </Typography>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                    <Chip 
                      label={`${exam.time_limit} MINS`} 
                      sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: 'primary.main', fontWeight: 900, fontSize: '0.65rem', border: '1px solid rgba(99, 102, 241, 0.2)' }} 
                      size="small" 
                    />
                    <Chip 
                      label={`${exam.question_count} Qs`} 
                      sx={{ bgcolor: 'rgba(0, 0, 0, 0.05)', color: 'text.primary', fontWeight: 900, fontSize: '0.65rem', border: '1px solid rgba(0, 0, 0, 0.1)' }} 
                      size="small" 
                    />
                    {attemptedSubjects.has(getExamKey(exam.subject, exam.exam_date)) && (
                      <Chip 
                        label="ALREADY ATTEMPTED" 
                        sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 900, fontSize: '0.65rem', border: '1px solid rgba(239, 68, 68, 0.3)' }} 
                        size="small" 
                      />
                    )}
                    {isMaster && (
                      <Chip 
                        label={exam.type === 'coding' ? 'CODING' : 'QUIZ'} 
                        sx={{ 
                          bgcolor: exam.type === 'coding' ? 'rgba(42, 255, 255, 0.1)' : 'rgba(168, 85, 247, 0.1)', 
                          color: exam.type === 'coding' ? '#2affff' : '#a855f7', 
                          fontWeight: 900, 
                          fontSize: '0.65rem', 
                          border: exam.type === 'coding' ? '1px solid rgba(42, 255, 255, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)' 
                        }} 
                        size="small" 
                      />
                    )}
                  </Stack>
                </CardContent>
                <Box sx={{ p: 3, pt: 0 }}>
                  {(() => {
                    const isAlreadyAttempted = !isMaster && attemptedSubjects.has(getExamKey(exam.subject, exam.exam_date));
                    return (
                      <button
                        className="pill-btn-teal"
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontSize: '0.9rem',
                          backgroundColor: isAlreadyAttempted ? '#334155' : undefined,
                          borderColor: isAlreadyAttempted ? '#475569' : undefined,
                          color: isAlreadyAttempted ? '#94a3b8' : undefined,
                          cursor: isAlreadyAttempted ? 'not-allowed' : 'pointer',
                          opacity: isAlreadyAttempted ? 0.7 : 1,
                        }}
                        onClick={() => handleStartExam(exam)}
                        disabled={startingExam === exam.id || isAlreadyAttempted}
                      >
                        {isAlreadyAttempted
                          ? 'ALREADY ATTEMPTED'
                          : startingExam === exam.id 
                            ? 'INITIALIZING...' 
                            : exam.type === 'coding' 
                              ? 'START PROBLEM' 
                              : 'START EXAMINATION'}
                      </button>
                    );
                  })()}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Already Attempted Block Dialog */}
      <Dialog 
        open={showAttemptedDialog} 
        onClose={() => setShowAttemptedDialog(false)}
        PaperProps={{
          className: 'premium-glass-card',
          style: {
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '24px',
            padding: '16px',
            maxWidth: '420px',
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 900, textAlign: 'center', pb: 1 }}>
          Assessment Blocked
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 3 }}>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            You already attempted this test.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <button 
            className="pill-btn-teal" 
            style={{ padding: '12px 32px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer' }}
            onClick={() => setShowAttemptedDialog(false)}
          >
            OKAY
          </button>
        </DialogActions>
      </Dialog>
    </StudentLayout>
  );
}
