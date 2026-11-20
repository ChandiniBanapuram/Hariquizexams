import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/context/AdminContext';
import { adminLoginSchema, AdminLogin } from '@/lib/validation';
import { adminAPI } from '@/lib/api';
import { Loader2, Shield, User, Lock, Eye, EyeOff, GraduationCap } from 'lucide-react';
import hariLogo from '@/assets/hari-logo.png';
import { useBranding } from '@/context/BrandingContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAdmin();
  const { settings } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLogin>({
    resolver: zodResolver(adminLoginSchema),
  });

  const onSubmit = async (data: AdminLogin) => {
    setIsLoading(true);
    try {
      const result = await adminAPI.login(data.username, data.password);
      login(result.token);
      toast({
        title: '✅ Welcome Admin!',
        description: 'Redirecting to dashboard...',
      });
      navigate('/admin/dashboard');
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
            <img src={settings.admin_logo || hariLogo} alt="HARI Logo" className="h-16 w-16 rounded-full object-contain" />
          </div>

          {/* Quick Portal Switcher */}
          <div className="flex bg-slate-800/40 border border-slate-700/50 p-1 rounded-xl mb-6">
            <Link
              to="/student/login"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all text-slate-400 hover:text-white"
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </Link>
            <div
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all bg-primary/25 text-primary border border-primary/40 shadow-sm"
            >
              <Shield className="h-4 w-4" />
              Admin
            </div>
          </div>

          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Admin Portal
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Administrator access to the exam management system
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Admin Username
              </Label>
              <Input
                id="username"
                placeholder="Enter staff ID / username"
                className="input-focus h-12"
                {...register('username')}
              />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter admin password"
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

            <Button type="submit" className="btn-primary-gradient w-full h-12 text-base mt-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 text-center text-xs text-muted-foreground space-y-1.5">
            <div>
              Are you a student?{' '}
              <Link to="/student/login" className="text-primary hover:underline font-semibold">
                Switch to Student Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
