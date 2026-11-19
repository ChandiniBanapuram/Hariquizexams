import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Paper,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';

import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI, Response } from '@/lib/api';
import { useLookupData, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN');
}

export default function ResponsesTable() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated, department } = useAdmin();

  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);

  const [filterDate, setFilterDate] = useState('');
  const [filterDept, setFilterDept] = useState(department || 'ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterSubject, setFilterSubject] = useState('ALL');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const { departments: DEPARTMENTS, sections: SECTIONS, years: YEARS, semesters: SEMESTERS } = useLookupData();

  const filterSubjectOptions = useLookupSubjectsForFilter(
    filterDept === 'ALL' ? undefined : filterDept,
    filterYear === 'ALL' ? undefined : filterYear,
    filterSemester === 'ALL' ? undefined : filterSemester
  );

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  const normalizedDepartment = filterDept === 'ALL' ? undefined : filterDept;
  // Fix: only send section value when not ALL, otherwise send undefined
  const normalizedSection = filterSection === 'ALL' ? undefined : filterSection;
  const normalizedYear = filterYear === 'ALL' ? undefined : filterYear;
  const normalizedSemester = filterSemester === 'ALL' ? undefined : filterSemester;
  const normalizedSubject = filterSubject === 'ALL' ? undefined : filterSubject;

  const fetchResponses = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsSilentRefreshing(true);

    // Debug logs as required
    console.log('[Responses] Selected section:', filterSection, '→ normalized:', normalizedSection);
    console.log('[Responses] API request filters:', {
      date: filterDate || undefined,
      department: normalizedDepartment,
      section: normalizedSection,
      year: normalizedYear,
      semester: normalizedSemester,
      subject: normalizedSubject,
    });

    try {
      const result = await adminAPI.getResponses({
        date: filterDate || undefined,
        department: normalizedDepartment,
        section: normalizedSection,
        year: normalizedYear,
        semester: normalizedSemester,
        subject: normalizedSubject,
      });

      // Detect backend error responses (non-array = error object)
      if (!Array.isArray(result)) {
        console.error('[Responses] API returned error:', result);
        if (!silent) {
          toast({
            title: 'Error',
            description: result?.message || 'Failed to fetch responses',
            variant: 'destructive',
          });
        }
        setResponses([]);
        return;
      }

      let fetchedResponses = result;
      // Ignore NULL/empty section rows when a section filter is active
      if (normalizedSection) {
        fetchedResponses = fetchedResponses.filter(r => r.section && r.section.trim() !== '');
      }
      fetchedResponses.sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || ''));
      console.log('[Responses] Filtered response count:', fetchedResponses.length);
      setResponses(fetchedResponses);
    } catch (err) {
      console.error('[Responses] Fetch error:', err);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to fetch responses',
          variant: 'destructive',
        });
      }
      setResponses([]);
    } finally {
      if (!silent) setIsLoading(false);
      else setIsSilentRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResponses();

    const interval = setInterval(() => {
      fetchResponses(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [filterDate, filterDept, filterSection, filterYear, filterSemester, filterSubject]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this response?')) return;
    await adminAPI.deleteResponse(id);
    fetchResponses();
  };

  const handleDeleteAll = async () => {
    if (responses.length === 0) {
      toast({
        title: 'Nothing to delete',
        description: 'No responses available.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete ALL (${responses.length}) responses?`);
    if (!confirmed) return;

    for (const r of responses) {
      await adminAPI.deleteResponse(r.id);
    }

    toast({
      title: 'Deleted',
      description: `${responses.length} responses deleted successfully.`,
    });

    fetchResponses();
  };

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const handleViewQA = async (r: Response) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await adminAPI.getResponseDetails(r.id);
      setDetailData(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
      setDetailOpen(false);
    }
    setDetailLoading(false);
  };

  const handleExportExcel = () => {
    if (responses.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No responses found for the selected filters.',
        variant: 'destructive',
      });
      return;
    }

    const excelData = responses
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number))
      .map((r, index) => ({
        'S.No': index + 1,
        'Roll Number': r.roll_number,
        Name: r.name,
        Department: r.department,
        Section: r.section,
        Year: r.year || '-',
        Semester: r.semester || '-',
        Subject: r.subject || '-',
        Score: r.score,
        'Total Marks': r.total_marks,
        'Tab Switched': r.tab_switched ? 'Yes' : 'No',
        'Submitted At': formatDateTime(r.submitted_at),
      }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
    XLSX.writeFile(workbook, 'responses.xlsx');
  };

  return (
    <AdminLayout onLogout={handleLogout}>
      <Box sx={{ mb: 4, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Submission Analytics
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Review and manage student exam performance records.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportExcel} disabled={responses.length === 0}>
            Export XLSX
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteAll} disabled={responses.length === 0}>
            Erase All
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ mb: 3, p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 2 }}>
          Filters
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              size="small"
              fullWidth
              label="Date"
              InputLabelProps={{ shrink: true }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select 
                value={filterDept} 
                label="Department" 
                onChange={(e) => setFilterDept(e.target.value)}
                disabled={!!department}
              >
                {!department && <MenuItem value="ALL">All Departments</MenuItem>}
                {DEPARTMENTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select value={filterYear} label="Year" onChange={(e) => setFilterYear(e.target.value)}>
                <MenuItem value="ALL">All Years</MenuItem>
                {YEARS.map((y) => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Section</InputLabel>
              <Select value={filterSection} label="Section" onChange={(e) => setFilterSection(e.target.value)}>
                <MenuItem value="ALL">All Sections</MenuItem>
                {SECTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Semester</InputLabel>
              <Select value={filterSemester} label="Semester" onChange={(e) => setFilterSemester(e.target.value)}>
                <MenuItem value="ALL">All Semesters</MenuItem>
                <MenuItem value="1">Semester I</MenuItem>
                <MenuItem value="2">Semester II</MenuItem>
                {SEMESTERS.filter(s => s.value !== '1' && s.value !== '2').map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Subject</InputLabel>
              <Select value={filterSubject} label="Subject" onChange={(e) => setFilterSubject(e.target.value)}>
                <MenuItem value="ALL">All Subjects</MenuItem>
                {filterSubjectOptions.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              onClick={() => {
                setFilterDate('');
                setFilterDept(department || 'ALL');
                setFilterSection('ALL');
                setFilterYear('ALL');
                setFilterSemester('ALL');
                setFilterSubject('ALL');
              }}
              sx={{ mb: 1 }}
            >
              Reset Filters
            </Button>
            <Button fullWidth variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchResponses(true)} disabled={isSilentRefreshing}>
              {isSilentRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Submissions</Typography>
            <Typography variant="caption" color="text.secondary">{responses.length} records found</Typography>
          </Box>
        </Box>
        <Divider />
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Roll No</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Integrity</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Submitted</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : responses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No submissions found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                responses.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.roll_number}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                    <TableCell>{r.subject || '-'}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{r.score} / {r.total_marks}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.tab_switched ? 'Tab Switch' : 'Clean'}
                        color={r.tab_switched ? 'warning' : 'success'}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{formatDateTime(r.submitted_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View Details">
                          <IconButton size="small" color="primary" onClick={() => handleViewQA(r)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Submission Details</Typography>
          <IconButton onClick={() => setDetailOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : detailData ? (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Student</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{detailData.name}</Typography>
                    <Typography sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>{detailData.roll_number}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Academic Info</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{detailData.department}</Typography>
                    <Typography color="text.secondary">{detailData.subject}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Question & Answer Details</Typography>
              <Stack spacing={2}>
                {detailData.answers?.map((ans: any, idx: number) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 600, mb: 1.5, whiteSpace: 'pre-wrap' }}>
                      <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>Q{idx + 1}.</Box>
                      {ans.question}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: ans.answer === ans.correct_answer ? 'success.50' : 'error.50', border: 1, borderColor: ans.answer === ans.correct_answer ? 'success.light' : 'error.light' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Student Answer</Typography>
                          <Typography sx={{ color: ans.answer === ans.correct_answer ? 'success.main' : 'error.main', fontWeight: 700 }}>{ans.answer}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'primary.50', border: 1, borderColor: 'primary.light' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Correct Answer</Typography>
                          <Typography sx={{ color: 'primary.main', fontWeight: 700 }}>{ans.correct_answer}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ py: 4, color: 'text.secondary', textAlign: 'center' }}>
              No data available for this submission.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
