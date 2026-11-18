import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Button, IconButton, Chip, Divider, Stack, Grid, CircularProgress, Tooltip, FormControl, InputLabel, Select, MenuItem, Tabs, Tab, LinearProgress, Dialog, DialogContent, DialogTitle } from '@mui/material';
import DialogActions from '@mui/material/DialogActions';
import { PlayArrow, Fullscreen, FullscreenExit, BugReport, Terminal, History, Leaderboard, EmojiEvents, Assignment, ChevronLeft, ChevronRight, Refresh, CheckCircle, Cancel, ContentCopy, Code as CodeIcon, Timer, Send as SendIcon, Close as CloseIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import { studentAPI, codingAPI } from '@/lib/api';
import { studentAuthAPI, AvailableExam } from '@/lib/student-auth-api';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { useToast } from '@/hooks/use-toast';
import StudentLayout from '@/components/layouts/StudentLayout';

import { ML_DOMAINS, getLangLabel, ALL_LANG_OPTIONS } from '@/components/admin/QuestionForm';
import { mlExecAPI, BASE_SERVER_URL } from '@/lib/api';

const SUPPORTED_LANGUAGES = ['python', 'java', 'cpp', 'c', 'js'];
const DEFAULT_CODE: any = {
  python: 'print("Hello World")',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello World");\n    return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello World";\n    return 0;\n}',
  js: 'console.log("Hello World");'
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const ResizeHandle = ({ dir }: { dir: 'h' | 'v' }) => (
  <PanelResizeHandle style={{ width: dir === 'h' ? '2px' : '100%', height: dir === 'v' ? '2px' : '100%', cursor: dir === 'h' ? 'col-resize' : 'row-resize' }}>
    <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.05)', transition: '0.2s', '&:hover': { bgcolor: '#2affff', boxShadow: '0 0 10px rgba(42, 255, 255, 0.5)' } }} />
  </PanelResizeHandle>
);

const DiffBadge = ({ d }: { d: string }) => {
  const colors: any = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444' };
  return <Chip label={d.toUpperCase()} size="small" sx={{ height: 20, bgcolor: 'rgba(0,0,0,0.4)', color: colors[d] || '#71717a', border: `1px solid ${colors[d] || '#71717a'}80`, fontWeight: 900, fontSize: '0.6rem', letterSpacing: 1 }} />;
};

