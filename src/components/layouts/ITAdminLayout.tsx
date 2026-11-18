import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  SpaceDashboard as DashboardIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import gnitsLogo from '@/assets/gnits-logo.webp';
import { ThemeToggle } from '../ThemeToggle';
import FooterWithContact from '@/components/FooterWithContact';
import { useBranding } from '@/context/BrandingContext';

interface ITAdminLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const itAdminMenu = [
  {
    category: ' ',
    items: [
      {
        title: 'Dashboard',
        path: '/it-admin/dashboard',
        icon: DashboardIcon,
        color: '#6366F1',
      },
      {
        title: 'System Settings',
        path: '/it-admin/dashboard',
        icon: SettingsIcon,
        color: '#3B82F6',
      },
    ],
  },
];

const ITAdminLayout: React.FC<ITAdminLayoutProps> = ({ children, onLogout }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { settings } = useBranding();

  const isActiveRoute = (path: string) => location.pathname === path;
  const handleDrawerToggle = () => setDrawerOpen((p) => !p);
  const handleLogout = () => {
    onLogout();
    navigate('/it-admin');
  };

  const isCollapsed = !drawerOpen;

  const drawerContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 flex-1 overflow-y-auto">
        {itAdminMenu.map((group) => (
          <div key={group.category} className="mb-8">
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {group.category}
              </h3>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const active = isActiveRoute(item.path);
                const IconComp = item.icon;
                return (
                  <button
                    key={item.title}
                    title={isCollapsed ? item.title : ''}
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate(item.path);
                    }}
                    className={`w-full flex items-center rounded-xl px-3 py-3 mb-1 relative transition-all duration-200 group ${
                      isCollapsed ? 'justify-center' : 'justify-start gap-3'
                    } ${
                      active
                        ? 'bg-[rgba(99,102,241,0.1)] text-[var(--primary)] shadow-[var(--shadow-glow)]'
                        : 'text-[var(--text-secondary)] hover:bg-[rgba(99,102,241,0.06)] hover:text-[var(--primary)] hover:translate-x-0.5'
                    }`}
                  >
                    <div
                      className={`sidebar-icon-container ${
                        active ? 'bg-[var(--primary)] text-white shadow-lg' : ''
                      }`}
                    >
                      <IconComp style={{ fontSize: 20 }} />
                    </div>
                    {!isCollapsed && (
                      <span className={`text-sm font-medium ${active ? 'font-semibold' : ''}`}>
                        {item.title}
                      </span>
                    )}
                    {active && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-3/5 bg-[var(--primary)] rounded-r-md"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-3 pt-4 border-t border-[var(--border)]">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center rounded-xl px-3 py-3 transition-all duration-200 ${
            isCollapsed ? 'justify-center' : 'justify-start gap-3'
          } text-red-500 hover:bg-[rgba(239,68,68,0.08)]`}
        >
          <div className="sidebar-icon-container">
            <LogoutIcon style={{ fontSize: 20 }} />
          </div>
          {!isCollapsed && <span className="text-sm font-semibold">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Top Navbar */}
      <div
        className="bg-gradient-to-r from-[var(--primary)] via-blue-500 to-green-500 shadow-lg"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '72px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          className="flex items-center justify-between px-6 w-full"
          style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          <div className="flex items-center gap-4 flex-1 overflow-hidden pr-4">
            <button
              onClick={handleDrawerToggle}
              className="bg-[rgba(255,255,255,0.12)] text-white rounded-xl p-2 hover:bg-[rgba(255,255,255,0.22)] border border-[rgba(255,255,255,0.15)] transition-all duration-200 z-10 relative flex-shrink-0"
            >
              {drawerOpen ? <CloseIcon style={{ fontSize: 20 }} /> : <MenuIcon style={{ fontSize: 20 }} />}
            </button>

            <div className="hidden sm:block flex-1 overflow-hidden relative h-[50px] min-w-[200px] group">
              <style>{`
                @keyframes marqueeScroll {
                  0% { transform: translateX(0); left: 100%; }
                  100% { transform: translateX(-100%); left: 0; }
                }
                .marquee-track { animation: marqueeScroll 22s linear infinite; }
                .marquee-wrap:hover .marquee-track { animation-play-state: paused; }
              `}</style>
              <div className="marquee-wrap h-full overflow-hidden relative">
                <div
                  className="marquee-track flex items-center gap-3 absolute top-0 h-full whitespace-nowrap"
                  style={{ width: 'max-content' }}
                >
                  <div className="bg-white p-1 rounded-xl shadow-md flex-shrink-0" style={{ width: 36, height: 36 }}>
                    <img src={settings.admin_logo || gnitsLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span
                    className="text-base sm:text-lg font-extrabold text-white tracking-wide"
                    style={{ textShadow: '0 0 12px rgba(255,255,255,0.55), 0 0 24px rgba(99,102,241,0.45)' }}
                  >
                    Welcome To GNITS Examination IT Admin Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="relative p-1 border-2 border-[rgba(255,255,255,0.3)] rounded-full hover:border-[rgba(255,255,255,0.6)] transition-all duration-200 hover:scale-105">
              <div className="w-8 h-8 bg-[rgba(255,255,255,0.25)] rounded-full flex items-center justify-center text-white font-extrabold text-sm backdrop-blur-sm">
                IT
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-[72px] h-[calc(100vh-72px)] bg-[var(--sidebar-bg)] border-r border-[var(--border)] transition-all duration-300 overflow-hidden z-40 ${
          isCollapsed ? 'w-20' : 'w-68'
        }`}
      >
        {drawerContent}
      </div>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '72px',
          p: { xs: 2, md: 4 },
          width: '100%',
          marginLeft: isMobile ? '0px' : (drawerOpen ? '272px' : '80px'),
          transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
          minHeight: 'calc(100vh - 72px)',
          background: 'radial-gradient(ellipse at 10% 0%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(42,255,255,0.03) 0%, transparent 50%)',
        }}
      >
        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 10 }}>
          {children}
        </Container>
        <Box sx={{ mt: 'auto', pt: 4 }}>
          <FooterWithContact variant="it-admin" />
        </Box>
      </Box>
    </div>
  );
};

export default ITAdminLayout;
