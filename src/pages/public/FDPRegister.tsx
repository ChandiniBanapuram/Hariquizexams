import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Typography, TextField, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Stack,
  Divider, Chip, Alert, Avatar,
  LinearProgress,
} from '@mui/material';
import {
  School as SchoolIcon, CheckCircle as SuccessIcon,
  ArrowForward as NextIcon, ArrowBack as BackIcon,
  School as StudentIcon, Work as StaffIcon,
  Payment as PaymentIcon,
  PhoneAndroid as PhoneIcon, Email as EmailIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import { fdpStore, fdpRegStore, type FDP } from '@/lib/events-store';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const DEPARTMENTS = ['CSE', 'CSE(AI&ML)', 'CSE(DataScience)', 'IT', 'ECE', 'EEE', 'ETM'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SEMESTERS = ['I Sem', 'II Sem'];
const DESIGNATIONS = ['Professor', 'Assoc Professor', 'Asst Professor', 'Programmer'];
const ROLL_REGEX = /^\d{5}[A-Z]\d{4}$/;

/* ─── UPI deep links ─────────────────────────────────────────────────────── */
const UPI_APPS = [
  {
    id: 'phonepe', label: 'PhonePe', color: '#5f259f',
    gradient: 'linear-gradient(135deg,#5f259f,#8b2fc9)', emoji: '💜',
    scheme: (upiId: string, amount: number, name: string) =>
      `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`,
  },
  {
    id: 'gpay', label: 'Google Pay', color: '#1a73e8',
    gradient: 'linear-gradient(135deg,#1a73e8,#34a853)', emoji: '🔵',
    scheme: (upiId: string, amount: number, name: string) =>
      `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`,
  },
  {
    id: 'paytm', label: 'Paytm', color: '#00baf2',
    gradient: 'linear-gradient(135deg,#00baf2,#0079c1)', emoji: '💙',
    scheme: (upiId: string, amount: number, name: string) =>
      `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`,
  },
];

declare global { interface Window { Razorpay: any; } }

// TODO: Replace with real SMS / Email API
async function sendSMSConfirmation(mobile: string, name: string, eventName: string) {
  console.log(`[SMS] To ${mobile}: Dear ${name}, your FDP registration for ${eventName} is confirmed! - GNITS`);
}
async function sendEmailConfirmation(email: string, name: string, eventName: string) {
  console.log(`[EMAIL] To ${email}: FDP registration confirmed for ${eventName} - GNITS`);
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function FDPRegister() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [fdp, setFdp] = useState<FDP | null>(null);
  const [step, setStep] = useState<'role' | 'details' | 'payment' | 'success'>('details');
  const [role, setRole] = useState<'student' | 'staff'>('staff');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingPay, setProcessingPay] = useState(false);

  /* Student fields */
  const [sName, setSName] = useState('');
  const [sRoll, setSRoll] = useState('');
  const [sDept, setSDept] = useState('');
  const [sYear, setSYear] = useState('');
  const [sSem, setSSem] = useState('');
  const [sMobile, setSMobile] = useState('+91 ');
  const [sEmail, setSEmail] = useState('');

  /* Staff fields */
  const [stName, setStName] = useState('');
  const [stEmpId, setStEmpId] = useState('');
  const [stDept, setStDept] = useState('');
  const [stDesig, setStDesig] = useState('');
  const [stMobile, setStMobile] = useState('+91 ');
  const [stEmail, setStEmail] = useState('');

  useEffect(() => {
    if (!id) return;
    const f = fdpStore.getById(id);
    if (!f || !f.isActive) { navigate('/'); return; }
    setFdp(f);
    if (f.audience === 'Students') { setRole('student'); setStep('details'); }
    else if (f.audience === 'Staff') { setRole('staff'); setStep('details'); }
    else { setStep('role'); }
  }, [id, navigate]);

  useEffect(() => {
    if (!document.getElementById('rzp-script')) {
      const s = document.createElement('script');
      s.id = 'rzp-script';
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(s);
    }
  }, []);

  const mobile = role === 'student' ? sMobile : stMobile;
  const email = role === 'student' ? sEmail : stEmail;
  const name = role === 'student' ? sName : stName;

  const validateDetails = () => {
    if (role === 'student') {
      if (!sName) return 'Please enter your full name.';
      if (!ROLL_REGEX.test(sRoll)) return 'Roll number must be like 23251A6601 (5 digits + 1 uppercase letter + 4 digits).';
      if (!sDept) return 'Please select your department.';
      if (!sYear) return 'Please select your year.';
      if (!sSem) return 'Please select your semester.';
      if (sMobile.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number.';
      if (!/\S+@\S+\.\S+/.test(sEmail)) return 'Enter a valid email address.';
    } else {
      if (!stName) return 'Please enter your full name.';
      if (!stEmpId) return 'Please enter your Employee ID.';
      if (!stDept) return 'Please select your department.';
      if (!stDesig) return 'Please select your designation.';
      if (stMobile.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number.';
      if (!/\S+@\S+\.\S+/.test(stEmail)) return 'Enter a valid email address.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateDetails();
    if (err) { setError(err); return; }
    setError('');
    if (fdp!.amount === 0) submitRegistration('Free');
    else setStep('payment');
  };

  const submitRegistration = async (paymentMethod: string) => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 500));
    fdpRegStore.add({
      fdpId: fdp!.id,
      fdpName: fdp!.name,
      registrantType: role,
      name,
      rollNumber: role === 'student' ? sRoll : undefined,
      year: role === 'student' ? sYear : undefined,
      semester: role === 'student' ? sSem : undefined,
      employeeId: role === 'staff' ? stEmpId : undefined,
      designation: role === 'staff' ? stDesig : undefined,
      department: role === 'student' ? sDept : stDept,
      mobile,
      email,
      paymentStatus: fdp!.amount === 0 ? 'Approved' : 'Pending',
      paymentScreenshot: '',
      paymentMethod,
    });
    await sendSMSConfirmation(mobile, name, fdp!.name);
    await sendEmailConfirmation(email, name, fdp!.name);
    setSubmitting(false);
    setStep('success');
  };

  const openRazorpay = () => {
    if (!window.Razorpay) { setError('Payment gateway not loaded. Please refresh.'); return; }
    setProcessingPay(true);
    const options = {
      key: 'rzp_test_yourkeyhere', // 🔑 Replace with your Razorpay Test Key
      amount: (fdp?.amount ?? 0) * 100,
      currency: 'INR',
      name: 'GNITS',
      description: `FDP: ${fdp?.name}`,
      image: '/favicon.ico',
      handler: async (response: any) => {
        console.log('[Razorpay] Payment success:', response);
        setProcessingPay(false);
        await submitRegistration('Razorpay');
      },
      prefill: { name, email, contact: mobile.replace(/\D/g, '').slice(-10) },
      theme: { color: '#8b5cf6' },
      modal: { ondismiss: () => setProcessingPay(false) },
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', () => { setProcessingPay(false); setError('Payment failed. Please try again.'); });
    rzp.open();
  };

  const openUpiApp = (app: typeof UPI_APPS[0]) => {
    const upiId = fdp?.upiId || 'gnits@upi';
    window.location.href = app.scheme(upiId, fdp?.amount ?? 0, `GNITS ${fdp?.name}`);
  };

  /* ── Styles ─────────────────────────────────────────────────────────────── */
  const inputSx = {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(139,92,246,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
  };
  const labelSx = { color: 'rgba(255,255,255,0.5)' };
  const selectSx = {
    color: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(139,92,246,0.5)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
    '& .MuiSvgIcon-root': { color: '#fff' },
  };

  if (!fdp) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <CircularProgress sx={{ color: '#8b5cf6' }} />
    </Box>
  );

  const stepIndex: Record<string, number> = { role: 0, details: 1, payment: 2, success: 3 };
  const progress = (stepIndex[step] / 3) * 100;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1a0a2e 50%, #0f172a 100%)', py: 4, px: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 620 }}>

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          {fdp.brochureUrl ? (
            <Box component="img" src={fdp.brochureUrl} alt="Brochure"
              sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 3, mb: 2, border: '1px solid rgba(255,255,255,0.1)' }} />
          ) : (
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2, boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
              <SchoolIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
          )}
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>FDP Registration</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>G. Narayanamma Institute of Technology & Science</Typography>
        </Box>

        {/* Progress bar */}
        {step !== 'success' && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress variant="determinate" value={progress}
              sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#8b5cf6,#3b82f6)', borderRadius: 3 } }} />
            <Stack direction="row" justifyContent="space-between" mt={0.5}>
              {['Role', 'Details', 'Payment'].map((lbl, i) => (
                <Typography key={lbl} variant="caption" sx={{ color: stepIndex[step] > i ? '#8b5cf6' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.65rem' }}>{lbl}</Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* FDP Info */}
        <Card sx={{ borderRadius: 3, p: 2.5, mb: 3, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>{fdp.name}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Chip label={fdp.department} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#a5b4fc', fontSize: '0.7rem' }} />
            <Chip label={fdp.audience} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: '0.7rem' }} />
            <Chip label={fdp.amount === 0 ? 'Free' : `₹${fdp.amount}`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '0.7rem' }} />
          </Stack>
          <Stack spacing={0.3}>
            {[
              ['📍 Venue', fdp.venue],
              ['📅 Date', `${fdp.startDate}${fdp.endDate && fdp.endDate !== fdp.startDate ? ` → ${fdp.endDate}` : ''}`],
              ['⏰ Timings', fdp.timings],
              ['📆 Days', `${fdp.numberOfDays} day(s)`],
              ['👤 Resource Person', fdp.resourcePerson],
              ['🗓️ Last Date', fdp.lastDateRegistration || '—'],
            ].map(([k, v]) => (
              <Typography key={k} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{k}:</strong> {v}
              </Typography>
            ))}
          </Stack>
          {fdp.description && <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}><Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{fdp.description}</Typography></Box>}
        </Card>

        {/* ─── STEP: ROLE ──────────────────────────────────────────────────── */}
        {step === 'role' && (
          <Card sx={{ borderRadius: 3, p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', mb: 3, textAlign: 'center' }}>
              Are you registering as a…
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
              {[
                { value: 'student', label: 'Student', icon: <StudentIcon sx={{ fontSize: 32 }} />, grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
                { value: 'staff', label: 'Staff / Faculty', icon: <StaffIcon sx={{ fontSize: 32 }} />, grad: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' },
              ].map(opt => (
                <Box key={opt.value} onClick={() => setRole(opt.value as any)}
                  sx={{
                    flex: 1, p: 3, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                    border: '2px solid', transition: 'all 0.2s',
                    borderColor: role === opt.value ? 'transparent' : 'rgba(255,255,255,0.1)',
                    background: role === opt.value ? opt.grad : 'rgba(255,255,255,0.03)',
                    boxShadow: role === opt.value ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                    transform: role === opt.value ? 'translateY(-2px)' : 'none',
                  }}>
                  <Box sx={{ color: role === opt.value ? '#fff' : 'rgba(255,255,255,0.4)', mb: 1 }}>{opt.icon}</Box>
                  <Typography sx={{ color: role === opt.value ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{opt.label}</Typography>
                </Box>
              ))}
            </Stack>
            <Button fullWidth variant="contained" size="large" endIcon={<NextIcon />}
              onClick={() => setStep('details')}
              sx={{ py: 1.5, fontWeight: 800, borderRadius: 2, background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', '&:hover': { opacity: 0.9 } }}>
              Continue as {role === 'student' ? 'Student' : 'Staff'}
            </Button>
          </Card>
        )}

        {/* ─── STEP: DETAILS ───────────────────────────────────────────────── */}
        {step === 'details' && (
          <Card sx={{ borderRadius: 3, p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
              <Avatar sx={{ width: 32, height: 32, background: role === 'student' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}>
                {role === 'student' ? <StudentIcon sx={{ fontSize: 18 }} /> : <StaffIcon sx={{ fontSize: 18 }} />}
              </Avatar>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                {role === 'student' ? 'Student Details' : 'Staff Details'}
              </Typography>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            {role === 'student' ? (
              <Stack spacing={2}>
                <TextField fullWidth size="small" label="Full Name *"
                  value={sName} onChange={e => setSName(e.target.value.toUpperCase())}
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }} />
                <TextField fullWidth size="small" label="Roll Number * (e.g. 23251A6601)"
                  value={sRoll} onChange={e => setSRoll(e.target.value.toUpperCase())}
                  helperText="Format: 5 digits + 1 uppercase letter + 4 digits"
                  FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }} />
                <FormControl fullWidth size="small">
                  <InputLabel sx={labelSx}>Department *</InputLabel>
                  <Select value={sDept} onChange={e => setSDept(e.target.value)} label="Department *" sx={selectSx}>
                    {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={labelSx}>Year *</InputLabel>
                    <Select value={sYear} onChange={e => setSYear(e.target.value)} label="Year *" sx={selectSx}>
                      {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={labelSx}>Semester *</InputLabel>
                    <Select value={sSem} onChange={e => setSSem(e.target.value)} label="Semester *" sx={selectSx}>
                      {SEMESTERS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
                <TextField fullWidth size="small" label="Mobile Number * (+91 XXXXXXXXXX)"
                  value={sMobile}
                  onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(-10); setSMobile(d ? `+91 ${d}` : '+91 '); }}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }}
                  InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 0.5 }} /> }} />
                <TextField fullWidth size="small" type="email" label="Email ID *"
                  value={sEmail} onChange={e => setSEmail(e.target.value)}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }}
                  InputProps={{ startAdornment: <EmailIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 0.5 }} /> }} />
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TextField fullWidth size="small" label="Full Name *"
                  value={stName} onChange={e => setStName(e.target.value.toUpperCase())}
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }} />
                <TextField fullWidth size="small" label="Employee ID *"
                  value={stEmpId} onChange={e => setStEmpId(e.target.value)}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }} />
                <FormControl fullWidth size="small">
                  <InputLabel sx={labelSx}>Department *</InputLabel>
                  <Select value={stDept} onChange={e => setStDept(e.target.value)} label="Department *" sx={selectSx}>
                    {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel sx={labelSx}>Designation *</InputLabel>
                  <Select value={stDesig} onChange={e => setStDesig(e.target.value)} label="Designation *" sx={selectSx}>
                    {DESIGNATIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth size="small" label="Mobile Number * (+91 XXXXXXXXXX)"
                  value={stMobile}
                  onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(-10); setStMobile(d ? `+91 ${d}` : '+91 '); }}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }}
                  InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 0.5 }} /> }} />
                <TextField fullWidth size="small" type="email" label="Email ID *"
                  value={stEmail} onChange={e => setStEmail(e.target.value)}
                  InputLabelProps={{ sx: labelSx }} sx={{ '& .MuiOutlinedInput-root': inputSx }}
                  InputProps={{ startAdornment: <EmailIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 0.5 }} /> }} />
              </Stack>
            )}

            <Stack direction="row" spacing={2} mt={3}>
              {fdp.audience === 'Both Students And Staff' && (
                <Button variant="outlined" startIcon={<BackIcon />} onClick={() => { setStep('role'); setError(''); }}
                  sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}>Back</Button>
              )}
              <Button fullWidth variant="contained" size="large" endIcon={<NextIcon />}
                onClick={handleNext} disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
                sx={{ py: 1.5, fontWeight: 800, borderRadius: 2, background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', '&:hover': { opacity: 0.9 } }}>
                {submitting ? 'Submitting…' : fdp.amount === 0 ? 'Submit Registration (Free)' : 'Next — Payment'}
              </Button>
            </Stack>
          </Card>
        )}

        {/* ─── STEP: PAYMENT ───────────────────────────────────────────────── */}
        {step === 'payment' && fdp.amount > 0 && (
          <Card sx={{ borderRadius: 3, p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}>
                <PaymentIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>Complete Payment</Typography>
            </Stack>

            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', mb: 0.5 }}>Registration Fee</Typography>
              <Typography sx={{ color: '#8b5cf6', fontWeight: 900, fontSize: '2.5rem', lineHeight: 1 }}>₹{fdp.amount}</Typography>
            </Box>

            {fdp.qrCodeUrl && (
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1.5, fontWeight: 600 }}>Scan QR Code to Pay</Typography>
                <Box component="img" src={fdp.qrCodeUrl} alt="QR"
                  sx={{ width: 160, height: 160, borderRadius: 3, border: '3px solid rgba(139,92,246,0.4)', objectFit: 'contain', bgcolor: '#fff', p: 1, mx: 'auto', display: 'block', boxShadow: '0 0 30px rgba(139,92,246,0.2)' }} />
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', px: 1 }}>Or pay using</Typography>
            </Divider>

            <Stack spacing={1.5} sx={{ mb: 2.5 }}>
              {UPI_APPS.map(app => (
                <Button key={app.id} fullWidth variant="contained" size="large"
                  onClick={() => openUpiApp(app)}
                  sx={{ py: 1.4, fontWeight: 800, borderRadius: 2, fontSize: '1rem', background: app.gradient, boxShadow: `0 4px 16px ${app.color}40`, '&:hover': { opacity: 0.9, transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>
                  {app.emoji}&nbsp;&nbsp;{app.label}
                </Button>
              ))}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', px: 1 }}>Or pay securely via</Typography>
            </Divider>

            <Button fullWidth variant="contained" size="large"
              onClick={openRazorpay} disabled={processingPay}
              startIcon={processingPay ? <CircularProgress size={18} color="inherit" /> : <PaymentIcon />}
              sx={{ py: 1.4, fontWeight: 800, borderRadius: 2, mb: 2, background: 'linear-gradient(135deg,#02042a,#3730a3)', border: '1px solid rgba(99,102,241,0.4)', '&:hover': { opacity: 0.9 } }}>
              {processingPay ? 'Processing…' : '💳  Pay with Razorpay'}
            </Button>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 1.5, lineHeight: 1.6 }}>
                💡 After completing payment via PhonePe / Google Pay / Paytm, click below to confirm.
              </Typography>
              <Button fullWidth variant="outlined" size="small"
                onClick={() => submitRegistration('UPI')}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <SuccessIcon />}
                sx={{ color: '#10b981', borderColor: '#10b981', fontWeight: 700, '&:hover': { bgcolor: 'rgba(16,185,129,0.08)' } }}>
                {submitting ? 'Submitting…' : 'I have paid — Submit Registration'}
              </Button>
            </Box>

            <Button startIcon={<BackIcon />} onClick={() => { setStep('details'); setError(''); }}
              sx={{ mt: 2, color: 'rgba(255,255,255,0.5)', display: 'block', mx: 'auto' }}>Go Back</Button>
          </Card>
        )}

        {/* ─── STEP: SUCCESS ────────────────────────────────────────────────── */}
        {step === 'success' && (
          <Card sx={{ borderRadius: 3, p: 4, textAlign: 'center', bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <CelebrationIcon sx={{ fontSize: 64, color: '#8b5cf6', mb: 1 }} />
            <SuccessIcon sx={{ fontSize: 48, color: '#10b981', mb: 2, display: 'block', mx: 'auto' }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mb: 1 }}>
              Registration Successful! 🎉
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3, lineHeight: 1.8 }}>
              Your registration for <strong style={{ color: '#8b5cf6' }}>{fdp.name}</strong> has been submitted successfully.
            </Typography>

            <Box sx={{ textAlign: 'left', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, p: 2, mb: 3 }}>
              {[
                ['👤 Name', name],
                ['🏢 Department', role === 'student' ? sDept : stDept],
                ...(role === 'student'
                  ? [['🎓 Roll No', sRoll], ['📚 Year / Sem', `${sYear} • ${sSem}`]]
                  : [['🪪 Emp ID', stEmpId], ['💼 Designation', stDesig]]),
                ['📱 Mobile', mobile],
                ['📧 Email', email],
              ].map(([k, v]) => (
                <Typography key={k} variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.65)', mb: 0.4 }}>
                  <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{k}:</strong> {v}
                </Typography>
              ))}
            </Box>

            <Stack direction="row" spacing={1} justifyContent="center" mb={3} flexWrap="wrap">
              <Chip icon={<PhoneIcon sx={{ fontSize: 14 }} />} label={`SMS sent to ${mobile}`} size="small"
                sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.7rem' }} />
              <Chip icon={<EmailIcon sx={{ fontSize: 14 }} />} label="Confirmation email sent" size="small"
                sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.7rem' }} />
            </Stack>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 3 }}>
              {fdp.amount > 0
                ? 'Payment verification is in progress. You will be notified once approved.'
                : 'Your FDP registration has been confirmed. See you there!'}
            </Typography>

            <Button variant="outlined" onClick={() => window.location.reload()} sx={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}>
              Register Another Person
            </Button>
          </Card>
        )}

      </Box>
    </Box>
  );
}
