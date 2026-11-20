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
  Visibility as EyeIcon,
  DeleteOutline as TrashIcon,
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
  const normalizedSection = filterSection === 'ALL' ? undefined : filterSection;
  const normalizedYear = filterYear === 'ALL' ? undefined : filterYear;
  const normalizedSemester = filterSemester === 'ALL' ? undefined : filterSemester;
  const normalizedSubject = filterSubject === 'ALL' ? undefined : filterSubject;

  const fetchResponses = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsSilentRefreshing(true);

    try {
      const result = await adminAPI.getResponses({
        date: filterDate || undefined,
        department: normalizedDepartment,
        section: normalizedSection,
        year: normalizedYear,
        semester: normalizedSemester,
        subject: normalizedSubject,
      });

      setResponses(Array.isArray(result) ? result : []);
    } catch {
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Responses
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          View and manage student exam submissions.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
              <TextField
                label="Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                sx={{ minWidth: 180 }}
              />
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="response-filter-dept">Department</InputLabel>
                <Select
                  labelId="response-filter-dept"
                  label="Department"
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  disabled={!!department}
                >
                  {!department && <MenuItem value="ALL">All Departments</MenuItem>}
                  {DEPARTMENTS.map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="response-filter-section">Section</InputLabel>
                <Select
                  labelId="response-filter-section"
                  label="Section"
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                >
                  <MenuItem value="ALL">All Sections</MenuItem>
                  {SECTIONS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel id="response-filter-year">Year</InputLabel>
                <Select
                  labelId="response-filter-year"
                  label="Year"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <MenuItem value="ALL">All Years</MenuItem>
                  {YEARS.map((y) => (
                    <MenuItem key={y.value} value={y.value}>
                      {y.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel id="response-filter-semester">Semester</InputLabel>
                <Select
                  labelId="response-filter-semester"
                  label="Semester"
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                >
                  <MenuItem value="ALL">All Semesters</MenuItem>
                  {SEMESTERS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="response-filter-subject">Subject</InputLabel>
                <Select
                  labelId="response-filter-subject"
                  label="Subject"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <MenuItem value="ALL">All Subjects</MenuItem>
                  {filterSubjectOptions.length > 0 ? (
                    filterSubjectOptions.map((s) => (
                      <MenuItem key={s.value} value={s.value}>
                        {s.label}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>No subjects</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                startIcon={isSilentRefreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
                onClick={() => fetchResponses(true)}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleExportExcel}
                disabled={responses.length === 0}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<TrashIcon />}
                onClick={handleDeleteAll}
                disabled={responses.length === 0}
              >
                Delete All
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Responses"
          subheader={`${responses.length} response${responses.length === 1 ? '' : 's'} found`}
        />
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Roll No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Year</TableCell>
                <TableCell>Sem</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Tab Switch</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : responses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Typography variant="body2" sx={{ py: 4 }}>
                      No responses found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                responses.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.roll_number}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell>{r.section}</TableCell>
                    <TableCell>{r.year || '-'}</TableCell>
                    <TableCell>{r.semester || '-'}</TableCell>
                    <TableCell>{r.subject || '-'}</TableCell>
                    <TableCell>{r.score}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.tab_switched ? 'Yes' : 'No'}
                        color={r.tab_switched ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(r.submitted_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="View details">
                          <IconButton size="small" onClick={() => handleViewQA(r)}>
                            <EyeIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(r.id)}>
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
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EyeIcon />
            <span>Response Details</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : detailData ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2">Student</Typography>
              <Typography>
                <strong>Roll:</strong> {detailData.roll_number} • <strong>Name:</strong> {detailData.name}
              </Typography>
              <Typography>
                <strong>Department:</strong> {detailData.department} • <strong>Subject:</strong> {detailData.subject}
              </Typography>
              <Divider />
              <Typography variant="subtitle2">Answers</Typography>
              {detailData.answers?.map((ans: any, idx: number) => (
                <Card key={idx} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Q{idx + 1}: {ans.question}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>
                    <strong>Your Answer:</strong> {ans.answer}
                  </Typography>
                  <Typography>
                    <strong>Correct Answer:</strong> {ans.correct_answer}
                  </Typography>
                </Card>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ py: 4 }}>
              No details available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} startIcon={<CloseIcon />}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
