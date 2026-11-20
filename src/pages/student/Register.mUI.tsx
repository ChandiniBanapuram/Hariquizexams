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
  TextField,
  Button,
  Grid,
} from '@mui/material';
import { Loader2, GraduationCap, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLookupData } from '@/hooks/use-lookup-data';
import { useThemeContext } from '@/context/ThemeContext';
import { studentAuthAPI } from '@/lib/student-auth-api';
import LoginLayout from '@/components/LoginLayout';
import { z } from 'zod';

const registerSchema = z
  .object({
    rollNumber: z
      .string()
      .min(1, 'Roll number is required')
      .regex(/^[0-9]{2}[A-Z]{2}[0-9]{6}$/, 'Invalid roll number format (e.g., 26ET103061)'),
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
  const { mode } = useThemeContext();
  const isDark = mode === 'dark';

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

      toast({ title: '✅ Registration Successful', description: 'You can now log in with your roll number and password.' });
      navigate('/student/login');
    } catch (err: any) {
      const errorMsg = err?.message || 'Registration failed. Please try again.';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputSx = {
    borderRadius: '14px',
    bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.9)',
    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    color: isDark ? '#FFFFFF' : '#0f172a',
    '& fieldset': { border: 'none' },
    '&:hover': { border: `1.5px solid ${isDark ? 'rgba(42,255,255,0.35)' : 'rgba(59,130,246,0.35)'}` },
    '&.Mui-focused': {
      border: `1.5px solid ${isDark ? '#2affff' : '#3b82f6'}`,
      boxShadow: isDark ? '0 0 0 3px rgba(42,255,255,0.15)' : '0 0 0 3px rgba(59,130,246,0.15)',
    },
    transition: 'all 0.2s ease',
  };

  const selectSx = {
    borderRadius: '14px',
    bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.9)',
    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    color: isDark ? '#FFFFFF' : '#0f172a',
    height: '52px',
    fontSize: '0.88rem',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover': { border: `1.5px solid ${isDark ? 'rgba(42,255,255,0.35)' : 'rgba(59,130,246,0.35)'}` },
    '&.Mui-focused': {
      border: `1.5px solid ${isDark ? '#2affff' : '#3b82f6'}`,
      boxShadow: isDark ? '0 0 0 3px rgba(42,255,255,0.15)' : '0 0 0 3px rgba(59,130,246,0.15)',
    },
    '& .MuiSelect-select': { paddingLeft: '16px' },
    '& .MuiSvgIcon-root': { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' },
    transition: 'all 0.2s ease',
  };

  const labelSx = {
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.75)',
    fontWeight: 700,
    letterSpacing: 0.5,
    mb: 0.7,
    display: 'block',
    fontSize: '0.72rem',
  };

  return (
    <LoginLayout maxWidth={{ xs: '100%', sm: 600, md: 680 }}>
      {/* Modern Glass Card */}
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{
          background: isDark
            ? 'rgba(12, 18, 40, 0.82)'
            : 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '28px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: isDark
            ? '0 32px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 32px 64px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          overflow: 'hidden',
          p: { xs: 3, sm: 4 },
        }}
      >
        {/* Top Accent Gradient Bar */}
        <Box
          sx={{
            height: '4px',
            background: 'linear-gradient(90deg, #2affff, #6366f1, #a855f7)',
            mx: { xs: -3, sm: -4 },
            mt: { xs: -3, sm: -4 },
            mb: { xs: 2.5, sm: 3 },
          }}
        />

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(42,255,255,0.1)' : 'rgba(59,130,246,0.1)',
              color: isDark ? '#2affff' : '#2563eb',
              border: `1.5px solid ${isDark ? 'rgba(42,255,255,0.25)' : 'rgba(59,130,246,0.25)'}`,
              mb: 1.5,
              boxShadow: isDark ? '0 0 20px rgba(42,255,255,0.2)' : '0 4px 12px rgba(59,130,246,0.15)',
            }}
          >
            <GraduationCap size={28} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 900,
              color: isDark ? '#FFFFFF' : '#0f172a',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.4rem', sm: '1.65rem' },
            }}
          >
            Student Registration
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
              fontWeight: 500,
              mt: 0.5,
              fontSize: '0.85rem',
            }}
          >
            Create your account to access exams, practice coding, and view results
          </Typography>
        </Box>

        {/* Input Fields Grid */}
        <Grid container spacing={2}>
          {/* Roll Number */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                ROLL NUMBER (USERNAME) *
              </Typography>
              <TextField
                fullWidth
                placeholder="e.g. 26ET103061"
                error={Boolean(errors.rollNumber)}
                helperText={errors.rollNumber?.message}
                {...register('rollNumber', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                    setValue('rollNumber', e.target.value);
                  },
                })}
                InputProps={{ sx: inputSx }}
                inputProps={{
                  sx: {
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    fontWeight: 600,
                    '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                  },
                }}
              />
            </Box>
          </Grid>

          {/* Full Name */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                FULL NAME *
              </Typography>
              <TextField
                fullWidth
                placeholder="Enter your full name"
                error={Boolean(errors.fullName)}
                helperText={errors.fullName?.message}
                {...register('fullName')}
                InputProps={{ sx: inputSx }}
                inputProps={{
                  sx: {
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    fontWeight: 600,
                    '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                  },
                }}
              />
            </Box>
          </Grid>

          {/* Email Address */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                EMAIL ADDRESS *
              </Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="student@example.com"
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                {...register('email')}
                InputProps={{ sx: inputSx }}
                inputProps={{
                  sx: {
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    fontWeight: 500,
                    '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                  },
                }}
              />
            </Box>
          </Grid>

          {/* Department */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                DEPARTMENT *
              </Typography>
              <FormControl fullWidth error={Boolean(errors.department)}>
                <Select
                  displayEmpty
                  value={watch('department') ?? ''}
                  onChange={(e) => setValue('department', e.target.value as string, { shouldValidate: true })}
                  sx={selectSx}
                >
                  <MenuItem value="" disabled>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: '0.88rem' }}>
                      Select Department
                    </Typography>
                  </MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.department && (
                  <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.department.message}
                  </Typography>
                )}
              </FormControl>
            </Box>
          </Grid>

          {/* Academic Row: Year, Semester, Section */}
          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                YEAR *
              </Typography>
              <FormControl fullWidth error={Boolean(errors.year)}>
                <Select
                  displayEmpty
                  value={watch('year') ?? ''}
                  onChange={(e) => setValue('year', e.target.value as string, { shouldValidate: true })}
                  sx={selectSx}
                >
                  <MenuItem value="" disabled>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: '0.88rem' }}>
                      Select Year
                    </Typography>
                  </MenuItem>
                  {years.map((y) => (
                    <MenuItem key={y.value} value={y.value}>
                      {y.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.year && (
                  <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.year.message}
                  </Typography>
                )}
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                SEMESTER *
              </Typography>
              <FormControl fullWidth error={Boolean(errors.semester)}>
                <Select
                  displayEmpty
                  value={watch('semester') ?? ''}
                  onChange={(e) => setValue('semester', e.target.value as string, { shouldValidate: true })}
                  sx={selectSx}
                >
                  <MenuItem value="" disabled>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: '0.88rem' }}>
                      Select Semester
                    </Typography>
                  </MenuItem>
                  {semesters.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.semester && (
                  <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.semester.message}
                  </Typography>
                )}
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                SECTION *
              </Typography>
              <FormControl fullWidth error={Boolean(errors.section)}>
                <Select
                  displayEmpty
                  value={watch('section') ?? ''}
                  onChange={(e) => setValue('section', e.target.value as string, { shouldValidate: true })}
                  sx={selectSx}
                >
                  <MenuItem value="" disabled>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: '0.88rem' }}>
                      Select Section
                    </Typography>
                  </MenuItem>
                  {sections.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.section && (
                  <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.section.message}
                  </Typography>
                )}
              </FormControl>
            </Box>
          </Grid>

          {/* Password */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                PASSWORD *
              </Typography>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
                InputProps={{
                  endAdornment: (
                    <Box
                      onClick={() => setShowPassword(!showPassword)}
                      sx={{
                        cursor: 'pointer',
                        color: isDark ? 'rgba(42,255,255,0.6)' : 'rgba(59,130,246,0.6)',
                        '&:hover': { color: isDark ? '#2affff' : '#2563eb' },
                        display: 'flex',
                        alignItems: 'center',
                        mr: 0.5,
                      }}
                    >
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </Box>
                  ),
                  sx: inputSx,
                }}
                inputProps={{
                  sx: {
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                  },
                }}
              />
            </Box>
          </Grid>

          {/* Confirm Password */}
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" sx={labelSx}>
                CONFIRM PASSWORD *
              </Typography>
              <TextField
                fullWidth
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
                InputProps={{
                  endAdornment: (
                    <Box
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      sx={{
                        cursor: 'pointer',
                        color: isDark ? 'rgba(42,255,255,0.6)' : 'rgba(59,130,246,0.6)',
                        '&:hover': { color: isDark ? '#2affff' : '#2563eb' },
                        display: 'flex',
                        alignItems: 'center',
                        mr: 0.5,
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </Box>
                  ),
                  sx: inputSx,
                }}
                inputProps={{
                  sx: {
                    color: isDark ? '#FFFFFF' : '#0f172a',
                    '&::placeholder': { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                  },
                }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Action Controls */}
        <Box sx={{ mt: 3.5, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems="center"
          >
            <Button
              component={Link}
              to="/student/login"
              startIcon={<ArrowLeft size={16} />}
              sx={{
                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: '12px',
                px: 2,
                py: 1,
                '&:hover': {
                  color: isDark ? '#2affff' : '#2563eb',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              Already registered? Sign In
            </Button>

            <Button
              type="submit"
              disabled={isLoading}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                minWidth: 180,
                borderRadius: '14px',
                py: 1.3,
                px: 3.5,
                fontWeight: 800,
                fontSize: '0.92rem',
                textTransform: 'none',
                letterSpacing: 0.3,
                background: isDark
                  ? 'linear-gradient(135deg, #2affff 0%, #00b4d8 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: isDark ? '#0a1128' : '#ffffff',
                boxShadow: isDark
                  ? '0 8px 24px rgba(42,255,255,0.3)'
                  : '0 8px 24px rgba(37,99,235,0.3)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDark
                    ? '0 12px 30px rgba(42,255,255,0.45)'
                    : '0 12px 30px rgba(37,99,235,0.45)',
                },
                '&:disabled': { opacity: 0.6 },
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {isLoading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Registering...</span>
                </Stack>
              ) : (
                'Create Account'
              )}
            </Button>
          </Stack>
        </Box>
      </Box>
    </LoginLayout>
  );
}
