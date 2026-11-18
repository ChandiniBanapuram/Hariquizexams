import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Stack,
  Avatar,
  LinearProgress,
  Chip,
  Button,
} from '@mui/material';
import {
  School as SchoolIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  HelpOutline as HelpIcon,
  Cloud as CloudIcon,
  PlayArrow as PlayArrowIcon,
  EmojiEvents as TrophyIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useStudentAuth } from '@/context/StudentAuthContext';
import StudentLayout from '@/components/layouts/StudentLayout';

const quickActions = [
  {
    label: 'Available Exams',
    description: 'View & attempt scheduled quizzes',
    icon: <SchoolIcon sx={{ fontSize: 28 }} />,
    path: '/student/available-exams',
    color: '#2affff',
    bg: 'rgba(42, 255, 255, 0.08)',
    border: 'rgba(42, 255, 255, 0.2)',
  },
  {
    label: 'Coding Practice',
    description: 'Sharpen your programming skills',
    icon: <CodeIcon sx={{ fontSize: 28 }} />,
    path: '/student/coding-practice',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.08)',
    border: 'rgba(167, 139, 250, 0.2)',
  },
  {
    label: 'Coding Exams',
    description: 'Attempt live coding assessments',
    icon: <CloudIcon sx={{ fontSize: 28 }} />,
    path: '/student/coding-exams',
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.08)',
    border: 'rgba(244, 114, 182, 0.2)',
  },
  {
    label: 'Previous Scores',
    description: 'Review your past exam results',
    icon: <HistoryIcon sx={{ fontSize: 28 }} />,
    path: '/student/previous-scores',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.2)',
  },
  {
    label: 'Performance',
    description: 'Track your academic progress',
    icon: <TrendingUpIcon sx={{ fontSize: 28 }} />,
    path: '/student/performance',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.08)',
    border: 'rgba(251, 191, 36, 0.2)',
  },
  {
    label: 'Question Banks',
    description: 'Browse topic-wise questions',
    icon: <HelpIcon sx={{ fontSize: 28 }} />,
    path: '/student/question-bank',
    color: '#fb7185',
    bg: 'rgba(251, 113, 133, 0.08)',
    border: 'rgba(251, 113, 133, 0.2)',
  },
];

const infoIcons = [PersonIcon, CalendarIcon, SchoolIcon, TrophyIcon];
const infoColors = ['#2affff', '#a78bfa', '#34d399', '#fbbf24'];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { student, logout, isAuthenticated } = useStudentAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/student/login');
      return;
    }
    // Trigger mount animation
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/student/login');
  };

  if (!student) return null;

  const studentInfoItems = [
    { label: 'Department', value: student.department || '—' },
    { label: 'Year', value: student.year || '—' },
    { label: 'Semester', value: `Sem ${student.semester || '—'}` },
    { label: 'Section', value: student.section || '—' },
  ];

  const initials = (student.fullName || student.full_name || 'S')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <StudentLayout user={student} onLogout={handleLogout}>

      {/* ── Hero Welcome Banner ────────────────────────────────── */}
      <Box
        sx={{
          mb: 5,
          mt: 1,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(18px)',
          transition: 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Glow Banner Card */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: '28px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(20,30,60,0.95) 60%, rgba(10,18,40,0.9) 100%)',
            border: '1px solid rgba(42,255,255,0.18)',
            boxShadow: '0 0 60px rgba(42,255,255,0.08), 0 20px 60px rgba(0,0,0,0.5)',
            p: { xs: 3, md: 5 },
          }}
        >
          {/* Decorative blobs */}
          <Box sx={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(42,255,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -40, left: 80, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={3}>
            {/* Left: Avatar + Text */}
            <Stack direction="row" alignItems="center" spacing={3}>
              <Avatar
                sx={{
                  width: 72,
                  height: 72,
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #2affff 0%, #00c8c8 100%)',
                  color: '#0f172a',
                  boxShadow: '0 0 24px rgba(42,255,255,0.35)',
                  border: '3px solid rgba(42,255,255,0.3)',
                }}
              >
                {initials}
              </Avatar>
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: '#2affff', fontWeight: 800, letterSpacing: 2.5, fontSize: '0.65rem', display: 'block', mb: 0.5 }}
                >
                  Welcome back
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                    background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.75) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {student.fullName || student.full_name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5, fontWeight: 500 }}>
                  {student.rollNumber || student.roll_number} &nbsp;•&nbsp; {student.department} &nbsp;•&nbsp; {student.email}
                </Typography>
              </Box>
            </Stack>

            {/* Right: CTA */}
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate('/student/available-exams')}
              sx={{
                borderRadius: '50px',
                px: 3.5,
                py: 1.4,
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #2affff 0%, #00c8c8 100%)',
                color: '#0f172a',
                boxShadow: '0 8px 24px rgba(42,255,255,0.35)',
                whiteSpace: 'nowrap',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 14px 32px rgba(42,255,255,0.45)',
                },
                transition: 'all 0.25s ease',
              }}
            >
              Start Exam
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* ── Info Strip Cards ──────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 5 }}>
        {studentInfoItems.map((info, i) => {
          const IconComp = infoIcons[i];
          return (
            <Grid item xs={6} sm={3} key={i}>
              <Card
                sx={{
                  borderRadius: '20px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${infoColors[i]}22`,
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${infoColors[i]}11`,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.5s cubic-bezier(0.34,1.3,0.64,1) ${0.08 * i + 0.2}s`,
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px ${infoColors[i]}33`,
                  },
                }}
              >
                <CardContent sx={{ p: '20px !important', textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '14px',
                      background: `${infoColors[i]}18`,
                      border: `1px solid ${infoColors[i]}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5,
                    }}
                  >
                    <IconComp sx={{ fontSize: 22, color: infoColors[i] }} />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: infoColors[i], fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, display: 'block', mb: 0.5, fontSize: '0.6rem' }}
                  >
                    {info.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {info.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Section Title ─────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.01em',
            mb: 0.5,
          }}
        >
          Quick Actions
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
          Navigate to any module below
        </Typography>
      </Box>

      {/* ── Quick Action Grid ─────────────────────────────────── */}
      <Grid container spacing={2.5}>
        {quickActions.map((action, i) => (
          <Grid item xs={12} sm={6} md={4} key={action.label}>
            <Card
              onClick={() => navigate(action.path)}
              sx={{
                borderRadius: '20px',
                background: action.bg,
                backdropFilter: 'blur(16px)',
                border: `1px solid ${action.border}`,
                cursor: 'pointer',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(24px)',
                transition: `all 0.5s cubic-bezier(0.34,1.3,0.64,1) ${0.06 * i + 0.35}s`,
                '&:hover': {
                  transform: 'translateY(-6px) scale(1.02)',
                  boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px ${action.border}`,
                  background: `${action.bg.replace('0.08', '0.14')}`,
                },
              }}
            >
              <CardContent sx={{ p: '24px !important' }}>
                <Stack direction="row" alignItems="flex-start" spacing={2.5}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `${action.color}18`,
                      border: `1.5px solid ${action.color}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: action.color,
                      flexShrink: 0,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 900, color: '#fff', mb: 0.3, lineHeight: 1.2 }}
                    >
                      {action.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 500, lineHeight: 1.4, display: 'block' }}
                    >
                      {action.description}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: action.color,
                      fontSize: '1.2rem',
                      opacity: 0.6,
                      alignSelf: 'center',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    →
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

    </StudentLayout>
  );
}
