import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, Typography, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, FormControl, InputLabel, Select, IconButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Code as CodeIcon } from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI, Question } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLookupData, useLookupSubjects } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';
import QuestionForm from '@/components/admin/QuestionForm';

export default function CodingQuestions() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const { toast } = useToast();
  const { departments, years, semesters } = useLookupData();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  // Coding Specific Form Format
    const [formData, setFormData] = useState({ 
      dept: '', sec: 'ALL', year: '', sem: '', subj: '', 
      title: '', problemObj: '', inFormat: '', outFormat: '', testCases: '', usageType: 'practice', difficulty: 'Medium'
    });
    
    const { subjects } = useLookupSubjects(formData.dept, formData.year, formData.sem);

    useEffect(() => {
      if (!isAuthenticated) navigate('/admin');
      else fetchQuestions();
    }, [isAuthenticated, navigate]);

    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const data = await adminAPI.getQuestions();
        if(Array.isArray(data)) {
            const codeQs = data.filter(q => {
               try {
                  const parsed = JSON.parse(q.question);
                  return !!parsed.description || !!parsed.title;
               } catch(e) {
                  return false;
               }
            });
            setQuestions(codeQs);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleSave = async (payloadString: string, rawFormData: any) => {
        setLoading(true);
        const payload = {
            department: rawFormData.dept, 
            section: rawFormData.sec, 
            year: rawFormData.year, 
            semester: rawFormData.sem, 
            subject: rawFormData.subj,
            question: payloadString, 
            optionA: 'N/A', 
            optionB: 'N/A', 
            optionC: 'N/A', 
            optionD: 'N/A', 
            correctOption: 'A'
        };
        
        try {
            if(editId) await adminAPI.updateQuestion(editId, payload);
            else await adminAPI.addQuestion(payload);
            toast({ title: 'Success', description: `Coding scenario ${editId ? 'updated' : 'pushed'}.` });
            setOpenDialog(false);
            fetchQuestions();
        } catch {
            toast({ title: 'Error', description: 'Failed to push serialized logic.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if(!confirm('Permanently delete this coding scenario?')) return;
        await adminAPI.deleteQuestion(id);
        fetchQuestions();
    };

    const openEdit = (q: Question) => {
        setEditId(q.id);
        try {
            const parsed = JSON.parse(q.question);
            setFormData(prev => ({ 
                ...prev,
                dept: (q as any).department || '',
                sec: (q as any).section || 'ALL',
                year: (q as any).year || '',
                sem: (q as any).semester || '',
                subj: (q as any).subject || '',
                title: parsed.title || '',
                problemObj: parsed.problemObj || '',
                inFormat: parsed.inFormat || '',
                outFormat: parsed.outFormat || '',
                testCases: parsed.testCases || '',
                usageType: parsed.usageType || 'practice',
                difficulty: parsed.difficulty || 'Medium',
            }));
        } catch(e) {
            setFormData(prev => ({ ...prev, title: 'Parsing Error', problemObj: q.question }));
        }
        setOpenDialog(true);
    };

    const openNew = () => {
        setEditId(null);
        setFormData(null);
        setOpenDialog(true);
    };

    const previewTitle = (raw: string) => {
        try { return JSON.parse(raw).title || 'Untitled Scenario'; } catch { return 'Legacy Unformatted Scenario'; }
    };

    return (
      <AdminLayout onLogout={logout}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Maintain Coding Scenarios</Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>Push complex multi-variable parameters using payload encapsulation mapping.</Typography>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<CodeIcon />} onClick={openNew}>Build Scenario</Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
        ) : (
          <Card>
              <Table>
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                      <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Coding Map Link</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Scenario Title Name</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Compiler Rules</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Controls</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {questions.map(q => (
                          <TableRow key={q.id} hover>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{q.subject}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{previewTitle(q.question)}</TableCell>
                              <TableCell align="center"><Typography variant="caption" sx={{ bgcolor: 'secondary.light', px: 1, py: 0.5, borderRadius: 1 }}>Custom Evaluator</Typography></TableCell>
                              <TableCell align="center">
                                  <IconButton size="small" color="primary" onClick={() => openEdit(q)}><EditIcon fontSize="small" /></IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDelete(q.id)}><DeleteIcon fontSize="small" /></IconButton>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </Card>
        )}

        {/* Code Editor Serializer Modal */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                {editId ? 'Refine Coding Scenario' : 'Formulate Code Challenge Payload'}
            </DialogTitle>
            <DialogContent dividers>
                <QuestionForm 
                    initialData={formData}
                    editId={editId}
                    onSave={handleSave}
                    onCancel={() => setOpenDialog(false)}
                    isLoading={loading}
                />
            </DialogContent>
        </Dialog>
    </AdminLayout>
  );
}
