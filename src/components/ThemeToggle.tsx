import { IconButton, Tooltip } from '@mui/material';
import { Moon, Sun } from 'lucide-react';
import { useThemeContext } from '@/context/ThemeContext';

export function ThemeToggle({ variant = 'header' }: { variant?: 'header' | 'default' }) {
  const { mode, toggleTheme } = useThemeContext();
  const isDark = mode === 'dark';

  const title = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip title={title}>
      <IconButton 
        onClick={toggleTheme} 
        sx={variant === 'header' ? {
          bgcolor: 'rgba(255,255,255,0.12)',
          color: '#ffffff',
          borderRadius: '12px',
          p: '8px',
          '&:hover': { 
            bgcolor: 'rgba(255,255,255,0.22)',
            transform: 'rotate(12deg)',
          },
          border: '1px solid rgba(255,255,255,0.15)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        } : {
          bgcolor: 'var(--background)',
          color: 'var(--text-primary)',
          borderRadius: '12px',
          p: '8px',
          '&:hover': { 
            bgcolor: 'var(--border-subtle)',
            transform: 'rotate(12deg)',
          },
          border: '1px solid var(--border-subtle)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </IconButton>
    </Tooltip>
  );
}
