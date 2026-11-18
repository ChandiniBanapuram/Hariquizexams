import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Paper, CircularProgress, 
  Divider, Stack, LinearProgress, useTheme 
} from '@mui/material';
import { 
  Code as CodeIcon, 
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
  EmojiEvents as EmojiEventsIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import StudentLayout from '@/components/layouts/StudentLayout';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { codingAPI } from '@/lib/api';

export default function Performance() {
  const { student, logout } = useStudentAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    if (!student) return;
    codingAPI.getStudentAnalytics(student.id)
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [student]);

  if (loading) return (
    <StudentLayout user={student} onLogout={logout}>
      <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress />
      </Box>
    </StudentLayout>
  );

  if (!data || data.error) return (
    <StudentLayout user={student} onLogout={logout}>
       <Box textAlign="center" py={8}>
          <Typography color="error" gutterBottom>{data?.error || "Unable to load performance data."}</Typography>
          <Typography variant="body2" color="text.secondary">Try again later or contact support if the issue persists.</Typography>
       </Box>
    </StudentLayout>
  );

  const practice = data.practice || { executed: 0, available: 0, passRate: 0 };
  const exams = data.exams || { executed: 0, available: 0, passRate: 0 };

  const MetricCard = ({ title, icon, executed, available, passRate, color }: any) => (
    <Paper 
      elevation={0}
      sx={{ 
        p: 4, 
        borderRadius: 4, 
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px -10px ${color}20`
        }
      }}
    >
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box sx={{ p: 1.5, bgcolor: `${color}15`, borderRadius: 3, color: color }}>
            {icon}
          </Box>
          <Typography variant="h5" fontWeight={800}>{title}</Typography>
        </Box>

        <Divider />

        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
              PROGRAMS EXECUTED
            </Typography>
            <Typography variant="h4" fontWeight={900}>{executed}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
              PROGRAMS AVAILABLE
            </Typography>
            <Typography variant="h4" fontWeight={900}>{available}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
              PASSING PERCENTAGE
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h4" fontWeight={900} color={color}>{passRate}%</Typography>
                <CheckCircleIcon sx={{ color: color, fontSize: 28 }} />
            </Box>
          </Grid>
        </Grid>

        <Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption" fontWeight={700}>Completion Progress</Typography>
                <Typography variant="caption" fontWeight={700}>{available > 0 ? Math.round((executed/available)*100) : 0}%</Typography>
            </Box>
            <LinearProgress 
                variant="determinate" 
                value={available > 0 ? (executed/available)*100 : 0} 
                sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                        bgcolor: color,
                        borderRadius: 5
                    }
                }}
            />
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <StudentLayout user={student} onLogout={logout}>
      <Box sx={{ mb: 6, mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: 'text.primary', letterSpacing: '-0.02em' }}>
          My <Box component="span" className="teal-accent-text">Performance</Box>
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Detailed breakdown of your progress in coding practice and examinations.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12}>
          <MetricCard 
            title="Coding Practice"
            icon={<CodeIcon fontSize="large" />}
            executed={practice.executed}
            available={practice.available}
            passRate={practice.passRate}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid item xs={12}>
          <MetricCard 
            title="Coding Exams"
            icon={<AssessmentIcon fontSize="large" />}
            executed={exams.executed}
            available={exams.available}
            passRate={exams.passRate}
            color="#22c55e"
          />
        </Grid>
      </Grid>
      
      {/* Optional: Add a small motivational quote or tip */}
      <Box mt={6} p={3} bgcolor="action.hover" borderRadius={3} border="1px dashed" borderColor="divider">
        <Stack direction="row" alignItems="center" spacing={2}>
            <EmojiEventsIcon color="warning" />
            <Typography variant="body2" color="text.secondary">
                <b>Tip:</b> Solving more practice problems increases your accuracy and prepares you for real-world coding exams. Keep practicing!
            </Typography>
        </Stack>
      </Box>
    </StudentLayout>
  );
}
