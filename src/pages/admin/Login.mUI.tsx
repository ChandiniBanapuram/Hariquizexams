import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, TextField, Button, Typography, Stack, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Loader2, GraduationCap, Shield, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { studentAuthAPI } from '@/lib/student-auth-api';
import LoginLayout from '@/components/LoginLayout';
import { z } from 'zod';
import { useThemeContext } from '@/context/ThemeContext';
import { useAdmin } from '@/context/AdminContext';
import { adminLoginSchema, AdminLogin } from '@/lib/validation';
import { adminAPI } from '@/lib/api';


const loginSchema = z.object({
  rollNumber: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

// ── Student Form ──────────────────────────────────────────────────────────────
function StudentForm({ isDark, onForgotPasswordClick }: { isDark: boolean; onForgotPasswordClick: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useStudentAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await studentAuthAPI.login(data.rollNumber, data.password);
      if (result.error) { toast({ title: 'Login Failed', description: result.message, variant: 'destructive' }); return; }
      login(result.token, result.student);
      toast({ title: '✅ Welcome!', description: `Logged in as ${result.student.fullName}` });
      navigate('/student/dashboard');
    } catch { toast({ title: 'Error', description: 'Login failed. Try again.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const inputSx = {
    borderRadius: '14px',
    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    '& fieldset': { border: 'none' },
    '&:hover': { border: `1.5px solid ${isDark ? 'rgba(42,255,255,0.3)' : 'rgba(42,150,255,0.3)'}` },
    '&.Mui-focused': { border: `1.5px solid ${isDark ? '#2affff' : '#3b82f6'}`, boxShadow: isDark ? '0 0 0 3px rgba(42,255,255,0.12)' : '0 0 0 3px rgba(59,130,246,0.15)' },
    transition: 'all 0.2s',
  };
  const inputProps = { color: isDark ? '#fff' : '#0f172a', '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' } };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontWeight: 700, letterSpacing: 0.5, mb: 0.8, display: 'block' }}>USERNAME (ROLL NUMBER)</Typography>
          <TextField fullWidth placeholder="e.g. 22B01A0501" error={Boolean(errors.rollNumber)} helperText={errors.rollNumber?.message} {...register('rollNumber', { onChange: (e) => { e.target.value = e.target.value.toUpperCase(); } })} InputProps={{ sx: inputSx }} inputProps={{ sx: inputProps }} />
        </Box>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontWeight: 700, letterSpacing: 0.5 }}>PASSWORD</Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#2affff' : '#3b82f6', fontWeight: 700, cursor: 'pointer', '&:hover': { opacity: 0.7 } }} onClick={onForgotPasswordClick}>Forgot password?</Typography>
          </Box>
          <TextField fullWidth type={showPassword ? 'text' : 'password'} placeholder="Enter your password" error={Boolean(errors.password)} helperText={errors.password?.message} {...register('password')} InputProps={{ endAdornment: <Box onClick={() => setShowPassword(!showPassword)} sx={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#2affff' } }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Box>, sx: inputSx }} inputProps={{ sx: inputProps }} />
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button component={Link} to="/student/register" variant="outlined" fullWidth sx={{ borderRadius: '14px', py: 1.4, fontWeight: 800, fontSize: '0.85rem', textTransform: 'none', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', '&:hover': { border: `1.5px solid ${isDark ? 'rgba(42,255,255,0.4)' : 'rgba(42,150,255,0.4)'}`, bgcolor: isDark ? 'rgba(42,255,255,0.05)' : 'rgba(42,150,255,0.05)', color: isDark ? '#2affff' : '#3b82f6', transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>Register</Button>
          <Button type="submit" disabled={isLoading} fullWidth sx={{ borderRadius: '14px', py: 1.4, fontWeight: 800, fontSize: '0.85rem', textTransform: 'none', background: isDark ? 'linear-gradient(135deg, #2affff 0%, #00c8c8 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: isDark ? '#0f172a' : '#fff', boxShadow: isDark ? '0 8px 20px rgba(42,255,255,0.25)' : '0 8px 20px rgba(59,130,246,0.3)', '&:hover': { transform: 'translateY(-2px)', boxShadow: isDark ? '0 12px 28px rgba(42,255,255,0.35)' : '0 12px 28px rgba(59,130,246,0.4)' }, '&:disabled': { opacity: 0.6 }, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>{isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// ── Admin Form ──────────────────────────────────────────────────────────────
function AdminForm({ isDark }: { isDark: boolean }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAdmin();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AdminLogin>({ resolver: zodResolver(adminLoginSchema) });

  const onSubmit = async (data: AdminLogin) => {
    setIsLoading(true);
    try {
      const result = await adminAPI.login(data.username, data.password);
      login(result.token);
      toast({ title: '✅ Welcome Admin!', description: 'Redirecting to dashboard...' });
      navigate('/admin/dashboard');
    } catch (error) {
      toast({ title: 'Login Failed', description: error instanceof Error ? error.message : 'Invalid credentials', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const inputSx = {
    borderRadius: '14px',
    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    '& fieldset': { border: 'none' },
    '&:hover': { border: '1.5px solid rgba(99,102,241,0.4)' },
    '&.Mui-focused': { border: '1.5px solid #6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' },
    transition: 'all 0.2s',
  };
  const inputProps = { color: isDark ? '#fff' : '#0f172a', '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' } };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontWeight: 700, letterSpacing: 0.5, mb: 0.8, display: 'block' }}>ADMIN USERNAME</Typography>
          <TextField fullWidth placeholder="Enter staff ID / username" error={Boolean(errors.username)} helperText={errors.username?.message} {...register('username')} InputProps={{ sx: inputSx }} inputProps={{ sx: inputProps }} />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontWeight: 700, letterSpacing: 0.5, mb: 0.8, display: 'block' }}>PASSWORD</Typography>
          <TextField fullWidth type={showPassword ? 'text' : 'password'} placeholder="Enter admin password" error={Boolean(errors.password)} helperText={errors.password?.message} {...register('password')} InputProps={{ endAdornment: <Box onClick={() => setShowPassword(!showPassword)} sx={{ cursor: 'pointer', color: 'rgba(99,102,241,0.4)', '&:hover': { color: '#6366f1' } }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Box>, sx: inputSx }} inputProps={{ sx: inputProps }} />
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
          <Button component={Link} to="/admin/register" variant="outlined" fullWidth sx={{ borderRadius: '14px', py: 1.4, fontWeight: 800, fontSize: '0.85rem', textTransform: 'none', border: '1.5px solid rgba(99,102,241,0.2)', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', '&:hover': { border: '1.5px solid rgba(99,102,241,0.5)', bgcolor: 'rgba(99,102,241,0.05)', color: '#6366f1', transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>Register</Button>
          <Button type="submit" disabled={isLoading} fullWidth sx={{ borderRadius: '14px', py: 1.4, fontWeight: 800, fontSize: '0.85rem', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', boxShadow: '0 8px 20px rgba(99,102,241,0.3)', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(99,102,241,0.4)' }, '&:disabled': { opacity: 0.6 }, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>{isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// ── Main Export (Admin default tab) ──────────────────────────────────────────
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mode } = useThemeContext();
  const isDark = mode === 'dark';
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('admin');

  // Forgot Password States
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!fpEmail) return toast({ title: 'Error', description: 'Enter your email', variant: 'destructive' });
    setFpLoading(true);
    try {
      const res = await studentAuthAPI.forgotPassword(fpEmail);
      if (res.error) {
        toast({ title: 'Email Failed', description: res.details || res.message || 'Check your SMTP settings', variant: 'destructive' });
      } else {
        toast({ title: 'OTP Sent', description: res.message || 'Check your email for the OTP.' });
        setFpStep(2);
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!fpOtp || !fpNewPassword) return toast({ title: 'Error', description: 'Fill all fields', variant: 'destructive' });
    setFpLoading(true);
    try {
      const res = await studentAuthAPI.resetPassword({ email: fpEmail, otp: fpOtp, newPassword: fpNewPassword });
      if (res.error) toast({ title: 'Failed', description: res.message, variant: 'destructive' });
      else {
        toast({ title: 'Success', description: 'Password reset successfully. You can now login.' });
        setFpOpen(false);
        setFpStep(1);
        setFpEmail(''); setFpOtp(''); setFpNewPassword('');
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <LoginLayout>
      <Box
        sx={{
          background: isDark ? 'rgba(12, 18, 40, 0.75)' : 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '28px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 32px 64px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent */}
        <Box sx={{ height: '3px', background: activeTab === 'student' ? 'linear-gradient(90deg, #2affff, #00c8c8)' : 'linear-gradient(90deg, #6366f1, #4f46e5)', transition: 'background 0.4s ease' }} />

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Tab Switcher */}
          <Box sx={{ display: 'flex', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: '14px', p: 0.5, mb: 3.5 }}>
            {(['student', 'admin'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const Icon = tab === 'student' ? GraduationCap : Shield;
              return (
                <Box key={tab} onClick={() => { setActiveTab(tab); if (tab === 'student') navigate('/student/login'); }} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.1, px: 1, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: isActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)') : 'transparent', boxShadow: isActive ? (isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)') : 'none' }}>
                  <Icon size={15} color={isActive ? (tab === 'student' ? (isDark ? '#2affff' : '#3b82f6') : '#6366f1') : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)')} />
                  <Typography sx={{ fontSize: '0.825rem', fontWeight: isActive ? 800 : 600, color: isActive ? (tab === 'student' ? (isDark ? '#2affff' : '#3b82f6') : '#6366f1') : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'), transition: 'all 0.2s', letterSpacing: 0.2 }}>
                    {tab === 'student' ? 'Student Login' : 'Admin Login'}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Title */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em', color: isDark ? '#fff' : '#0f172a', mb: 0.5, fontFamily: "'Poppins', sans-serif" }}>
              {activeTab === 'student' ? 'Student Portal' : 'Admin Portal'}
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
              {activeTab === 'student' ? 'Sign in to access your exams and coding challenges' : 'Administrator access to the exam management system'}
            </Typography>
          </Box>

          {activeTab === 'student' ? <StudentForm isDark={isDark} onForgotPasswordClick={() => setFpOpen(true)} /> : <AdminForm isDark={isDark} />}
        </Box>
      </Box>


      {/* Forgot Password Dialog */}
      <Dialog open={fpOpen} onClose={() => { if(!fpLoading) setFpOpen(false); }} PaperProps={{ sx: { background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000', borderRadius: '16px', minWidth: 350 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Forgot Password</DialogTitle>
        <DialogContent>
          {fpStep === 1 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ color: isDark ? '#aaa' : '#555' }}>
                Enter your registered Email Address. An OTP will be sent to confirm your identity.
              </Typography>
              <TextField
                fullWidth
                label="Email Address"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                InputProps={{ sx: { color: isDark ? '#fff' : '#000' } }}
                InputLabelProps={{ sx: { color: isDark ? '#aaa' : '#555' } }}
              />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ color: isDark ? '#aaa' : '#555' }}>
                Enter the OTP sent to your email and your new password.
              </Typography>
              <TextField
                fullWidth
                label="OTP"
                value={fpOtp}
                onChange={(e) => setFpOtp(e.target.value)}
                InputProps={{ sx: { color: isDark ? '#fff' : '#000' } }}
                InputLabelProps={{ sx: { color: isDark ? '#aaa' : '#555' } }}
              />
              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={fpNewPassword}
                onChange={(e) => setFpNewPassword(e.target.value)}
                InputProps={{ sx: { color: isDark ? '#fff' : '#000' } }}
                InputLabelProps={{ sx: { color: isDark ? '#aaa' : '#555' } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setFpOpen(false)} sx={{ color: isDark ? '#aaa' : '#555' }}>Cancel</Button>
          {fpStep === 1 ? (
            <Button variant="contained" onClick={handleSendOtp} disabled={fpLoading}>
              {fpLoading ? <Loader2 className="animate-spin" size={20} /> : 'Send OTP'}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleResetPassword} disabled={fpLoading}>
              {fpLoading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </LoginLayout>
  );
}
