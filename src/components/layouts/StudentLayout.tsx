import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Drawer,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Container,
  useMediaQuery,
  useTheme,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Avatar,
  Divider,
  Tooltip,
} from '@mui/material';
import DialogActions from '@mui/material/DialogActions';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  School as SchoolIcon,
  History as HistoryIcon,
  Code as CodeIcon,
  Cloud as CloudIcon,
  TrendingUp as TrendingUpIcon,
  HelpOutline as HelpIcon,
  ArrowBack as ArrowBackIcon,
  KeyboardArrowRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import gnitsLogo from '@/assets/gnits-logo.webp';
import { ThemeToggle } from '@/components/ThemeToggle';
import { studentAuthAPI } from '@/lib/student-auth-api';
import { useToast } from '@/hooks/use-toast';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { Loader2 } from 'lucide-react';
import FooterWithContact from '@/components/FooterWithContact';
import { useBranding } from '@/context/BrandingContext';

interface StudentLayoutProps {
  children: React.ReactNode;
  user?: {
    fullName?: string;
    full_name?: string;
    rollNumber?: string;
    roll_number?: string;
    department?: string;
    email?: string;
  } | null;
  onLogout: () => void;
  noPadding?: boolean;
  hideNav?: boolean;
}

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 88;

const menuGroups = [
  {
    category: ' ',
    items: [
      { label: 'Dashboard', icon: DashboardIcon, path: '/student/dashboard', color: '#6366F1' },
      { label: 'Available Quiz', icon: SchoolIcon, path: '/student/available-exams', color: '#22C55E' },
      { label: 'Previous Scores', icon: HistoryIcon, path: '/student/previous-scores', color: '#A78BFA' },
      { label: 'Coding Practice', icon: CodeIcon, path: '/student/coding-practice', color: '#3B82F6' },
      { label: 'Coding Exams', icon: CloudIcon, path: '/student/coding-exams', color: '#F59E0B' },
      { label: 'Performance', icon: TrendingUpIcon, path: '/student/performance', color: '#38BDF8' },
      { label: 'Question Banks', icon: HelpIcon, path: '/student/question-bank', color: '#EC4899' },
    ]
  }
];

