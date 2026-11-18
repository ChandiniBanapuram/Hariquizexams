import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Button, Typography, Container, Paper, Table, 
  TableBody, TableCell, TableHead, TableRow, IconButton, 
  CircularProgress, Chip 
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { codingAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function CodingPracticeList() {
  const navigate = useNavigate();
  const { logout } = useAdmin();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await codingAPI.getPracticeQuestions();
      setQuestions(res.questions || []);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to fetch questions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getDiffColor = (diff: string) => {
    switch (diff) {
      case 'Easy': return 'success';
      case 'Medium': return 'warning';
      case 'Hard': return 'error';
      default: return 'default';
    }
  };

  const handleDelete = async (id: number) => {
    if (isProcessing) return;
    if (!window.confirm('Are you sure you want to delete this question? This will be a soft delete.')) return;

    setIsProcessing(true);
    try {
      await codingAPI.deletePracticeQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast({ title: 'Deleted', description: 'Question removed successfully' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to delete question';
      toast({ 
        title: 'Error', 
        description: msg, 
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (q: any) => {
    navigate(`/admin/coding-practice-questions/add?edit=${q.id}`);
  };

  return (
    <AdminLayout onLogout={logout}>
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              onClick={() => navigate('/admin/coding-practice-questions')}
              sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{ fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Previous Questions
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            onClick={() => navigate('/admin/coding-practice-questions/add')}
            sx={{ 
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' }
            }}
          >
            Add New Challenge
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
        ) : (
          <Paper elevation={0} className="glass" sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(99, 102, 241, 0.08)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>PROBLEM TITLE</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>DIFFICULTY</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>TOPIC</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>CREATED</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }} align="right">ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {questions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No questions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  questions.map((q) => (
                    <TableRow key={q.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{q.title}</TableCell>
                      <TableCell>
                        <Chip label={q.difficulty} size="small" color={getDiffColor(q.difficulty) as any} sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>{q.topic}</TableCell>
                      <TableCell>{new Date(q.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(q)} sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDelete(q.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </AdminLayout>
  );
}
