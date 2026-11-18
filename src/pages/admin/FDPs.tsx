import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, Typography, TextField, MenuItem, FormControl,
  InputLabel, Select, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Tooltip,
  Stack, Divider, InputAdornment, Grid,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  Search as SearchIcon, PowerSettingsNew as PowerIcon,
  Close as CloseIcon, QrCode as QrCodeIcon,
  CalendarToday as CalIcon, People as PeopleIcon,
  AttachMoney as MoneyIcon, Place as PlaceIcon,
  Person as PersonIcon, Refresh as ResetIcon, School as SchoolIcon,
} from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { fdpStore, type FDP, type EventAudience } from '@/lib/events-store';
import { useLookupData } from '@/hooks/use-lookup-data';

const AUDIENCE_OPTIONS: EventAudience[] = ['Staff', 'Both Students And Staff'];

const EMPTY_FORM = {
  name: '',
  resourcePerson: '',
  department: '',
  venue: '',
  startDate: '',
  endDate: '',
  timings: '',
  numberOfDays: 1,
  amount: 0,
  qrCodeUrl: '',
  brochureUrl: '',
  upiId: '',
  description: '',
  lastDateRegistration: '',
  maxParticipants: 60,
  audience: 'Staff' as EventAudience,
  isActive: false,
};