const StudentLayout: React.FC<StudentLayoutProps> = ({ children, user, onLogout, noPadding, hideNav }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(() => {
    const saved = localStorage.getItem('student_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('student_sidebar_open', drawerOpen.toString());
  }, [drawerOpen]);

  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const { toast } = useToast();
  const { updateStudent } = useStudentAuth();
  const { settings } = useBranding();

  // Email Prompt States
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (user && !user.email) {
      setEmailPromptOpen(true);
    } else {
      setEmailPromptOpen(false);
    }
  }, [user]);

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      return toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
    }
    setEmailLoading(true);
    try {
      const res = await studentAuthAPI.updateEmail(newEmail);
      if (res.error) {
        toast({ title: 'Failed', description: res.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Your email has been registered.' });
        updateStudent({ email: newEmail });
        setEmailPromptOpen(false);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setEmailLoading(false);
    }
  };

  const isActiveRoute = (path: string) => location.pathname === path;

  const handleDrawerToggle = () => setDrawerOpen(prev => !prev);
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setProfileMenuAnchor(event.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  const handleLogout = () => {
    handleProfileMenuClose();
    onLogout();
    navigate('/student/login');
  };

  const isCollapsed = !drawerOpen && !isMobile;

  const displayName = user?.fullName || user?.full_name || 'Student';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const rollNumber = user?.rollNumber || user?.roll_number || '';

  // Sidebar content
  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'var(--sidebar-bg)' }}>
      {/* Menu items */}
      <Box sx={{ px: 1.5, flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 0 } }}>
        {menuGroups.map((group) => (
          <Box key={group.category} sx={{ mb: 3 }}>
            {!isCollapsed && (
              <Typography
                variant="overline"
                sx={{
                  px: 2,
                  mb: 1,
                  display: 'block',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  letterSpacing: 1.5
                }}
              >
                {group.category}
              </Typography>
            )}
            <Stack spacing={0.5}>
              {group.items.map((item) => {
                const active = isActiveRoute(item.path);
                const IconComp = item.icon;
                return (
                  <Tooltip key={item.path} title={isCollapsed ? item.label : ""} placement="right" arrow>
                    <ListItemButton
                      onClick={() => {
                        if (isMobile) {
                          setDrawerOpen(false);
                        }
                        navigate(item.path);
                      }}
                      sx={{
                        borderRadius: '14px',
                        px: 2,
                        py: 1.5,
                        position: 'relative',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        backgroundColor: active ? 'rgba(99, 102, 241, 0.08) !important' : 'transparent',
                        color: active ? '#6366F1' : 'var(--text-secondary)',
                        '&:hover': {
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                          color: '#6366F1',
                          '& .sidebar-icon-container': {
                            backgroundColor: active ? '#6366F1' : 'rgba(99, 102, 241, 0.1)',
                            backdropFilter: 'blur(8px)',
                          }
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: isCollapsed ? 0 : 44,
                          color: 'inherit',
                          display: 'flex',
                          justifyContent: 'center'
                        }}
                      >
                        <Box
                          className="sidebar-icon-container"
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? '#6366F1' : 'transparent',
                            color: active ? '#FFFFFF' : 'inherit',
                            boxShadow: active ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <IconComp sx={{ fontSize: 22 }} />
                        </Box>
                      </ListItemIcon>
                      {!isCollapsed && (
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: active ? 700 : 600,
                            color: 'inherit',
                          }}
                        />
                      )}
                      {active && !isCollapsed && (
                        <ChevronRightIcon sx={{ fontSize: 18, opacity: 0.5 }} />
                      )}
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Box>

      {/* Bottom logout */}
      <Box sx={{ p: 2, borderTop: '1px solid var(--border-subtle)' }}>
        <Tooltip title={isCollapsed ? "Sign Out" : ""} placement="right" arrow>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: '14px',
              px: 2,
              py: 1.5,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              color: '#EF4444',
              '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                '& .sidebar-icon-container': {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                }
              },
              transition: 'all 0.2s ease',
            }}
          >
            <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 44, color: 'inherit', display: 'flex', justifyContent: 'center' }}>
              <Box className="sidebar-icon-container">
                <LogoutIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Sign Out"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 700 }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* ── AppBar ────────────────────────────────────────────── */}
      {!hideNav && (
        <AppBar
          position="fixed"
          elevation={0}
          className="shadow-lg"
          sx={{
            zIndex: (t) => t.zIndex.drawer + 1,
            width: '100%',
            background: 'linear-gradient(to right, var(--primary), #3b82f6, #22c55e) !important',
          }}
        >
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', px: { xs: 2, md: 3 }, minHeight: '72px !important', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {/* Left: hamburger + logo */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, overflow: 'hidden', pr: 2 }}>
              <IconButton
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  p: '8px',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  border: '1px solid rgba(255,255,255,0.15)',
                  zIndex: 10,
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                {drawerOpen ? <CloseIcon sx={{ fontSize: 22 }} /> : <MenuIcon sx={{ fontSize: 22 }} />}
              </IconButton>

              <Box sx={{ display: { xs: 'none', sm: 'block' }, flex: 1, overflow: 'hidden', position: 'relative', height: 50, minWidth: 200 }}>
                <style>{`
                  @keyframes marqueeScrollStudent {
                    0% { transform: translateX(0); left: 100%; }
                    100% { transform: translateX(-100%); left: 0; }
                  }
                  .marquee-student-wrap:hover .marquee-student-track { animation-play-state: paused; }
                `}</style>
                <Box className="marquee-student-wrap" sx={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
                  <Stack
                    className="marquee-student-track"
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      whiteSpace: 'nowrap',
                      animation: 'marqueeScrollStudent 22s linear infinite',
                      width: 'max-content',
                    }}
                  >
                    <Box component="img" src={settings.student_logo || gnitsLogo} alt="GNITS Logo" sx={{ width: 36, height: 36, bgcolor: '#fff', p: '4px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: { xs: '0.95rem', sm: '1.05rem' },
                        color: '#ffffff',
                        letterSpacing: 0.3,
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }}
                    >
                      {settings.student_header_title || 'Welcome To GNITS Examination Student Portal'}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Stack>

            {/* Right: back + theme + profile */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Go Back" arrow>
                <IconButton
                  onClick={() => navigate(-1)}
                  sx={{
                    color: '#ffffff',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    p: '8px',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <ThemeToggle variant="header" />

              {/* Profile avatar */}
              <Tooltip title={displayName} arrow>
                <IconButton
                  onClick={handleProfileMenuOpen}
                  sx={{
                    p: 0.5,
                    border: '2px solid rgba(42,255,255,0.3)',
                    borderRadius: '50%',
                    '&:hover': { border: '2px solid rgba(42,255,255,0.6)', transform: 'scale(1.05)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #2affff 0%, #00a8a8 100%)',
                      color: '#0f172a',
                    }}
                  >
                    {initials}
                  </Avatar>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={profileMenuAnchor}
                open={Boolean(profileMenuAnchor)}
                onClose={handleProfileMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(42,255,255,0.12)',
                    borderRadius: '16px',
                    mt: 1,
                    minWidth: 200,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800 }}>
                    {displayName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 600, display: 'block' }}>
                    {rollNumber}
                  </Typography>
                  {user?.email && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500, display: 'block', mt: 0.5 }}>
                      {user.email}
                    </Typography>
                  )}
                </Box>
                <MenuItem
                  onClick={handleLogout}
                  sx={{
                    color: '#fb7185',
                    fontWeight: 700,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.5,
                    '&:hover': { background: 'rgba(251,113,133,0.1)' },
                  }}
                >
                  <LogoutIcon sx={{ mr: 1.5, fontSize: 18 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      {/* ── Sidebar Drawer ────────────────────────────────────── */}
      {!hideNav && (
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen || !isMobile}
          onClose={handleDrawerToggle}
          sx={{
            width: isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
              mt: '72px',
              height: 'calc(100% - 72px)',
              bgcolor: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--border-subtle)',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* ── Main Content ──────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: hideNav ? 0 : (noPadding ? 0 : { xs: 2, sm: 3, md: 4 }),
          width: hideNav ? '100%' : (isMobile ? '100%' : `calc(100% - ${drawerOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH}px)`),
          transition: theme.transitions.create(['width', 'margin', 'padding'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          mt: hideNav ? 0 : '70px',
          minHeight: hideNav ? '100vh' : 'calc(100vh - 70px)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'var(--background)'
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          {children}
        </Box>
        
        {!hideNav && (
          <Box sx={{ mt: 'auto', pt: 4 }}>
             {location.pathname === '/student/dashboard' && <FooterWithContact variant="student" />}
          </Box>
        )}
      </Box>

      {/* ── Email Prompt Dialog ───────────────────────────────── */}
      <Dialog
        open={emailPromptOpen}
        onClose={() => { }}
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            background: 'rgba(12, 18, 40, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(42,255,255,0.15)',
            borderRadius: '24px',
            minWidth: { xs: 300, sm: 420 },
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          },
        }}
      >
        <Box sx={{ height: '3px', background: 'linear-gradient(90deg, #2affff, #00c8c8)' }} />
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', pb: 1, color: '#fff', pt: 3 }}>
          Update Your Profile
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
              To ensure account security and enable password resets, please link an active email address to your account before continuing.
            </Typography>
            <TextField
              fullWidth
              label="Email Address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. student@gmail.com"
              InputProps={{ sx: { color: '#fff', borderRadius: '14px' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 4, justifyContent: 'center' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleUpdateEmail}
            disabled={emailLoading}
            sx={{
              py: 1.5,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2affff 0%, #00c8c8 100%)',
              color: '#0f172a',
              fontWeight: 800,
              '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 8px 24px rgba(42,255,255,0.35)' },
            }}
          >
            {emailLoading ? <Loader2 className="animate-spin" size={20} /> : 'Save Email & Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentLayout;
