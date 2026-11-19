import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useITAdmin } from '@/context/ITAdminContext';
import { adminLoginSchema, AdminLogin } from '@/lib/validation';
import { itAdminAPI } from '@/lib/itadmin-api';
import { Loader2, Settings, User, Lock } from 'lucide-react';
import hariLogo from '@/assets/hari-logo.png';

export default function ITAdminLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useITAdmin();
  const [isLoading, setIsLoading] = useState(false);

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
      const result = await itAdminAPI.login(data.username, data.password);
      if (result.token) {
        login(result.token);
        navigate('/it-admin/dashboard');
      } else {
        toast({
          title: 'Login Failed',
          description: result.message || 'Invalid credentials',
          variant: 'destructive',
        });
      }
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
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-card rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <img src={hariLogo} alt="HARI Logo" className="h-16 w-16 rounded-full object-contain" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-2xl font-bold text-foreground">
                IT Admin Portal
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage Departments, Sections, Years, Semesters & Subjects
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Username
              </Label>
              <Input id="username" placeholder="Enter username" className="input-focus h-12" {...register('username')} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" />
                Password
              </Label>
              <Input id="password" type="password" placeholder="Enter password" className="input-focus h-12" {...register('password')} />
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
        </div>
      </div>
    </div>
  );
}
