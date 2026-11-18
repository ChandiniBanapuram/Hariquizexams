import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Chip,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';

import { codingAPI, mlExecAPI } from '@/lib/api';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { useLookupData, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import { ALL_LANG_OPTIONS } from '@/components/admin/QuestionForm';
import AdminLayout from '@/components/layouts/AdminLayout';
import * as XLSX from 'xlsx';

export default function SubmissionsDashboard({ type = 'ALL' }: { type?: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated, department } = useAdmin();

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [activeSubIdx, setActiveSubIdx] = useState(0);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // ML Execution output state
  const [mlExecData, setMlExecData] = useState<{
    execution: any; graphs: any[]; images: any[]; metrics: any[];
  } | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  
  const [editingScore, setEditingScore] = useState<string>('');
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);

  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('sub_statusFilter') || 'ALL';
  });
  const [examIdFilter, setExamIdFilter] = useState(type);

  const [filterDate, setFilterDate] = useState(() => {
    return localStorage.getItem('sub_filterDate') || '';
  });
  const [filterDept, setFilterDept] = useState(() => {
    return localStorage.getItem('sub_filterDept') || department || 'ALL';
  });
  const [filterYear, setFilterYear] = useState(() => {
    return localStorage.getItem('sub_filterYear') || 'ALL';
  });
  const [filterSemester, setFilterSemester] = useState(() => {
    return localStorage.getItem('sub_filterSemester') || 'ALL';
  });
  const [filterSection, setFilterSection] = useState(() => {
    return localStorage.getItem('sub_filterSection') || 'ALL';
  });
  const [filterLanguage, setFilterLanguage] = useState(() => {
    return localStorage.getItem('sub_filterLanguage') || 'ALL';
  });

  useEffect(() => {
    localStorage.setItem('sub_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('sub_filterDate', filterDate);
  }, [filterDate]);

  useEffect(() => {
    localStorage.setItem('sub_filterDept', filterDept);
  }, [filterDept]);

  useEffect(() => {
    localStorage.setItem('sub_filterYear', filterYear);
  }, [filterYear]);

  useEffect(() => {
    localStorage.setItem('sub_filterSemester', filterSemester);
  }, [filterSemester]);

  const { departments: DEPARTMENTS, years: YEARS, semesters: SEMESTERS, sections: SECTIONS } = useLookupData();

  useEffect(() => { setExamIdFilter(type); }, [type]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
    fetchSubmissions();
  }, [isAuthenticated, statusFilter, examIdFilter, type, filterDate, filterDept, filterYear, filterSemester, filterSection, filterLanguage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, examIdFilter, type, filterDate, filterDept, filterYear, filterSemester, filterSection, filterLanguage]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params: any = { 
        limit: 200,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        examId: examIdFilter !== 'ALL' ? examIdFilter : undefined,
        date: filterDate || undefined,
        department: filterDept !== 'ALL' ? filterDept : undefined,
        year: filterYear !== 'ALL' ? filterYear : undefined,
        semester: filterSemester !== 'ALL' ? filterSemester : undefined,
        section: filterSection !== 'ALL' ? filterSection : undefined,
        language: filterLanguage !== 'ALL' ? filterLanguage : undefined
      };
      const res = await codingAPI.getAdminSubmissions(params);
      setSubmissions(res.submissions || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch submissions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = useMemo(() => {
    const filtered = submissions.filter(sub =>
      sub.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.roll_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.question_id?.toString().includes(searchTerm) ||
      sub.language?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // If viewing Exams Only or a specific Exam, aggregate by Student + Exam
    if (examIdFilter === 'Exams' || (examIdFilter !== 'ALL' && examIdFilter !== 'Practice')) {
        const examTotalQsMap = new Map();
        submissions.forEach(sub => {
            if (sub.exam_id) {
                if (!examTotalQsMap.has(sub.exam_id)) {
                    examTotalQsMap.set(sub.exam_id, new Set());
                }
                examTotalQsMap.get(sub.exam_id).add(sub.question_id);
            }
        });

        const groupedMap = new Map();
        
        filtered.forEach(sub => {
            const key = `${sub.roll_number}_${sub.exam_id || 'practice'}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, { 
                    ...sub, 
                    scoresMap: new Map([[sub.question_id, sub.score]]),
                    uniqueQs: new Set([sub.question_id]),
                    isAggregated: true 
                });
            } else {
                const existing = groupedMap.get(key);
                existing.uniqueQs.add(sub.question_id);
                const prevScore = existing.scoresMap.get(sub.question_id) || 0;
                if (sub.score > prevScore) {
                    existing.scoresMap.set(sub.question_id, sub.score);
                }
                if (sub.tab_switched) {
                    existing.tab_switched = true;
                }
            }
        });

        const resultList = Array.from(groupedMap.values()).map(g => {
            const totalQsForExam = g.assigned_questions_count || 1;
            const passedQIds = new Set();
            g.scoresMap.forEach((score: number, qId: any) => {
                if (score === 100) {
                    passedQIds.add(qId);
                }
            });
            const passedCount = passedQIds.size;
            
            const totalScoreSum = Array.from(g.scoresMap.values()).reduce((sum: number, val: any) => sum + val, 0);
            const combinedScore = Math.round(Number(totalScoreSum) / totalQsForExam);
            
            return {
                ...g,
                score: combinedScore,
                question_id: `${passedCount}/${totalQsForExam} executed`
            };
        });

        return [...resultList].sort((a, b) => 
          (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true, sensitivity: 'base' })
        );
    }

    return [...filtered].sort((a, b) => 
      (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [submissions, searchTerm, examIdFilter]);

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage, itemsPerPage]);

  const handleViewCode = async (sub: any) => {
    if (sub.isAggregated) {
        const group = submissions.filter(s => s.roll_number === sub.roll_number && s.exam_id === sub.exam_id);
        setSelectedSub({ ...sub, group });
        setActiveSubIdx(0);
        setMlExecData(null);
        setCodeModalOpen(true);
        // Fetch ML execution for first question in group
        const first = group[0];
        if (first) fetchMlExec(first.student_id, first.question_id, first.exam_id);
        return;
    }

    try {
      const res = await codingAPI.getSubmissionDetail(sub.id);
      setSelectedSub(res.submission);
      setActiveSubIdx(0);
      setEditingScore(String(res.submission.score));
      setMlExecData(null);
      setCodeModalOpen(true);
      fetchMlExec(res.submission.student_id, res.submission.question_id, res.submission.exam_id);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch submission details', variant: 'destructive' });
    }
  };

  const fetchMlExec = async (studentId: any, questionId: any, examId: any) => {
    if (!studentId || !questionId) return;
    setMlLoading(true);
    try {
      const data = await mlExecAPI.getAdminExecution(studentId, questionId, examId || null);
      if (data?.execution) setMlExecData(data);
      else setMlExecData(null);
    } catch {
      setMlExecData(null);
    } finally {
      setMlLoading(false);
    }
  };

  const handleUpdateScore = async () => {
    const numScore = parseInt(editingScore, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      return toast({ title: 'Invalid Score', description: 'Score must be between 0 and 100', variant: 'destructive' });
    }
    
    setIsUpdatingScore(true);
    try {
      const res = await codingAPI.updateSubmissionScore(selectedSub.id, numScore);
      if (res.success) {
        toast({ title: 'Score Updated', description: 'The submission score was updated manually.' });
        setSelectedSub((prev: any) => ({ ...prev, score: numScore, status: 'Manual Grade' }));
        fetchSubmissions();
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to update score', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An error occurred while updating the score.', variant: 'destructive' });
    } finally {
      setIsUpdatingScore(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    try {
      const res = await codingAPI.deleteSubmission(id);
      if (res.success || !res.error) {
        toast({ title: 'Success', description: 'Submission deleted successfully' });
        fetchSubmissions();
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete submission', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const data = submissions.map(s => ({
      ID: s.id, Student: s.student_name, Roll: s.roll_number,
      QuestionID: s.question_id, ExamID: s.exam_id || 'Practice',
      Subject: s.question_subject || '-',
      Language: s.language, Status: s.status, Score: s.score,
      TabSwitched: s.tab_switched ? 'Yes' : 'No',
      Time: new Date(s.created_at).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    XLSX.writeFile(wb, `Submissions_${Date.now()}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Wrong Answer': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Runtime Error': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Compilation Error': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {type === 'Practice' ? 'Practice Responses' : type === 'Exams' ? 'Exam Responses' : 'Submissions Dashboard'}
            </h1>
            <p className="text-[var(--text-secondary)] font-medium mt-1">
              {type === 'Practice' ? 'History of student practice sessions.' : type === 'Exams' ? 'Overview of coding exam results.' : 'Track all coding assessment and practice records.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors flex items-center gap-2"
            >
              <DownloadIcon style={{ fontSize: 18 }} />
              Export
            </button>
            <button
              onClick={fetchSubmissions}
              className="btn-gradient px-4 py-2 rounded-lg font-semibold text-white flex items-center gap-2"
            >
              <RefreshIcon style={{ fontSize: 18 }} />
              Refresh
            </button>
          </div>
        </div>

        <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', fontWeight: 600, mb: 2 }}>
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
                sx={{ '& .MuiInputBase-root': { color: 'var(--text-primary)' }, '& .MuiInputLabel-root': { color: 'var(--text-secondary)' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Department</InputLabel>
                <Select 
                  value={filterDept} 
                  label="Department" 
                  onChange={(e) => setFilterDept(e.target.value)} 
                  disabled={!!department}
                  sx={{ color: 'var(--text-primary)' }}
                >
                  {!department && <MenuItem value="ALL">All Departments</MenuItem>}
                  {DEPARTMENTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Year</InputLabel>
                <Select value={filterYear} label="Year" onChange={(e) => setFilterYear(e.target.value)} sx={{ color: 'var(--text-primary)' }}>
                  <MenuItem value="ALL">All Years</MenuItem>
                  {YEARS.map((y) => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Semester</InputLabel>
                <Select value={filterSemester} label="Semester" onChange={(e) => setFilterSemester(e.target.value)} sx={{ color: 'var(--text-primary)' }}>
                  <MenuItem value="ALL">All Semesters</MenuItem>
                  {SEMESTERS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Section</InputLabel>
                <Select value={filterSection} label="Section" onChange={(e) => setFilterSection(e.target.value)} sx={{ color: 'var(--text-primary)' }}>
                  <MenuItem value="ALL">All Sections</MenuItem>
                  {SECTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Language</InputLabel>
                <Select value={filterLanguage} label="Language" onChange={(e) => setFilterLanguage(e.target.value)} sx={{ color: 'var(--text-primary)' }}>
                  <MenuItem value="ALL">All Languages</MenuItem>
                  {ALL_LANG_OPTIONS.map((l) => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value as string)} sx={{ color: 'var(--text-primary)' }}>
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="Accepted">Accepted</MenuItem>
                    <MenuItem value="Wrong Answer">Wrong Answer</MenuItem>
                    <MenuItem value="Runtime Error">Runtime Error</MenuItem>
                    <MenuItem value="Compilation Error">Compilation Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="text-[var(--text-secondary)] text-sm" />
                </div>
                <input
                  type="text"
                  placeholder="Roll..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </Grid>
          </Grid>
        </Paper>

        {/* Table */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[var(--text-secondary)]">Loading submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--text-secondary)]">No submissions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[rgba(99,102,241,0.02)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Student</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Roll</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">QID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Integrity</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Score</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Lang</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Time</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[rgba(99,102,241,0.02)] transition-colors">
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{sub.id}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)]">{sub.student_name}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)]">{sub.roll_number}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{sub.question_subject || sub.subject || '-'}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-bold">{sub.question_id}</td>
                      <td className="px-6 py-4">
                        <Chip 
                            label={sub.tab_switched ? 'Tab Switch' : 'Clean'} 
                            color={sub.tab_switched ? 'warning' : 'success'} 
                            size="small" 
                            variant="outlined" 
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-bold">{sub.score}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] uppercase">{sub.language}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                        {new Date(sub.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewCode(sub)}
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="View Code"
                          >
                            <VisibilityIcon className="text-blue-600 dark:text-blue-400 text-lg" />
                          </button>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <DeleteIcon className="text-red-600 dark:text-red-400 text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination controls */}
          {!loading && filteredSubmissions.length > 0 && (
            <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[rgba(99,102,241,0.01)]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                >
                  {[10, 25, 50, 100].map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">entries</span>
                <span className="text-xs font-semibold text-[var(--text-secondary)] ml-4">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} entries
                </span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.04)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.04)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Prev
                  </button>
                  
                  {/* Page Numbers */}
                  {(() => {
                    const pages = [];
                    const start = Math.max(1, currentPage - 2);
                    const end = Math.min(totalPages, start + 4);
                    const adjustedStart = Math.max(1, end - 4);
                    
                    for (let i = adjustedStart; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPage === i ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.04)]'}`}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.04)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.04)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Code Modal */}
      {codeModalOpen && selectedSub && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-large)] max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Submission Details</h2>
                <p className="text-[var(--text-secondary)] mt-1">
                  {selectedSub.student_name} ({selectedSub.roll_number})
                </p>
              </div>
              <button
                onClick={() => setCodeModalOpen(false)}
                className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col md:flex-row h-full overflow-hidden">
              {/* Question Sidebar for Aggregated View */}
              {selectedSub.group && selectedSub.group.length > 0 && (
                <div className="w-full md:w-64 border-r border-[var(--border)] bg-[rgba(99,102,241,0.02)] overflow-y-auto max-h-[20vh] md:max-h-full">
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Attempted Questions ({selectedSub.group.length})</p>
                  </div>
                  <div className="flex flex-col">
                    {selectedSub.group.map((s: any, i: number) => (
                      <button
                        key={s.id}
                        onClick={() => {
                            setActiveSubIdx(i);
                            setEditingScore(String(s.score));
                        }}
                        className={`p-4 text-left border-b border-[var(--border)] transition-colors hover:bg-[rgba(99,102,241,0.05)] ${activeSubIdx === i ? 'bg-white dark:bg-gray-800 border-l-4 border-l-[var(--primary)] shadow-sm' : ''}`}
                      >
                        <p className={`text-sm font-bold ${activeSubIdx === i ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>QID: {s.question_id}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate mt-1">{s.question_subject || s.subject || 'Coding Problem'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                           <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${getStatusColor(s.status)}`}>{s.status}</span>
                           <span className="text-[10px] font-bold text-[var(--text-secondary)]">{s.score}%</span>
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                             TC: {s.passed_test_cases || 0}/{s.total_test_cases || 0}
                           </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const current = selectedSub.group ? selectedSub.group[activeSubIdx] : selectedSub;
                  if (!current) return null;
                  
                  return (
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Status</span>
                          <div className={`mt-1 px-2 py-1 text-xs font-medium rounded-full inline-block ${getStatusColor(current.status)}`}>
                            {current.status}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase block mb-1">Score (Edit)</span>
                          <div className="flex items-center gap-2 mt-1">
                              <input 
                                 type="number" 
                                 value={editingScore} 
                                 onChange={(e) => setEditingScore(e.target.value)} 
                                 className="w-20 px-2 py-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                                 min="0" max="100"
                              />
                              <button 
                                 onClick={async () => {
                                    const numScore = parseInt(editingScore, 10);
                                    if (isNaN(numScore) || numScore < 0 || numScore > 100) return;
                                    setIsUpdatingScore(true);
                                    try {
                                      const res = await codingAPI.updateSubmissionScore(current.id, numScore);
                                      if (res.success) {
                                        toast({ title: 'Score Updated' });
                                        if (selectedSub.group) {
                                            const newGroup = [...selectedSub.group];
                                            newGroup[activeSubIdx] = { ...newGroup[activeSubIdx], score: numScore, status: 'Manual Grade' };
                                            setSelectedSub({ ...selectedSub, group: newGroup });
                                        } else {
                                            setSelectedSub({ ...selectedSub, score: numScore, status: 'Manual Grade' });
                                        }
                                        fetchSubmissions();
                                      }
                                    } finally { setIsUpdatingScore(false); }
                                 }} 
                                 disabled={isUpdatingScore || String(current.score) === editingScore}
                                 className="px-2 py-1 text-xs bg-[var(--primary)] text-white rounded font-bold disabled:opacity-50"
                              >
                                 {isUpdatingScore ? '...' : 'Save'}
                              </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Language</span>
                          <p className="text-[var(--text-primary)] font-medium mt-1 uppercase">{current.language}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Test Cases</span>
                          <p className="text-[var(--text-primary)] font-medium mt-1">
                            {current.passed_test_cases}/{current.total_test_cases}
                          </p>
                        </div>
                      </div>
                      <div className="h-[45vh] border border-[var(--border)] rounded-xl overflow-hidden">
                        <Editor
                          height="100%"
                          language={current.language?.toLowerCase() || 'javascript'}
                          value={current.code || ''}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                          }}
                        />
                      </div>

                      {/* ── Execution Output Section ── */}
                      {mlLoading && (
                        <div className="flex items-center gap-2 mt-4 text-[var(--text-secondary)] text-sm">
                          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                          Loading execution output...
                        </div>
                      )}

                      <div className="mt-5 space-y-4">

                        {/* ── Fallback: stdout from code_submissions (always visible if exists) ── */}
                        {!mlLoading && !mlExecData && current.stdout && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">📤 Output</p>
                            <pre className="bg-[#0d0d0f] border border-[rgba(42,255,255,0.15)] rounded-xl p-4 text-sm font-mono text-[#22d3ee] overflow-x-auto whitespace-pre-wrap max-h-52 overflow-y-auto">
                              {current.stdout}
                            </pre>
                          </div>
                        )}
                        {!mlLoading && !mlExecData && current.stderr && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1.5">⚠️ Error / Stderr</p>
                            <pre className="bg-[#0d0d0f] border border-[rgba(248,113,113,0.2)] rounded-xl p-4 text-sm font-mono text-red-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {current.stderr}
                            </pre>
                          </div>
                        )}

                        {/* ── Full ML Execution data (graphs, metrics, images, stdout) ── */}
                        {mlExecData && !mlLoading && (() => {
                          const { execution, graphs, images, metrics } = mlExecData;
                          return (
                            <>
                              {/* stdout */}
                              {execution?.stdout && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">📤 Output</p>
                                  <pre className="bg-[#0d0d0f] border border-[rgba(42,255,255,0.15)] rounded-xl p-4 text-sm font-mono text-[#22d3ee] overflow-x-auto whitespace-pre-wrap max-h-52 overflow-y-auto">
                                    {execution.stdout}
                                  </pre>
                                </div>
                              )}

                              {/* stderr */}
                              {execution?.stderr && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1.5">⚠️ Error / Stderr</p>
                                  <pre className="bg-[#0d0d0f] border border-[rgba(248,113,113,0.2)] rounded-xl p-4 text-sm font-mono text-red-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {execution.stderr}
                                  </pre>
                                </div>
                              )}

                              {/* Metrics */}
                              {metrics && metrics.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">📊 Metrics</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {metrics.map((m: any, i: number) => (
                                      <div key={i} className="bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.2)] rounded-xl p-3 text-center">
                                        <p className="text-xs text-[var(--text-secondary)] uppercase font-bold truncate">{m.metric_name}</p>
                                        <p className="text-lg font-extrabold text-[var(--primary)] mt-1">
                                          {typeof m.metric_value === 'number' ? m.metric_value.toFixed(4) : m.metric_value}
                                          {m.metric_unit ? <span className="text-xs ml-1 font-normal text-[var(--text-secondary)]">{m.metric_unit}</span> : null}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Graphs */}
                              {graphs && graphs.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">📈 Graphs</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {graphs.map((g: any, i: number) => (
                                      <div key={i} className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-xl overflow-hidden">
                                        {g.graph_title && <p className="text-xs font-bold text-[var(--text-secondary)] px-3 pt-2">{g.graph_title}</p>}
                                        <img
                                          src={g.base64_data}
                                          alt={g.graph_title || `Graph ${i + 1}`}
                                          className="w-full object-contain max-h-72"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Images */}
                              {images && images.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">🖼️ Images</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {images.map((img: any, i: number) => (
                                      <div key={i} className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-xl overflow-hidden">
                                        {img.image_label && <p className="text-xs font-bold text-[var(--text-secondary)] px-3 pt-2">{img.image_label}</p>}
                                        <img
                                          src={img.base64_data}
                                          alt={img.image_label || `Image ${i + 1}`}
                                          className="w-full object-contain max-h-72"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                      </div>


                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
