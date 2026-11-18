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
  Person as PersonIcon, Refresh as ResetIcon,
} from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { workshopStore, type Workshop, type EventAudience } from '@/lib/events-store';
import { useLookupData } from '@/hooks/use-lookup-data';

const AUDIENCE_OPTIONS: EventAudience[] = ['Students', 'Staff', 'Both Students And Staff'];

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
  maxParticipants: 100,
  audience: 'Students' as EventAudience,
  isActive: false,
};

export default function Workshops() {
  const { logout, isAuthenticated } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { departments } = useLookupData();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
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

  const reload = useCallback(() => setWorkshops(workshopStore.getAll()), []);
  useEffect(() => { reload(); }, [reload]);

  const filtered = workshops.filter(w => {
    if (filterDept && w.department !== filterDept) return false;
    if (filterDate && w.startDate !== filterDate && w.endDate !== filterDate) return false;
    if (filterSearch && !w.name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !w.resourcePerson.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setQrPreview('');
    setBrochurePreview('');
    setDialogOpen(true);
  };

  const openEdit = (w: Workshop) => {
    setEditId(w.id);
    setForm({
      name: w.name,
      resourcePerson: w.resourcePerson,
      department: w.department,
      venue: w.venue,
      startDate: w.startDate || '',
      endDate: w.endDate || '',
      timings: w.timings,
      numberOfDays: w.numberOfDays,
      amount: w.amount,
      qrCodeUrl: w.qrCodeUrl || '',
      brochureUrl: w.brochureUrl || '',
      upiId: w.upiId || '',
      description: w.description,
      lastDateRegistration: w.lastDateRegistration,
      maxParticipants: w.maxParticipants,
      audience: w.audience,
      isActive: w.isActive,
    });
    setQrPreview(w.qrCodeUrl || '');
    setBrochurePreview(w.brochureUrl || '');
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
      workshopStore.update(editId, form);
      toast({ title: '✅ Workshop Updated' });
    } else {
      workshopStore.add(form);
      toast({ title: '✅ Workshop Added' });
    }
    setSaving(false);
    setDialogOpen(false);
    reload();
  };

  const handleToggle = (w: Workshop) => {
    workshopStore.toggle(w.id, !w.isActive);
    toast({ title: w.isActive ? '🔴 Workshop Disabled' : '🟢 Workshop Enabled', description: w.isActive ? 'Notification removed from login page.' : 'Notification will now appear on login page.' });
    reload();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    workshopStore.delete(deleteId);
    toast({ title: 'Deleted', description: 'Workshop and its registrations deleted.' });
    setDeleteId(null);
    reload();
  };

  const f = (key: keyof typeof form, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <AdminLayout onLogout={logout}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 0.5 }}>
          Workshop Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Create and manage workshops. Toggle ON to show registration notification on the student login page.
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
          <TextField size="small" placeholder="Search name / resource person…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<ResetIcon />} onClick={() => { setFilterDept(''); setFilterDate(''); setFilterSearch(''); }} sx={{ whiteSpace: 'nowrap' }}>Clear</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', fontWeight: 700 }}>
            Add Workshop
          </Button>
        </Stack>
      </Card>

      {/* Workshop Cards */}
      {filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No Workshops Found</Typography>
          <Typography variant="body2" color="text.secondary">Click "Add Workshop" to create your first workshop.</Typography>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(w => (
            <Grid item xs={12} md={6} lg={4} key={w.id}>
              <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: w.isActive ? 'success.main' : 'divider', boxShadow: w.isActive ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none', transition: 'all 0.2s', overflow: 'hidden' }}>
                {/* Status bar */}
                <Box sx={{ height: 4, background: w.isActive ? 'linear-gradient(90deg,#10b981,#34d399)' : 'rgba(0,0,0,0.1)' }} />
                {w.brochureUrl && (
                  <Box component="img" src={w.brochureUrl} alt="Brochure" sx={{ width: '100%', height: 140, objectFit: 'cover' }} />
                )}
                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box sx={{ flex: 1, pr: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.3, mb: 0.3 }}>{w.name}</Typography>
                      <Chip label={w.audience} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: w.audience === 'Students' ? 'rgba(99,102,241,0.1)' : w.audience === 'Staff' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: w.audience === 'Students' ? '#6366f1' : w.audience === 'Staff' ? '#f59e0b' : '#10b981' }} />
                    </Box>
                    <Chip label={w.isActive ? 'LIVE' : 'OFF'} size="small" sx={{ fontWeight: 800, bgcolor: w.isActive ? 'success.main' : 'error.main', color: '#fff', fontSize: '0.65rem' }} />
                  </Stack>

                  <Stack spacing={0.8} sx={{ mb: 2 }}>
                    {[
                      { icon: <PersonIcon sx={{ fontSize: 14 }} />, text: w.resourcePerson },
                      { icon: <PlaceIcon sx={{ fontSize: 14 }} />, text: w.venue },
                      { icon: <CalIcon sx={{ fontSize: 14 }} />, text: `${w.startDate}${w.endDate && w.endDate !== w.startDate ? ` to ${w.endDate}` : ''}  •  ${w.timings}  •  ${w.numberOfDays} day(s)` },
                      { icon: <PeopleIcon sx={{ fontSize: 14 }} />, text: `${w.department}  •  Max: ${w.maxParticipants}` },
                      { icon: <MoneyIcon sx={{ fontSize: 14 }} />, text: w.amount === 0 ? 'Free' : `₹${w.amount} (${w.upiId || 'No UPI ID'})` },
                    ].map((row, i) => (
                      <Stack key={i} direction="row" spacing={0.8} alignItems="center">
                        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{row.icon}</Box>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>{row.text}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontStyle: 'italic', lineHeight: 1.5 }}>
                    Last date: {w.lastDateRegistration || '—'}
                  </Typography>

                  <Divider sx={{ mb: 1.5 }} />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title={w.isActive ? 'Disable (hides notification)' : 'Enable (shows notification)'}>
                      <IconButton size="small" onClick={() => handleToggle(w)} sx={{ color: w.isActive ? 'success.main' : 'text.disabled', bgcolor: w.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.04)', '&:hover': { bgcolor: w.isActive ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.08)' } }}>
                        <PowerIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(w)} sx={{ color: 'primary.main', bgcolor: 'rgba(99,102,241,0.08)', '&:hover': { bgcolor: 'rgba(99,102,241,0.16)' } }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => setDeleteId(w.id)} sx={{ color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)', '&:hover': { bgcolor: 'rgba(239,68,68,0.16)' } }}>
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
          {editId ? 'Edit Workshop' : 'Add New Workshop'}
          <IconButton size="small" onClick={() => setDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {/* Audience */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Workshop Audience</InputLabel>
                <Select value={form.audience} onChange={e => f('audience', e.target.value)} label="Workshop Audience">
                  {AUDIENCE_OPTIONS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {/* Workshop Name */}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Workshop Name *" value={form.name} onChange={e => f('name', e.target.value)} />
            </Grid>
            {/* Resource Person */}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Resource Person *" value={form.resourcePerson} onChange={e => f('resourcePerson', e.target.value)} />
            </Grid>
            {/* Department */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department *</InputLabel>
                <Select value={form.department} onChange={e => f('department', e.target.value)} label="Department *">
                  <MenuItem value="All Departments">All Departments</MenuItem>
                  {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {/* Venue */}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Venue *" value={form.venue} onChange={e => f('venue', e.target.value)} />
            </Grid>
            {/* Start Date */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="Start Date *" InputLabelProps={{ shrink: true }} value={form.startDate} onChange={e => f('startDate', e.target.value)} />
            </Grid>
            {/* End Date */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="End Date *" InputLabelProps={{ shrink: true }} value={form.endDate} onChange={e => f('endDate', e.target.value)} />
            </Grid>
            {/* Timings */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Timings (e.g. 10AM–1PM)" value={form.timings} onChange={e => f('timings', e.target.value)} />
            </Grid>
            {/* Number of Days */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="number" label="Number of Days" value={form.numberOfDays} onChange={e => f('numberOfDays', Number(e.target.value))} inputProps={{ min: 1 }} />
            </Grid>
            {/* Amount */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="number" label="Registration Fee (₹, 0 = Free)" value={form.amount} onChange={e => f('amount', Number(e.target.value))} inputProps={{ min: 0 }} />
            </Grid>
            {/* UPI ID */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="UPI ID (e.g. name@upi)" value={form.upiId} onChange={e => f('upiId', e.target.value)} />
            </Grid>
            {/* Last Date */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="Last Date for Registration" InputLabelProps={{ shrink: true }} value={form.lastDateRegistration} onChange={e => f('lastDateRegistration', e.target.value)} />
            </Grid>
            {/* Max Participants */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="number" label="Max Participants" value={form.maxParticipants} onChange={e => f('maxParticipants', Number(e.target.value))} inputProps={{ min: 1 }} />
            </Grid>
            {/* Description */}
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={3} size="small" label="Description / About Workshop" value={form.description} onChange={e => f('description', e.target.value)} />
            </Grid>
            {/* Brochure Upload */}
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>Workshop Brochure / Poster Image</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Button variant="outlined" component="label" startIcon={<QrCodeIcon />} size="small">
                  Upload Brochure
                  <input type="file" hidden accept="image/*" onChange={handleBrochureUpload} />
                </Button>
                {brochurePreview && (
                  <Box component="img" src={brochurePreview} alt="Brochure" sx={{ width: 80, height: 80, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'contain' }} />
                )}
              </Box>
            </Grid>
            {/* QR Code Upload */}
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>Scanner / QR Code for Payment</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Button variant="outlined" component="label" startIcon={<QrCodeIcon />} size="small">
                  Upload QR Code
                  <input type="file" hidden accept="image/*" onChange={handleQrUpload} />
                </Button>
                {qrPreview && (
                  <Box component="img" src={qrPreview} alt="QR" sx={{ width: 80, height: 80, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'contain' }} />
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => { setForm({ ...EMPTY_FORM }); setQrPreview(''); setBrochurePreview(''); }} startIcon={<ResetIcon />}>Reset</Button>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />} sx={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', fontWeight: 700 }}>
            {saving ? 'Saving…' : editId ? 'Update Workshop' : 'Add Workshop'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Workshop?</DialogTitle>
        <DialogContent>
          <Typography>This will also delete all registrations for this workshop. This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
