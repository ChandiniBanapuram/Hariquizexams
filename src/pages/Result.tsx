import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '@/context/ExamContext';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { Box, Typography, Button, Stack, CircularProgress } from '@mui/material';
import { Person, Badge, Business, Class, CheckCircle, Cancel, Analytics } from '@mui/icons-material';

export default function ResultPage() {
  const navigate = useNavigate();
  const { examResult, resetExam } = useExam();
  const { isAuthenticated } = useStudentAuth();

  const activeResult = examResult || (() => {
    try {
      const saved = localStorage.getItem('lastExamResult') || localStorage.getItem('examResult');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!activeResult) {
      navigate('/student/dashboard');
    }
  }, [activeResult, navigate]);

  if (!activeResult) return null;

  const correct = activeResult.score !== undefined ? activeResult.score : 0;
  const total = activeResult.totalMarks !== undefined ? activeResult.totalMarks : 0;
  const wrong = Math.max(0, total - correct);
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, #1e1b4b, #020617 70%)',
      p: 2,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glow */}
      <Box sx={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          animation: 'fadeScaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          '@keyframes fadeScaleUp': {
            '0%': { opacity: 0, transform: 'scale(0.95) translateY(20px)' },
            '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
          }
        }}
      >
        <Box
          sx={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(168, 85, 247, 0.5), rgba(6, 182, 212, 0.5))',
            borderRadius: '24px',
            p: '2px',
            boxShadow: '0 0 40px rgba(59, 130, 246, 0.2)',
          }}
        >
          <Box
            sx={{
              background: 'rgba(9, 9, 11, 0.85)',
              backdropFilter: 'blur(16px)',
              borderRadius: '22px',
              p: { xs: 4, md: 5 },
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <Typography variant="h4" sx={{ 
              fontWeight: 950, 
              color: '#fff', 
              textAlign: 'center',
              background: 'linear-gradient(to right, #60a5fa, #c084fc, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>
              Exam Result
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, bgcolor: 'rgba(255,255,255,0.02)', p: 2.5, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}><Person sx={{ fontSize: 18, color: '#94a3b8' }} /></Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1 }}>Name</Typography>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{activeResult.name}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}><Badge sx={{ fontSize: 18, color: '#94a3b8' }} /></Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1 }}>Roll Number</Typography>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{activeResult.rollNumber}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}><Business sx={{ fontSize: 18, color: '#94a3b8' }} /></Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1 }}>Department</Typography>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{activeResult.department}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)' }}><Class sx={{ fontSize: 18, color: '#94a3b8' }} /></Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1 }}>Section</Typography>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{activeResult.section}</Typography>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ color: '#94a3b8', fontWeight: 800, mb: 2.5, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Performance Summary
              </Typography>
              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(59,130,246,0.05)' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Analytics sx={{ color: '#3b82f6', fontSize: 22 }} />
                    <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 700 }}>Questions Answered</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900 }}>{total}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16,185,129,0.05)' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <CheckCircle sx={{ color: '#10b981', fontSize: 22 }} />
                    <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 700 }}>Correct Answers</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 900 }}>{correct}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,68,68,0.05)' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Cancel sx={{ color: '#ef4444', fontSize: 22 }} />
                    <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 700 }}>Wrong Answers</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 900 }}>{wrong}</Typography>
                </Box>
              </Stack>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              p: 3.5, 
              bgcolor: 'rgba(0,0,0,0.3)', 
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.05)',
              position: 'relative',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
            }}>
              <Box sx={{ position: 'relative', display: 'inline-flex', mr: 4 }}>
                <CircularProgress variant="determinate" value={100} size={80} thickness={4.5} sx={{ color: 'rgba(255,255,255,0.05)' }} />
                <CircularProgress variant="determinate" value={percentage} size={80} thickness={4.5} sx={{ color: '#3b82f6', position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))', strokeLinecap: 'round' }} />
                <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" component="div" sx={{ color: '#fff', fontWeight: 900, fontSize: '0.85rem' }}>
                    {percentage}%
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'block', letterSpacing: '1.5px', mb: 0.5 }}>FINAL SCORE</Typography>
                <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
                  {correct} <span style={{ fontSize: '1.5rem', color: '#64748b' }}>/ {total}</span>
                </Typography>
              </Box>
            </Box>

            <Button
              fullWidth
              onClick={() => { 
                resetExam(); 
                if (isAuthenticated) {
                  navigate('/student/previous-scores');
                } else {
                  navigate('/');
                }
              }}
              sx={{
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                py: 2,
                borderRadius: '14px',
                fontWeight: 900,
                fontSize: '1.05rem',
                letterSpacing: '0.5px',
                textTransform: 'none',
                boxShadow: '0 10px 25px -5px rgba(59,130,246,0.5)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 15px 30px -5px rgba(59,130,246,0.6)',
                }
              }}
            >
              Go to Home
            </Button>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.5px' }}>
          You may close this window. Thank you for taking the examination.
        </Typography>
      </Box>
    </Box>
  );
}
