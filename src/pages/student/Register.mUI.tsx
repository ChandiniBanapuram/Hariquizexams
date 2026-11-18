import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Typography,
  Stack,
  MenuItem,
  Select,
  FormControl,
  Link as MuiLink,
  CircularProgress,
  Grid,
} from '@mui/material';
import { useToast } from '@/hooks/use-toast';
import { useLookupData } from '@/hooks/use-lookup-data';
import { studentAuthAPI } from '@/lib/student-auth-api';
import LoginLayout from '@/components/LoginLayout';
import { z } from 'zod';

const registerSchema = z
  .object({
    rollNumber: z
      .string()
      .min(1, 'Roll number is required')
      .regex(/^[0-9]{5}[A-Z][0-9]{2}[A-Z0-9][0-9]$/, 'Invalid roll number format (e.g., 23251A6601)'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    fullName: z.string().min(1, 'Full name is required').max(100),
    department: z.string().min(1, 'Department is required'),
    section: z.string().min(1, 'Section is required'),
    year: z.string().min(1, 'Year is required'),
    semester: z.string().min(1, 'Semester is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function StudentRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { departments, sections, years, semesters } = useLookupData(true);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const result = await studentAuthAPI.register({
        rollNumber: data.rollNumber,
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        department: data.department,
        section: data.section,
        year: data.year,
        semester: data.semester,
      });

      if (result.error) {
        const errorDesc = result.backendError 
          ? `${result.message}: ${result.backendError}` 
          : result.message;
        toast({ title: 'Registration Failed', description: errorDesc, variant: 'destructive' });
        return;
      }

      toast({ title: 'Registration Successful', description: 'You can now login with your roll number and password.' });
      navigate('/student/login');
    } catch (err: any) {
      const errorMsg = err?.message || 'Registration failed. Please try again.';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginLayout>
      <Box 
        component="form" 
        onSubmit={handleSubmit(onSubmit)} 
        className="card-teal-login" 
        sx={{ 
          p: { xs: 2.5, md: 3.5 }, 
          borderRadius: '28px', 
          maxWidth: 580, 
          margin: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
        }}
      >
        <Stack spacing={2.5}>
          <Box textAlign="center">
            <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', mb: 0.5, letterSpacing: '-0.02em' }}>
              Create Account
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              Join the GNITS Online Examination Portal
            </Typography>
          </Box>

          <Grid container spacing={1.5}>
            {/* Roll Number */}
            <Grid item xs={12}>
              <Box className="pill-input-bordered">
                <input
                  placeholder="Roll Number (e.g. 23251A6601)"
                  {...register('rollNumber')}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    setValue('rollNumber', e.target.value);
                  }}
                />
              </Box>
              {errors.rollNumber && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.rollNumber.message}</Typography>}
            </Grid>

            {/* Full Name */}
            <Grid item xs={12}>
              <Box className="pill-input-bordered">
                <input
                  placeholder="Full Name"
                  {...register('fullName')}
                />
              </Box>
              {errors.fullName && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.fullName.message}</Typography>}
            </Grid>
            
            {/* Email Address */}
            <Grid item xs={12}>
              <Box className="pill-input-bordered">
                <input
                  type="email"
                  placeholder="Email Address"
                  {...register('email')}
                />
              </Box>
              {errors.email && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.email.message}</Typography>}
            </Grid>

            {/* Department */}
            <Grid item xs={12}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}>
                <Select
                  displayEmpty
                  value={watch('department') ?? ''}
                  onChange={(e) => setValue('department', e.target.value as string, { shouldValidate: true })}
                  sx={{ 
                    borderRadius: '50px', 
                    color: 'text.primary', 
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                    border: (theme) => `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    height: '44px',
                    fontSize: '0.85rem',
                    '&.Mui-focused': { borderColor: 'primary.main' },
                    '& .MuiSelect-select': { paddingLeft: '20px' },
                    '& .MuiSvgIcon-root': { color: 'text.secondary' }
                  }}
                >
                  <MenuItem value="" disabled>Select Department</MenuItem>
                  {departments.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
              {errors.department && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.department.message}</Typography>}
            </Grid>

            {/* Year, Semester, Section Row */}
            <Grid item xs={4}>
              <Select
                fullWidth
                displayEmpty
                value={watch('year') ?? ''}
                onChange={(e) => setValue('year', e.target.value as string, { shouldValidate: true })}
                sx={{ 
                  borderRadius: '50px', 
                  color: 'text.primary', 
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  border: (theme) => `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  height: '44px',
                  fontSize: '0.85rem',
                  '&.Mui-focused': { borderColor: 'primary.main' },
                  '& .MuiSelect-select': { paddingLeft: '16px' },
                  '& .MuiSvgIcon-root': { color: 'text.secondary' }
                }}
              >
                <MenuItem value="" disabled>Year</MenuItem>
                {years.map((y) => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
              </Select>
              {errors.year && <Typography variant="caption" color="error" sx={{ ml: 1, fontSize: '0.7rem' }}>{errors.year.message}</Typography>}
            </Grid>

            <Grid item xs={4}>
              <Select
                fullWidth
                displayEmpty
                value={watch('semester') ?? ''}
                onChange={(e) => setValue('semester', e.target.value as string, { shouldValidate: true })}
                sx={{ 
                  borderRadius: '50px', 
                  color: 'text.primary', 
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  border: (theme) => `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  height: '44px',
                  fontSize: '0.85rem',
                  '&.Mui-focused': { borderColor: 'primary.main' },
                  '& .MuiSelect-select': { paddingLeft: '16px' },
                  '& .MuiSvgIcon-root': { color: 'text.secondary' }
                }}
              >
                <MenuItem value="" disabled>Semester</MenuItem>
                {semesters.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
              {errors.semester && <Typography variant="caption" color="error" sx={{ ml: 1, fontSize: '0.7rem' }}>{errors.semester.message}</Typography>}
            </Grid>

            <Grid item xs={4}>
              <Select
                fullWidth
                displayEmpty
                value={watch('section') ?? ''}
                onChange={(e) => setValue('section', e.target.value as string, { shouldValidate: true })}
                sx={{ 
                  borderRadius: '50px', 
                  color: 'text.primary', 
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  border: (theme) => `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  height: '44px',
                  fontSize: '0.85rem',
                  '&.Mui-focused': { borderColor: 'primary.main' },
                  '& .MuiSelect-select': { paddingLeft: '16px' },
                  '& .MuiSvgIcon-root': { color: 'text.secondary' }
                }}
              >
                <MenuItem value="" disabled>Section</MenuItem>
                {sections.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
              {errors.section && <Typography variant="caption" color="error" sx={{ ml: 1, fontSize: '0.7rem' }}>{errors.section.message}</Typography>}
            </Grid>

            {/* Password */}
            <Grid item xs={12}>
              <Box className="pill-input-bordered">
                <input
                  type="password"
                  placeholder="Password"
                  {...register('password')}
                />
              </Box>
              {errors.password && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.password.message}</Typography>}
            </Grid>

            {/* Confirm Password */}
            <Grid item xs={12}>
              <Box className="pill-input-bordered">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  {...register('confirmPassword')}
                />
              </Box>
              {errors.confirmPassword && <Typography variant="caption" color="error" sx={{ ml: 2, fontSize: '0.7rem' }}>{errors.confirmPassword.message}</Typography>}
            </Grid>

            {/* Bottom Row Buttons */}
            <Grid item xs={12}>
              <Box className="login-footer-row" sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <MuiLink component={Link} to="/student/login" sx={{ color: 'text.primary', fontWeight: 800, fontSize: '0.8rem', '&:hover': { color: 'primary.main' } }}>
                  ALREADY REGISTERED?
                </MuiLink>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="pill-button"
                  style={{ width: '150px', padding: '12px', borderRadius: '50px', fontWeight: 800 }}
                >
                  {isLoading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'REGISTER'}
                </button>
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </LoginLayout>
  );
}
