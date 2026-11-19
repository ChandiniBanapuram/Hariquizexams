import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, Typography, TextField, MenuItem, FormControl,
  InputLabel, Select, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, Divider, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tooltip, Badge, CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon, Delete as DeleteIcon, CheckCircle as ApproveIcon,
  Cancel as RejectIcon, Download as DownloadIcon, Visibility as ViewIcon,
  FileDownload as ExportIcon, Close as CloseIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  workshopStore, workshopRegStore,
  type WorkshopRegistration, type PaymentStatus,
  exportToCSV, exportToPDF,
} from '@/lib/events-store';
import { useLookupData } from '@/hooks/use-lookup-data';

const STATUS_COLORS: Record<PaymentStatus, 'warning' | 'success' | 'error'> = {
  Pending: 'warning', Approved: 'success', Rejected: 'error',
};

export default function WorkshopRegistrations() {
  const { logout, isAuthenticated } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { departments } = useLookupData();

  const [registrations, setRegistrations] = useState<WorkshopRegistration[]>([]);
  const [filterWorkshop, setFilterWorkshop] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');
  const [viewReg, setViewReg] = useState<WorkshopRegistration | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { if (!isAuthenticated) navigate('/admin'); }, [isAuthenticated, navigate]);

  const reload = useCallback(() => setRegistrations(workshopRegStore.getAll()), []);
  useEffect(() => { reload(); }, [reload]);

  const workshops = workshopStore.getAll();
  const workshopNames = [...new Set(registrations.map(r => r.workshopName))];

  const filtered = registrations.filter(r => {
    if (filterWorkshop && r.workshopName !== filterWorkshop) return false;
    if (filterDept && r.department !== filterDept) return false;
    if (filterFrom && r.registrationDate < filterFrom) return false;
    if (filterTo && r.registrationDate > filterTo + 'T23:59:59') return false;
    const idField = (r.rollNumber ?? r.hallTicket ?? r.employeeId ?? '').toLowerCase();
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) &&
      !idField.includes(search.toLowerCase()) &&
      !r.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleStatus = async (id: string, status: PaymentStatus) => {
    setProcessing(id);
    await new Promise(r => setTimeout(r, 400));
    workshopRegStore.updateStatus(id, status);
    toast({ title: `Registration ${status}`, description: `Payment marked as ${status}.` });
    setProcessing(null);
    reload();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    workshopRegStore.delete(deleteId);
    toast({ title: 'Registration deleted.' });
    setDeleteId(null);
    reload();
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Roll No / Emp ID', 'Type', 'Department', 'Mobile', 'Email', 'Workshop', 'Payment Status', 'Registration Date'];
    const rows = filtered.map(r => [
      r.name,
      r.rollNumber ?? r.hallTicket ?? r.employeeId ?? '',
      r.registrantType ?? 'student',
      r.department, r.mobile, r.email, r.workshopName,
      r.paymentStatus, new Date(r.registrationDate).toLocaleDateString()
    ]);
    exportToCSV(`workshop_registrations_${Date.now()}.csv`, headers, rows);
    toast({ title: 'Exported to CSV' });
  };

  const handleExportPDF = () => {
    const headers = ['Name', 'Roll No / Emp ID', 'Dept', 'Mobile', 'Email', 'Workshop', 'Status', 'Date'];
    const rows = filtered.map(r => [
      r.name, r.rollNumber ?? r.hallTicket ?? r.employeeId ?? '',
      r.department, r.mobile, r.email, r.workshopName,
      r.paymentStatus, new Date(r.registrationDate).toLocaleDateString()
    ]);
    exportToPDF(`workshop_registrations_${Date.now()}.pdf`, 'Workshop Registrations — HARI', headers, rows);
    toast({ title: 'Exported to PDF' });
  };

  const stats = {
    total: filtered.length,
    pending: filtered.filter(r => r.paymentStatus === 'Pending').length,
    approved: filtered.filter(r => r.paymentStatus === 'Approved').length,
    rejected: filtered.filter(r => r.paymentStatus === 'Rejected').length,
  };

  return (
    <AdminLayout onLogout={logout}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 0.5 }}>
          Workshop Registrations
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>View, approve and manage all workshop registrations.</Typography>
      </Box>

      {/* Stats */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: stats.total, color: '#6366f1' },
          { label: 'Pending', value: stats.pending, color: '#f59e0b' },
          { label: 'Approved', value: stats.approved, color: '#10b981' },
          { label: 'Rejected', value: stats.rejected, color: '#ef4444' },
        ].map(s => (
          <Card key={s.label} sx={{ flex: 1, p: 2, borderRadius: 3, border: `1px solid ${s.color}30`, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: s.color }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>{s.label}</Typography>
          </Card>
        ))}
      </Stack>

      {/* Filters */}
      <Card sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Workshop</InputLabel>
            <Select value={filterWorkshop} onChange={e => setFilterWorkshop(e.target.value)} label="Workshop">
              <MenuItem value="">All Workshops</MenuItem>
              {workshopNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Department</InputLabel>
            <Select value={filterDept} onChange={e => setFilterDept(e.target.value)} label="Department">
              <MenuItem value="">All Departments</MenuItem>
              {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="From Date" InputLabelProps={{ shrink: true }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <TextField size="small" type="date" label="To Date" InputLabelProps={{ shrink: true }} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          <TextField size="small" placeholder="Search name / ID / email…" value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: 1, minWidth: 200 }} />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { setFilterWorkshop(''); setFilterDept(''); setFilterFrom(''); setFilterTo(''); setSearch(''); }}>Clear</Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
          <Button size="small" variant="outlined" startIcon={<ExportIcon />} onClick={handleExportCSV}>Export CSV</Button>
          <Button size="small" variant="outlined" startIcon={<ExportIcon />} onClick={handleExportPDF} color="error">Export PDF</Button>
        </Stack>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <Typography color="text.secondary">No registrations found.</Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(99,102,241,0.06)' }}>
                {['#', 'Name', 'Roll No / Emp ID', 'Type', 'Dept', 'Mobile', 'Email', 'Workshop', 'Status', 'Date', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{r.name}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{r.rollNumber ?? r.hallTicket ?? r.employeeId ?? '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}><Chip label={r.registrantType ?? 'student'} size="small" sx={{ fontSize: '0.6rem', height: 18, textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{r.department}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{r.mobile}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{r.email}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', maxWidth: 150 }}>
                    <Tooltip title={r.workshopName}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.workshopName}</span></Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.paymentStatus} color={STATUS_COLORS[r.paymentStatus]} size="small" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(r.registrationDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => setViewReg(r)} sx={{ color: 'primary.main' }}><ViewIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Approve">
                        <span>
                          <IconButton size="small" onClick={() => handleStatus(r.id, 'Approved')} disabled={r.paymentStatus === 'Approved' || processing === r.id} sx={{ color: 'success.main' }}>
                            {processing === r.id ? <CircularProgress size={14} /> : <ApproveIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <IconButton size="small" onClick={() => handleStatus(r.id, 'Rejected')} disabled={r.paymentStatus === 'Rejected' || processing === r.id} sx={{ color: 'error.main' }}><RejectIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      {r.paymentScreenshot && (
                        <Tooltip title="Download Payment Screenshot">
                          <IconButton size="small" component="a" href={r.paymentScreenshot} download="payment.png" sx={{ color: 'info.main' }}><DownloadIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteId(r.id)} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Detail Dialog */}
      <Dialog open={!!viewReg} onClose={() => setViewReg(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Registration Details <IconButton size="small" onClick={() => setViewReg(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {viewReg && (
            <Stack spacing={1.5}>
              {[
                ['Name', viewReg.name],
                ['Type', viewReg.registrantType ?? 'student'],
                ['Roll No / Emp ID', viewReg.rollNumber ?? viewReg.hallTicket ?? viewReg.employeeId ?? '—'],
                ...(viewReg.year ? [['Year / Sem', `${viewReg.year} • ${viewReg.semester ?? ''}`]] : []),
                ...(viewReg.designation ? [['Designation', viewReg.designation]] : []),
                ['Department', viewReg.department], ['Mobile', viewReg.mobile],
                ['Email', viewReg.email], ['Workshop', viewReg.workshopName],
                ['Payment Method', viewReg.paymentMethod ?? '—'],
                ['Payment Status', viewReg.paymentStatus],
                ['Registration Date', new Date(viewReg.registrationDate).toLocaleString()],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', gap: 1 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 160, color: 'text.secondary' }}>{k}:</Typography>
                  <Typography variant="body2">{v}</Typography>
                </Box>
              ))}
              {viewReg.paymentScreenshot && (
                <Box>
                  <Typography variant="body2" fontWeight={700} color="text.secondary" mb={0.5}>Payment Screenshot:</Typography>
                  <Box component="img" src={viewReg.paymentScreenshot} alt="Payment" sx={{ maxWidth: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setViewReg(null)}>Close</Button>
          {viewReg && viewReg.paymentStatus === 'Pending' && (
            <>
              <Button variant="contained" color="success" onClick={() => { handleStatus(viewReg.id, 'Approved'); setViewReg(null); }}>Approve</Button>
              <Button variant="contained" color="error" onClick={() => { handleStatus(viewReg.id, 'Rejected'); setViewReg(null); }}>Reject</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Delete Registration?</DialogTitle>
        <DialogContent><Typography>This action cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
