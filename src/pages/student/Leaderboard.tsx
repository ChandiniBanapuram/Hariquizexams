import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Avatar, Tabs, Tab } from '@mui/material';
import { EmojiEvents, Timer, Memory, Person } from '@mui/icons-material';
import StudentLayout from '@/components/layouts/StudentLayout';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { codingAPI } from '@/lib/api';

interface LeaderEntry {
  rank: number;
  student_id: number;
  name: string;
  roll_number: string;
  department: string;
  total_score: number;
  total_passed: number;
  total_time: number;
  problems_solved: number;
  last_submitted: string;
  status: string;
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function Leaderboard() {
  const { student, logout } = useStudentAuth();
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState(0); // 0 = Practice, 1 = Specific Exam
  const [stats, setStats] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('Practice');

  const fetchLeaderboard = async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await codingAPI.getLeaderboard(selectedExamId === 'Practice' ? undefined : selectedExamId, 100);
      setLeaders(res.leaderboard || []);
      
      const s = await codingAPI.getStats();
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedExamId]);

  // Auto-refresh every 15s
  useEffect(() => {
    const timer = setInterval(() => fetchLeaderboard(true), 18081);
    return () => clearInterval(timer);
  }, [selectedExamId]);

  useEffect(() => {
    // Fetch available exams for the student to filter by
    // Using a simplified list for now or fetching from backend
    // For now, we'll let them see major active exams
    // codingAPI.getAvailableExams()... 
  }, []);

  function getRankIcon(rank: number) {
    if (rank === 1) return <EmojiEvents sx={{ color: '#FFD700', fontSize: 24 }} />;
    if (rank === 2) return <EmojiEvents sx={{ color: '#C0C0C0', fontSize: 22 }} />;
    if (rank === 3) return <EmojiEvents sx={{ color: '#CD7F32', fontSize: 20 }} />;
    return <Typography fontWeight={700} color="text.secondary" sx={{ width: 24, textAlign: 'center' }}>{rank}</Typography>;
  }

  return (
    <StudentLayout user={student} onLogout={logout}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents sx={{ color: '#FFD700', fontSize: 28 }} />
          Coding Leaderboard
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Ranked by total score → fastest execution time
        </Typography>
      </Box>

      {/* Stats cards */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Total Submissions', value: stats.total_submissions, icon: <Timer /> },
            { label: 'Accepted',          value: stats.accepted_count,    icon: <EmojiEvents sx={{ color: '#22c55e' }} /> },
            { label: 'Success Rate',      value: `${stats.success_rate}%`, icon: <Memory /> },
            { label: 'Active Students',   value: stats.active_students,   icon: <Person /> },
          ].map(({ label, value, icon }) => (
            <Paper key={label} sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ bgcolor: 'action.selected', borderRadius: '50%', width: 40, height: 40, display: 'grid', placeItems: 'center' }}>
                {icon}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h6" fontWeight={700}>{value}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Tabs value={selectedExamId === 'Practice' ? 0 : 1} onChange={(_, v) => setSelectedExamId(v === 0 ? 'Practice' : 'ALL')} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Practice Mode" />
                <Tab label="Live Exams" />
            </Tabs>
            {refreshing && <CircularProgress size={16} sx={{ ml: 2 }} />}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : leaders.length === 0 ? (
          <Box py={6} textAlign="center">
            <EmojiEvents sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No submissions yet for this category.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  {['Rank', 'Student', 'Score', 'Passed Cases', 'Time (s)', 'Status'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, py: 1.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {leaders.map((row, i) => {
                    const isMe = student && row.student_id === student.id;
                    return (
                      <TableRow
                        key={row.student_id}
                        sx={{
                          bgcolor: isMe ? 'rgba(34,197,94,0.07)' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' },
                          transition: 'background 0.15s',
                        }}
                      >
                        <TableCell sx={{ width: 60 }}>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            {getRankIcon(i + 1)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar
                              sx={{
                                width: 32, height: 32, fontSize: 13, fontWeight: 700,
                                bgcolor: i < 3 ? RANK_COLORS[i] + '33' : 'primary.main',
                                color: i < 3 ? RANK_COLORS[i] : 'white',
                              }}
                            >
                              {row.name?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{row.roll_number}</Typography>
                            </Box>
                            {isMe && (
                              <Chip label="You" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e' }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={700} color={i === 0 ? '#FFD700' : 'text.primary'}>
                            {row.total_score ?? 0}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${row.total_passed ?? 0} cases`}
                            size="small"
                            sx={{ bgcolor: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{parseFloat(row.total_time as any || 0).toFixed(3)}s</Typography>
                        </TableCell>
                        <TableCell>
                           <Chip 
                             label={row.status || 'Active'} 
                             size="small" 
                             sx={{ 
                               height: 20, fontSize: '0.65rem', 
                               bgcolor: row.status === 'Completed' ? '#22c55e22' : '#3b82f622',
                               color: row.status === 'Completed' ? '#22c55e' : '#3b82f6'
                             }} 
                           />
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </StudentLayout>
  );
}
