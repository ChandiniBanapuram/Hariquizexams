import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import DialogActions from '@mui/material/DialogActions';
import {
  AccessTime as AccessTimeIcon,
  Fullscreen as FullscreenIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Send as SendIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useExam } from '@/context/ExamContext';
import { studentAPI } from '@/lib/api';
import { ExamHeader } from '@/components/ExamHeader';
import * as THREE from 'three';
// @ts-ignore
import NET from 'vanta/dist/vanta.net.min';

const DEFAULT_EXAM_DURATION = 15 * 60; // 15 minutes fallback

export default function ExamPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { studentDetails, questions, timeLimit, setExamResult, resetExam } = useExam();
  const examContainerRef = useRef<HTMLDivElement>(null);

  // Guard: if the stored end time has already elapsed, the localStorage is stale
  // from a previous session — clear it so the new exam doesn't immediately auto-submit.
  const savedEndTimeRaw = localStorage.getItem('examEndTime');
  const savedEndTimeMs = savedEndTimeRaw ? parseInt(savedEndTimeRaw, 10) : 0;
  const savedEndTimeValid = savedEndTimeMs > Date.now();
  if (savedEndTimeRaw && !savedEndTimeValid) {
    localStorage.removeItem('examEndTime');
    localStorage.removeItem('examStarted');
    localStorage.removeItem('examAnswers');
    localStorage.removeItem('examCurrentQuestionIndex');
  }

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem('examCurrentQuestionIndex');
    const index = saved ? parseInt(saved, 10) : 0;
    return (index >= 0 && index < questions.length) ? index : 0;
  });
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('examAnswers');
    return saved ? JSON.parse(saved) : {};
  });
  const [examStarted, setExamStarted] = useState(() => {
    // Only restore "started" if there is still valid time remaining.
    return localStorage.getItem('examStarted') === 'true' && savedEndTimeValid;
  });
  const [timeLeft, setTimeLeft] = useState(() => {
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

  useEffect(() => {
    localStorage.setItem('examCurrentQuestionIndex', currentQuestionIndex.toString());
  }, [currentQuestionIndex]);

  useEffect(() => {
    localStorage.setItem('examAnswers', JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    localStorage.setItem('examStarted', examStarted.toString());
    if (examStarted && !localStorage.getItem('examEndTime')) {
      const endTime = Date.now() + (timeLimit || 15) * 60 * 1000;
      localStorage.setItem('examEndTime', endTime.toString());
      setTimeLeft((timeLimit || 15) * 60);
    }
  }, [examStarted, timeLimit]);

  // Vanta.js Background
  const vantaRef = useRef<HTMLDivElement>(null);
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  useEffect(() => {
    if (!vantaEffect && vantaRef.current) {
      setVantaEffect(
        NET({
          el: vantaRef.current,
          THREE: THREE,
          color: 0x3b82f6,
          backgroundColor: 0x020617,
          points: 12.00,
          maxDistance: 20.00,
          spacing: 16.00,
        })
      );
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeLow = timeLeft <= 60;

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const unansweredCount = totalCount - answeredCount;

  const handlePreSubmit = () => {
      if (answeredCount === 0) {
          return toast({ title: 'Validation Warning', description: 'You must answer at least one question before submitting.', variant: 'destructive' });
      }
      setShowSubmitModal(true);
  };

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

  // Start exam: enter fullscreen then begin
  const handleStartExam = useCallback(async () => {
    await enterFullscreen();
    setExamStarted(true);
  }, [enterFullscreen]);

  const checkFullscreen = useCallback(() => {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
  }, []);

  useEffect(() => {
    if (!studentDetails || questions.length === 0) {
      navigate('/');
    }
  }, [studentDetails, questions, navigate]);

  const submitExam = useCallback(
    async (reason: string = 'manual') => {
      if (hasSubmitted || isSubmitting || localStorage.getItem('examHasSubmitted') === 'true') return;

      setIsSubmitting(true);
      setHasSubmitted(true);
      localStorage.setItem('examHasSubmitted', 'true');

      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen().catch((err) => console.log('[submitExam] exitFullscreen ignored:', err));
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen().catch((err) => console.log('[submitExam] webkitExitFullscreen ignored:', err));
          }
        } catch (fsErr) {
          console.log('[submitExam] Fullscreen exit error safely caught:', fsErr);
        }
      }

      try {
        const studentObj =
          studentDetails ||
          JSON.parse(localStorage.getItem('examStudentDetails') || '{}') ||
          JSON.parse(localStorage.getItem('studentData') || '{}') ||
          JSON.parse(sessionStorage.getItem('student') || '{}') ||
          JSON.parse(sessionStorage.getItem('studentData') || '{}') ||
          {};

        const rawRoll =
          (studentObj as any).rollNumber ||
          (studentObj as any).roll_number ||
          (studentObj as any).rollNo ||
          (studentObj as any).username ||
          localStorage.getItem('rollNumber') ||
          sessionStorage.getItem('rollNumber') ||
          'STUDENT';

        const rawName =
          (studentObj as any).name ||
          (studentObj as any).fullName ||
          (studentObj as any).full_name ||
          localStorage.getItem('studentName') ||
          sessionStorage.getItem('studentName') ||
          'Student';

        const rawDept =
          (studentObj as any).department ||
          (studentObj as any).dept ||
          (studentObj as any).branch ||
          localStorage.getItem('department') ||
          'CSE';

        const rawSec =
          (studentObj as any).section ||
          (studentObj as any).sec ||
          localStorage.getItem('section') ||
          'A';

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

        const result = await studentAPI.submitExam({
          rollNumber: rawRoll,
          name: rawName,
          department: normalizedDepartment,
          section: normalizedSection,
          year: (studentObj as any).year || '1',
          semester: (studentObj as any).semester || '1',
          subject: (studentObj as any).subject || '',
          examDate: (studentObj as any).examDate || '',
          answers,
          tabSwitched: tabSwitched || reason === 'tab_switch' || reason === 'fullscreen_exit',
        });

        if (!result || result.message === 'Request failed' || result.score === undefined) {
          throw new Error(result?.message || 'Failed to submit exam');
        }

        const calculatedResult = {
          name: rawName,
          rollNumber: rawRoll,
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

        navigate('/result');
      } catch (error) {
        setHasSubmitted(false);
        toast({
          title: 'Submission Failed',
          description: error instanceof Error ? error.message : 'Failed to submit exam',
          variant: 'destructive',
        });
        resetExam();
        navigate('/');
      } finally {
        setIsSubmitting(false);
      }
    },
    [studentDetails, answers, tabSwitched, hasSubmitted, isSubmitting, setExamResult, navigate, toast, resetExam]
  );

  useEffect(() => {
    if (!examStarted) return; // Don't count down until exam actually started
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !hasSubmitted && examStarted) {
        setTabSwitched(true);
        localStorage.setItem('examTabSwitched', 'true');
        toast({
          title: 'Tab switch detected!',
          description: 'Opening another tab or switching windows is prohibited. Your exam is being submitted automatically.',
          variant: 'destructive',
        });
        submitExam('tab_switch');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasSubmitted, examStarted, toast, submitExam]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = checkFullscreen();
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen && !hasSubmitted && examStarted) {
        setTabSwitched(true);
        localStorage.setItem('examTabSwitched', 'true');
        toast({
          title: 'Exited Fullscreen!',
          description: 'Exiting fullscreen mode is prohibited. Your exam is being submitted automatically.',
          variant: 'destructive',
        });
        submitExam('fullscreen_exit');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [checkFullscreen, hasSubmitted, examStarted, toast, submitExam]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const allowedKeys = [
        'Tab',
        'Enter',
        'Space',
        ' ',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        '1',
        '2',
        '3',
        '4',
        'a',
        'b',
        'c',
        'd',
        'A',
        'B',
        'C',
        'D',
        'Backspace',
        'Delete',
      ];

      if (e.key.startsWith('F') && e.key.length <= 3) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.shiftKey && !allowedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Meta' || e.key === 'OS') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Insert') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
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

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCopy, true);
    document.addEventListener('paste', handleCopy, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCopy, true);
      document.removeEventListener('paste', handleCopy, true);
    };
  }, [hasSubmitted, submitExam]);

  const handleAnswerSelect = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  if (!studentDetails || !currentQuestion) return null;

  // ── PRE-EXAM SPLASH SCREEN ──────────────────────────────────────────────────
  if (!examStarted) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
          position: 'relative',
          overflow: 'hidden',
          px: 2,
        }}
      >
        {/* Animated background rings */}
        {[1,2,3].map(i => (
          <Box key={i} sx={{
            position: 'absolute',
            width: `${i * 300}px`,
            height: `${i * 300}px`,
            borderRadius: '50%',
            border: `1px solid rgba(59,130,246,${0.15 - i * 0.04})`,
            animation: `pulse${i} ${3 + i}s ease-in-out infinite`,
            [`@keyframes pulse${i}`]: {
              '0%, 100%': { transform: 'scale(1)', opacity: 0.6 },
              '50%': { transform: `scale(${1 + i * 0.05})`, opacity: 0.3 },
            },
          }} />
        ))}

        <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: 520 }}>
          {/* College Logo / Icon */}
          <Box sx={{
            width: 80, height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
            boxShadow: '0 0 40px rgba(59,130,246,0.5)',
          }}>
            <FullscreenIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', mb: 1, letterSpacing: '-0.02em' }}>
            Ready to Start?
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
            {studentDetails.subject}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mb: 4 }}>
            {questions.length} Questions &nbsp;•&nbsp; {timeLimit || 15} Minutes
          </Typography>

          {/* Info box */}
          <Box sx={{
            bgcolor: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '16px',
            p: 2.5, mb: 4, textAlign: 'left',
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, mb: 1.5 }}>
              📋 Before you begin:
            </Typography>
            {[
              '🖥️  The exam will open in fullscreen mode automatically',
              '⚠️  Exiting fullscreen will auto-submit your exam',
              '🚫  Tab switching will auto-submit your exam',
              '⏱️  The timer starts as soon as you click Start',
            ].map((tip, i) => (
              <Typography key={i} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 0.8, lineHeight: 1.6 }}>
                {tip}
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
              py: 2,
              borderRadius: '16px',
              fontWeight: 900,
              fontSize: '1.05rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 10px 30px rgba(59,130,246,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                boxShadow: '0 15px 40px rgba(59,130,246,0.55)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {isEnteringFullscreen ? 'Entering Fullscreen...' : '🚀  Start Exam in Fullscreen'}
          </Button>
        </Box>
      </Box>
    );
  }

  // ── FULLSCREEN LOST WARNING ──────────────────────────────────────────────────
  if (!isFullscreen && examStarted) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a0a00 0%, #2d0f00 100%)',
          px: 2,
        }}
      >
        <Card sx={{ maxWidth: 480, width: '100%', p: 4, textAlign: 'center', bgcolor: '#1e293b', border: '1px solid rgba(239,68,68,0.3)' }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%',
            bgcolor: 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
          }}>
            <WarningIcon sx={{ color: 'error.main', fontSize: 36 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>Fullscreen Exited!</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
            You have exited fullscreen mode. Please return to fullscreen to continue your exam. Leaving fullscreen again may auto-submit.
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<FullscreenIcon />}
            onClick={enterFullscreen}
            fullWidth
            sx={{ py: 1.5, fontWeight: 800, borderRadius: '12px' }}
          >
            Re-enter Fullscreen
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      ref={examContainerRef}
      sx={{ minHeight: '100vh', bgcolor: 'transparent', userSelect: 'none', position: 'relative' }}
    >
      <div 
        ref={vantaRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: -1 
        }} 
      />
      <ExamHeader showTimer timeLeft={timeLeft} />

      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Alert
            icon={<AccessTimeIcon />}
            severity={isTimeLow ? 'error' : 'info'}
            sx={{
              borderRadius: '16px',
              bgcolor: (theme) => isTimeLow ? `${theme.palette.error.main}15` : `${theme.palette.primary.main}10`,
              backdropFilter: 'blur(10px)',
              border: '1px solid',
              borderColor: (theme) => isTimeLow ? `${theme.palette.error.main}30` : `${theme.palette.primary.main}30`,
              color: 'text.primary',
              '& .MuiAlert-icon': { color: isTimeLow ? 'error.main' : 'primary.main' }
            }}
            action={
              <Chip
                label={formatTime(timeLeft)}
                sx={{
                  fontWeight: 800,
                  bgcolor: isTimeLow ? 'error.main' : 'primary.main',
                  color: '#fff',
                  px: 1,
                  '& .MuiChip-icon': { color: '#fff' }
                }}
                size="small"
                icon={<AccessTimeIcon />}
              />
            }
          >
            {isTimeLow
              ? 'Less than 1 minute remaining! Your exam will be auto-submitted when time ends.'
              : 'Exam is running in fullscreen mode. Exiting fullscreen will auto-submit your exam.'}
          </Alert>

          <Box
            sx={{
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '32px',
              border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 20px 50px rgba(0,0,0,0.3)' : '0 20px 50px rgba(0,0,0,0.1)',
              p: { xs: 3, md: 5 },
              overflow: 'hidden'
            }}
          >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                   QUESTION {currentQuestionIndex + 1} <span style={{ opacity: 0.5 }}>/ {questions.length}</span>
                </Typography>
                <Chip 
                  label={studentDetails.subject} 
                  sx={{ 
                    fontWeight: 700, 
                    bgcolor: (theme) => `${theme.palette.primary.main}15`,
                    color: 'primary.main',
                    border: '1px solid',
                    borderColor: (theme) => `${theme.palette.primary.main}30`,
                    px: 1,
                    textTransform: 'uppercase',
                    fontSize: '0.7rem'
                  }} 
                  size="small" 
                />
              </Stack>
  
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'left', mb: 3, width: '100%' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 6, maxWidth: 800, width: '100%', lineHeight: 1.5, color: 'text.primary', letterSpacing: '-0.01em', whiteSpace: 'pre-wrap' }}>
                    {currentQuestion.question}
                  </Typography>


                  {currentQuestion.image_url && (
                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
                      <Box
                        component="img"
                        src={currentQuestion.image_url}
                        alt="Question diagram"
                        sx={{
                          maxHeight: 280,
                          width: 'auto',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </Box>
                  )}

                  <Box sx={{ width: '100%', maxWidth: 600, textAlign: 'left' }}>
                    {(currentQuestion as any).question_type === 'fill_blank' ? (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                          YOUR ANSWER
                        </Typography>
                        <input
                          type="text"
                          value={answers[currentQuestion.id] || ''}
                          onChange={(e) => handleAnswerSelect(e.target.value)}
                          placeholder="Type your answer here"
                          style={{
                            width: '100%', padding: '16px 20px', fontSize: '1.1rem',
                            borderRadius: 16, border: '2px solid #06b6d4',
                            outline: 'none', background: 'transparent', color: 'inherit', fontWeight: 600,
                          }}
                        />
                      </Box>
                    ) : (
                      <FormControl component="fieldset" fullWidth>
                        <RadioGroup
                          value={answers[currentQuestion.id] || ''}
                          onChange={(e) => handleAnswerSelect(e.target.value)}
                        >
                  {(() => {
                    const opts = (currentQuestion as any).options as string[] | undefined;
                    const list = (opts && opts.length)
                      ? opts.map((t, i) => ({ v: String(i), t }))
                      : [
                          { v: 'A', t: currentQuestion.option_a || '' },
                          { v: 'B', t: currentQuestion.option_b || '' },
                          { v: 'C', t: currentQuestion.option_c || '' },
                          { v: 'D', t: currentQuestion.option_d || '' },
                        ];
                    return list.filter(o => o.t).map((o) => (
                    <FormControlLabel
                      key={o.v}
                      value={o.v}
                      control={<Radio sx={{ color: answers[currentQuestion.id] === o.v ? '#fff !important' : 'inherit', '&.Mui-checked': { color: '#fff !important' } }} />}
                      label={
                        <Typography sx={{
                          fontWeight: answers[currentQuestion.id] === o.v ? 800 : 500,
                          ml: 1,
                          color: answers[currentQuestion.id] === o.v ? '#fff !important' : 'text.primary',
                          transition: 'color 0.2s'
                        }}>
                          {o.t}
                        </Typography>
                      }
                      sx={{
                        mb: 2.5,
                        p: 2,
                        borderRadius: '16px',
                        border: '2px solid',
                        borderColor: answers[currentQuestion.id] === o.v ? '#06b6d4' : 'divider',
                        background: answers[currentQuestion.id] === o.v
                          ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%) !important'
                          : 'background.paper',
                        boxShadow: answers[currentQuestion.id] === o.v ? '0 10px 20px -5px rgba(6, 182, 212, 0.4)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        margin: 0,
                        '&:hover': {
                          bgcolor: answers[currentQuestion.id] === o.v ? 'none' : 'action.hover',
                          transform: 'translateY(-3px) scale(1.01)',
                          boxShadow: answers[currentQuestion.id] === o.v ? '0 12px 25px -5px rgba(6, 182, 212, 0.5)' : 2,
                          borderColor: answers[currentQuestion.id] === o.v ? '#22d3ee' : 'primary.light',
                        },
                        '& .MuiFormControlLabel-label': { width: '100%' }
                      }}
                    />
                  ));
                  })()}
                        </RadioGroup>
                      </FormControl>
                    )}
                  </Box>
              </Box>

              <Divider sx={{ my: 4 }} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                >
                  Previous
                </Button>

                {isLastQuestion ? (
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<SendIcon />}
                    onClick={handlePreSubmit}
                    sx={{
                      borderRadius: '50px',
                      px: 5,
                      py: 1.8,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                      boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                        boxShadow: '0 15px 35px rgba(16, 185, 129, 0.5)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Submit Exam
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                    sx={{
                      borderRadius: '50px',
                      px: 5,
                      fontWeight: 800,
                      boxShadow: '0 10px 20px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    Next
                  </Button>
                )}
              </Stack>
          </Box>
        </Stack>
      </Container>

      {/* SUBMISSION VERIFICATION MODAL */}
      <Dialog open={showSubmitModal} onClose={() => setShowSubmitModal(false)} disablePortal maxWidth="sm" fullWidth>
          <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                  <WarningIcon sx={{ mr: 1, color: 'warning.main' }} /> Confirm Submission
              </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                  Are you sure you want to submit the exam?
              </Typography>
              <Box sx={{ display: 'inline-flex', gap: 3, bgcolor: 'background.default', p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Box>
                      <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>{answeredCount}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>ANSWERED</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box>
                      <Typography variant="h4" color={unansweredCount > 0 ? 'error.main' : 'text.disabled'} sx={{ fontWeight: 800 }}>{unansweredCount}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>UNANSWERED</Typography>
                  </Box>
              </Box>
              {unansweredCount > 0 && (
                  <Alert severity="warning" sx={{ mt: 3, textAlign: 'left' }}>
                      You still have questions pending. You can close this to go back and complete them.
                  </Alert>
              )}
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button variant="outlined" size="large" onClick={() => setShowSubmitModal(false)} disabled={isSubmitting} fullWidth>
                  Cancel & Return
              </Button>
              <Button variant="contained" color="success" size="large" onClick={() => { setShowSubmitModal(false); submitExam('manual'); }} disabled={isSubmitting} fullWidth startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}>
                  {isSubmitting ? 'Processing...' : 'Confirm Submit'}
              </Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}