const MonoBox = ({ children, error, sx }: any) => (
  <Box sx={{ p: 1.5, bgcolor: 'rgba(9, 9, 11, 0.8)', border: `1px solid ${error ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: error ? '#fca5a5' : '#fff', whiteSpace: 'pre-wrap', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', ...sx }}>{children}</Box>
);

export default function CodingExams() {
  const { student, logout, isAuthenticated } = useStudentAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [activeExams, setActiveExams] = useState<AvailableExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<AvailableExam | null>(() => {
    const saved = localStorage.getItem('codingExamSelected');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAttemptedDialog, setShowAttemptedDialog] = useState(false);
  const [questions, setQuestions] = useState<any[]>(() => {
    const saved = localStorage.getItem('codingExamQuestions');
    return saved ? JSON.parse(saved) : [];
  });
  const [idx, setIdx] = useState<number | null>(() => {
    const saved = localStorage.getItem('codingExamIdx');
    return saved ? (saved === 'null' ? null : parseInt(saved, 10)) : null;
  });
  const [codes, setCodes] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('codingExamCodes');
    return saved ? JSON.parse(saved) : {};
  });
  const [solvedStatus, setSolvedStatus] = useState<Record<number, 'solved' | 'failed'>>(() => {
    const saved = localStorage.getItem('codingExamSolvedStatus');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<'python' | 'java' | 'cpp' | 'c' | 'js'>(() => {
    const locked = localStorage.getItem('codingExamLockedLanguage');
    if (locked) {
      if (locked === 'java') return 'java';
      if (locked === 'cpp') return 'cpp';
      if (locked === 'c') return 'c';
      if (locked === 'js') return 'js';
    }
    return 'python';
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const savedEndTime = localStorage.getItem('codingExamEndTime');
    if (savedEndTime) {
      const remaining = Math.max(0, Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000));
      return remaining;
    }
    return 0;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leftTab, setLeftTab] = useState(0);
  const [bottomTab, setBottomTab] = useState(0);
  const [examSettings, setExamSettings] = useState(() => {
    const saved = localStorage.getItem('codingExamSettings');
    return saved ? JSON.parse(saved) : { 
      enableCopyPaste: true, 
      autoSubmitTabSwitch: false 
    };
  });
  
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const departments = useMemo(() => {
    const set = new Set<string>();
    activeExams.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [activeExams]);

  const years = useMemo(() => {
    const set = new Set<string>();
    activeExams.forEach(e => { if (e.year) set.add(e.year); });
    return Array.from(set).sort();
  }, [activeExams]);

  const semesters = useMemo(() => {
    const set = new Set<string>();
    activeExams.forEach(e => { if (e.semester) set.add(e.semester); });
    return Array.from(set).sort();
  }, [activeExams]);

  const sections = useMemo(() => {
    const set = new Set<string>();
    activeExams.forEach(e => { if (e.section) set.add(e.section); });
    return Array.from(set).sort();
  }, [activeExams]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    activeExams.forEach(e => { if (e.subject) set.add(e.subject); });
    return Array.from(set).sort();
  }, [activeExams]);

  const isMaster = !!student?.isMaster;
  const dashboardPath = student?.isMaster ? '/student/master-dashboard' : '/student/dashboard';

  const examsToDisplay = useMemo(() => {
    if (isMaster) {
      return activeExams.filter(e => {
        if (filterDept && e.department !== filterDept) return false;
        if (filterYear && e.year !== filterYear) return false;
        if (filterSem && e.semester !== filterSem) return false;
        if (filterSection && e.section !== filterSection) return false;
        if (filterSubject && e.subject !== filterSubject) return false;
        return true;
      });
    } else {
      return activeExams;
    }
  }, [isMaster, activeExams, filterDept, filterYear, filterSem, filterSection, filterSubject]);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lockedLanguage, setLockedLanguage] = useState<string | null>(() => {
    return localStorage.getItem('codingExamLockedLanguage');
  });

  const clearCodingExamStorage = () => {
    localStorage.removeItem('codingExamSelected');
    localStorage.removeItem('codingExamQuestions');
    localStorage.removeItem('codingExamIdx');
    localStorage.removeItem('codingExamCodes');
    localStorage.removeItem('codingExamSolvedStatus');
    localStorage.removeItem('codingExamEndTime');
    localStorage.removeItem('codingExamLockedLanguage');
    localStorage.removeItem('codingExamSettings');
  };

  useEffect(() => {
    if (selectedExam) {
      localStorage.setItem('codingExamSelected', JSON.stringify(selectedExam));
    } else {
      localStorage.removeItem('codingExamSelected');
    }
  }, [selectedExam]);

  useEffect(() => {
    if (questions && questions.length > 0) {
      localStorage.setItem('codingExamQuestions', JSON.stringify(questions));
    } else {
      localStorage.removeItem('codingExamQuestions');
    }
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('codingExamIdx', idx === null ? 'null' : idx.toString());
  }, [idx]);

  useEffect(() => {
    localStorage.setItem('codingExamCodes', JSON.stringify(codes));
  }, [codes]);

  useEffect(() => {
    localStorage.setItem('codingExamSolvedStatus', JSON.stringify(solvedStatus));
  }, [solvedStatus]);

  useEffect(() => {
    if (lockedLanguage) {
      localStorage.setItem('codingExamLockedLanguage', lockedLanguage);
    } else {
      localStorage.removeItem('codingExamLockedLanguage');
    }
  }, [lockedLanguage]);

  useEffect(() => {
    localStorage.setItem('codingExamSettings', JSON.stringify(examSettings));
  }, [examSettings]);
  
  const [results, setResults] = useState<any[]>([]);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [customIn, setCustomIn] = useState('');
  const [customOut, setCustomOut] = useState<any>(null);
  const [isCustomRun, setIsCustomRun] = useState(false);

  // ── ML/CVPR/RL output state ──
  const [mlGraphs,   setMlGraphs]   = useState<any[]>([]);
  const [mlImages,   setMlImages]   = useState<any[]>([]);
  const [mlMetrics,  setMlMetrics]  = useState<any>({});
  const [mlAudio,    setMlAudio]    = useState<any[]>([]);
  const [mlExecId,  setMlExecId]  = useState<number | null>(null);
  const [execHistory, setExecHistory] = useState<any[]>([]);
  const [questionDatasets, setQuestionDatasets] = useState<any[]>([]);
  const [isMLDomain, setIsMLDomain] = useState(false);
  const [autoGrade,  setAutoGrade]  = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Execution lifecycle status for UI
  type ExecStatus = 'IDLE' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'SECURITY_BLOCKED' | 'RATE_LIMITED';
  const [execStatus,       setExecStatus]       = useState<ExecStatus>('IDLE');
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [aiSuspected,      setAiSuspected]      = useState(false);

  // Sync isMLDomain whenever lockedLanguage changes
  useEffect(() => {
    setIsMLDomain(!!lockedLanguage && ML_DOMAINS.includes(lockedLanguage));
  }, [lockedLanguage]);

  // ── ML shim offset: the shim prepends ~65 lines before student code ──────────
  // Error "line 66" in combined file = student's line 1. Subtract offset for display.
  const ML_SHIM_LINES = 65;
  const adjustLine = (rawLine: string | undefined): string => {
    if (!rawLine) return '?';
    const n = parseInt(rawLine, 10);
    if (isNaN(n)) return '?';
    if (isMLDomain && n > ML_SHIM_LINES) return String(n - ML_SHIM_LINES);
    return String(n);
  };

  // ── Fetch available exams ──
  useEffect(() => {
    if (!isAuthenticated) { navigate('/student/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await studentAuthAPI.getAvailableCodingExams();
        setActiveExams(Array.isArray(res) ? res : []);
      } catch (err) { toast({ title: 'Sync Error', description: 'Failed to fetch coding assessments.', variant: 'destructive' }); }
      finally { setLoading(false); }
    })();
  }, [isAuthenticated, navigate]);

  const timerEffectRef = useRef(false);

  // ── Browser Fullscreen Handler ──
  useEffect(() => {
    if (isFullscreen) {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => setIsFullscreen(false));
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Timer Effect ──
  useEffect(() => {
    if (selectedExam && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const savedEndTime = localStorage.getItem('codingExamEndTime');
          if (savedEndTime) {
            const remaining = Math.max(0, Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000));
            return remaining;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    if (selectedExam && timeLeft === 0 && !timerEffectRef.current) { 
        timerEffectRef.current = true;
        toast({ title: 'Time Expired', description: 'Exam time limit reached. Auto-submitting active draft...', variant: 'destructive' });
        clearCodingExamStorage();
        if (idx !== null) {
          execCode('submit', true);
        } else {
          navigate(dashboardPath);
        }
    }
  }, [selectedExam, timeLeft, idx]);

  // ── Start specific exam ──
  const handleStartExam = async (exam: AvailableExam) => {
    setLoading(true);
    try {


      console.log('[Student CodingExams] requesting with section:', student?.section, 'dept:', student?.department, 'year:', student?.year, 'sem:', student?.semester);
      const data = await studentAPI.getCodingQuestions('exam', {
        department: student?.department,
        section:    student?.section,
        year:       student?.year,
        semester:   student?.semester,
      });
      console.log('[Student CodingExams] fetched count:', Array.isArray(data) ? data.length : 0, 'sections:', Array.isArray(data) ? [...new Set(data.map((q:any)=>q.section))] : []);
      if (Array.isArray(data)) {
        const filtered = data.filter(q => {
            let parsed: any = {};
            try { parsed = JSON.parse(q.question); } catch {}
            
            const rawDate = q.exam_date ? (typeof q.exam_date === 'string' ? q.exam_date : new Date(q.exam_date).toISOString()) : '';
            const dateOnly = rawDate.split('T')[0] || '';
            const key = `${dateOnly}_${q.department}_${q.section}_${q.year}_${q.semester}`;

            const assigned = Array.isArray(parsed.assignedStudents) ? parsed.assignedStudents : [];
            const hasAssignedList = assigned.length > 0;
            const roll = student?.rollNumber?.toUpperCase();
            const isExplicitlyAssigned = roll && assigned.includes(roll);
            const isMaster = !!student?.isMaster;

            if (hasAssignedList && !isExplicitlyAssigned && !isMaster) {
                return false;
            }
            
            return key === String(exam.id);
        });

        if (student?.id && !student?.isMaster && filtered.length > 0) {
          const subRes = await codingAPI.getSubmissions(student.id, undefined, exam.id);
          if (subRes && Array.isArray(subRes.submissions) && subRes.submissions.length >= filtered.length) {
            toast({
              title: 'Already Attempted',
              description: 'You already completed this examination.',
              variant: 'destructive'
            });
            setShowAttemptedDialog(true);
            setLoading(false);
            return;
          }
        }

        if (filtered.length > 0) {
          const firstP = JSON.parse(filtered[0].question);
          let finalQs = filtered;
          if (firstP.shuffleLogic) {
             finalQs = [...filtered].sort(() => Math.random() - 0.5);
          }
          setQuestions(finalQs);
          setSelectedExam(exam);
          setExamSettings({
              enableCopyPaste: firstP.enableCopyPaste !== false,
              autoSubmitTabSwitch: firstP.autoSubmitTabSwitch === true
          });

          const progLang: string | undefined = firstP.programmingLanguage;
          let resolvedLang: typeof language = 'python';
          if (progLang) {
            if (ML_DOMAINS.includes(progLang)) {
              resolvedLang = 'python';
            } else if (progLang === 'java') {
              resolvedLang = 'java';
            } else if (progLang === 'cpp') {
              resolvedLang = 'cpp';
            } else if (progLang === 'c') {
              resolvedLang = 'c';
            } else if (progLang === 'js') {
              resolvedLang = 'js';
            } else {
              resolvedLang = 'python';
            }
            setLanguage(resolvedLang);
            setLockedLanguage(progLang);
            console.log('[Student CodingExams] Language locked to:', progLang, '→ runtime:', resolvedLang);
          } else {
            setLockedLanguage(null);
          }

          setIdx(0);
          try {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen();
            }
          } catch (e) { console.warn('Fullscreen request failed', e); }

          setCodes({});
          setSolvedStatus({});
          const endTime = Date.now() + exam.time_limit * 60 * 1000;
          localStorage.setItem('codingExamEndTime', endTime.toString());
          setTimeLeft(exam.time_limit * 60);
          setCode(DEFAULT_CODE[resolvedLang] || '');
          toast({ title: 'Assessment Started', description: `Good luck with your ${exam.subject} exam.` });
        } else {
          toast({ title: 'Error', description: 'No questions assigned for this assessment.', variant: 'destructive' });
        }
      }
    } catch (err) { toast({ title: 'Error', description: 'Failed to initialize exam workspace.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (location.state?.autoStartExam && student) {
      handleStartExam(location.state.autoStartExam);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, student]);

  // ── Load datasets when question changes ──
  useEffect(() => {
    if (idx === null || !questions[idx]) return;
    const qId = questions[idx]?.id;
    if (!qId) return;
    mlExecAPI.getDatasets(qId).then((r: any) => {
      setQuestionDatasets(Array.isArray(r?.datasets) ? r.datasets : []);
    }).catch(() => {});
  }, [idx]);

  // ── Load execution history + submission lock status when question changes ──
  useEffect(() => {
    if (!student?.id || idx === null || !questions[idx]) return;
    const qId  = questions[idx]?.id;
    const eId  = selectedExam?.id ? String(selectedExam.id) : undefined;

    mlExecAPI.getHistory(student.id, { limit: 10, questionId: String(qId) }).then((r: any) => {
      setExecHistory(Array.isArray(r?.history) ? r.history : []);
    }).catch(() => {});

    if (qId && eId) {
      mlExecAPI.getSubmissionStatus(student.id, qId, eId).then((r: any) => {
        setSubmissionLocked(!!r?.locked);
        if (r?.locked) setSolvedStatus(prev => ({ ...prev, [idx]: 'solved' }));
      }).catch(() => {});
    }

    setMlGraphs([]); setMlImages([]); setMlMetrics({}); setAutoGrade(null); setMlAudio([]);
    setAiSuspected(false); setExecStatus('IDLE');
  }, [idx, student?.id]);

  // Sync editor code state with current question's saved code or default template
  useEffect(() => {
    if (idx !== null && questions[idx]) {
      const savedCode = codes[idx] || '';
      if (savedCode) {
        setCode(savedCode);
      } else {
        setCode(DEFAULT_CODE[language] || '');
      }
    }
  }, [idx, questions, codes, language]);

  // Pre-populate solvedStatus for all questions when selectedExam is loaded
  useEffect(() => {
    if (!selectedExam || !student?.id || student.isMaster || questions.length === 0) return;

    codingAPI.getSubmissions(student.id, undefined, selectedExam.id).then((res: any) => {
      if (res && Array.isArray(res.submissions)) {
        const newSolvedStatus = {};
        res.submissions.forEach((sub) => {
          const qIdx = questions.findIndex(q => q.id === sub.question_id || q.id === sub.questionId);
          if (qIdx !== -1) {
            newSolvedStatus[qIdx] = sub.status === 'Accepted' ? 'solved' : 'failed';
          }
        });
        setSolvedStatus(prev => ({ ...prev, ...newSolvedStatus }));
      }
    }).catch(err => console.error('Failed to sync submissions:', err));
  }, [selectedExam, student?.id, questions]);

  // ── Anti-Cheat Logic ──
  useEffect(() => {
    if (!selectedExam) return;

    const handleCopyPaste = (e: ClipboardEvent) => {
      if (!examSettings.enableCopyPaste) {
        e.preventDefault();
        toast({ title: 'Action Blocked', description: 'Copy-Paste is disabled for this examination.', variant: 'destructive' });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && examSettings.autoSubmitTabSwitch && idx !== null) {
        toast({ title: 'Violation Detected', description: 'Tab switching detected. Auto-submitting exam...', variant: 'destructive' });
        execCode('submit', true);
      }
    };

    window.addEventListener('copy', handleCopyPaste);
    window.addEventListener('paste', handleCopyPaste);
    window.addEventListener('cut', handleCopyPaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('copy', handleCopyPaste);
      window.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedExam, examSettings, idx]);

  // ── Execution Logic ──
  const execCode = async (mode: 'run' | 'submit', forceNavigate = false) => {
    if (mode === 'submit') {
      const pending = questions.length - (Object.keys(solvedStatus).includes(String(idx)) ? Object.keys(solvedStatus).length : Object.keys(solvedStatus).length + 1);
      if (pending > 0 && !forceNavigate) {
         if (!window.confirm(`You are submitting this problem. You still have ${pending} pending question(s) in this exam. Do you want to submit this one?`)) {
            return;
         }
      }
    }
    if (!student || idx === null || !questions[idx]) return;
    const isSub = mode === 'submit';
    isSub ? setIsSubmitting(true) : setIsRunning(true);
    setExecStatus('PENDING');
    setBottomTab(1);

    setMlGraphs([]); setMlImages([]); setMlMetrics({}); setAutoGrade(null); setMlAudio([]);

    const curQ = questions[idx];
    const parsed = parseQuestion(curQ.question);
    const testCases = parsed.testCases || [];
    const domain = lockedLanguage && ML_DOMAINS.includes(lockedLanguage) ? lockedLanguage : undefined;

    if (domain || (lockedLanguage && !['c','cpp','java','python','js'].includes(lockedLanguage))) {
      setExecStatus('RUNNING');
      try {
        const result = await mlExecAPI.runCode({
          code,
          language,
          domain: domain || undefined,
          stdin: testCases.map(tc => tc.input || '').join('\n'),
          studentId: student.id,
          questionId: curQ.id,
          examId: selectedExam?.id ? String(selectedExam.id) : undefined,
          isSubmit: isSub,
          datasetType: questionDatasets[0]?.dataset_type,
        });

        // ── Check for top-level fetch/network error ──
        if (!result || result.error === true || result.error === 'true') {
          const status = result?.status || 'ERROR';
          if (status === 'RATE_LIMITED') {
            setExecStatus('RATE_LIMITED');
            toast({ title: '⏱ Rate Limited', description: result?.message || 'Too many requests. Please wait 60 seconds.', variant: 'destructive' });
          } else if (status === 'QUEUE_FULL' || status === 'QUEUE_TIMEOUT') {
            setExecStatus('RATE_LIMITED');
            toast({ title: '🔄 Server Busy', description: result?.message || 'Server is busy. Please try again.', variant: 'destructive' });
          } else if (status === 'SECURITY_BLOCKED') {
            setExecStatus('SECURITY_BLOCKED');
            setCustomOut({ stdout: '', stderr: result?.error || 'Code blocked.' });
            setStatusType('error'); setStatusText('Security Blocked');
          } else {
            setExecStatus('FAILED');
            toast({ title: 'Execution Failed', description: result?.message || result?.error || 'Server returned an error.', variant: 'destructive' });
          }
          return;
        }

        const graphs = Array.isArray(result.graphs) ? result.graphs : [];
        const images = Array.isArray(result.images) ? result.images : [];

        setMlGraphs(graphs);
        setMlImages(images);
        setMlMetrics(result.metrics || {});
        setMlAudio(result.audioOut || []);
        setAutoGrade(result.autoGrade || null);
        if (result?.executionId) setMlExecId(result.executionId);
        if (result?.aiSuspected) setAiSuspected(true);

        const stdout = result?.stdout || '';
        const stderr = result?.stderr || result?.compileError || '';

        if (result?.status === 'SECURITY_BLOCKED') {
          setExecStatus('SECURITY_BLOCKED');
          setCustomOut({ stdout: '', stderr: result.error || 'Code blocked by security scanner.' });
          setStatusType('error'); setStatusText('Security Blocked');
          setResults([{ testCase: 1, passed: false, status: 'Security Blocked', actualOutput: '', error: result.error || 'Dangerous import detected.' }]);
          return;
        }

        const statusOk = !stderr && result?.status !== 'Failed' && result?.status !== 'TIMEOUT';
        const timedOut = result?.timedOut || result?.status === 'TIMEOUT';
        setExecStatus(timedOut ? 'TIMEOUT' : statusOk ? 'SUCCESS' : 'FAILED');

        setCustomOut({ stdout, stderr });

        let passedCount = 0;
        let detailedResults: any[] = [];
        let finalStatusOk = statusOk;

        if (statusOk && testCases.length > 0) {
            for (let i = 0; i < testCases.length; i++) {
                const expected = (testCases[i].output || '').trim();
                const expectedLines = expected.split('\\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                
                // For ML, we verify all expected lines are present in the output (tolerating training logs/epochs)
                const isPassed = expectedLines.length === 0 ? true : expectedLines.every((line: string) => stdout.includes(line));
                if (isPassed) passedCount++;
                
                detailedResults.push({
                    testCase: i + 1,
                    passed: isPassed,
                    status: isPassed ? 'Accepted' : 'Wrong Answer',
                    actualOutput: stdout,
                    expectedOutput: expected,
                    error: ''
                });
            }
            finalStatusOk = passedCount === testCases.length;
        } else {
            passedCount = statusOk ? 1 : 0;
            detailedResults = [{ testCase: 1, passed: statusOk, status: statusOk ? 'Accepted' : 'Failed', actualOutput: stdout, error: stderr }];
        }

        setStatusType(finalStatusOk ? 'success' : 'error');
        setStatusText(finalStatusOk ? 'Accepted' : timedOut ? 'Timed Out' : 'Failed');
        setResults(detailedResults);
        const totalTC = testCases.length > 0 ? testCases.length : 1;
        setRunSummary({ passed: passedCount, total: totalTC });

        if (graphs.length > 0)       { setTimeout(() => setBottomTab(3), 300); }
        else if (images.length > 0)  { setTimeout(() => setBottomTab(4), 300); }

        if (isSub) {
          const score = Math.round((passedCount / totalTC) * 100);
          await codingAPI.saveSubmission({
            studentId: String(student.id),
            questionId: String(curQ.id),
            examId: String(selectedExam?.id),
            code, language,
            status: finalStatusOk ? 'Accepted' : 'Failed',
            passedTestCases: passedCount,
            totalTestCases: totalTC,
            score: score,
            executionTime: result?.executionTimeMs || 0,
            memory: 0,
            tabSwitched: forceNavigate,
            stdout: stdout || undefined,
            stderr: stderr || undefined,
          } as any);
          setSolvedStatus(prev => ({ ...prev, [idx]: finalStatusOk ? 'solved' : 'failed' }));
          toast({ title: 'Submission Logged', description: `ML Execution: ${passedCount}/${totalTC} test cases passed.` });
          if (forceNavigate) {
            clearCodingExamStorage();
            setTimeout(() => navigate(dashboardPath), 2000);
          }
        }

      } catch (err: any) {
        console.error('[ML Exec Error]', err);
        setExecStatus('FAILED');
        setStatusType('error');
        setStatusText('Error');
        toast({ title: 'ML Execution Error', description: err?.message || 'Network error — check backend connection.', variant: 'destructive' });
      } finally {
        setIsRunning(false); setIsSubmitting(false);
      }
      return;
    }


    let passedCount = 0;
    const detailedResults = [];
    let finalStatus: 'success' | 'error' = 'success';
    
    try {
      if (testCases.length === 0) {
          const res = await studentAPI.runCode({ code, language, stdin: '' });
          if (res.error) {
              finalStatus = 'error';
              detailedResults.push({ testCase: 1, status: 'Error', passed: false, error: res.message });
          } else if (res.stderr) {
              finalStatus = 'error';
              detailedResults.push({ testCase: 1, status: 'Runtime Error', passed: false, error: res.stderr });
          } else {
              finalStatus = 'success';
              detailedResults.push({ testCase: 1, status: 'Accepted', passed: true, actualOutput: res.stdout || 'Success', expectedOutput: 'No output expected' });
          }
          
          setResults(detailedResults);
          setStatusType(finalStatus);
          setStatusText(finalStatus === 'success' ? 'Accepted' : 'Failed');
          setRunSummary({ passed: finalStatus === 'success' ? 1 : 0, total: 1 });
          
          if (isSub) {
              await codingAPI.saveSubmission({
                  studentId: String(student.id),
                  questionId: String(curQ.id),
                  examId: String(selectedExam?.id),
                  code, language,
                  status: finalStatus === 'success' ? 'Accepted' : 'Failed',
                  passedTestCases: 0,
                  totalTestCases: 0,
                  score: finalStatus === 'success' ? 100 : 0,
                  executionTime: 0,
                  memory: 0,
                  tabSwitched: forceNavigate
              });
              toast({ title: 'Submission Logged', description: finalStatus === 'success' ? 'Code is correct. Full marks assigned.' : 'Code execution failed.' });
              setSolvedStatus(prev => ({ ...prev, [idx]: finalStatus === 'success' ? 'solved' : 'failed' }));
              if (forceNavigate) {
                 clearCodingExamStorage();
                 setTimeout(() => { navigate(dashboardPath); }, 2000);
              } else {
                 setTimeout(() => { 
                    if (idx !== null && idx < questions.length - 1) {
                        const next = idx + 1;
                        setIdx(next);
                        setCode(codes[next] || DEFAULT_CODE[language] || '');
                        setResults([]);
                        setBottomTab(0);
                    } else {
                        if (document.exitFullscreen && document.fullscreenElement) {
                            try { document.exitFullscreen(); } catch(e){}
                        }
                        clearCodingExamStorage();
                        setIdx(null);
                        setSelectedExam(null);
                    }
                 }, 2000); 
              }
          }
          setIsRunning(false); setIsSubmitting(false);
          return;
      }

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const res = await studentAPI.runCode({ code, language, stdin: tc.input });
        
        if (res.error) {
            finalStatus = 'error';
            detailedResults.push({ testCase: i + 1, status: 'Error', passed: false, error: res.message });
            break;
        }

        const rawOutput = (res.stdout || '').trim();
        const expected = (tc.output || '').trim();
        const isPassed = !res.stderr && rawOutput === expected;

        if (isPassed) passedCount++;
        else finalStatus = 'error';

        detailedResults.push({
          testCase: i + 1,
          passed: isPassed,
          status: isPassed ? 'Accepted' : (res.stderr ? 'Runtime Error' : 'Wrong Answer'),
          actualOutput: res.stdout || '',
          expectedOutput: tc.output,
          error: res.stderr || '',
        });

        if (!isPassed && isSub) break;
      }

      setResults(detailedResults);
      setStatusType(finalStatus);
      setStatusText(finalStatus === 'success' ? 'Accepted' : 'Failed');
      setRunSummary({ passed: passedCount, total: testCases.length });

      if (isSub) {
          await codingAPI.saveSubmission({
              studentId: String(student.id),
              questionId: String(curQ.id),
              examId: String(selectedExam?.id),
              code, language,
              status: finalStatus === 'success' ? 'Accepted' : 'Failed',
              passedTestCases: passedCount,
              totalTestCases: testCases.length,
              score: Math.round((passedCount / testCases.length) * 100),
              executionTime: 0,
              memory: 0,
              tabSwitched: forceNavigate
          });
          toast({ title: 'Submission Logged', description: `Result: ${passedCount}/${testCases.length} test cases passed.` });
          setSolvedStatus(prev => ({ ...prev, [idx]: finalStatus === 'success' ? 'solved' : 'failed' }));
          
          if (forceNavigate) {
              clearCodingExamStorage();
              setTimeout(() => { 
                 if (document.exitFullscreen && document.fullscreenElement) {
                     try { document.exitFullscreen(); } catch(e){}
                 }
                 navigate(dashboardPath); 
              }, 2000);
          } else {
              setTimeout(() => { 
                 if (idx !== null && idx < questions.length - 1) {
                     const next = idx + 1;
                     setIdx(next);
                     setCode(codes[next] || DEFAULT_CODE[language] || '');
                     setResults([]);
                     setBottomTab(0);
                 } else {
                     if (document.exitFullscreen && document.fullscreenElement) {
                         try { document.exitFullscreen(); } catch(e){}
                     }
                     clearCodingExamStorage();
                     setIdx(null);
                     setSelectedExam(null);
                 }
              }, 2000);
          }
      }
    } catch (err) { toast({ title: 'Execution Failed', description: 'Internal kernel error during execution.', variant: 'destructive' }); }
    finally { setIsSubmitting(false); setIsRunning(false); }
  };

  const runCustom = async () => {
    setIsCustomRun(true);
    setBottomTab(1); // CONSOLE
    try {
      const domain = lockedLanguage && ML_DOMAINS.includes(lockedLanguage) ? lockedLanguage : undefined;
      if (domain || (lockedLanguage && !['c','cpp','java','python','js'].includes(lockedLanguage))) {
        const res = await mlExecAPI.runCode({
          code,
          language,
          domain: domain || undefined,
          stdin: customIn,
          studentId: student?.id,
          questionId: questions[idx]?.id,
          examId: selectedExam?.id ? String(selectedExam.id) : undefined,
        });
        setCustomOut({
          stdout: res.stdout || '',
          stderr: res.stderr || res.compileError || '',
        });
      } else {
        const res = await studentAPI.runCode({ code, language, stdin: customIn });
        setCustomOut(res);
      }
    } catch (err) { toast({ title: 'Error', description: 'Custom execution failed.', variant: 'destructive' }); }
    finally { setIsCustomRun(false); }
  };

  const parseQuestion = (qStr: string) => {
    try {
      const p = JSON.parse(qStr);
      return {
        title: p.title || 'Untitled',
        description: p.description || qStr,
        difficulty: p.difficulty || 'Medium',
        inputFormat: p.inputFormat || '',
        outputFormat: p.outputFormat || '',
        testCases: p.testCases || p.cases || []
      };
    } catch {
      return { title: 'Untitled', description: qStr, difficulty: 'Medium', inputFormat: '', outputFormat: '', testCases: [] };
    }
  };

  if (loading) return (
    <StudentLayout user={student} onLogout={logout}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 3 }}>
        <CircularProgress sx={{ color: '#2affff', filter: 'drop-shadow(0 0 8px rgba(42, 255, 255, 0.4))' }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, letterSpacing: 2 }}>SECURE EVALUATION ENVIRONMENT STARTING...</Typography>
      </Box>
    </StudentLayout>
  );

  if (!selectedExam) return (
    <StudentLayout user={student} onLogout={logout}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 6 } }}>
        <Box sx={{ mb: 6 }}>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 950, mb: 2, letterSpacing: -2, background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.4))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CODING ASSESSMENTS</Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Select your scheduled coding examination below.</Typography>
        </Box>

        {isMaster && (
          <Box className="premium-glass-card" sx={{ p: 3, mb: 6, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
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

        <Grid container spacing={4}>
          {examsToDisplay.map((exam) => (
            <Grid item xs={12} sm={6} md={4} key={exam.id}>
              <Box className="premium-glass-card" sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column', transition: '0.4s', '&:hover': { transform: 'translateY(-12px)', border: '1px solid rgba(42, 255, 255, 0.4)' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 4 }}>
                  <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(42, 255, 255, 0.1)', border: '1px solid rgba(42, 255, 255, 0.2)' }}><CodeIcon sx={{ color: '#2affff', fontSize: 28 }} /></Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1 }}>{exam.subject?.toUpperCase()}</Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900 }}>{exam.subject}</Typography>
                  </Box>
                </Box>
                <Stack spacing={2} sx={{ mb: 5, flexGrow: 1 }}>
                   <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>EXAM DATE: {exam.exam_date && !isNaN(new Date(exam.exam_date).getTime()) ? new Date(exam.exam_date).toLocaleDateString() : 'N/A'}</Typography>
                   <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>DURATION: {exam.time_limit} MINS</Typography>
                </Stack>
                <button className="pill-btn-teal" style={{ width: '100%', padding: '16px', fontWeight: 900 }} onClick={() => handleStartExam(exam)}>START PROBLEM</button>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </StudentLayout>
  );

  if (idx === null) {
    return (
      <StudentLayout user={student} onLogout={logout}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 6 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 6, flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 2 }}>EXAM DASHBOARD</Typography>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 950, mb: 2, letterSpacing: -1 }}>{selectedExam.subject}</Typography>
              <Stack direction="row" spacing={2}>
                 <Chip icon={<Timer fontSize="small" />} label={`${formatTime(timeLeft)} REMAINING`} sx={{ bgcolor: 'rgba(42, 255, 255, 0.1)', color: '#2affff', fontWeight: 900, borderRadius: '8px', border: '1px solid rgba(42, 255, 255, 0.2)', px: 1 }} />
              </Stack>
            </Box>
            <Button variant="contained" onClick={() => {
              const pending = questions.length - Object.keys(solvedStatus).length;
              if (pending > 0) {
                 if (!window.confirm(`You have ${pending} question(s) pending. Are you sure you want to exit the exam?`)) return;
              }
               if (document.exitFullscreen && document.fullscreenElement) {
                  try { document.exitFullscreen(); } catch(e){}
               }
               clearCodingExamStorage();
               navigate(dashboardPath);
            }} sx={{ bgcolor: '#f87171', color: '#000', fontWeight: 900, px: 4, py: 1.5, borderRadius: '10px', '&:hover': { bgcolor: '#ef4444' } }}>
              EXIT
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {questions.map((q, i) => {
              const p = parseQuestion(q.question);
              const isSolved = solvedStatus[i] === 'solved';
              const isFailed = solvedStatus[i] === 'failed';
              return (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box 
                    className="premium-glass-card" 
                    onClick={() => {
                        setIdx(i);
                        setCode(codes[i] || DEFAULT_CODE[language] || '');
                        setResults([]);
                        setBottomTab(0);
                    }} 
                    sx={{ p: 4, cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', border: '1px solid #2affff' }, border: isSolved ? '1px solid rgba(34, 197, 94, 0.5)' : isFailed ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                       <Typography variant="caption" sx={{ color: isSolved ? '#22c55e' : '#2affff', fontWeight: 900, letterSpacing: 1 }}>QUESTION {i + 1}</Typography>
                       {isSolved && <CheckCircle sx={{ color: '#22c55e', fontSize: 20 }} />}
                       {isFailed && <Cancel sx={{ color: '#f87171', fontSize: 20 }} />}
                    </Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, mb: 3, flexGrow: 1 }}>{p.title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DiffBadge d={p.difficulty} />
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </StudentLayout>
    );
  }

  const parsedQ = parseQuestion(questions[idx]?.question || '{}');

  return (
    <StudentLayout user={student} onLogout={logout} noPadding hideNav={idx !== null}>
      <Box sx={{ height: '100vh', width: '100vw', bgcolor: '#09090b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <PanelGroup direction="horizontal">
          <Panel defaultSize={38} minSize={30}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0b0b0d', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <Tabs 
                value={leftTab} 
                onChange={(_, v) => setLeftTab(v)} 
                sx={{ 
                  minHeight: 45, 
                  bgcolor: '#0f0f12',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { bgcolor: '#2affff', height: 3 }, 
                  '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.05em' } 
                }}
              >
                <Tab label="PROBLEM" />
                <Tab label="HISTORY" />
                <Tab label="RANKING" />
              </Tabs>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(42, 255, 255, 0.03)' }}>
                <Button onClick={() => {
                   setCodes(prev => ({ ...prev, [idx]: code }));
                   setIdx(null); 
                }} size="small" sx={{ color: '#fff', fontWeight: 900, letterSpacing: 1, fontSize: '0.7rem' }}>
                  &larr; BACK
                </Button>
                <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1 }}>
                  {parsedQ.title || 'PROBLEM'}
                </Typography>
              </Box>

              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                {leftTab === 0 && (
                  <Box>
                    {/* Title + Difficulty */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff' }}>{parsedQ.title}</Typography>
                      <DiffBadge d={parsedQ.difficulty} />
                    </Box>

                    {/* Problem Description */}
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, mb: 3, whiteSpace: 'pre-wrap' }}>{parsedQ.description}</Typography>

                    {/* Input Format */}
                    {parsedQ.inputFormat && (
                      <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 3, height: 16, bgcolor: '#2affff', borderRadius: 1 }} />
                          <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1, fontSize: '0.72rem' }}>INPUT FORMAT</Typography>
                        </Box>
                        <MonoBox sx={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{parsedQ.inputFormat}</MonoBox>
                      </Box>
                    )}

                    {/* Output Format */}
                    {parsedQ.outputFormat && (
                      <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 3, height: 16, bgcolor: '#a78bfa', borderRadius: 1 }} />
                          <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 900, letterSpacing: 1, fontSize: '0.72rem' }}>OUTPUT FORMAT</Typography>
                        </Box>
                        <MonoBox sx={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{parsedQ.outputFormat}</MonoBox>
                      </Box>
                    )}

                    {/* All Test Cases */}
                    {parsedQ.testCases?.map((tc: any, i: number) => {
                      const tcResult = results?.find((r: any) => r.testCase === i + 1);
                      return (
                        <Box
                          key={i}
                          className="premium-glass-card"
                          sx={{
                            p: 2.5,
                            mb: 2.5,
                            border: tcResult
                              ? (tcResult.passed ? '1.5px solid rgba(34, 197, 94, 0.4)' : '1.5px solid rgba(239, 68, 68, 0.4)')
                              : '1px solid rgba(255,255,255,0.06)',
                            boxShadow: tcResult
                              ? (tcResult.passed ? '0 0 15px rgba(34, 197, 94, 0.05)' : '0 0 15px rgba(239, 68, 68, 0.05)')
                              : 'none',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1.5 }}>
                              TEST CASE {i + 1}
                            </Typography>
                            {tcResult && (
                              <Chip
                                label={tcResult.status?.toUpperCase() || (tcResult.passed ? 'PASSED' : 'FAILED')}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.62rem',
                                  fontWeight: 900,
                                  letterSpacing: 1,
                                  bgcolor: tcResult.passed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: tcResult.passed ? '#22c55e' : '#f87171',
                                  border: tcResult.passed ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                              />
                            )}
                          </Stack>

                          <Box sx={{ mb: tc.output ? 1.5 : 0 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'block', mb: 0.5, letterSpacing: 0.5 }}>Input</Typography>
                            <MonoBox>{tc.input || '(empty)'}</MonoBox>
                          </Box>

                          {tc.output && (
                            <Box sx={{ mb: tcResult ? 1.5 : 0 }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'block', mb: 0.5, letterSpacing: 0.5 }}>Expected Output</Typography>
                              <MonoBox>{tc.output}</MonoBox>
                            </Box>
                          )}

                          {tcResult && (
                            <Box sx={{ mt: 1.5 }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'block', mb: 0.5, letterSpacing: 0.5 }}>
                                {tcResult.passed ? 'Your Output' : 'Actual Output / Error'}
                              </Typography>
                              <MonoBox error={!tcResult.passed} sx={{ bgcolor: tcResult.passed ? 'rgba(9, 9, 11, 0.8)' : 'rgba(239, 68, 68, 0.04)' }}>
                                {tcResult.actualOutput || tcResult.error || 'No output returned'}
                              </MonoBox>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          </Panel>
          <ResizeHandle dir="h" />
          <Panel defaultSize={62}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={60}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0d0d0f' }}>
                  <Box sx={{ height: 40, bgcolor: '#111113', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', px: 2, justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ display: 'flex', gap: 0.8 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f56' }} />
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#27c93f' }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800, ml: 2, fontFamily: 'monospace' }}>
                        {language === 'java' ? 'Solution.java' : `solution.${language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : language === 'js' ? 'js' : 'c'}`}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <FormControl size="small" variant="standard" sx={{ minWidth: 100 }}>
                        <Select
                          value={language}
                          onChange={(e: any) => {
                            if (lockedLanguage) return; 
                            const newLang = e.target.value;
                            setLanguage(newLang);
                            if (!code || Object.values(DEFAULT_CODE).includes(code)) {
                              setCode(DEFAULT_CODE[newLang] || '');
                            }
                          }}
                          disabled={isSubmitting || !!lockedLanguage}
                          disableUnderline
                          title={lockedLanguage ? `Language locked: ${getLangLabel(lockedLanguage)}` : undefined}
                          sx={{
                            color: lockedLanguage ? '#f59e0b' : '#2affff',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            '& .MuiSelect-icon': { color: lockedLanguage ? '#f59e0b' : '#2affff' },
                            '& .MuiSelect-select': { py: 0 }
                          }}
                        >
                          <MenuItem value="python" sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>Python</MenuItem>
                          <MenuItem value="java"   sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>Java</MenuItem>
                          <MenuItem value="c"      sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>C</MenuItem>
                          <MenuItem value="cpp"    sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>C++</MenuItem>
                        </Select>
                      </FormControl>
                      {lockedLanguage && (
                        <Chip
                          label={`🔒 ${getLangLabel(lockedLanguage)}`}
                          size="small"
                          sx={{ height: 20, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', fontWeight: 900, fontSize: '0.65rem', letterSpacing: 0.5 }}
                        />
                      )}
                      {results.some(r => !r.passed && r.error) && (
                        <Chip 
                          label={`ERR L:${adjustLine(results.find(r => !r.passed && r.error)?.error?.match(/line (\d+)/i)?.[1])}`} 
                          size="small" 
                          sx={{ height: 20, bgcolor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 900, fontSize: '0.65rem' }} 
                        />
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(42, 255, 255, 0.1)', px: 1.5, py: 0.5, borderRadius: '6px', border: '1px solid rgba(42, 255, 255, 0.2)' }}>
                        <Timer sx={{ fontSize: 16, color: '#2affff' }} />
                        <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, fontFamily: 'monospace', letterSpacing: 1 }}>
                          {formatTime(timeLeft)}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                        {isFullscreen ? <FullscreenExit sx={{ fontSize: 18 }} /> : <Fullscreen sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Stack>
                  </Box>
                  <Box sx={{ flexGrow: 1, overflow: 'hidden', minHeight: 0 }}>
                    <Editor 
                       height="100%" 
                       language={language === 'js' ? 'javascript' : language} 
                       theme="vs-dark" 
                       value={code} 
                       onChange={(v) => {
                          setCode(v || '');
                          setCodes(prev => ({ ...prev, [idx]: v || '' }));
                       }} 
                       options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", padding: { top: 12 }, lineNumbersMinChars: 3, scrollBeyondLastLine: false, automaticLayout: true }} 
                    />
                  </Box>
                </Box>
              </Panel>
              <ResizeHandle dir="v" />
              <Panel defaultSize={10} minSize={6}>
                <Box sx={{ height: '100%', bgcolor: '#0d0d0f', borderTop: '1px solid rgba(255,255,255,0.05)', p: 1.5, overflowY: 'auto' }}>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 900, display: 'block', mb: 1, letterSpacing: 1 }}>PROBLEMS ({results.filter(r => !r.passed).length})</Typography>
                  {results.filter(r => !r.passed).map((r, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Cancel sx={{ fontSize: 14, color: '#f87171' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontFamily: 'monospace' }}>
                        Line {adjustLine(r.error?.match(/line (\d+)/i)?.[1])}: {r.error || r.status || 'Assertion Error'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Panel>
              <ResizeHandle dir="v" />
              <Panel defaultSize={25}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(17, 17, 19, 0.4)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#0f0f12', borderBottom: '1px solid rgba(255,255,255,0.1)', px: 1, justifyContent: 'space-between' }}>
                    <Tabs 
                      value={bottomTab} 
                      onChange={(_, v) => setBottomTab(v)} 
                      sx={{ 
                        minHeight: 45, 
                        '& .MuiTabs-indicator': { bgcolor: '#2affff', height: 3 }, 
                        '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: '0.7rem', minWidth: 70 } 
                      }}
                    >
                      <Tab label="RESULTS" />
                      <Tab label="CONSOLE" />
                      <Tab label="CUSTOM" />
                      {(isMLDomain || mlGraphs.length > 0) && (
                        <Tab label={`GRAPHS ${mlGraphs.length > 0 ? `(${mlGraphs.length})` : ''}`} sx={{ color: mlGraphs.length > 0 ? '#a855f7 !important' : 'inherit' }} />
                      )}
                      {(isMLDomain || mlImages.length > 0) && (
                        <Tab label={`IMAGES ${mlImages.length > 0 ? `(${mlImages.length})` : ''}`} sx={{ color: mlImages.length > 0 ? '#f59e0b !important' : 'inherit' }} />
                      )}
                      {(isMLDomain || Object.keys(mlMetrics).length > 0) && (
                        <Tab label="METRICS" sx={{ color: Object.keys(mlMetrics).length > 0 ? '#22c55e !important' : 'inherit' }} />
                      )}
                      {questionDatasets.length > 0 && (
                        <Tab label={`DATASET (${questionDatasets.length})`} sx={{ color: '#2affff !important' }} />
                      )}
                      {(isMLDomain || mlAudio.length > 0) && (
                        <Tab label={`AUDIO OUT`} sx={{ color: mlAudio.length > 0 ? '#ec4899 !important' : 'inherit' }} />
                      )}
                    </Tabs>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, flexShrink: 0 }}>
                      {execStatus !== 'IDLE' && (
                        <Chip
                          size="small"
                          label={execStatus}
                          sx={{
                            height: 20,
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            letterSpacing: 0.5,
                            bgcolor: execStatus === 'SUCCESS'          ? 'rgba(34,197,94,0.15)'
                                   : execStatus === 'FAILED'           ? 'rgba(248,113,113,0.15)'
                                   : execStatus === 'TIMEOUT'          ? 'rgba(245,158,11,0.15)'
                                   : execStatus === 'SECURITY_BLOCKED' ? 'rgba(239,68,68,0.2)'
                                   : execStatus === 'RATE_LIMITED'     ? 'rgba(168,85,247,0.15)'
                                   : 'rgba(42,255,255,0.1)',
                            color: execStatus === 'SUCCESS'          ? '#22c55e'
                                 : execStatus === 'FAILED'           ? '#f87171'
                                 : execStatus === 'TIMEOUT'          ? '#f59e0b'
                                 : execStatus === 'SECURITY_BLOCKED' ? '#ef4444'
                                 : execStatus === 'RATE_LIMITED'     ? '#a855f7'
                                 : '#2affff',
                            border: '1px solid currentColor',
                          }}
                        />
                      )}
                      {aiSuspected && (
                        <Chip size="small" label="⚠ AI DETECTED" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }} />
                      )}
                      {submissionLocked && (
                        <Chip size="small" label="🔒 SUBMITTED" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }} />
                      )}
                      {!submissionLocked && (
                        <>
                          <Button
                            variant="contained"
                            onClick={() => execCode('run')}
                            disabled={isRunning || isSubmitting || execStatus === 'RATE_LIMITED'}
                            sx={{ bgcolor: '#2affff', color: '#000', fontWeight: 900, fontSize: '0.7rem', px: 2.5, borderRadius: '8px', '&:hover': { bgcolor: '#00e5e5' }, minWidth: 80 }}
                          >
                            {isRunning ? <CircularProgress size={14} sx={{ color: '#000' }} /> : 'RUN'}
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => execCode('submit')}
                            disabled={isSubmitting || isRunning || execStatus === 'RATE_LIMITED'}
                            sx={{ bgcolor: '#2affff', color: '#000', fontWeight: 900, fontSize: '0.7rem', px: 2.5, borderRadius: '8px', '&:hover': { bgcolor: '#00e5e5' }, minWidth: 90 }}
                          >
                            {isSubmitting ? <CircularProgress size={14} sx={{ color: '#000' }} /> : 'SUBMIT'}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                  <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    {bottomTab === 0 && (
                      <Stack spacing={2}>
                        {results.length === 0 && !isRunning && !isSubmitting && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4 }}>// AWAITING EXECUTION COMMAND</Typography>}
                        {results.map((r, i) => (
                          <Box key={i} className="premium-glass-card" sx={{ p: 2, borderLeft: `3px solid ${r.passed ? '#22c55e' : '#f87171'}` }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, color: r.passed ? '#22c55e' : '#f87171' }}>TEST CASE {r.testCase}: {r.status}</Typography>
                            {r.error && <MonoBox error sx={{ mt: 1 }}>{r.error}</MonoBox>}
                            {!r.error && <MonoBox sx={{ mt: 1 }}>{r.actualOutput}</MonoBox>}
                          </Box>
                        ))}
                      </Stack>
                    )}

                    {bottomTab === 1 && (
                       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                         {customOut?.stdout && (
                           <Box>
                             <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 900, letterSpacing: 1 }}>STDOUT</Typography>
                             <MonoBox sx={{ mt: 0.5 }}>{customOut.stdout}</MonoBox>
                           </Box>
                         )}
                         {customOut?.stderr && (
                           <Box>
                             <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 900, letterSpacing: 1 }}>STDERR</Typography>
                             <MonoBox error sx={{ mt: 0.5 }}>{customOut.stderr}</MonoBox>
                           </Box>
                         )}
                         {!customOut && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4 }}>// Console output will appear here after execution</Typography>}
                       </Box>
                    )}

                    {bottomTab === 2 && (
                       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                         <textarea value={customIn} onChange={(e) => setCustomIn(e.target.value)} placeholder="Enter custom STDIN..." style={{ width: '100%', height: 100, backgroundColor: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', fontFamily: 'monospace' }} />
                         <button className="pill-btn-teal" onClick={runCustom} disabled={isCustomRun}>EXECUTE CUSTOM</button>
                         {customOut && <MonoBox sx={{ mt: 1 }}>{customOut.stdout || customOut.stderr || 'No output'}</MonoBox>}
                       </Box>
                    )}

                    {bottomTab === 3 && (
                      <Box>
                        {mlGraphs.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4, display: 'block' }}>
                            // Matplotlib graphs will appear here after execution
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {mlGraphs.map((g, i) => (
                              <Grid item xs={12} md={6} key={i}>
                                <Box sx={{ p: 1.5, border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, bgcolor: 'rgba(168,85,247,0.03)' }}>
                                  <Typography variant="caption" sx={{ color: '#a855f7', fontWeight: 900, display: 'block', mb: 1, fontFamily: 'monospace' }}>
                                    📊 {g.filename || `Graph ${i + 1}`}
                                  </Typography>
                                  <img
                                    src={g.url ? `${BASE_SERVER_URL}${g.url}` : g.base64}
                                    alt={g.filename || `Graph ${i + 1}`}
                                    onClick={() => setSelectedImage(g.url ? `${BASE_SERVER_URL}${g.url}` : g.base64)}
                                    style={{ width: '100%', borderRadius: 8, display: 'block', cursor: 'pointer', transition: '0.2s', '&:hover': { opacity: 0.8 } } as any}
                                  />
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      </Box>
                    )}

                    {bottomTab === 4 && (
                      <Box>
                        {mlImages.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4, display: 'block' }}>
                            // OpenCV processed images will appear here
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {mlImages.map((img, i) => (
                              <Grid item xs={12} sm={6} md={4} key={i}>
                                <Box sx={{ p: 1.5, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, bgcolor: 'rgba(245,158,11,0.03)' }}>
                                  <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 900, display: 'block', mb: 1, fontFamily: 'monospace' }}>
                                    🖼️ {img.filename || `Image ${i + 1}`}
                                  </Typography>
                                  <img
                                    src={img.url ? `${BASE_SERVER_URL}${img.url}` : img.base64}
                                    alt={img.filename || `Image ${i + 1}`}
                                    onClick={() => setSelectedImage(img.url ? `${BASE_SERVER_URL}${img.url}` : img.base64)}
                                    style={{ width: '100%', borderRadius: 8, display: 'block', cursor: 'pointer', transition: '0.2s', '&:hover': { opacity: 0.8 } } as any}
                                  />
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      </Box>
                    )}

                    {bottomTab === 5 && (
                      <Box>
                        {autoGrade && (
                          <Box sx={{ mb: 3, p: 2.5, border: '1px solid rgba(42,255,255,0.2)', borderRadius: 3, bgcolor: 'rgba(42,255,255,0.03)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1 }}>AUTO GRADE</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip
                                  label={autoGrade.passed ? 'PASSED' : 'FAILED'}
                                  size="small"
                                  sx={{ bgcolor: autoGrade.passed ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.2)', color: autoGrade.passed ? '#22c55e' : '#f87171', fontWeight: 900, fontSize: '0.65rem' }}
                                />
                                <Typography variant="h5" sx={{ color: autoGrade.score >= 70 ? '#22c55e' : autoGrade.score >= 40 ? '#f59e0b' : '#f87171', fontWeight: 900, fontFamily: 'monospace' }}>
                                  {autoGrade.score}/100
                                </Typography>
                              </Box>
                            </Box>
                            {autoGrade.breakdown?.length > 0 && (
                              <Stack spacing={1}>
                                {autoGrade.breakdown.map((b: any, i: number) => (
                                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                      <Typography variant="caption" sx={{ color: b.passed ? '#22c55e' : '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>{b.passed ? '✓' : '✗'}</Typography>
                                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{b.label || b.metric}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                      <Typography variant="caption" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{typeof b.value === 'number' ? b.value.toFixed(4) : b.value}</Typography>
                                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.6rem' }}>
                                        {b.lowerIsBetter ? `≤ ${b.threshold}` : `≥ ${b.threshold}`}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: '#2affff', fontFamily: 'monospace', fontSize: '0.65rem' }}>{b.score}/{b.maxScore}pt</Typography>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mt: 1.5, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                              {autoGrade.summary}
                              {autoGrade.visualBonus > 0 && ` (visual bonus: +${autoGrade.visualBonus}pts)`}
                            </Typography>
                          </Box>
                        )}

                        {Object.keys(mlMetrics).length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4, display: 'block' }}>
                            // Print metrics using: print(f"METRIC: accuracy={'{'}acc:.4f{'}'}")
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {Object.entries(mlMetrics).map(([name, value]) => (
                              <Grid item xs={6} sm={4} md={3} key={name}>
                                <Box sx={{ p: 2, border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, bgcolor: 'rgba(34,197,94,0.03)', textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, display: 'block' }}>
                                    {name.toUpperCase()}
                                  </Typography>
                                  <Typography variant="h5" sx={{ color: '#22c55e', fontWeight: 900, fontFamily: 'monospace', mt: 0.5 }}>
                                    {typeof value === 'number' ? value.toFixed(4) : String(value)}
                                  </Typography>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        )}

                        {execHistory.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1, display: 'block', mb: 1.5 }}>EXECUTION HISTORY</Typography>
                            <Stack spacing={1}>
                              {execHistory.slice(0, 8).map((h: any, i) => (
                                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.01)' }}>
                                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Chip
                                      size="small"
                                      label={h.status}
                                      sx={{
                                        height: 18,
                                        fontSize: '0.6rem',
                                        fontWeight: 900,
                                        bgcolor: h.status === 'Accepted' ? 'rgba(34,197,94,0.15)' : h.status === 'TIMEOUT' ? 'rgba(245,158,11,0.15)' : h.status === 'SECURITY_BLOCKED' ? 'rgba(239,68,68,0.15)' : 'rgba(248,113,113,0.15)',
                                        color:   h.status === 'Accepted' ? '#22c55e' : h.status === 'TIMEOUT' ? '#f59e0b' : h.status === 'SECURITY_BLOCKED' ? '#ef4444' : '#f87171',
                                      }}
                                    />
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{h.execution_time_ms}ms</Typography>
                                    {h.has_graphs ? <Chip size="small" label="📊" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(168,85,247,0.15)', color: '#a855f7' }} /> : null}
                                  </Box>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
                                    {new Date(h.created_at).toLocaleTimeString()}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    )}

                    {bottomTab === 6 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, letterSpacing: 1, display: 'block', mb: 2 }}>AVAILABLE DATASETS</Typography>
                        <Stack spacing={2}>
                          {questionDatasets.map((ds: any, i) => (
                            <Box key={i} sx={{ p: 2, border: '1px solid rgba(42,255,255,0.15)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>{ds.dataset_name}</Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                                  Type: {ds.dataset_type.toUpperCase()} · Size: {(ds.dataset_size / 1024).toFixed(1)} KB
                                </Typography>
                              </Box>
                              <Chip
                                label={ds.dataset_type.toUpperCase()}
                                size="small"
                                sx={{
                                  bgcolor: ds.dataset_type === 'csv' ? 'rgba(34,197,94,0.15)' : ds.dataset_type === 'rl' ? 'rgba(168,85,247,0.15)' : ds.dataset_type === 'audio' ? 'rgba(236,72,153,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: ds.dataset_type === 'csv' ? '#22c55e' : ds.dataset_type === 'rl' ? '#a855f7' : ds.dataset_type === 'audio' ? '#ec4899' : '#f59e0b',
                                  fontWeight: 900,
                                  fontSize: '0.65rem',
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', mt: 2, display: 'block', fontFamily: 'monospace' }}>
                          // Datasets are auto-mounted at /datasets/ in your execution environment
                        </Typography>
                      </Box>
                    )}

                    {/* AUDIO OUT PREVIEW */}
                    {bottomTab === 7 && (
                      <Box>
                        {mlAudio.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 4, display: 'block' }}>
                            // Generated audio outputs will appear here
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {mlAudio.map((a, i) => (
                              <Grid item xs={12} key={i}>
                                <Box sx={{ p: 2, border: '1px solid rgba(236,72,153,0.3)', borderRadius: 3, bgcolor: 'rgba(236,72,153,0.03)' }}>
                                  <Typography variant="caption" sx={{ color: '#ec4899', fontWeight: 900, display: 'block', mb: 1, fontFamily: 'monospace' }}>
                                    🎵 {a.filename || `Audio ${i + 1}`}
                                  </Typography>
                                  <audio controls src={a.base64} style={{ width: '100%', height: 40 }} />
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </Box>

      {/* Graph Pop-up Modal */}
      <Dialog 
        open={!!selectedImage} 
        onClose={() => setSelectedImage(null)} 
        maxWidth="lg" 
        fullWidth 
        PaperProps={{ style: { backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, letterSpacing: 1 }}>IMAGE PREVIEW</Typography>
          <IconButton onClick={() => setSelectedImage(null)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, display: 'flex', justifyContent: 'center', bgcolor: '#000' }}>
          {selectedImage && <img src={selectedImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />}
        </DialogContent>
      </Dialog>

      {/* Already Attempted Block Dialog */}
      <Dialog 
        open={showAttemptedDialog} 
        onClose={() => setShowAttemptedDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
          style: { 
            backgroundColor: '#0d0d0f', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '16px'
          } 
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, letterSpacing: 1 }}>ASSESSMENT BLOCKED</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 4, textAlign: 'center', bgcolor: '#0d0d0f' }}>
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
