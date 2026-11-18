import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Container, Paper, List, ListItem, ListItemButton, 
  ListItemIcon, ListItemText, Divider, Stack, Chip, IconButton, Skeleton, Button,
  Collapse
} from '@mui/material';
import { 
  Code as CodeIcon, Lock as LockIcon, LockOpen as UnlockedIcon, 
  ChevronRight, Category as CategoryIcon, Functions, DataObject,
  Storage, Memory, AccountTree, FolderZip, DeviceUnknown, ReportProblem
} from '@mui/icons-material';
import StudentLayout from '@/components/layouts/StudentLayout';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { codingAPI } from '@/lib/api';

const TOPICS = [
  { name: 'Module 1 – Basic Programming', icon: <CodeIcon color="primary" /> },
  { name: 'Module 2 – Pattern Programs', icon: <CodeIcon color="secondary" /> },
  { name: 'Module 3 – Arrays', icon: <CodeIcon /> },
  { name: 'Module 4 – Strings', icon: <CodeIcon color="action" /> },
  { name: 'Module 5 – Matrix', icon: <CodeIcon sx={{ color: '#f7df1e' }} /> },
  { name: 'Module 6 – Recursion', icon: <CodeIcon color="success" /> },
  { name: 'Module 7 – Data Structures', icon: <Storage color="success" /> },
  { name: 'Module 8 – Dynamic Programming', icon: <Memory color="secondary" /> },
];

