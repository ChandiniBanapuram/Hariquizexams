import { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import ContactDialog from '@/components/ContactDialog';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBranding } from '@/context/BrandingContext';

export default function FooterWithContact({ mounted = true, variant }: { mounted?: boolean, variant?: 'admin' | 'student' | 'it-admin' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useBranding();

  const isAdmin = variant === 'admin' || location.pathname.startsWith('/admin') || location.pathname.startsWith('/it-admin');
  const footerText = isAdmin ? settings.admin_footer_text : settings.student_footer_text;

  const links = [
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Terms & Conditions', path: '/terms-and-conditions' },
    { label: 'Contact', path: 'contact' },
    { label: 'About', path: '/about' }
  ];

  const handleLinkClick = (path: string) => {
    if (path === 'contact') {
      setOpen(true);
    } else {
      navigate(path);
    }
  };

  return (
    <Box
      sx={{
        py: 8,
        mt: 'auto',
        position: 'relative',
        zIndex: 10,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.6s ease'
      }}
    >
      <Stack 
        direction="row" 
        spacing={{ xs: 3, md: 5 }} 
        justifyContent="center" 
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        {links.map((link) => (
          <Typography 
            key={link.label} 
            variant="body2" 
            onClick={() => handleLinkClick(link.path)}
            sx={{ 
              color: 'rgba(255,255,255,0.3)', 
              fontWeight: 800, 
              cursor: 'pointer', 
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              '&:hover': { 
                color: '#2affff',
                transform: 'translateY(-1px)'
              }, 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            }}
          >
            {link.label}
          </Typography>
        ))}
      </Stack>

      {footerText && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            color: 'text.secondary',
            opacity: 0.6,
            fontWeight: 500,
            letterSpacing: '0.05em'
          }}
        >
          {footerText}
        </Typography>
      )}

      <ContactDialog open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
