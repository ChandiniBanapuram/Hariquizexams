import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download as DownloadIcon, Delete as DeleteIcon, Search as SearchIcon,
  FilterList as FilterListIcon, Code as CodeIcon, Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon, Cancel as CancelIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';

import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI, codingAPI, Response } from '@/lib/api';
import { useLookupData, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function scoreColor(score: number, total: number) {
  if (!total) return 'gray';
  const pct = (score / total) * 100;
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'orange';
  return 'red';
}

const badgeClass = (color: string) => {
  switch (color) {
    case 'green': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800';
    case 'orange': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
    case 'red': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
  }
};

export default function ResultsScores() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated, department } = useAdmin();
  const lookup = useLookupData();

  const [responses, setResponses] = useState<Response[]>(() => {
    try {
      const cached = sessionStorage.getItem('results_responses_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [hasApplied, setHasApplied] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filters
  const [filterDate, setFilterDate] = useState(() => {
    return localStorage.getItem('results_filterDate') || '';
  });
  const [filterDept, setFilterDept] = useState(() => {
    // Use admin's own department if dept-scoped, else empty (show all)
    return department || '';
  });
  const [filterSection, setFilterSection] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('results_filterDate', filterDate);
  }, [filterDate]);

  useEffect(() => {
    localStorage.setItem('results_filterDept', filterDept);
  }, [filterDept]);

  useEffect(() => {
    localStorage.setItem('results_filterSection', filterSection);
  }, [filterSection]);

  useEffect(() => {
    localStorage.setItem('results_filterYear', filterYear);
  }, [filterYear]);

  useEffect(() => {
    localStorage.setItem('results_filterSemester', filterSemester);
  }, [filterSemester]);

  useEffect(() => {
    localStorage.setItem('results_filterSubject', filterSubject);
  }, [filterSubject]);

  // Distinct values that actually exist in MySQL (responses table).
  // Falls back to lookup data if the API call hasn't returned yet or is empty.
  type Opt = { label: string; value: string };
  const [distinct, setDistinct] = useState<{
    departments: Opt[]; sections: Opt[]; years: Opt[]; semesters: Opt[]; subjects: Opt[];
  }>({ departments: [], sections: [], years: [], semesters: [], subjects: [] });

  useEffect(() => {
    adminAPI.getFilterOptions({
      source: 'responses',
      department: filterDept || undefined,
      year: filterYear || undefined,
      semester: filterSemester || undefined,
    }).then((res: any) => {
      if (res && Array.isArray(res.departments)) setDistinct(res);
    }).catch(() => { /* keep fallback */ });
  }, [filterDept, filterYear, filterSemester]);

  const pickOptions = (live: Opt[], fallback: Opt[]) => (live.length ? live : fallback);
  const departments = pickOptions(distinct.departments, lookup.departments);
  const sections = pickOptions(distinct.sections, lookup.sections);
  const years = pickOptions(distinct.years, lookup.years);
  const semesters = pickOptions(distinct.semesters, lookup.semesters);
  const lookupSubjects = useLookupSubjectsForFilter(filterDept, filterYear, filterSemester);
  const subjects = pickOptions(distinct.subjects, lookupSubjects);


  const handleApply = async () => {
    if (responses.length === 0) {
      setIsLoading(true);
    }
    try {
      const [quizResult, codingResult] = await Promise.all([
        adminAPI.getResponses({
          date: filterDate || undefined,
          department: filterDept || undefined,
          section: filterSection || undefined,
          year: filterYear || undefined,
          semester: filterSemester || undefined,
          subject: filterSubject || undefined,
        }),
        codingAPI.getAdminSubmissions({
          examId: 'Exams',
          date: filterDate || undefined,
          department: filterDept || undefined,
          section: filterSection || undefined,
          year: filterYear || undefined,
          semester: filterSemester || undefined,
          subject: filterSubject || undefined,
          limit: 500
        }).catch(() => ({ submissions: [] }))
      ]);

      const parsedQuiz = Array.isArray(quizResult) ? quizResult.map(r => ({ ...r, type: 'mcq' })) : [];
      if (!Array.isArray(quizResult) && quizResult?.message) {
        console.error('[ResultsScores] getResponses error:', quizResult.message);
      }
      // Group and consolidate coding submissions by roll number + exam_id
      const groupedCodingMap = new Map();
      const examTotalQsMap = new Map();
      if (codingResult && Array.isArray(codingResult.submissions)) {
        codingResult.submissions.forEach((sub: any) => {
          if (sub.exam_id) {
            if (!examTotalQsMap.has(sub.exam_id)) {
              examTotalQsMap.set(sub.exam_id, new Set());
            }
            examTotalQsMap.get(sub.exam_id).add(sub.question_id);
          }
        });

        codingResult.submissions.forEach((c: any) => {
          const key = `${c.roll_number}_${c.exam_id || 'practice'}`;
          if (!groupedCodingMap.has(key)) {
            groupedCodingMap.set(key, {
              id: c.id,
              roll_number: c.roll_number,
              name: c.student_name,
              department: c.department || 'ALL',
              section: c.section || 'ALL',
              subject: c.question_subject || c.subject || 'Coding Assessment',
              exam_id: c.exam_id,
              scoresMap: new Map([[c.question_id, c.score]]),
              tab_switched: c.tab_switched ? 1 : 0,
              submitted_at: c.created_at,
              type: 'coding',
              qCount: 1,
              uniqueQs: new Set([c.question_id])
            });
          } else {
            const existing = groupedCodingMap.get(key);
            existing.qCount += 1;
            existing.uniqueQs.add(c.question_id);
            if (c.tab_switched) existing.tab_switched = 1;
            if (c.created_at > existing.submitted_at) existing.submitted_at = c.created_at;
            
            const prevScore = existing.scoresMap.get(c.question_id) || 0;
            if (c.score > prevScore) {
              existing.scoresMap.set(c.question_id, c.score);
            }
          }
        });
      }

      const parsedCoding = Array.from(groupedCodingMap.values()).map(g => {
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
          id: g.id,
          roll_number: g.roll_number,
          name: g.name,
          department: g.department,
          section: g.section,
          subject: `${g.subject} (${passedCount}/${totalQsForExam} Qs)`,
          score: combinedScore,
          total_marks: 100,
          tab_switched: g.tab_switched,
          submitted_at: g.submitted_at,
          type: 'coding',
          attempts: g.qCount
        };
      });

      const updatedData = [...parsedQuiz, ...parsedCoding];
      setResponses(updatedData);
      setHasApplied(true);
      try {
        sessionStorage.setItem('results_responses_cache', JSON.stringify(updatedData));
      } catch (_) {}
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch responses.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
    } else {
      // Clear any stale cached data and filters from previous sessions
      sessionStorage.removeItem('results_responses_cache');
      handleApply();
    }
  }, [isAuthenticated, navigate]);

  const handleResetFilters = () => {
    setFilterDate(''); setFilterDept(department || ''); setFilterSection(''); setFilterYear('');
    setFilterSemester(''); setFilterSubject(''); setSearch('');
    localStorage.removeItem('results_filterDate');
    localStorage.removeItem('results_filterDept');
    localStorage.removeItem('results_filterSection');
    localStorage.removeItem('results_filterYear');
    localStorage.removeItem('results_filterSemester');
    localStorage.removeItem('results_filterSubject');
    sessionStorage.removeItem('results_responses_cache');
    // Automatically re-apply empty filters to show all
    setTimeout(handleApply, 0);
  };

  const handleDeleteResponse = async (row: any) => {
    if (!window.confirm('Delete this response? This cannot be undone.')) return;
    try {
      let res;
      if (row.type === 'coding') {
        res = await codingAPI.deleteSubmission(row.id);
      } else {
        res = await adminAPI.deleteResponse(row.id);
      }

      if (res.success || res.message?.includes('success') || !res.error) {
        toast({ title: 'Deleted', description: 'Response removed.' });
        handleApply();
      } else {
        toast({ title: 'Error', description: res.message || res.error || 'Failed to delete.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete response.', variant: 'destructive' });
    }
  };

  // Split + search + sort + attempt count
  const enriched = useMemo(() => {
    // Count attempts per (roll_number, subject)
    const counts = new Map<string, number>();
    responses.forEach(r => {
      const key = `${r.roll_number}__${r.subject}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return responses.map(r => ({
      ...r,
      attempts: counts.get(`${r.roll_number}__${r.subject}`) || 1,
    }));
  }, [responses]);

  const quizScores = useMemo(() => enriched.filter(r => (r as any).type !== 'coding'), [enriched]);
  const codingScores = useMemo(() => enriched.filter(r => (r as any).type === 'coding'), [enriched]);

  const activeDataset = useMemo(() => {
    const base = tabIndex === 0 ? quizScores : codingScores;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter(r =>
          r.roll_number?.toLowerCase().includes(q) ||
          r.name?.toLowerCase().includes(q) ||
          r.subject?.toLowerCase().includes(q))
      : base;
    // Sort ascending by roll_number
    return [...filtered].sort((a, b) =>
      (a.roll_number || '').localeCompare(b.roll_number || '')
    );
  }, [tabIndex, quizScores, codingScores, search]);

  const totalPages = Math.ceil(activeDataset.length / itemsPerPage);
  const paginatedDataset = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return activeDataset.slice(startIndex, startIndex + itemsPerPage);
  }, [activeDataset, currentPage, itemsPerPage]);

  // Reset page when data or filter query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tabIndex, filterDate, filterDept, filterSection, filterYear, filterSemester, filterSubject]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const getRowKey = (r: Response) => `${(r as any).type || 'mcq'}_${r.id}`;

  const currentKeys = useMemo(() => paginatedDataset.map(getRowKey), [paginatedDataset]);
  const isAllSelected = useMemo(
    () => currentKeys.length > 0 && currentKeys.every(k => selectedIds.includes(k)),
    [currentKeys, selectedIds]
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentKeys])));
    } else {
      setSelectedIds(prev => prev.filter(k => !currentKeys.includes(k)));
    }
  };

  const handleToggleSelect = (key: string) => {
    setSelectedIds(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [tabIndex, search, filterDate, filterDept, filterSection, filterYear, filterSemester, filterSubject, currentPage]);

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected response(s)? This cannot be undone.`)) return;

    setIsLoading(true);
    try {
      const selectedRows = activeDataset.filter(r => selectedIds.includes(getRowKey(r)));
      let deletedCount = 0;
      for (const row of selectedRows) {
        let res;
        if ((row as any).type === 'coding') {
          res = await codingAPI.deleteSubmission(row.id);
        } else {
          res = await adminAPI.deleteResponse(row.id);
        }
        if (res?.success || res?.message?.includes('success') || !res?.error) {
          deletedCount++;
        }
      }
      toast({ title: 'Deleted', description: `${deletedCount} response(s) removed.` });
      setSelectedIds([]);
      handleApply();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete selected responses.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (activeDataset.length === 0) {
      toast({ title: 'No Data', description: 'Nothing to export.', variant: 'destructive' });
      return;
    }
    const data = activeDataset.map((r, i) => ({
      'S.No': i + 1,
      'Roll Number': r.roll_number,
      'Student Name': r.name,
      'Department': r.department,
      'Section': r.section || '-',
      'Subject': r.subject,
      'Score': `${r.score} / ${r.total_marks}`,
      'Tab Switched': r.tab_switched ? 'Yes' : 'No',
      'Date & Time': formatDateTime(r.submitted_at),
      'Attempts': r.attempts,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tabIndex === 0 ? 'Quiz' : 'Coding');
    XLSX.writeFile(wb, `Responses_${Date.now()}.xlsx`);
  };

  const [isRescoring, setIsRescoring] = useState(false);

  const handleRescoreAll = async () => {
    setIsRescoring(true);
    try {
      const res = await adminAPI.rescoreResponses();
      if (res && !res.error) {
        toast({ title: 'Success', description: res.message || 'Responses rescored successfully.' });
        handleApply();
      } else {
        toast({ title: 'Error', description: res?.message || 'Failed to rescore responses.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to rescore responses.', variant: 'destructive' });
    } finally {
      setIsRescoring(false);
    }
  };

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Responses
            </h1>
            <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">
              Apply filters to view student exam responses.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 flex items-center gap-2 transition-all shadow-sm"
                title="Delete selected responses"
              >
                <DeleteIcon style={{ fontSize: 18 }} />
                Delete Selected ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleRescoreAll}
              disabled={isRescoring}
              className="px-4 py-2.5 rounded-xl font-semibold text-[var(--primary)] border border-[var(--primary)] hover:bg-[rgba(99,102,241,0.08)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              title="Recalculate all response scores using updated question keys"
            >
              <AssessmentIcon style={{ fontSize: 18 }} />
              {isRescoring ? 'Rescoring…' : 'Rescore All'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={!hasApplied || activeDataset.length === 0}
              className="px-5 py-2.5 rounded-xl font-semibold text-white bg-[var(--primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              <DownloadIcon style={{ fontSize: 18 }} />
              Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--border)] flex items-center gap-2 bg-[rgba(99,102,241,0.04)]">
            <FilterListIcon className="text-[var(--primary)]" style={{ fontSize: 18 }} />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Filters</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Date</label>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Department</label>
              <select 
                value={filterDept} 
                onChange={e => { setFilterDept(e.target.value); setFilterSubject(''); }}
                disabled={!!department}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {!department && <option value="">All</option>}
                {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Year</label>
              <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSubject(''); }}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option value="">All</option>
                {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Section</label>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option value="">All</option>
                {sections.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Semester</label>
              <select value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setFilterSubject(''); }}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option value="">All</option>
                {semesters.map(s => <option key={s.value} value={s.value}>{`Semester ${s.label.replace(/Sem\s*/i, '')}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Subject</label>
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option value="">All</option>
                {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" style={{ fontSize: 16 }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Roll, name…"
                  className="w-full pl-8 pr-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
              </div>
            </div>
          </div>
          <div className="px-6 pb-5 flex items-center justify-end gap-2">
            <button onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)] rounded-lg transition-colors">
              Reset
            </button>
            <button onClick={handleApply} disabled={isLoading}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 transition-all">
              {isLoading ? 'Loading…' : 'Apply Filters'}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!hasApplied && (
          <div className="bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)] p-16 text-center">
            <FilterListIcon className="text-[var(--text-secondary)] mb-3" style={{ fontSize: 40 }} />
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">No data yet</h3>
            <p className="text-sm text-[var(--text-secondary)]">Choose filters above and click Apply to see responses.</p>
          </div>
        )}

        {/* Results table */}
        {hasApplied && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-[var(--border)] flex">
              <button onClick={() => setTabIndex(0)}
                className={`flex-1 px-6 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tabIndex === 0 ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[rgba(99,102,241,0.04)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                <AssessmentIcon style={{ fontSize: 18 }} /> Quiz Responses ({quizScores.length})
              </button>
              <button onClick={() => setTabIndex(1)}
                className={`flex-1 px-6 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tabIndex === 1 ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[rgba(99,102,241,0.04)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                <CodeIcon style={{ fontSize: 18 }} /> Coding Responses ({codingScores.length})
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[var(--text-secondary)]">Loading responses...</p>
              </div>
            ) : activeDataset.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[var(--text-secondary)]">No responses match the filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[rgba(99,102,241,0.03)] border-b border-[var(--border)]">
                    <tr>
                      {['Roll Number','Student Name','Department','Section','Subject','Score','Tab Switch','Date & Time','Attempts'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                      <th className="px-5 py-3.5 text-center text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <span>Actions</span>
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                            title="Select all on this page"
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedDataset.map((r) => {
                      const color = scoreColor(r.score, r.total_marks);
                      const key = getRowKey(r);
                      const isSelected = selectedIds.includes(key);
                      return (
                        <tr key={r.id} className={`transition-colors ${isSelected ? 'bg-[rgba(99,102,241,0.08)] dark:bg-[rgba(99,102,241,0.15)]' : 'hover:bg-[rgba(99,102,241,0.04)]'}`}>
                          <td className="px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.roll_number}</td>
                          <td className="px-5 py-3.5 text-sm text-[var(--text-primary)]">{r.name}</td>
                          <td className="px-5 py-3.5 text-sm text-[var(--text-secondary)]">{r.department}</td>
                          <td className="px-5 py-3.5 text-sm text-[var(--text-secondary)]">{r.section || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-[var(--text-secondary)]">{r.subject}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${badgeClass(color)}`}>
                              {Math.floor(r.score)} / {r.total_marks}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {r.tab_switched ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${badgeClass('red')}`}>
                                <CancelIcon style={{ fontSize: 14 }} /> Yes
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${badgeClass('green')}`}>
                                <CheckCircleIcon style={{ fontSize: 14 }} /> No
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDateTime(r.submitted_at)}</td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] text-center">{r.attempts}</td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(key)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                              />
                              <button onClick={() => handleDeleteResponse(r)}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors" title="Delete">
                                <DeleteIcon className="text-red-600 dark:text-red-400" style={{ fontSize: 18 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination controls */}
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
                    Showing {activeDataset.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, activeDataset.length)} of {activeDataset.length} entries
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
            </>
          )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
