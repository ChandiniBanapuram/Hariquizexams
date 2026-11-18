import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Container, Stack, Paper } from '@mui/material';
import { Add as AddIcon, History as HistoryIcon } from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';

export default function CodingPracticeQuestions() {
  const navigate = useNavigate();
  const { logout } = useAdmin();

  return (
    <AdminLayout onLogout={logout}>
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
            Coding Practice Questions
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<HistoryIcon />}
            onClick={() => navigate('/admin/coding-practice-questions/list')}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Previous Questions
          </Button>
        </Box>

        <Paper 
          elevation={0} 
          sx={{ 
            p: 8, 
            textAlign: 'center', 
            bgcolor: 'background.paper', 
            borderRadius: 4,
            border: '2px dashed',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px'
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Box 
              sx={{ 
                width: 80, 
                height: 80, 
                borderRadius: '50%', 
                bgcolor: 'primary.light', 
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2
              }}
            >
              <AddIcon sx={{ fontSize: 40 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Build a New Coding Challenge
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
              Create a global coding practice question accessible to all students, regardless of their department or year.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/coding-practice-questions/add')}
              sx={{ 
                px: 6, 
                py: 1.5, 
                borderRadius: 3, 
                fontSize: '1.1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 3
              }}
            >
              Add Questions
            </Button>
          </Stack>
        </Paper>
      </Container>
    </AdminLayout>
  );
}
