import { createTheme } from '@mui/material/styles';

// Create a modern theme for the Online Examination Portal
export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#4F46E5' : '#6366F1',
      light: mode === 'light' ? '#6366F1' : '#818CF8',
      dark: mode === 'light' ? '#3730A3' : '#4F46E5',
      contrastText: '#fff',
    },
    secondary: {
      main: '#22C55E', // Green accent
      light: '#4ADE80',
      dark: '#16A34A',
      contrastText: '#fff',
    },
    success: {
      main: '#22C55E',
      light: '#4ADE80',
      dark: '#16A34A',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FB7185',
      dark: '#D97706',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: mode === 'light' ? '#F8FAFC' : '#0B1220',
      paper:   mode === 'light' ? '#FFFFFF' : '#1F2937',
    },
    text: {
      primary:   mode === 'light' ? '#0f172a' : '#E5E7EB',
      secondary: mode === 'light' ? '#475569' : '#9CA3AF',
      disabled:  mode === 'light' ? '#94a3b8'  : '#6B7280',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 800,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.5,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.6,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.75,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.875rem',
      letterSpacing: '0.2px',
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.05)',
    '0px 4px 6px rgba(0, 0, 0, 0.05)',
    '0px 4px 8px rgba(0, 0, 0, 0.08)',
    '0px 5px 12px rgba(0, 0, 0, 0.08)',
    '0px 6px 16px rgba(0, 0, 0, 0.08)',
    '0px 8px 24px rgba(0, 0, 0, 0.1)',
    '0px 10px 32px rgba(0, 0, 0, 0.1)',
    '0px 12px 40px rgba(0, 0, 0, 0.1)',
    '0px 14px 48px rgba(0, 0, 0, 0.15)',
    '0px 16px 56px rgba(0, 0, 0, 0.15)',
    '0px 20px 64px rgba(0, 0, 0, 0.15)',
    '0px 24px 72px rgba(0, 0, 0, 0.15)',
    '0px 28px 80px rgba(0, 0, 0, 0.15)',
    '0px 32px 88px rgba(0, 0, 0, 0.2)',
    '0px 36px 96px rgba(0, 0, 0, 0.2)',
    '0px 40px 104px rgba(0, 0, 0, 0.2)',
    '0px 44px 112px rgba(0, 0, 0, 0.2)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
    '0px 48px 120px rgba(0, 0, 0, 0.25)',
  ],
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(11, 18, 32, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: mode === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
          color: mode === 'light' ? '#0f172a' : '#E5E7EB',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#111827',
          borderRight: mode === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '10px 24px',
          textTransform: 'none',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
        containedPrimary: {
          background: mode === 'dark' ? 'linear-gradient(135deg, #6366F1 0%, #22C55E 50%, #F59E0B 100%)' : '#4F46E5',
          '&:hover': {
            background: mode === 'dark' ? 'linear-gradient(135deg, #4F46E5 0%, #16A34A 50%, #D97706 100%)' : '#4338CA',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1F2937',
          border: mode === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: mode === 'light' ? '0 10px 15px -3px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '14px',
            backgroundColor: mode === 'light' ? '#F1F5F9' : '#111827',
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(99, 102, 241, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366F1',
            },
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          margin: '4px 12px',
          padding: '10px 16px',
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            backgroundColor: mode === 'light' ? 'rgba(79, 70, 229, 0.08)' : 'rgba(99, 102, 241, 0.15)',
            color: mode === 'light' ? '#4F46E5' : '#6366F1',
            '&:hover': {
              backgroundColor: mode === 'light' ? 'rgba(79, 70, 229, 0.12)' : 'rgba(99, 102, 241, 0.2)',
            },
          },
          '&:hover': {
            backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(8px)',
          },
        },
      },
    },
  },
});

export default getTheme;
