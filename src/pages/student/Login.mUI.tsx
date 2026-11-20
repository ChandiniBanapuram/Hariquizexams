import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { studentAuthAPI } from '@/lib/student-auth-api';
import { z } from 'zod';
import { Loader2, GraduationCap, Shield, User, Lock, Eye, EyeOff } from 'lucide-react';
import hariLogo from '@/assets/hari-logo.png';
import { useBranding } from '@/context/BrandingContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const loginSchema = z.object({
  rollNumber: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function StudentLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useStudentAuth();
  const { settings } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password States
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await studentAuthAPI.login(data.rollNumber, data.password);
      if (result.error) {
        toast({
          title: 'Login Failed',
          description: result.message,
          variant: 'destructive',
        });
        return;
      }
      login(result.token, result.student);
      toast({
        title: '✅ Welcome!',
        description: `Logged in as ${result.student.fullName}`,
      });
      if (result.student.isMaster) {
        navigate('/student/master-dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Login failed. Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!fpEmail.trim()) {
      return toast({ title: 'Error', description: 'Enter your registered email', variant: 'destructive' });
    }
    setFpLoading(true);
    try {
      const res = await studentAuthAPI.forgotPassword(fpEmail.trim());
      if (res.error) {
        toast({
          title: 'Email Failed',
          description: res.details || res.message || 'Check your SMTP settings',
          variant: 'destructive',
        });
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
    if (!fpOtp.trim() || !fpNewPassword.trim()) {
      return toast({ title: 'Error', description: 'Please fill in both OTP and new password', variant: 'destructive' });
    }
    setFpLoading(true);
    try {
      const res = await studentAuthAPI.resetPassword({
        email: fpEmail.trim(),
        otp: fpOtp.trim(),
        newPassword: fpNewPassword.trim(),
      });
      if (res.error) {
        toast({ title: 'Failed', description: res.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Password reset successfully. You can now login.' });
        setFpOpen(false);
        setFpStep(1);
        setFpEmail('');
        setFpOtp('');
        setFpNewPassword('');
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background Video */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover"
        >
          <source src="/hari-video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-8">
          {/* Logo Badge */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted border border-border/60 p-2 shadow-inner">
            <img src={settings.student_logo || hariLogo} alt="HARI Logo" className="h-16 w-16 rounded-full object-contain" />
          </div>

          {/* Quick Portal Switcher */}
          <div className="flex bg-slate-800/40 border border-slate-700/50 p-1 rounded-xl mb-6">
            <div
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all bg-primary/25 text-primary border border-primary/40 shadow-sm"
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </div>
            <Link
              to="/admin"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all text-slate-400 hover:text-white"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          </div>

          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Student Portal
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Sign in to access your exams and coding challenges
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rollNumber" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Username (Roll Number)
              </Label>
              <Input
                id="rollNumber"
                placeholder="e.g. 26ET103061"
                className="input-focus h-12 uppercase"
                {...register('rollNumber', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
              {errors.rollNumber && <p className="text-sm text-destructive">{errors.rollNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-primary" />
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setFpOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="input-focus h-12 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/student/register')}
                className="w-1/2 h-12 text-base font-semibold border-border/60 hover:bg-white/10"
              >
                Register
              </Button>
              <Button
                type="submit"
                className="btn-primary-gradient w-1/2 h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 text-center text-xs text-muted-foreground space-y-1.5">
            <div>
              Administrator?{' '}
              <Link to="/admin" className="text-primary hover:underline font-semibold">
                Switch to Admin Login
              </Link>
            </div>
            <div>
              IT Administrator?{' '}
              <Link to="/it-admin" className="text-muted-foreground/75 hover:text-foreground hover:underline">
                IT Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={fpOpen} onOpenChange={(open) => { if (!fpLoading) setFpOpen(open); }}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border border-border/50">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-xl">Reset Password</DialogTitle>
            <DialogDescription>
              {fpStep === 1
                ? 'Enter your registered email address to receive a verification OTP.'
                : 'Enter the verification OTP and your new password.'}
            </DialogDescription>
          </DialogHeader>

          {fpStep === 1 ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fpEmail">Registered Email</Label>
                <Input
                  id="fpEmail"
                  type="email"
                  placeholder="student@example.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  className="input-focus h-11"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fpOtp">Verification OTP</Label>
                <Input
                  id="fpOtp"
                  placeholder="Enter 6-digit OTP"
                  value={fpOtp}
                  onChange={(e) => setFpOtp(e.target.value)}
                  className="input-focus h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fpNewPassword">New Password</Label>
                <Input
                  id="fpNewPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={fpNewPassword}
                  onChange={(e) => setFpNewPassword(e.target.value)}
                  className="input-focus h-11"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFpOpen(false)}
              disabled={fpLoading}
            >
              Cancel
            </Button>
            {fpStep === 1 ? (
              <Button
                type="button"
                onClick={handleSendOtp}
                disabled={fpLoading}
                className="btn-primary-gradient"
              >
                {fpLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                Send OTP
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleResetPassword}
                disabled={fpLoading}
                className="btn-primary-gradient"
              >
                {fpLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                Reset Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
