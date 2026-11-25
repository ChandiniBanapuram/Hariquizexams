import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useExam } from '@/context/ExamContext';
import { studentAPI, Question } from '@/lib/api';

export default function ExamPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { studentDetails, questions, timeLimit, setExamResult, resetExam } = useExam();
  const examContainerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const isExitingFullscreenForSubmitRef = useRef(false);

  // ── LOCAL STORAGE RECOVERY & GUARD ──────────────────────────────────────────
  const savedEndTimeRaw = localStorage.getItem('examEndTime');
  const savedEndTimeMs = savedEndTimeRaw ? parseInt(savedEndTimeRaw, 10) : 0;
  const savedEndTimeValid = savedEndTimeMs > Date.now();
  if (savedEndTimeRaw && !savedEndTimeValid) {
    localStorage.removeItem('examEndTime');
    localStorage.removeItem('examStarted');
    localStorage.removeItem('examAnswers');
    localStorage.removeItem('examCurrentQuestionIndex');
    localStorage.removeItem('examMarkedForReview');
    localStorage.removeItem('examVisitedQuestions');
  }

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    const saved = localStorage.getItem('examCurrentQuestionIndex');
    const index = saved ? parseInt(saved, 10) : 0;
    return index >= 0 && index < questions.length ? index : 0;
  });

  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('examAnswers');
    return saved ? JSON.parse(saved) : {};
  });
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const hasSubmittedRef = useRef(false);

  const [markedForReview, setMarkedForReview] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('examMarkedForReview');
    return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
  });

  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('examVisitedQuestions');
    const initialSet = saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    if (questions.length > 0 && questions[0]?.id) {
      initialSet.add(questions[0].id);
    }
    return initialSet;
  });

  const [examStarted, setExamStarted] = useState<boolean>(() => {
    return localStorage.getItem('examStarted') === 'true' && savedEndTimeValid;
  });

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (savedEndTimeValid) {
      return Math.max(0, Math.floor((savedEndTimeMs - Date.now()) / 1000));
    }
    return (timeLimit || 15) * 60;
  });

  const [tabSwitched, setTabSwitched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEnteringFullscreen, setIsEnteringFullscreen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // ── SAVE STATE TO LOCAL STORAGE ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('examCurrentQuestionIndex', currentQuestionIndex.toString());
    if (questions[currentQuestionIndex]) {
      setVisitedQuestions((prev) => {
        const next = new Set(prev);
        next.add(questions[currentQuestionIndex].id);
        localStorage.setItem('examVisitedQuestions', JSON.stringify(Array.from(next)));
        return next;
      });
    }
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    localStorage.setItem('examAnswers', JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    localStorage.setItem('examMarkedForReview', JSON.stringify(Array.from(markedForReview)));
  }, [markedForReview]);

  useEffect(() => {
    localStorage.setItem('examStarted', examStarted.toString());
    if (examStarted && !localStorage.getItem('examEndTime')) {
      const endTime = Date.now() + (timeLimit || 15) * 60 * 1000;
      localStorage.setItem('examEndTime', endTime.toString());
      setTimeLeft((timeLimit || 15) * 60);
    }
  }, [examStarted, timeLimit]);

  // ── FULLSCREEN HELPERS ───────────────────────────────────────────────────────
  const checkFullscreen = useCallback(() => {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
  }, []);

  const enterFullscreen = useCallback(async () => {
    setIsEnteringFullscreen(true);
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    } finally {
      setIsFullscreen(true);
      setIsEnteringFullscreen(false);
    }
  }, []);

  const handleStartExam = useCallback(async () => {
    await enterFullscreen();
    setExamStarted(true);
  }, [enterFullscreen]);

  // Guard: if no student or questions in state or localStorage, redirect to home
  useEffect(() => {
    const hasLocalStudent = studentDetails || localStorage.getItem('examStudentDetails') || localStorage.getItem('studentData');
    const savedQs = localStorage.getItem('examQuestions');
    const hasLocalQuestions = (questions && questions.length > 0) || (savedQs && JSON.parse(savedQs).length > 0);
    if (!hasLocalStudent || !hasLocalQuestions) {
      navigate('/');
    }
  }, [studentDetails, questions, navigate]);

  // ── SUBMIT EXAM ─────────────────────────────────────────────────────────────
  const submitExam = useCallback(
    async (reason: string = 'manual') => {
      if (isSubmittingRef.current || hasSubmittedRef.current) {
        console.log('[submitExam] Submission already in progress or completed, skipping');
        return;
      }

      isSubmittingRef.current = true;
      hasSubmittedRef.current = true;
      setIsSubmitting(true);
      setHasSubmitted(true);
      setShowSubmitModal(false);
      console.log('[submitExam] Starting exam submission, reason:', reason);

      try {
        const studentObj =
          studentDetails ||
          JSON.parse(localStorage.getItem('examStudentDetails') || '{}') ||
          JSON.parse(localStorage.getItem('studentData') || '{}') ||
          JSON.parse(sessionStorage.getItem('student') || '{}') ||
          JSON.parse(sessionStorage.getItem('studentData') || '{}') ||
          {};

        const rawRoll =
          studentObj.rollNumber ||
          (studentObj as any).roll_number ||
          (studentObj as any).rollNo ||
          (studentObj as any).username ||
          localStorage.getItem('rollNumber') ||
          sessionStorage.getItem('rollNumber') ||
          '';

        const rawName =
          studentObj.name ||
          (studentObj as any).fullName ||
          (studentObj as any).full_name ||
          localStorage.getItem('studentName') ||
          sessionStorage.getItem('studentName') ||
          '';

        const rawDept =
          studentObj.department ||
          (studentObj as any).dept ||
          (studentObj as any).branch ||
          localStorage.getItem('department') ||
          'CSE';

        const rawSec =
          studentObj.section ||
          (studentObj as any).sec ||
          localStorage.getItem('section') ||
          'A';

        const finalRoll = rawRoll || 'STUDENT';
        const finalName = rawName || 'Student';

        const normalizedDepartment = (rawDept || 'CSE')
          .toString()
          .replace(/\s+/g, '')
          .replace('&', '&');

        const normalizedSection =
          rawSec === 'Section A' || rawSec === 'A'
            ? 'A'
            : rawSec === 'Section B' || rawSec === 'B'
            ? 'B'
            : rawSec || 'A';

        const currentAnswers =
          answersRef.current && Object.keys(answersRef.current).length > 0
            ? answersRef.current
            : JSON.parse(localStorage.getItem('examAnswers') || '{}');

        console.log('[submitExam] Payload details:', {
          rollNumber: finalRoll,
          name: finalName,
          department: normalizedDepartment,
          section: normalizedSection,
          subject: studentObj.subject || '',
          answersCount: Object.keys(currentAnswers).length,
          reason,
        });

        const isViolation = tabSwitched || reason === 'tab_switch' || reason === 'fullscreen_exit';

        const result = await studentAPI.submitExam({
          rollNumber: finalRoll,
          name: finalName,
          department: normalizedDepartment,
          section: normalizedSection,
          year: studentObj.year || '1',
          semester: studentObj.semester || '1',
          subject: studentObj.subject || '',
          examDate: studentObj.examDate || '',
          answers: currentAnswers,
          tabSwitched: isViolation,
        });

        console.log('[submitExam] Backend result:', result);

        if (!result || result.message === 'Request failed' || (result.score === undefined && !result.success)) {
          if (result?.message && (result.message.includes('already submitted') || result.message.includes('Only one attempt'))) {
            toast({
              title: 'Already Submitted',
              description: result.message,
              variant: 'destructive',
            });
            localStorage.removeItem('examStarted');
            localStorage.removeItem('examAnswers');
            localStorage.removeItem('examEndTime');
            navigate('/student/dashboard');
            return;
          }
          throw new Error(result?.message || 'Failed to submit exam');
        }

        const calculatedResult = {
          name: finalName,
          rollNumber: finalRoll,
          department: normalizedDepartment,
          section: normalizedSection,
          score: result.score !== undefined ? result.score : 0,
          totalMarks: result.totalMarks !== undefined ? result.totalMarks : questions.length,
        };

        setExamResult(calculatedResult);
        localStorage.setItem('examResult', JSON.stringify(calculatedResult));
        localStorage.setItem('lastExamResult', JSON.stringify(calculatedResult));

        // Clean up exam localStorage state
        localStorage.removeItem('examStarted');
        localStorage.removeItem('examAnswers');
        localStorage.removeItem('examEndTime');

        // Safely exit fullscreen now that submission is saved
        try {
          if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
            isExitingFullscreenForSubmitRef.current = true;
            if (document.exitFullscreen) {
              await document.exitFullscreen().catch(() => {});
            } else if ((document as any).webkitExitFullscreen) {
              await (document as any).webkitExitFullscreen().catch(() => {});
            }
          }
        } catch (e) {}

        navigate('/result');
      } catch (error) {
        console.error('[submitExam] Exception caught:', error);
        hasSubmittedRef.current = false;
        setHasSubmitted(false);
        toast({
          title: 'Submission Failed',
          description: error instanceof Error ? error.message : 'Failed to submit exam. Please try again.',
          variant: 'destructive',
        });
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        isExitingFullscreenForSubmitRef.current = false;
      }
    },
    [studentDetails, tabSwitched, setExamResult, navigate, toast, questions.length]
  );

  // ── TIMER COUNTDOWN ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examStarted) return;
    if (timeLeft <= 0) {
      toast({
        title: 'Time Up!',
        description: 'Your exam has been auto-submitted.',
        variant: 'destructive',
      });
      submitExam('timeout');
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        const savedEndTime = localStorage.getItem('examEndTime');
        if (savedEndTime) {
          const remaining = Math.max(0, Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000));
          return remaining;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timeLeft, submitExam, toast, examStarted]);

  // ── ANTI-CHEAT: TAB SWITCH, BLUR, AND FULLSCREEN DETECTOR (AUTO SUBMIT) ──────
  useEffect(() => {
    if (!examStarted || hasSubmitted) return;

    const triggerAutoSubmit = (reason: 'tab_switch' | 'fullscreen_exit') => {
      if (isSubmittingRef.current || hasSubmittedRef.current || isExitingFullscreenForSubmitRef.current) {
        return;
      }
      isSubmittingRef.current = true;
      hasSubmittedRef.current = true;
      setTabSwitched(true);
      localStorage.setItem('examTabSwitched', 'true');
      toast({
        title: reason === 'fullscreen_exit' ? 'Exited Fullscreen!' : 'Tab Switch Detected!',
        description: `${
          reason === 'fullscreen_exit' ? 'Exiting fullscreen mode' : 'Opening another tab or window'
        } is prohibited. Your exam is being submitted automatically.`,
        variant: 'destructive',
      });
      submitExam(reason);
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        console.warn('[Proctor] Visibility changed to hidden - auto submitting');
        triggerAutoSubmit('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      console.warn('[Proctor] Window lost focus - auto submitting');
      triggerAutoSubmit('tab_switch');
    };

    const handleFullscreenChange = () => {
      if (isExitingFullscreenForSubmitRef.current) return;
      const isCurrentlyFullscreen = checkFullscreen();
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        console.warn('[Proctor] Fullscreen exited - auto submitting');
        triggerAutoSubmit('fullscreen_exit');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [examStarted, hasSubmitted, checkFullscreen, submitExam, toast]);

  // ── KEYBOARD & CONTEXT MENU PREVENTION ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const allowedKeys = [
        'Tab', 'Enter', 'Space', ' ',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        '1', '2', '3', '4',
        'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D',
        'Backspace', 'Delete',
      ];

      if (e.key.startsWith('F') && e.key.length <= 3) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.shiftKey && !allowedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (['PrintScreen', 'Meta', 'OS', 'Insert', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (!allowedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    const handlePrevent = (e: Event) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handlePrevent, true);
    document.addEventListener('copy', handlePrevent, true);
    document.addEventListener('cut', handlePrevent, true);
    document.addEventListener('paste', handlePrevent, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handlePrevent, true);
      document.removeEventListener('copy', handlePrevent, true);
      document.removeEventListener('cut', handlePrevent, true);
      document.removeEventListener('paste', handlePrevent, true);
    };
  }, [hasSubmitted, submitExam]);

  // ── INTERACTION HANDLERS ────────────────────────────────────────────────────
  const handleAnswerSelect = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleToggleReview = () => {
    if (!currentQuestion) return;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  };

  const handlePreSubmit = () => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setShowSubmitModal(true);
  };

  // ── TIME CALCULATION ────────────────────────────────────────────────────────
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  // ── GROUP QUESTIONS BY SECTION / SUBJECT ───────────────────────────────────
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  const sectionsMap = useMemo(() => {
    const map = new Map<string, { question: Question; globalIndex: number }[]>();
    questions.forEach((q, idx) => {
      const secName = q.subject || studentDetails?.subject || 'Quant';
      if (!map.has(secName)) {
        map.set(secName, []);
      }
      map.get(secName)!.push({ question: q, globalIndex: idx });
    });
    return map;
  }, [questions, studentDetails]);

  // Summary counts
  const answeredCount = Object.keys(answers).filter((id) => answers[Number(id)]).length;
  const totalCount = questions.length;
  const unansweredCount = totalCount - answeredCount;
  const reviewCount = markedForReview.size;

  if (!studentDetails || !currentQuestion) return null;

  // ── PRE-EXAM SPLASH SCREEN (BLACK/DARK THEME) ──────────────────────────────
  if (!examStarted) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          px: 2,
        }}
      >
        <Card
          sx={{
            maxWidth: 540,
            width: '100%',
            p: 4,
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            textAlign: 'center',
            bgcolor: '#0f172a',
            border: '1px solid #1e293b',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(25, 118, 210, 0.4)',
            }}
          >
            <FullscreenIcon sx={{ fontSize: 32 }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff', mb: 0.5, letterSpacing: '0.01em' }}>
            Online Test - {studentDetails.subject || 'CAT Preparation'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, fontWeight: 500 }}>
            {questions.length} Questions &nbsp;•&nbsp; {timeLimit || 15} Minutes
          </Typography>

          <Box
            sx={{
              bgcolor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 2,
              p: 2.5,
              mb: 3.5,
              textAlign: 'left',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, mb: 1.2 }}>
              📋 Exam Guidelines & Rules:
            </Typography>
            {[
              'The exam will launch in fullscreen mode automatically.',
              'Tab switching or exiting fullscreen is prohibited and will auto-submit the exam.',
              'Use the right sidebar to navigate across sections and questions.',
              'Click "Submit Test" once you have completed all answers.',
            ].map((rule, i) => (
              <Typography key={i} variant="caption" sx={{ color: '#e2e8f0', display: 'block', mb: 0.8, lineHeight: 1.6, fontSize: '0.85rem' }}>
                • {rule}
              </Typography>
            ))}
          </Box>

          <Button
            id="start-exam-btn"
            variant="contained"
            size="large"
            fullWidth
            disabled={isEnteringFullscreen}
            onClick={handleStartExam}
            startIcon={isEnteringFullscreen ? <CircularProgress size={20} color="inherit" /> : <FullscreenIcon />}
            sx={{
              py: 1.6,
              borderRadius: '24px',
              fontWeight: 700,
              fontSize: '1.02rem',
              textTransform: 'none',
              background: '#1976d2 !important',
              backgroundColor: '#1976d2 !important',
              color: '#ffffff !important',
              boxShadow: '0 4px 15px rgba(25, 118, 210, 0.4) !important',
              '&:hover': {
                background: '#1565c0 !important',
                backgroundColor: '#1565c0 !important',
              },
            }}
          >
            {isEnteringFullscreen ? 'Starting Fullscreen...' : 'Start Test in Fullscreen'}
          </Button>
        </Card>
      </Box>
    );
  }

  // ── SUBMISSION IN PROGRESS SCREEN ───────────────────────────────────────────
  if (isSubmitting || hasSubmitted) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          px: 2,
          gap: 2.5,
        }}
      >
        <CircularProgress size={56} sx={{ color: '#2affff' }} />
        <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 700, textAlign: 'center' }}>
          Submitting Examination...
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center', maxWidth: 420 }}>
          Please wait while your answers and examination results are recorded.
        </Typography>
      </Box>
    );
  }

  // Helper function to determine badge status & color
  const getQuestionStatus = (qId: number, idx: number) => {
    if (idx === currentQuestionIndex) return 'current';
    if (markedForReview.has(qId)) return 'review';
    if (answers[qId] !== undefined && answers[qId] !== '') return 'answered';
    if (visitedQuestions.has(qId)) return 'not-answered';
    return 'not-attempted';
  };

  // ── MAIN CBT TEST INTERFACE (FULL SCREEN BLACK/DARK THEME) ────────────────────
  return (
    <Box
      ref={examContainerRef}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: 9999,
      }}
    >
      {/* Top Header Bar */}
      <Box
        sx={{
          bgcolor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          height: '48px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          width: '100%',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            color: '#ffffff',
            fontSize: '1.02rem',
            letterSpacing: '0.01em',
          }}
        >
          Online Test - {studentDetails.subject || 'CAT Preparation'}
        </Typography>
      </Box>

      {/* Main Content Area (Two Columns: Left Question Pane, Right Sidebar) */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: 'calc(100vh - 48px)',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT COLUMN: QUESTION CONTENT + ACTIONS + LEGEND ── */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            bgcolor: '#000000',
            borderRight: '1px solid #1e293b',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable Question Content Area (Displayed in Middle) */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: { xs: 2, sm: 3.5, md: 4 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 850,
                mx: 'auto',
                py: { xs: 1, md: 2 },
              }}
            >
              {/* Question Heading */}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: '#ffffff',
                  fontSize: { xs: '1.05rem', md: '1.2rem' },
                  mb: 1.5,
                }}
              >
                {currentQuestion.subject || studentDetails.subject || 'Quant'} - Question {currentQuestionIndex + 1}
              </Typography>

              <Divider sx={{ borderColor: '#1e293b', mb: 3.5 }} />

              {/* Question Text */}
              <Typography
                variant="body1"
                sx={{
                  color: '#f8fafc',
                  fontSize: { xs: '0.98rem', md: '1.08rem' },
                  lineHeight: 1.8,
                  mb: 4,
                  whiteSpace: 'pre-wrap',
                  fontWeight: 500,
                }}
              >
                {currentQuestion.question}
              </Typography>

              {/* Optional Question Diagram / Image */}
              {currentQuestion.image_url && (
                <Box sx={{ mb: 4 }}>
                  <Box
                    component="img"
                    src={currentQuestion.image_url}
                    alt="Question Diagram"
                    sx={{
                      maxHeight: 320,
                      maxWidth: '100%',
                      borderRadius: 1.5,
                      border: '1px solid #334155',
                      p: 0.5,
                      bgcolor: '#0f172a',
                    }}
                  />
                </Box>
              )}

              {/* Question Answer Inputs */}
              {(currentQuestion as any).question_type === 'fill_blank' ? (
                <Box sx={{ maxWidth: 540, mt: 2 }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mb: 1, display: 'block' }}>
                    Type your answer:
                  </Typography>
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(e.target.value)}
                    placeholder="Enter answer here..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '1rem',
                      borderRadius: 8,
                      border: '2px solid #3b82f6',
                      outline: 'none',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontWeight: 500,
                    }}
                  />
                </Box>
              ) : (
                /* MCQ Option List with Checkbox / Checkmark (Dark Theme) */
                <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 850 }}>
                {(() => {
                  const opts = (currentQuestion as any).options as string[] | undefined;
                  const list =
                    opts && opts.length
                      ? opts.map((t, i) => ({
                          v: String(i),
                          letter: String.fromCharCode(65 + i),
                          t,
                        }))
                      : [
                          { v: 'A', letter: 'A', t: currentQuestion.option_a || '' },
                          { v: 'B', letter: 'B', t: currentQuestion.option_b || '' },
                          { v: 'C', letter: 'C', t: currentQuestion.option_c || '' },
                          { v: 'D', letter: 'D', t: currentQuestion.option_d || '' },
                        ];

                  return list
                    .filter((o) => o.t)
                    .map((o) => {
                      const isSelected = answers[currentQuestion.id] === o.v;
                      return (
                        <Box
                          key={o.v}
                          onClick={() => handleAnswerSelect(o.v)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            py: 1.2,
                            px: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: isSelected ? '#22c55e' : '#1e293b',
                            bgcolor: isSelected ? 'rgba(34, 197, 94, 0.12)' : '#0a0f1d',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              bgcolor: isSelected ? 'rgba(34, 197, 94, 0.18)' : '#0f172a',
                              borderColor: isSelected ? '#22c55e' : '#334155',
                            },
                          }}
                        >
                          {/* Checkbox square */}
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '4px',
                              border: isSelected ? '2px solid #22c55e' : '2px solid #64748b',
                              bgcolor: isSelected ? '#22c55e' : '#0f172a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 2,
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSelected && <CheckIcon sx={{ color: '#ffffff', fontSize: 18, stroke: '#ffffff', strokeWidth: 1 }} />}
                          </Box>

                          {/* Option Label & Text */}
                          <Typography
                            sx={{
                              fontSize: '1.02rem',
                              color: isSelected ? '#ffffff' : '#e2e8f0',
                              fontWeight: isSelected ? 700 : 500,
                            }}
                          >
                            <span style={{ fontWeight: 700, marginRight: '10px', color: isSelected ? '#22c55e' : '#94a3b8' }}>
                              {o.letter}.
                            </span>
                            {o.t}
                          </Typography>
                        </Box>
                      );
                    });
                })()}
              </Stack>
            )}
            </Box>
          </Box>

          {/* Bottom Actions Bar + Legend (Fixed at Bottom of Left Pane) */}
          <Box sx={{ bgcolor: '#000000', flexShrink: 0 }}>
            {/* Buttons Row */}
            <Box
              sx={{
                px: { xs: 2.5, sm: 4, md: 5 },
                pb: 2.5,
                pt: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              {/* Left Action Buttons */}
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={handleToggleReview}
                  variant="contained"
                  disableElevation
                  sx={{
                    background: (markedForReview.has(currentQuestion.id) ? '#730000' : '#8b0000') + ' !important',
                    backgroundColor: (markedForReview.has(currentQuestion.id) ? '#730000' : '#8b0000') + ' !important',
                    color: '#ffffff !important',
                    borderRadius: '9999px !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: { xs: 2, sm: 3 },
                    py: 1,
                    fontSize: { xs: '0.82rem', sm: '0.88rem' },
                    boxShadow: 'none !important',
                    border: 'none !important',
                    '&:hover': {
                      background: '#700000 !important',
                      backgroundColor: '#700000 !important',
                    },
                  }}
                >
                  {markedForReview.has(currentQuestion.id) ? 'Marked for review' : 'Mark for review'}
                </Button>

                <Button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={isFirstQuestion}
                  variant="contained"
                  disableElevation
                  sx={{
                    background: '#1976d2 !important',
                    backgroundColor: '#1976d2 !important',
                    color: '#ffffff !important',
                    borderRadius: '9999px !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: { xs: 2.5, sm: 3.5 },
                    py: 1,
                    fontSize: { xs: '0.82rem', sm: '0.88rem' },
                    boxShadow: 'none !important',
                    border: 'none !important',
                    '&:hover': {
                      background: '#1565c0 !important',
                      backgroundColor: '#1565c0 !important',
                    },
                    '&.Mui-disabled': {
                      background: '#1e293b !important',
                      backgroundColor: '#1e293b !important',
                      color: '#64748b !important',
                      opacity: 0.6,
                    },
                  }}
                >
                  Previous
                </Button>

                <Button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={isLastQuestion}
                  variant="contained"
                  disableElevation
                  sx={{
                    background: '#1976d2 !important',
                    backgroundColor: '#1976d2 !important',
                    color: '#ffffff !important',
                    borderRadius: '9999px !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: { xs: 2.5, sm: 3.5 },
                    py: 1,
                    fontSize: { xs: '0.82rem', sm: '0.88rem' },
                    boxShadow: 'none !important',
                    border: 'none !important',
                    '&:hover': {
                      background: '#1565c0 !important',
                      backgroundColor: '#1565c0 !important',
                    },
                    '&.Mui-disabled': {
                      background: '#1e293b !important',
                      backgroundColor: '#1e293b !important',
                      color: '#64748b !important',
                      opacity: 0.6,
                    },
                  }}
                >
                  Next
                </Button>
              </Stack>

              {/* Right Action Button: Submit Test */}
              <Button
                onClick={handlePreSubmit}
                variant="contained"
                disabled={isSubmitting}
                disableElevation
                sx={{
                  background: '#2e7d32 !important',
                  backgroundColor: '#2e7d32 !important',
                  color: '#ffffff !important',
                  borderRadius: '9999px !important',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: { xs: 2.5, sm: 4 },
                  py: 1,
                  fontSize: { xs: '0.82rem', sm: '0.88rem' },
                  boxShadow: 'none !important',
                  border: 'none !important',
                  '&:hover': {
                    background: '#256629 !important',
                    backgroundColor: '#256629 !important',
                  },
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </Button>
            </Box>

            {/* Status Legend Bar (Dark Theme - Perfect Alignment) */}
            <Box
              sx={{
                bgcolor: '#080d1a',
                borderTop: '1px solid #1e293b',
                py: 1.4,
                px: { xs: 2.5, sm: 4 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                flexWrap: 'wrap',
                rowGap: 1.2,
                columnGap: { xs: 3, sm: 4.5 },
                minHeight: 48,
              }}
            >
              {/* Current */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1976d2', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.83rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                  Current
                </Typography>
              </Box>

              {/* Not Attempted */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'transparent',
                    border: '1.8px solid #94a3b8',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.83rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                  Not Attempted
                </Typography>
              </Box>

              {/* Answered */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#2e7d32', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.83rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                  Answered
                </Typography>
              </Box>

              {/* Not Answered */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ea580c', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.83rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                  Not Answered
                </Typography>
              </Box>

              {/* Review */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#8b0000', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.83rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                  Review
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── RIGHT COLUMN: TIME LEFT + SECTION PALETTES ── */}
        <Box
          sx={{
            width: { xs: '260px', sm: '280px', md: '300px' },
            minWidth: { xs: '260px', sm: '280px', md: '300px' },
            bgcolor: '#090d16',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            borderLeft: '1px solid #1e293b',
          }}
        >
          {/* Time Left Box */}
          <Box sx={{ flexShrink: 0 }}>
            <Box
              sx={{
                bgcolor: '#0f172a',
                py: 1,
                px: 2,
                textAlign: 'center',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.92rem' }}>
                Time Left
              </Typography>
            </Box>

            {/* Countdown Digits (Dark Theme) */}
            <Box
              sx={{
                py: 2.5,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                bgcolor: '#000000',
                borderBottom: '1px solid #1e293b',
              }}
            >
              {/* Hours */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
                  {formattedHours}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                  hours
                </Typography>
              </Box>

              {/* Minutes */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
                  {formattedMinutes}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                  minutes
                </Typography>
              </Box>

              {/* Seconds */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: timeLeft <= 60 ? '#ef4444' : '#ffffff',
                    lineHeight: 1,
                  }}
                >
                  {formattedSeconds}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                  seconds
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Section Palettes (Scrollable Dark Grid) */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {Array.from(sectionsMap.entries()).map(([sectionTitle, secQuestions]) => (
              <Box key={sectionTitle} sx={{ mb: 1.5 }}>
                {/* Section Title Banner */}
                <Box
                  sx={{
                    bgcolor: '#0f172a',
                    py: 0.8,
                    px: 2,
                    textAlign: 'center',
                    borderBottom: '1px solid #1e293b',
                    borderTop: '1px solid #1e293b',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.88rem' }}>
                    {sectionTitle}
                  </Typography>
                </Box>

                {/* Question Badges Grid */}
                <Box
                  sx={{
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 1.2,
                  }}
                >
                  {secQuestions.map(({ question: q, globalIndex: idx }) => {
                    const status = getQuestionStatus(q.id, idx);

                    let bgColor = '#1e293b';
                    let textColor = '#cbd5e1';
                    let borderStyle = '1px solid #334155';

                    if (status === 'current') {
                      bgColor = '#1976d2';
                      textColor = '#ffffff';
                      borderStyle = 'none';
                    } else if (status === 'review') {
                      bgColor = '#8b0000';
                      textColor = '#ffffff';
                      borderStyle = 'none';
                    } else if (status === 'answered') {
                      bgColor = '#2e7d32';
                      textColor = '#ffffff';
                      borderStyle = 'none';
                    } else if (status === 'not-answered') {
                      bgColor = '#ea580c';
                      textColor = '#ffffff';
                      borderStyle = 'none';
                    } else {
                      bgColor = '#1e293b';
                      textColor = '#94a3b8';
                      borderStyle = '1px solid #334155';
                    }

                    return (
                      <Box
                        key={q.id}
                        component="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        sx={{
                          width: '100%',
                          aspectRatio: '1/1',
                          bgcolor: bgColor,
                          color: textColor,
                          border: borderStyle,
                          borderRadius: '10px 4px 4px 4px', // Leaf/tab style top-left curve
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          p: 0,
                          '&:hover': {
                            opacity: 0.88,
                            transform: 'scale(1.05)',
                          },
                        }}
                      >
                        {idx + 1}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── SUBMISSION CONFIRMATION MODAL (DARK THEME) ── */}
      <Dialog
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        disablePortal
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, p: 1, bgcolor: '#0f172a', border: '1px solid #1e293b' } }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
            Submit Test Confirmation
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Are you sure you want to submit your test?
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
              bgcolor: '#000000',
              p: 2,
              borderRadius: 2,
              border: '1px solid #1e293b',
              mb: 2.5,
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#22c55e' }}>
                {answeredCount}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>
                Answered
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: unansweredCount > 0 ? '#f97316' : '#64748b' }}>
                {unansweredCount}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>
                Unanswered
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#ef4444' }}>
                {reviewCount}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>
                In Review
              </Typography>
            </Box>
          </Box>

          {unansweredCount > 0 && (
            <Alert severity="warning" sx={{ textAlign: 'left', borderRadius: 1.5, fontSize: '0.82rem', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              You have {unansweredCount} unanswered questions.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setShowSubmitModal(false)}
            disabled={isSubmitting}
            fullWidth
            sx={{ borderRadius: '24px', textTransform: 'none', fontWeight: 600, color: '#cbd5e1', borderColor: '#334155' }}
          >
            Cancel & Return
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowSubmitModal(false);
              submitExam('manual');
            }}
            disabled={isSubmitting}
            fullWidth
            sx={{
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              background: '#2e7d32 !important',
              backgroundColor: '#2e7d32 !important',
              color: '#ffffff !important',
              '&:hover': { background: '#256629 !important', backgroundColor: '#256629 !important' },
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Yes, Submit Exam'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

