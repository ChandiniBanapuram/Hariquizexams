import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, CircularProgress, Table, TableBody,
  TableCell, TableHead, TableRow, TableContainer, IconButton, Chip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { itAdminAPI } from '@/lib/itadmin-api';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/layouts/AdminLayout';

export default function ManageStudents() {
  const navigate = useNavigate();
  const { logout, isAuthenticated, department } = useAdmin();
  const { toast } = useToast();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/admin'); return; }
    fetchStudents();
  }, [isAuthenticated]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const result = await itAdminAPI.getStudents(department || undefined);
      setStudents(Array.isArray(result) ? result : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch students.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this registered student?')) return;
    try {
      await itAdminAPI.deleteStudent(id);
      toast({ title: 'Deleted', description: 'Student removed successfully.' });
      fetchStudents();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete student.', variant: 'destructive' });
    }
  };

  return (
    <AdminLayout onLogout={logout}>
      <Box sx={{ mb: 3, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Student Registry
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Oversee and manage the student demographic data.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpenDialog(true)}>
          Add New Student
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          {students.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary" fontWeight={600}>No students found.</Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Roll Number</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Full Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Year / Sem</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((stu) => (
                  <TableRow key={stu.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{stu.roll_number}</TableCell>
                    <TableCell>{stu.full_name}</TableCell>
                    <TableCell>
                      <Chip label={stu.department} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>Year {stu.year} • Sem {stu.semester}</TableCell>
                    <TableCell>{stu.section}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => setOpenDialog(true)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(stu.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Full Name" fullWidth size="small" />
          <TextField label="Roll Number" fullWidth size="small" />
          <TextField label="Department" fullWidth size="small" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Year" fullWidth size="small" />
            <TextField label="Semester" fullWidth size="small" />
          </Box>
          <TextField label="Section" fullWidth size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenDialog(false)}>Save</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
