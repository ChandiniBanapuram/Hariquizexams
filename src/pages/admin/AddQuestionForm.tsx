import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Button, Typography, Container, Paper, TextField, 
  MenuItem, Grid, Stack, Divider, CircularProgress, IconButton 
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { codingAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function AddQuestionForm() {
  const navigate = useNavigate();
  const { logout } = useAdmin();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'Easy',
    topic: 'Arrays',
    input_format: '',
    output_format: '',
    visible_test_cases: [
      { input: '', output: '' },
      { input: '', output: '' },
      { input: '', output: '' }
    ],
    hidden_test_cases: ''
  });

  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('edit');
    if (id) {
      setIsEdit(true);
      setEditId(id);
      loadQuestion(id);
    }
  }, []);

  const loadQuestion = async (id: string) => {
    setLoading(true);
    try {
      // We can fetch all and find, or if the API supports it, fetch by id.
      // Current GET /practice/questions returns all if no params.
      const res = await codingAPI.getPracticeQuestions();
      const rawData = res.data || res.questions || [];
      const q = rawData.find((item: any) => String(item.id) === id);
      
      if (q) {
        setFormData({
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          topic: q.topic,
          input_format: q.input_format,
          output_format: q.output_format,
          visible_test_cases: q.visible_test_cases,
          hidden_test_cases: JSON.stringify(q.hidden_test_cases, null, 2)
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load question details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const [errors, setErrors] = useState<any>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTestCaseChange = (idx: number, field: 'input' | 'output', value: string) => {
    const newCases = [...formData.visible_test_cases];
    newCases[idx][field] = value;
    setFormData({ ...formData, visible_test_cases: newCases });
  };

  const validate = () => {
    const newErrors: any = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    
    // Check test cases
    formData.visible_test_cases.forEach((tc, i) => {
      if (!tc.input.trim() || !tc.output.trim()) {
        newErrors[`tc_${i}`] = 'Input and Output are required';
      }
    });

    // Check hidden JSON
    if (formData.hidden_test_cases.trim()) {
      try {
        const parsed = JSON.parse(formData.hidden_test_cases);
        if (!Array.isArray(parsed)) newErrors.hidden_test_cases = 'Hidden test cases must be a JSON array';
      } catch {
        newErrors.hidden_test_cases = 'Invalid JSON format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isProcessing) return;

    setIsProcessing(true);
    try {
      const payload = {
        ...formData,
        hidden_test_cases: formData.hidden_test_cases.trim() ? JSON.parse(formData.hidden_test_cases) : []
      };
      
      if (isEdit && editId) {
        await codingAPI.updatePracticeQuestion(editId, payload);
        toast({ title: 'Success', description: 'Question updated successfully!' });
      } else {
        await codingAPI.savePracticeQuestion(payload);
        toast({ title: 'Success', description: 'New question added successfully!' });
      }
      navigate('/admin/coding-practice-questions/list');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to save question';
      toast({ 
        title: 'Error', 
        description: msg, 
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout onLogout={logout}>
      <Container maxWidth="md">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/admin/coding-practice-questions')}
            sx={{ 
              mb: 2, 
              color: 'text.secondary',
              '&:hover': { color: 'primary.main', bgcolor: 'rgba(99, 102, 241, 0.05)' }
            }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {isEdit ? 'Update Practice Challenge' : 'Create Practice Challenge'}
          </Typography>
        </Box>

        <Paper elevation={0} className="glass" sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Difficulty"
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleChange as any}
                  required
                >
                  {DIFFICULTIES.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Topic"
                  name="topic"
                  value={formData.topic}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Arrays, Strings, DP"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Problem Title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  error={!!errors.title}
                  helperText={errors.title}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Problem Description"
                  name="description"
                  multiline
                  rows={6}
                  value={formData.description}
                  onChange={handleChange}
                  error={!!errors.description}
                  helperText={errors.description}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Input Format"
                  name="input_format"
                  multiline
                  rows={3}
                  value={formData.input_format}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Output Format"
                  name="output_format"
                  multiline
                  rows={3}
                  value={formData.output_format}
                  onChange={handleChange}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }}>
                  <Typography variant="h6" color="text.secondary">Visible Test Cases (Exactly 3)</Typography>
                </Divider>
              </Grid>

              {formData.visible_test_cases.map((tc, idx) => (
                <Grid item xs={12} key={idx}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Test Case {idx + 1}</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Input"
                          multiline
                          rows={2}
                          value={tc.input}
                          onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                          error={!!errors[`tc_${idx}`]}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Output"
                          multiline
                          rows={2}
                          value={tc.output}
                          onChange={(e) => handleTestCaseChange(idx, 'output', e.target.value)}
                          error={!!errors[`tc_${idx}`]}
                          helperText={errors[`tc_${idx}`]}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }}>
                  <Typography variant="h6" color="text.secondary">Hidden Test Cases (JSON)</Typography>
                </Divider>
                <TextField
                  fullWidth
                  label="JSON Input"
                  name="hidden_test_cases"
                  multiline
                  rows={4}
                  value={formData.hidden_test_cases}
                  onChange={handleChange}
                  placeholder='[ { "input": "...", "output": "..." } ]'
                  error={!!errors.hidden_test_cases}
                  helperText={errors.hidden_test_cases || "Paste your hidden test cases array here."}
                  sx={{ fontFamily: 'monospace' }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading || isProcessing}
                  startIcon={(loading || isProcessing) ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  sx={{ 
                    py: 1.8, 
                    borderRadius: 2, 
                    fontWeight: 800,
                    fontSize: '1rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                      boxShadow: '0 10px 30px rgba(99, 102, 241, 0.5)',
                    }
                  }}
                >
                  {isProcessing ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Question' : 'Add Question')}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>
    </AdminLayout>
  );
}