export default function CodingPracticeSetup() {
  const navigate = useNavigate();
  const { student, logout, isAuthenticated } = useStudentAuth();

  const [activeTopic, setActiveTopic] = useState<string>(TOPICS[0].name);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        // Fetch all questions for this topic (no difficulty specified -> returns all)
        const res = await codingAPI.getPracticeQuestions(undefined, activeTopic);
        // The backend returns { data: [...] } or { questions: [...] }
        const rawData = res.data || res.questions || [];
        setQuestions(rawData);
      } catch (err) {
        console.error('Failed to load questions:', err);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [activeTopic]);

  const handleStartQuestion = (q: any) => {
    // Navigate to the editor, passing difficulty=All, topic=activeTopic, and the specific questionId
    navigate(`/student/coding-practice/active?difficulty=All&topic=${encodeURIComponent(activeTopic)}&qid=${q.id}`);
  };

  const getDiffColor = (d: string) => {
    if (d === 'Easy') return '#22c55e';
    if (d === 'Medium') return '#f59e0b';
    return '#ef4444';
  };

  if (!isAuthenticated) return null;

  return (
    <StudentLayout user={student} onLogout={logout} noPadding>
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          minHeight: 'calc(100vh - 64px)',
          p: { xs: 2, md: 3 },
          display: 'flex',
          gap: 3,
          flexDirection: { xs: 'column', md: 'row' },
          background: 'radial-gradient(1200px 600px at 10% -10%, rgba(168,85,247,0.12), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(99,102,241,0.10), transparent 60%), #09090b',
        }}
      >
        
        {/* LEFT SIDEBAR: Topic Filters */}
        <Paper 
          className="glass" 
          elevation={0} 
          sx={{ 
            width: { xs: '100%', md: 280 },
            minWidth: { xs: '100%', md: 280 },
            height: 'fit-content',
            maxHeight: 'calc(100vh - 96px)',
            borderRadius: 4, 
            overflowY: 'auto',
            p: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
            backdropFilter: 'blur(14px)',
            background: 'linear-gradient(180deg, rgba(20,20,28,0.85), rgba(20,20,28,0.55))',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, px: 2, color: 'primary.main' }}>
            Categories
          </Typography>
          <Stack spacing={1}>
            {TOPICS.map((topic) => {
              const isExpanded = activeTopic === topic.name;
              return (
                <Box key={topic.name}>
                  <Button
                    fullWidth
                    variant={isExpanded ? 'contained' : 'text'}
                    onClick={() => setActiveTopic(topic.name)}
                    sx={{
                      justifyContent: 'flex-start',
                      px: 2.5,
                      py: 1.5,
                      borderRadius: 4,
                      textTransform: 'none',
                      fontWeight: isExpanded ? 800 : 500,
                      color: isExpanded ? '#fff' : 'text.primary',
                      bgcolor: isExpanded ? 'primary.main' : 'transparent',
                      background: isExpanded ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'transparent',
                      boxShadow: isExpanded ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
                      '&:hover': {
                        bgcolor: isExpanded ? 'primary.dark' : 'rgba(99, 102, 241, 0.08)',
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      {topic.icon}
                      <Typography sx={{ fontWeight: isExpanded ? 700 : 500, fontSize: '0.85rem', textAlign: 'left', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topic.name}
                      </Typography>
                      <ChevronRight sx={{ fontSize: 16, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
                    </Box>
                  </Button>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit sx={{ mt: 0.5 }}>
                    <List component="div" disablePadding sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {loading ? (
                        <Skeleton variant="rectangular" height={32} sx={{ my: 0.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)' }} />
                      ) : questions.length === 0 ? (
                        <Typography variant="caption" sx={{ py: 1, px: 2, display: 'block', opacity: 0.5 }}>
                          No subtopics available
                        </Typography>
                      ) : (
                        questions.map((q) => (
                          <ListItemButton
                            key={q.id}
                            onClick={() => handleStartQuestion(q)}
                            sx={{
                              py: 0.8,
                              px: 2,
                              borderRadius: 2,
                              bgcolor: 'rgba(255,255,255,0.01)',
                              border: '1px solid rgba(255,255,255,0.02)',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'rgba(168, 85, 247, 0.08)',
                                borderColor: 'rgba(168, 85, 247, 0.3)',
                                color: '#c4b5fd',
                                pl: 2.5
                              }
                            }}
                          >
                            <ListItemText
                              primary={q.title}
                              primaryTypographyProps={{
                                sx: { fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                              }}
                            />
                          </ListItemButton>
                        ))
                      )}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* RIGHT AREA: Question List */}
        <Paper 
          className="glass"
          elevation={0}
          sx={{ 
            flexGrow: 1, 
            minHeight: { xs: 500, md: 'calc(100vh - 96px)' },
            borderRadius: 4, 
            display: 'flex', 
            flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            backdropFilter: 'blur(14px)',
            background: 'linear-gradient(180deg, rgba(15,15,20,0.85), rgba(15,15,20,0.55))',
          }}
        >
          {/* Header */}
          <Box sx={{ p: { xs: 3, md: 4 }, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.06))' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                boxShadow: '0 6px 20px rgba(99,102,241,0.45)'
              }}>
                <CodeIcon sx={{ color: '#fff' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                {activeTopic}
              </Typography>
              <Chip
                size="small"
                label={`${questions.length} ${questions.length === 1 ? 'Problem' : 'Problems'}`}
                sx={{ ml: 1, bgcolor: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontWeight: 700, border: '1px solid rgba(168,85,247,0.3)' }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Solve {activeTopic.toLowerCase()} problems to improve your logical thinking and coding speed.
            </Typography>
          </Box>

          {/* List */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 3 } }}>
            {loading ? (
              <Stack spacing={2}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)' }} />
                ))}
              </Stack>
            ) : questions.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, opacity: 0.6, textAlign: 'center' }}>
                <CodeIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>No Problems Found</Typography>
                <Typography variant="body2">More questions for {activeTopic} are coming soon.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {questions.map((q, index) => {
                  const accRate = (40 + (q.id % 40) + ((q.id % 13) / 10)).toFixed(1);
                  const diffColor = getDiffColor(q.difficulty);

                  return (
                    <Paper 
                      key={q.id} 
                      elevation={0} 
                      sx={{ 
                        mb: 1.5, 
                        bgcolor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 2,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(168,85,247,0.5)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 24px rgba(99,102,241,0.18)',
                          bgcolor: 'rgba(168,85,247,0.04)'
                        }
                      }}
                    >
                      <ListItemButton 
                        onClick={() => handleStartQuestion(q)}
                        sx={{ px: 3, py: 2 }}
                      >
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                          fontWeight: 800, fontSize: '0.8rem', mr: 2, flexShrink: 0,
                          border: '1px solid rgba(99,102,241,0.25)'
                        }}>
                          {index + 1}
                        </Box>

                        <ListItemText 
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                              {q.title}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                Acceptance {accRate}%
                              </Typography>
                            </Stack>
                          }
                        />
                        
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Chip
                            label={q.difficulty}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 24,
                              color: diffColor,
                              bgcolor: `${diffColor}1A`,
                              border: `1px solid ${diffColor}55`,
                            }}
                          />
                          <UnlockedIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                          <ChevronRight sx={{ color: 'text.disabled', fontSize: 20 }} />
                        </Stack>
                      </ListItemButton>
                    </Paper>
                  );
                })}
              </List>
            )}
          </Box>
        </Paper>

      </Container>
    </StudentLayout>
  );
}
