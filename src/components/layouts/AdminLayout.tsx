import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Container, useMediaQuery, useTheme, Menu, MenuItem, Divider, Typography } from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  SpaceDashboard as DashboardIcon,
  Quiz as QuizIcon,
  Code as CodeIcon,
  Terminal as CodingExamIcon,
  LibraryBooks as QuestionBankIcon,
  ExpandLess,
  ExpandMore,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import hariLogo from '@/assets/hari-logo.png';
import { ThemeToggle } from '../ThemeToggle';
import FooterWithContact from '@/components/FooterWithContact';
import { useBranding } from '@/context/BrandingContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const adminMenu = [
  {
    category: ' ',
    items: [
      {
        title: 'Dashboard',
        path: '/admin/dashboard',
        icon: DashboardIcon,
        color: '#6366F1',
      },
      {
        title: 'Quiz Exams',
        icon: QuizIcon,
        color: '#22C55E',
        children: [
          { title: 'Questions', path: '/admin/quiz-questions' },
          { title: 'Responses', path: '/admin/quiz-responses' },
          { title: 'Manage Status', path: '/admin/exams?tab=quiz' },
        ],
      },
      {
        title: 'Coding Practice',
        icon: CodeIcon,
        color: '#3B82F6',
        children: [
          { title: 'Questions', path: '/admin/coding-practice-questions' },
          { title: 'Responses', path: '/admin/coding-practice-responses' },
        ],
      },
      {
        title: 'Coding Exams',
        icon: CodingExamIcon,
        color: '#F59E0B',
        children: [
          { title: 'Questions', path: '/admin/coding-exam-questions' },
          { title: 'Responses', path: '/admin/coding-exam-responses' },
          { title: 'Manage Status', path: '/admin/exams?tab=coding' },
        ],
      },
      {
        title: 'Question Banks',
        path: '/admin/question-banks',
        icon: QuestionBankIcon,
        color: '#EC4899',
      },
      {
        title: 'Event Registration',
        icon: EventNoteIcon,
        color: '#F59E0B',
        children: [
          { title: 'Workshops', path: '/admin/workshops' },
          { title: 'Workshop Registrations', path: '/admin/workshop-registrations' },
          { title: 'FDPs', path: '/admin/fdps' },
          { title: 'FDP Registrations', path: '/admin/fdp-registrations' },
        ],
      },
    ]
  },
];

