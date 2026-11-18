import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, Typography, Button,
  FormControl, InputLabel, Select, MenuItem, Chip, Stack,
} from '@mui/material';
import { PictureAsPdf, Visibility, Download } from '@mui/icons-material';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLookupData, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import StudentLayout from '@/components/layouts/StudentLayout';

interface PDFMeta {
  id: number;
  name: string;
  size: string;
  date: string;
  department: string;
  year: string;
  semester: string;
  subject: string;
  label: string;
  fileData: string; // base64
}

export default function QuestionBanks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { student, logout, isAuthenticated } = useStudentAuth();

  const { departments, years, semesters } = useLookupData(true);

  // Load all PDFs that admin uploaded
  const [allPdfs, setAllPdfs] = useState<PDFMeta[]>([]);

  // Filter state — pre-fill from student profile
  const [filterDept, setFilterDept]         = useState('');
  const [filterYear, setFilterYear]         = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSubject, setFilterSubject]   = useState('ALL');
  const [filterLabel, setFilterLabel]       = useState('ALL');

  const filterSubjectsList = useLookupSubjectsForFilter(
      filterDept || undefined,
      filterYear || undefined,
      filterSemester || undefined
  );

  useEffect(() => {
    if (!isAuthenticated) navigate('/student/login');
  }, [isAuthenticated, navigate]);

  // Pre-fill from student profile
  useEffect(() => {
    if (student) {
      setFilterDept(student.department || '');
      setFilterYear(student.year       || '');
      setFilterSemester(student.semester || '');
    }
  }, [student]);

  // Read admin-uploaded PDFs from localStorage (no random/mock PDFs)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('question_banks_meta');
      if (stored) {
        const parsed: PDFMeta[] = JSON.parse(stored);
        setAllPdfs(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setAllPdfs([]);
    }
  }, []);

  // Derive distinct subjects for current dept/year/semester selection
  const availableSubjects = useMemo(() => {
    const subset = allPdfs.filter(p =>
      (!filterDept     || p.department === filterDept)     &&
      (!filterYear     || p.year       === filterYear)     &&
      (!filterSemester || p.semester   === filterSemester)
    );
    return Array.from(new Set(subset.map(p => p.subject))).sort();
  }, [allPdfs, filterDept, filterYear, filterSemester]);

  // Derive distinct sort labels for current filters
  const availableLabels = useMemo(() => {
    const subset = allPdfs.filter(p =>
      (!filterDept     || p.department === filterDept)     &&
      (!filterYear     || p.year       === filterYear)     &&
      (!filterSemester || p.semester   === filterSemester) &&
      (filterSubject === 'ALL' || p.subject === filterSubject)
    );
    const labels = Array.from(new Set(subset.map(p => p.label).filter(Boolean))).sort();
    return labels;
  }, [allPdfs, filterDept, filterYear, filterSemester, filterSubject]);

  // Reset subject filter when dept/year/semester changes
  const handleDeptChange   = (v: string) => { setFilterDept(v);     setFilterSubject('ALL'); setFilterLabel('ALL'); };
  const handleYearChange   = (v: string) => { setFilterYear(v);     setFilterSubject('ALL'); setFilterLabel('ALL'); };
  const handleSemChange    = (v: string) => { setFilterSemester(v); setFilterSubject('ALL'); setFilterLabel('ALL'); };
  const handleSubChange    = (v: string) => { setFilterSubject(v);  setFilterLabel('ALL'); };

  // Filtered results
  const filteredPdfs = useMemo(() => {
    return allPdfs
      .filter(p =>
        (!filterDept      || p.department === filterDept)              &&
        (!filterYear      || p.year       === filterYear)              &&
        (!filterSemester  || p.semester   === filterSemester)          &&
        (filterSubject === 'ALL' || p.subject === filterSubject)       &&
        (filterLabel   === 'ALL' || p.label   === filterLabel)
      )
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [allPdfs, filterDept, filterYear, filterSemester, filterSubject, filterLabel]);

  // ── REAL download using stored base64 data ──
  const handleDownload = (pdf: PDFMeta) => {
    if (!pdf.fileData) {
      return toast({ title: 'Not Available', description: 'This PDF was uploaded without file data. Ask admin to re-upload.', variant: 'destructive' });
    }
    const link = document.createElement('a');
    link.href = pdf.fileData;
    link.download = pdf.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── View in new tab ──
  const handleView = (pdf: PDFMeta) => {
    if (!pdf.fileData) {
      return toast({ title: 'Not Available', description: 'Preview not available. Ask admin to re-upload.', variant: 'destructive' });
    }
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${pdf.fileData}" style="width:100%;height:100vh;border:none;"></iframe>`);
    }
  };

  if (!student) return null;

  return (
    <StudentLayout user={student} onLogout={logout}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Question Banks</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Access your examination resources. Use the filters to find PDFs by department, year, semester, subject or unit.
        </Typography>
      </Box>

      {/* ── FILTER BAR ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
        {/* Department */}
        <FormControl sx={{ minWidth: 180, flex: 1 }} size="small">
          <InputLabel>Department</InputLabel>
          <Select value={filterDept} label="Department" onChange={e => handleDeptChange(e.target.value)}>
            <MenuItem value="">All Departments</MenuItem>
            {departments.map(d => (
              <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Year */}
        <FormControl sx={{ minWidth: 110, flex: 1 }} size="small">
          <InputLabel>Year</InputLabel>
          <Select value={filterYear} label="Year" onChange={e => handleYearChange(e.target.value)}>
            <MenuItem value="">All Years</MenuItem>
            {years.map(y => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Semester */}
        <FormControl sx={{ minWidth: 120, flex: 1 }} size="small">
          <InputLabel>Semester</InputLabel>
          <Select value={filterSemester} label="Semester" onChange={e => handleSemChange(e.target.value)}>
            <MenuItem value="">All Semesters</MenuItem>
            {semesters.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Subject */}
        <FormControl sx={{ minWidth: 180, flex: 1 }} size="small">
          <InputLabel>Subject</InputLabel>
          <Select value={filterSubject} label="Subject" onChange={e => handleSubChange(e.target.value)}>
            <MenuItem value="ALL">All Subjects</MenuItem>
            {filterSubjectsList.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Unit/Label sort — UNIT-1, UNIT-2 etc */}
        {availableLabels.length > 0 && (
          <FormControl sx={{ minWidth: 130, flex: 1 }} size="small">
            <InputLabel>Unit / Sort</InputLabel>
            <Select value={filterLabel} label="Unit / Sort" onChange={e => setFilterLabel(e.target.value)}>
              <MenuItem value="ALL">All Units</MenuItem>
              {availableLabels.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* ── RESULTS COUNT ── */}
      {filteredPdfs.length > 0 && (
        <Typography variant="caption" sx={{ mb: 2, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
          Showing {filteredPdfs.length} PDF{filteredPdfs.length !== 1 ? 's' : ''}
        </Typography>
      )}

      {/* ── PDF GRID ── */}
      {filteredPdfs.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <PictureAsPdf sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
            No PDFs Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {allPdfs.length === 0
              ? 'No question banks have been uploaded yet. Ask your administrator to upload PDFs.'
              : 'Try changing the filters above to find available resources.'}
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {filteredPdfs.map(pdf => (
            <Grid item xs={12} sm={6} lg={4} key={pdf.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '4px solid',
                  borderTopColor: 'error.main',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
              >
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                    <PictureAsPdf color="error" fontSize="large" sx={{ mr: 1.5, mt: 0.2, flexShrink: 0 }} />
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.3, wordBreak: 'break-word' }}
                      >
                        {pdf.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uploaded: {pdf.date}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Tags */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2, gap: 0.5 }}>
                    <Chip size="small" label={pdf.subject} variant="outlined" color="primary" />
                    {pdf.label && (
                      <Chip size="small" label={pdf.label} variant="filled" color="secondary" sx={{ fontWeight: 700 }} />
                    )}
                    <Chip size="small" label={pdf.size} variant="outlined" />
                  </Stack>

                  {/* Actions */}
                  <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Visibility />}
                      onClick={() => handleView(pdf)}
                      disabled={!pdf.fileData}
                    >
                      View
                    </Button>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<Download />}
                      onClick={() => handleDownload(pdf)}
                      disabled={!pdf.fileData}
                      color="primary"
                    >
                      Download
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </StudentLayout>
  );
}
