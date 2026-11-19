import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { useThemeContext } from '@/context/ThemeContext';

const TermsAndConditions: React.FC = () => {
  const { mode } = useThemeContext();
  const isDark = mode === 'dark';

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: isDark ? '#0B1220' : '#f8fafc',
      pt: 12,
      pb: 8
    }}>
      <Container maxWidth="md">
        <Paper sx={{ 
          p: { xs: 4, md: 6 },
          borderRadius: '24px',
          bgcolor: isDark ? '#1F2937' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.05)'
        }}>
          <Typography variant="h3" sx={{ 
            fontWeight: 900, 
            mb: 4, 
            color: isDark ? '#fff' : '#0f172a',
            letterSpacing: '-0.02em'
          }}>
            Terms and Conditions
          </Typography>
          
          <Box sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', lineHeight: 1.8 }}>
            <Typography variant="h6" sx={{ color: isDark ? '#3B82F6' : '#2563EB', mt: 4, mb: 2, fontWeight: 700 }}>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1" paragraph>
              By accessing and using this examination portal, you agree to be bound by these Terms and Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
            </Typography>

            <Typography variant="h6" sx={{ color: isDark ? '#3B82F6' : '#2563EB', mt: 4, mb: 2, fontWeight: 700 }}>
              2. Use License
            </Typography>
            <Typography variant="body1" paragraph>
              Permission is granted to temporarily use the materials (information or software) on the HARI Examination System for personal, non-commercial transitory viewing only.
            </Typography>

            <Typography variant="h6" sx={{ color: isDark ? '#3B82F6' : '#2563EB', mt: 4, mb: 2, fontWeight: 700 }}>
              3. Disclaimer
            </Typography>
            <Typography variant="body1" paragraph>
              The materials on this website are provided on an 'as is' basis. HARI makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability.
            </Typography>

            <Typography variant="h6" sx={{ color: isDark ? '#3B82F6' : '#2563EB', mt: 4, mb: 2, fontWeight: 700 }}>
              4. Limitations
            </Typography>
            <Typography variant="body1" paragraph>
              In no event shall HARI or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on the portal.
            </Typography>

            <Typography variant="h6" sx={{ color: isDark ? '#3B82F6' : '#2563EB', mt: 4, mb: 2, fontWeight: 700 }}>
              5. Governing Law
            </Typography>
            <Typography variant="body1" paragraph>
              These terms and conditions are governed by and construed in accordance with the laws of India and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
            </Typography>

            <Typography variant="body2" sx={{ mt: 6, fontStyle: 'italic', opacity: 0.6 }}>
              Last updated: March 25, 2026
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TermsAndConditions;
