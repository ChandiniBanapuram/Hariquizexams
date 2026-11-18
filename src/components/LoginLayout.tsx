import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import gnitsLogo from '@/assets/gnits-logo.webp';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeContext } from '@/context/ThemeContext';
import { useBranding } from '@/context/BrandingContext';
import ContactDialog from '@/components/ContactDialog';
import { workshopStore, fdpStore } from '@/lib/events-store';

// ── Events Marquee ─────────────────────────────────────────────────────────────
function EventsMarqueeBar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<{ id: string; label: string; path: string }[]>([]);

  useEffect(() => {
    const ws = workshopStore.getActive().map(w => ({
      id: w.id,
      label: `🎓 Registration open: ${w.name}`,
      path: `/events/workshop/${w.id}`,
    }));
    const fs = fdpStore.getActive().map(f => ({
      id: f.id,
      label: `📚 Registration open: ${f.name}`,
      path: `/events/fdp/${f.id}`,
    }));
    setEvents([...ws, ...fs]);
  }, []);

  if (events.length === 0) return null;

  return (
    <Box sx={{ width: '100%', position: 'relative', zIndex: 20, bgcolor: 'rgba(245,158,11,0.13)', borderBottom: '1px solid rgba(245,158,11,0.3)', py: 0.75, overflow: 'hidden' }}>
      <style>{`
        @keyframes evMarquee { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        .ev-mq { animation: evMarquee 35s linear infinite; white-space: nowrap; }
        .ev-mq:hover { animation-play-state: paused; }
      `}</style>
      <Box className="ev-mq" sx={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {[...events, ...events].map((ev, i) => (
          <Box key={`${ev.id}_${i}`} component="span" onClick={() => navigate(ev.path)}
            sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5, '&:hover': { color: '#f59e0b', textDecoration: 'underline' } }}>
            {ev.label}
            <Box component="span" sx={{ opacity: 0.35, mx: 2 }}>◆</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}


interface LoginLayoutProps {
  children: React.ReactNode;
}

const LoginLayout: React.FC<LoginLayoutProps> = ({ children }) => {
  const { mode } = useThemeContext();
  const isDark = mode === 'dark';
  const [contactOpen, setContactOpen] = useState(false);
  const { settings } = useBranding();

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* ── Background Video / Gradient (HD Ken Burns) ── */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          '&:after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: isDark
              ? 'linear-gradient(135deg, rgba(5,10,30,0.55) 0%, rgba(15,20,50,0.65) 100%)'
              : 'linear-gradient(135deg, rgba(230,240,255,0.45) 0%, rgba(210,230,255,0.55) 100%)',
            zIndex: 1,
          },
          '@keyframes kenBurns': {
            '0%':   { transform: 'scale(1.08) translate(0%, 0%)' },
            '50%':  { transform: 'scale(1.18) translate(-2%, -1.5%)' },
            '100%': { transform: 'scale(1.08) translate(0%, 0%)' },
          },
        }}
      >
        {/* Ambient background is handled by the gradient orbs below */}

        {/* Animated gradient orbs */}
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: isDark
            ? `
              radial-gradient(ellipse 600px 500px at 10% 20%, rgba(42, 255, 255, 0.06) 0%, transparent 70%),
              radial-gradient(ellipse 700px 600px at 90% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 70%),
              radial-gradient(ellipse 500px 400px at 50% 50%, rgba(42, 255, 255, 0.03) 0%, transparent 70%)
            `
            : `
              radial-gradient(ellipse 600px 500px at 10% 20%, rgba(42, 180, 255, 0.12) 0%, transparent 70%),
              radial-gradient(ellipse 700px 600px at 90% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 70%)
            `,
        }} />

        {/* Grid / circuit lines overlay */}
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0, opacity: isDark ? 0.03 : 0.04,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </Box>

      {/* ── Top Bar: Logo + Theme Toggle ── */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 3, md: 6 },
          pt: { xs: 2, md: 2.5 },
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#ffffff',
              border: `2px solid ${isDark ? 'rgba(42,255,255,0.4)' : 'rgba(42,180,255,0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              p: '4px',
            }}
          >
            <Box
              component="img"
              src={settings.login_logo || gnitsLogo}
              alt="Logo"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
          <Box>
            <Box
              component="span"
              sx={{
                display: 'block',
                fontWeight: 900,
                fontSize: '1rem',
                letterSpacing: '-0.02em',
                color: isDark ? '#fff' : '#0f172a',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {settings.login_header_title || 'GNITS Portal'}
            </Box>
            <Box
              component="span"
              sx={{
                display: 'block',
                fontSize: '0.65rem',
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                letterSpacing: 1.5,
              }}
            >
              {settings.login_header_subtitle || 'EXAMINATION SYSTEM'}
            </Box>
          </Box>
        </Box>

        {/* Theme Toggle */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: '50px',
            bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              letterSpacing: 0.5,
            }}
          >
            {isDark ? 'DARK' : 'LIGHT'}
          </Box>
          <ThemeToggle variant="header" />
        </Box>
      </Box>

      {/* ── Events Notification Marquee ── */}
      <EventsMarqueeBar />

      {/* ── Main Content: Centered Card (Stationary without animations) ── */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: { xs: 1, md: 2 },
          overflow: 'hidden',
        }}
      >
        <Box
          className="no-scrollbar"
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', sm: 540 },
            maxHeight: 'calc(100vh - 110px)',
            overflowX: 'hidden',
            overflowY: 'auto',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none !important' },
            position: 'relative',
          }}
        >
          {/* Soft glow halo behind card */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: -20,
              borderRadius: '32px',
              background: isDark
                ? 'radial-gradient(ellipse at center, rgba(42,255,255,0.14) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, rgba(59,130,246,0.14) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {children}
          </Box>
        </Box>
      </Box>

      {/* Bottom Footer Links */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          pb: { xs: 2, md: 2.5 },
          pt: 0.5,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2.5, sm: 4 }, flexWrap: 'wrap' }}>
          {[
            { label: 'Privacy Policy', path: '/privacy-policy' },
            { label: 'Terms & Conditions', path: '/terms-and-conditions' },
            { label: 'Contact', path: '#contact', action: () => setContactOpen(true) },
            { label: 'About', path: '/about' }
          ].map((link) => {
            const commonSx = {
              color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
              fontSize: '0.7rem',
              fontWeight: 800,
              textDecoration: 'none',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                color: isDark ? '#2affff' : '#3b82f6',
                transform: 'translateY(-1px)'
              }
            } as const;
            if (link.action) {
              return (
                <Box key={link.label} component="span" onClick={link.action} sx={commonSx}>
                  {link.label}
                </Box>
              );
            }
            return (
              <Box key={link.path} component={Link} to={link.path} sx={commonSx}>
                {link.label}
              </Box>
            );
          })}
        </Box>
        {settings.login_footer_text && (
          <Box
            sx={{
              color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textAlign: 'center',
            }}
          >
            {settings.login_footer_text}
          </Box>
        )}
      </Box>
      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} />
    </Box>
  );
};

export default LoginLayout;