export default function FDPs() {
  const { logout, isAuthenticated } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { departments } = useLookupData();

  const [fdps, setFdps] = useState<FDP[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState('');
  const [brochurePreview, setBrochurePreview] = useState('');

  useEffect(() => { if (!isAuthenticated) navigate('/admin'); }, [isAuthenticated, navigate]);

  const reload = useCallback(() => setFdps(fdpStore.getAll()), []);
  useEffect(() => { reload(); }, [reload]);

  const filtered = fdps.filter(f => {
    if (filterDept && f.department !== filterDept) return false;
    if (filterDate && f.startDate !== filterDate && f.endDate !== filterDate) return false;
    if (filterSearch && !f.name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !f.resourcePerson.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setQrPreview('');
    setBrochurePreview('');
    setDialogOpen(true);
  };

  const openEdit = (fdp: FDP) => {
    setEditId(fdp.id);
    setForm({
      name: fdp.name,
      resourcePerson: fdp.resourcePerson,
      department: fdp.department,
      venue: fdp.venue,
      startDate: fdp.startDate || '',
      endDate: fdp.endDate || '',
      timings: fdp.timings,
      numberOfDays: fdp.numberOfDays,
      amount: fdp.amount,
      qrCodeUrl: fdp.qrCodeUrl || '',
      brochureUrl: fdp.brochureUrl || '',
      upiId: fdp.upiId || '',
      description: fdp.description,
      lastDateRegistration: fdp.lastDateRegistration,
      maxParticipants: fdp.maxParticipants,
      audience: fdp.audience,
      isActive: fdp.isActive,
    });
    setQrPreview(fdp.qrCodeUrl || '');
    setBrochurePreview(fdp.brochureUrl || '');
    setDialogOpen(true);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setQrPreview(url);
      setForm(p => ({ ...p, qrCodeUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const handleBrochureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setBrochurePreview(url);
      setForm(p => ({ ...p, brochureUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name || !form.department || !form.venue || !form.startDate) {
      toast({ title: 'Missing Fields', description: 'Please fill Name, Department, Venue and Start Date.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    if (editId) {
      fdpStore.update(editId, form);
      toast({ title: '✅ FDP Updated' });
    } else {
      fdpStore.add(form);
      toast({ title: '✅ FDP Added' });
    }
    setSaving(false);
    setDialogOpen(false);
    reload();
  };

  const handleToggle = (fdp: FDP) => {
    fdpStore.toggle(fdp.id, !fdp.isActive);
    toast({ title: fdp.isActive ? '🔴 FDP Disabled' : '🟢 FDP Enabled' });
    reload();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    fdpStore.delete(deleteId);
    toast({ title: 'FDP deleted.' });
    setDeleteId(null);
    reload();
  };

  const f = (key: keyof typeof form, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <AdminLayout onLogout={logout}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 0.5 }}>
          FDP Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Create and manage Faculty Development Programs. Toggle ON to show notifications on the login page.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={filterDate} onChange={e => setFilterDate(e.target.value)} sx={{ minWidth: 160 }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Department</InputLabel>
            <Select value={filterDept} onChange={e => setFilterDept(e.target.value)} label="Department">
              <MenuItem value="">All Departments</MenuItem>
              {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" placeholder="Search FDP name / resource person…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<ResetIcon />} onClick={() => { setFilterDept(''); setFilterDate(''); setFilterSearch(''); }}>Clear</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', fontWeight: 700 }}>
            Add FDP
          </Button>
        </Stack>
      </Card>

      {/* FDP Cards */}
      {filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">No FDPs Found</Typography>
          <Typography variant="body2" color="text.secondary">Click "Add FDP" to create your first FDP.</Typography>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(fdp => (
            <Grid item xs={12} md={6} lg={4} key={fdp.id}>
              <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: fdp.isActive ? '#8b5cf6' : 'divider', boxShadow: fdp.isActive ? '0 0 0 2px rgba(139,92,246,0.15)' : 'none', transition: 'all 0.2s', overflow: 'hidden' }}>
                <Box sx={{ height: 4, background: fdp.isActive ? 'linear-gradient(90deg,#8b5cf6,#3b82f6)' : 'rgba(0,0,0,0.1)' }} />
                {fdp.brochureUrl && (
                  <Box component="img" src={fdp.brochureUrl} alt="Brochure" sx={{ width: '100%', height: 140, objectFit: 'cover' }} />
                )}
                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box sx={{ flex: 1, pr: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.3, mb: 0.3 }}>{fdp.name}</Typography>
                      <Chip label={fdp.audience} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }} />
                    </Box>
                    <Chip label={fdp.isActive ? 'LIVE' : 'OFF'} size="small" sx={{ fontWeight: 800, bgcolor: fdp.isActive ? '#8b5cf6' : 'error.main', color: '#fff', fontSize: '0.65rem' }} />
                  </Stack>

                  <Stack spacing={0.8} sx={{ mb: 2 }}>
                    {[
                      { icon: <PersonIcon sx={{ fontSize: 14 }} />, text: fdp.resourcePerson },
                      { icon: <PlaceIcon sx={{ fontSize: 14 }} />, text: fdp.venue },
                      { icon: <CalIcon sx={{ fontSize: 14 }} />, text: `${fdp.startDate}${fdp.endDate && fdp.endDate !== fdp.startDate ? ` to ${fdp.endDate}` : ''}  •  ${fdp.timings}  •  ${fdp.numberOfDays} day(s)` },
                      { icon: <PeopleIcon sx={{ fontSize: 14 }} />, text: `${fdp.department}  •  Max: ${fdp.maxParticipants}` },
                      { icon: <MoneyIcon sx={{ fontSize: 14 }} />, text: fdp.amount === 0 ? 'Free' : `₹${fdp.amount} (${fdp.upiId || 'No UPI ID'})` },
                    ].map((row, i) => (
                      <Stack key={i} direction="row" spacing={0.8} alignItems="center">
                        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{row.icon}</Box>
                        <Typography variant="caption" color="text.secondary">{row.text}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontStyle: 'italic' }}>Last date: {fdp.lastDateRegistration || '—'}</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title={fdp.isActive ? 'Disable' : 'Enable'}>
                      <IconButton size="small" onClick={() => handleToggle(fdp)} sx={{ color: fdp.isActive ? '#8b5cf6' : 'text.disabled', bgcolor: fdp.isActive ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.04)' }}>
                        <PowerIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(fdp)} sx={{ color: 'primary.main', bgcolor: 'rgba(99,102,241,0.08)' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => setDeleteId(fdp.id)} sx={{ color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          {editId ? 'Edit FDP' : 'Add New FDP'}
          <IconButton size="small" onClick={() => setDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>FDP Audience</InputLabel>
                <Select value={form.audience} onChange={e => f('audience', e.target.value)} label="FDP Audience">
                  {AUDIENCE_OPTIONS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="FDP Name *" value={form.name} onChange={e => f('name', e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Resource Person *" value={form.resourcePerson} onChange={e => f('resourcePerson', e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department *</InputLabel>
                <Select value={form.department} onChange={e => f('department', e.target.value)} label="Department *">
                  <MenuItem value="All Departments">All Departments</MenuItem>
                  {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Venue *" value={form.venue} onChange={e => f('venue', e.target.value)} /></Grid>
            {/* Start Date */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="Start Date *" InputLabelProps={{ shrink: true }} value={form.startDate} onChange={e => f('startDate', e.target.value)} />
            </Grid>
            {/* End Date */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="End Date *" InputLabelProps={{ shrink: true }} value={form.endDate} onChange={e => f('endDate', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Timings" value={form.timings} onChange={e => f('timings', e.target.value)} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="number" label="Number of Days" value={form.numberOfDays} onChange={e => f('numberOfDays', Number(e.target.value))} inputProps={{ min: 1 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="number" label="Registration Fee (₹)" value={form.amount} onChange={e => f('amount', Number(e.target.value))} inputProps={{ min: 0 }} /></Grid>
            {/* UPI ID */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="UPI ID (e.g. name@upi)" value={form.upiId} onChange={e => f('upiId', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="date" label="Last Date for Registration" InputLabelProps={{ shrink: true }} value={form.lastDateRegistration} onChange={e => f('lastDateRegistration', e.target.value)} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="number" label="Max Participants" value={form.maxParticipants} onChange={e => f('maxParticipants', Number(e.target.value))} inputProps={{ min: 1 }} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={3} size="small" label="Description / About FDP" value={form.description} onChange={e => f('description', e.target.value)} /></Grid>
            {/* Brochure Upload */}
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>FDP Brochure / Poster Image</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Button variant="outlined" component="label" startIcon={<QrCodeIcon />} size="small">
                  Upload Brochure <input type="file" hidden accept="image/*" onChange={handleBrochureUpload} />
                </Button>
                {brochurePreview && <Box component="img" src={brochurePreview} alt="Brochure" sx={{ width: 80, height: 80, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'contain' }} />}
              </Box>
            </Grid>
            {/* QR Code Upload */}
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>Scanner / QR Code for Payment</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Button variant="outlined" component="label" startIcon={<QrCodeIcon />} size="small">
                  Upload QR Code <input type="file" hidden accept="image/*" onChange={handleQrUpload} />
                </Button>
                {qrPreview && <Box component="img" src={qrPreview} alt="QR" sx={{ width: 80, height: 80, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'contain' }} />}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => { setForm({ ...EMPTY_FORM }); setQrPreview(''); setBrochurePreview(''); }} startIcon={<ResetIcon />}>Reset</Button>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />} sx={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', fontWeight: 700 }}>
            {saving ? 'Saving…' : editId ? 'Update FDP' : 'Add FDP'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Delete FDP?</DialogTitle>
        <DialogContent><Typography>This will also delete all FDP registrations. This action cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
