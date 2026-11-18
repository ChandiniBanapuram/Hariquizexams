import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Link, Stack } from '@mui/material';
import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', py: 3, mt: 'auto' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" alignItems="center" spacing={2}>
          <Link component={RouterLink} to="/privacy-policy" underline="hover" color="text.secondary">
            Privacy Policy
          </Link>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            |
          </Typography>
          <Link component={RouterLink} to="/about" underline="hover" color="text.secondary">
            About Us
          </Link>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            |
          </Typography>
          <Link
            href="mailto:sairohit4531@gmail.com"
            underline="hover"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <Mail size={16} />
            Contact Us
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