const DRAWER_WIDTH = 272;

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onLogout }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { settings } = useBranding();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  const toggleSubmenu = (title: string) =>
    setOpenSubmenus((prev) => ({ ...prev, [title]: !prev[title] }));

  const isActiveRoute = (path: string) => location.pathname === path;
  const isActiveGroup = (children?: { path: string }[]) =>
    children?.some((c) => location.pathname === c.path) ?? false;

  const handleDrawerToggle = () => setDrawerOpen(prev => !prev);
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setProfileMenuAnchor(event.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  const handleLogout = () => {
    handleProfileMenuClose();
    onLogout();
    navigate('/admin');
  };

  const adminToken = localStorage.getItem('adminToken');
  let loginName = 'Admin';
  let adminDept = '';
  if (adminToken) {
    try {
      const payload = JSON.parse(atob(adminToken.split('.')[1]));
      if (payload) {
        if (payload.username) loginName = payload.username;
        if (payload.department) adminDept = payload.department;
      }
    } catch (e) {
      console.error(e);
    }
  }

  const isCollapsed = !drawerOpen;

  const drawerContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Nav items */}
      <div className="px-3 flex-1 overflow-y-auto">
        {adminMenu.map((group) => (
          <div key={group.category} className="mb-8">
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {group.category}
              </h3>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children);
                const isOpen = openSubmenus[item.title];
                const groupActive = hasChildren && isActiveGroup(item.children);
                const leafActive = !hasChildren && isActiveRoute(item.path || '');
                const active = groupActive || leafActive;
                const IconComp = item.icon;

                return (
                  <div key={item.title}>
                    <button
                      title={isCollapsed ? item.title : ''}
                      onClick={() => {
                        if (hasChildren) {
                          if (isCollapsed) handleDrawerToggle();
                          toggleSubmenu(item.title);
                        } else {
                          setDrawerOpen(false);
                          navigate(item.path || '');
                        }
                      }}
                      className={`w-full flex items-center rounded-xl px-3 py-3 mb-1 relative transition-all duration-200 group ${isCollapsed ? 'justify-center' : 'justify-start gap-3'
                        } ${active
                          ? 'bg-[rgba(99,102,241,0.1)] text-[var(--primary)] shadow-[var(--shadow-glow)]'
                          : 'text-[var(--text-secondary)] hover:bg-[rgba(99,102,241,0.06)] hover:text-[var(--primary)] hover:translate-x-0.5'
                        }`}
                    >
                      <div
                        className={`sidebar-icon-container ${active ? 'bg-[var(--primary)] text-white shadow-lg' : ''
                          }`}
                      >
                        <IconComp style={{ fontSize: 20 }} />
                      </div>

                      {!isCollapsed && (
                        <span className={`text-sm font-medium ${active ? 'font-semibold' : ''}`}>
                          {item.title}
                        </span>
                      )}
                      {!isCollapsed && hasChildren && (
                        isOpen ? <ExpandLess className="ml-auto text-sm opacity-60" /> : <ExpandMore className="ml-auto text-sm opacity-60" />
                      )}
                      {active && !hasChildren && (
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-3/5 bg-[var(--primary)] rounded-r-md"></div>
                      )}
                    </button>

                    {hasChildren && !isCollapsed && (
                      <div
                        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                      >
                        <div className="pl-12 pr-3 space-y-1">
                          {item.children!.map((child) => {
                            const childActive = isActiveRoute(child.path);
                            return (
                              <button
                                key={child.path}
                                onClick={() => {
                                  setDrawerOpen(false);
                                  navigate(child.path);
                                }}
                                className={`w-full flex items-center py-2.5 px-3 rounded-lg text-sm transition-all duration-200 ${childActive
                                  ? 'text-[var(--primary)] bg-[rgba(99,102,241,0.08)] font-semibold'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[rgba(99,102,241,0.04)]'
                                  }`}
                              >
                                <span>{child.title}</span>
                                {childActive && <ChevronRightIcon className="ml-auto text-xs opacity-70" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom logout */}
      <div className="p-3 pt-4 border-t border-[var(--border)]">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center rounded-xl px-3 py-3 transition-all duration-200 ${isCollapsed ? 'justify-center' : 'justify-start gap-3'
            } text-red-500 hover:bg-[rgba(239,68,68,0.08)]`}
        >
          <div className="sidebar-icon-container">
            <LogoutIcon style={{ fontSize: 20 }} />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-semibold">Sign Out</span>
          )}
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
          alignItems: 'center'
        }}
      >
        <div
          className="flex items-center justify-between px-6 w-full"
          style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          {/* Left: Toggle & Marquee */}
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
                    <img src={settings.admin_logo || hariLogo} alt="HARI Logo" className="w-full h-full object-contain" />
                  </div>
                  <span
                    className="text-base sm:text-lg font-extrabold text-white tracking-wide"
                    style={{ textShadow: '0 0 12px rgba(255,255,255,0.55), 0 0 24px rgba(99,102,241,0.45)' }}
                  >
                    {settings.admin_header_title || 'Welcome To HARI Examination Admin Portal'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Theme toggle + Avatar */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button 
              onClick={handleProfileMenuOpen}
              className="relative p-[3px] border-[2px] border-[rgba(42,255,255,0.3)] rounded-full hover:border-[rgba(42,255,255,0.6)] transition-all duration-200 hover:scale-105"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#2affff] to-[#00a8a8] text-[#0f172a] rounded-full flex items-center justify-center font-black text-[0.8rem]">
                {loginName.slice(0, 2).toUpperCase()}
              </div>
            </button>
            <Menu
              anchorEl={profileMenuAnchor}
              open={Boolean(profileMenuAnchor)}
              onClose={handleProfileMenuClose}
              onClick={handleProfileMenuClose}
              PaperProps={{
                sx: {
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(42,255,255,0.12)',
                  borderRadius: '16px',
                  mt: 1.5,
                  minWidth: 200,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800 }}>
                  {loginName.toUpperCase()}
                </Typography>
              </Box>
              <MenuItem 
                onClick={handleLogout}
                sx={{ 
                  color: '#fff', 
                  fontWeight: 700, 
                  borderRadius: '8px',
                  mx: 1,
                  my: 0.5,
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.05)'
                  }
                }}
              >
                <LogoutIcon sx={{ mr: 1.5, fontSize: 18 }} />
                <span>Sign Out</span>
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-[72px] h-[calc(100vh-72px)] bg-[var(--sidebar-bg)] border-r border-[var(--border)] transition-all duration-300 overflow-hidden z-40 ${isCollapsed ? 'w-20' : 'w-68'
          }`}
      >
        {drawerContent}
      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
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
          {location.pathname === '/admin/dashboard' && <FooterWithContact variant="admin" />}
        </Box>
      </Box>
    </div>
  );
};

export default AdminLayout;
