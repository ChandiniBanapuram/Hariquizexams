import { Box, AppBar, Toolbar, Typography, Chip, useTheme } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import gnitsLogo from '@/assets/gnits-logo.webp';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBranding } from '@/context/BrandingContext';

interface ExamHeaderProps {
  showTimer?: boolean;
  timeLeft?: number;
}

export function ExamHeader({ showTimer = false, timeLeft = 0 }: ExamHeaderProps) {
  const theme = useTheme();
  const { settings } = useBranding();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft <= 60;

  return (
    <AppBar
      position="static"
      elevation={4}
      sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            component="img"
            src={settings.student_logo || gnitsLogo}
            alt="GNITS Logo"
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              p: 0.5,
            }}
          />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
              {settings.student_header_title || "G. Narayanamma Institute of Technology & Science"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Online Examination Portal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showTimer ? (
            <Chip
              icon={<AccessTimeIcon />}
              label={formatTime(timeLeft)}
              color={isLowTime ? 'error' : 'primary'}
              variant="filled"
              sx={{
                fontWeight: 600,
                bgcolor: isLowTime ? theme.palette.error.light : theme.palette.primary.light,
                color: isLowTime ? theme.palette.error.contrastText : theme.palette.primary.contrastText,
              }}
            />
          ) : (
            <ThemeToggle variant="header" />
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
