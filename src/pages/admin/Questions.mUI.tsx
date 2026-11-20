import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Save as SaveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/context/AdminContext';
import { questionSchema, QuestionForm } from '@/lib/validation';
import { adminAPI, Question, ExamConfig } from '@/lib/api';
import { useLookupData, useLookupSubjects, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';
import { ImageUpload } from '@/components/ImageUpload';

const FIELD_WIDTH = 220;

function QuestionFormFields({
  registerFn,
  errors,
  deptValue,
  sectionValue,
  yearValue,
  semesterValue,
  subjectValue,
  subjectOpts,
  correctOptValue,
  imageUrlValue,
  examDateValue,
  setValueFn,
  prefix,
  hideMetaFields,
}: {
  registerFn: ReturnType<typeof useForm<QuestionForm>>['register'];
  errors: ReturnType<typeof useForm<QuestionForm>>['formState']['errors'];
  deptValue: string;
  sectionValue: string;
  yearValue: string;
  semesterValue: string;
  subjectValue: string;
  subjectOpts: { label: string; value: string }[];
  correctOptValue: string;
  imageUrlValue?: string;
  examDateValue?: string;
  setValueFn: ReturnType<typeof useForm<QuestionForm>>['setValue'];
  prefix: string;
  hideMetaFields?: boolean;
}) {
  const { departments: DEPARTMENTS, sections: SECTIONS, years: YEARS, semesters: SEMESTERS } = useLookupData();

  return (
    <Stack spacing={2}>
      {!hideMetaFields && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}dept-label`}>Department</InputLabel>
            <Select
              labelId={`${prefix}dept-label`}
              label="Department"
              value={deptValue}
              {...registerFn('department')}
              onChange={(e) => setValueFn('department', e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <MenuItem key={d.value} value={d.value}>
                  {d.label}
                </MenuItem>
              ))}
            </Select>
            {errors.department && (
              <FormHelperText error>{errors.department.message}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}section-label`}>Section</InputLabel>
            <Select
              labelId={`${prefix}section-label`}
              label="Section"
              value={sectionValue}
              {...registerFn('section')}
              onChange={(e) => setValueFn('section', e.target.value)}
            >
              {SECTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
            {errors.section && (
              <FormHelperText error>{errors.section.message}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}year-label`}>Year</InputLabel>
            <Select
              labelId={`${prefix}year-label`}
              label="Year"
              value={yearValue}
              {...registerFn('year')}
              onChange={(e) => setValueFn('year', e.target.value)}
            >
              {YEARS.map((y) => (
                <MenuItem key={y.value} value={y.value}>
                  {y.label}
                </MenuItem>
              ))}
            </Select>
            {errors.year && (
              <FormHelperText error>{errors.year.message}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}semester-label`}>Semester</InputLabel>
            <Select
              labelId={`${prefix}semester-label`}
              label="Semester"
              value={semesterValue}
              {...registerFn('semester')}
              onChange={(e) => setValueFn('semester', e.target.value)}
            >
              {SEMESTERS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
            {errors.semester && (
              <FormHelperText error>{errors.semester.message}</FormHelperText>
            )}
          </FormControl>
        </Stack>
      )}

      <FormControl fullWidth>
        <InputLabel id={`${prefix}subject-label`}>Subject</InputLabel>
        <Select
          labelId={`${prefix}subject-label`}
          label="Subject"
          value={subjectValue}
          {...registerFn('subject')}
          onChange={(e) => setValueFn('subject', e.target.value)}
        >
          {subjectOpts.length > 0 ? (
            subjectOpts.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))
          ) : (
            <MenuItem value="" disabled>
              No subjects
            </MenuItem>
          )}
        </Select>
        {errors.subject && (
          <FormHelperText error>{errors.subject.message}</FormHelperText>
        )}
      </FormControl>

      <TextField
        label="Question"
        multiline
        minRows={3}
        fullWidth
        {...registerFn('question')}
        error={Boolean(errors.question)}
        helperText={errors.question?.message}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Option A"
            multiline
            minRows={2}
            fullWidth
            {...registerFn('optionA')}
            error={Boolean(errors.optionA)}
            helperText={errors.optionA?.message}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Option B"
            multiline
            minRows={2}
            fullWidth
            {...registerFn('optionB')}
            error={Boolean(errors.optionB)}
            helperText={errors.optionB?.message}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Option C"
            multiline
            minRows={2}
            fullWidth
            {...registerFn('optionC')}
            error={Boolean(errors.optionC)}
            helperText={errors.optionC?.message}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Option D"
            multiline
            minRows={2}
            fullWidth
            {...registerFn('optionD')}
            error={Boolean(errors.optionD)}
            helperText={errors.optionD?.message}
          />
        </Grid>
      </Grid>

      <FormControl component="fieldset" sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Correct Answer
        </Typography>
        <Stack direction="row" spacing={2}>
          {['A', 'B', 'C', 'D'].map((opt) => (
            <FormControlLabel
              key={opt}
              control={
                <Switch
                  checked={correctOptValue === opt}
                  onChange={() => setValueFn('correctOption', opt as any)}
                />
              }
              label={opt}
            />
          ))}
        </Stack>
        {errors.correctOption && (
          <FormHelperText error>{errors.correctOption.message}</FormHelperText>
        )}
      </FormControl>

      <TextField
        label="Exam Date"
        type="date"
        InputLabelProps={{ shrink: true }}
        value={examDateValue || ''}
        onChange={(e) => setValueFn('examDate', e.target.value)}
        fullWidth
      />

      <ImageUpload
        value={imageUrlValue}
        onChange={(url) => setValueFn('imageUrl', url)}
        label="Question Diagram (Optional)"
      />
    </Stack>
  );
}

export default function QuestionPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated, department: adminDept } = useAdmin();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterDept, setFilterDept] = useState<string>(() => adminDept || sessionStorage.getItem('q_filterDept') || 'ALL');
  const [filterSection, setFilterSection] = useState<string>(() => sessionStorage.getItem('q_filterSection') || 'ALL');
  const [filterYear, setFilterYear] = useState<string>(() => sessionStorage.getItem('q_filterYear') || 'ALL');
  const [filterSemester, setFilterSemester] = useState<string>(() => sessionStorage.getItem('q_filterSemester') || 'ALL');
  const [filterSubject, setFilterSubject] = useState<string>(() => sessionStorage.getItem('q_filterSubject') || 'ALL');
  const [filterDate, setFilterDate] = useState<Date | undefined>(() => {
    const saved = sessionStorage.getItem('q_filterDate');
    return saved ? new Date(saved) : undefined;
  });

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('q_filterDept', filterDept);
    sessionStorage.setItem('q_filterSection', filterSection);
    sessionStorage.setItem('q_filterYear', filterYear);
    sessionStorage.setItem('q_filterSemester', filterSemester);
    sessionStorage.setItem('q_filterSubject', filterSubject);
    if (filterDate) {
      sessionStorage.setItem('q_filterDate', filterDate.toISOString());
    } else {
      sessionStorage.removeItem('q_filterDate');
    }
  }, [filterDept, filterSection, filterYear, filterSemester, filterSubject, filterDate]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Exam config state
  const [configTimeLimit, setConfigTimeLimit] = useState<number>(15);
  const [configIsActive, setConfigIsActive] = useState<boolean>(false);
  const [configShuffleQuestions, setConfigShuffleQuestions] = useState<boolean>(false);
  const [isTogglingExam, setIsTogglingExam] = useState(false);
  const [isTogglingShuffle, setIsTogglingShuffle] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configShowPreviousScores, setConfigShowPreviousScores] = useState<boolean>(false);
  const [isTogglingPreviousScores, setIsTogglingPreviousScores] = useState(false);

  const { departments: DEPARTMENTS, sections: SECTIONS, years: YEARS, semesters: SEMESTERS } = useLookupData();

  const filterSubjectOptions = useLookupSubjectsForFilter(
    filterDept === 'ALL' ? undefined : filterDept,
    filterYear === 'ALL' ? undefined : filterYear,
    filterSemester === 'ALL' ? undefined : filterSemester
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    setValue: setEditValue,
    watch: watchEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
  });

  const department = watch('department');
  const section = watch('section');
  const year = watch('year');
  const semester = watch('semester');
  const subjectField = watch('subject');
  const correctOption = watch('correctOption');
  const imageUrl = watch('imageUrl');
  const examDateField = watch('examDate');

  const { subjects: addSubjectOptions } = useLookupSubjects(department, year, semester);

  const editDepartment = watchEdit('department');
  const editSection = watchEdit('section');
  const editYear = watchEdit('year');
  const editSemester = watchEdit('semester');
  const editSubjectField = watchEdit('subject');
  const editCorrectOption = watchEdit('correctOption');
  const editImageUrl = watchEdit('imageUrl');
  const editExamDateField = watchEdit('examDate');

  const { subjects: editSubjectOptions } = useLookupSubjects(editDepartment, editYear, editSemester);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const result = await adminAPI.getQuestions(
        filterDept === 'ALL' ? undefined : filterDept,
        filterSection === 'ALL' ? undefined : filterSection,
        filterYear === 'ALL' ? undefined : filterYear,
        filterSemester === 'ALL' ? undefined : filterSemester,
        filterSubject === 'ALL' ? undefined : filterSubject,
        filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined
      );

      if (Array.isArray(result)) {
        setQuestions(result);
      } else {
        setQuestions([]);
        if (result?.message) {
          toast({
            title: 'Info',
            description: result.message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch questions',
        variant: 'destructive',
      });
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExamConfig = async () => {
    if (
      filterDept === 'ALL' ||
      filterSection === 'ALL' ||
      filterYear === 'ALL' ||
      filterSemester === 'ALL' ||
      filterSubject === 'ALL'
    ) {
      setExamConfig(null);
      setConfigTimeLimit(15);
      setConfigIsActive(false);
      setConfigShuffleQuestions(false);
      setConfigShowPreviousScores(false);
      return;
    }

    try {
      const result = await adminAPI.getExamConfigs(
        filterDept,
        filterSection,
        filterYear,
        filterSemester,
        filterSubject,
        filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined
      );

      if (Array.isArray(result) && result.length > 0) {
        const config = result[0];
        setExamConfig(config);
        setConfigTimeLimit(config.time_limit);
        setConfigIsActive(config.is_active);
        setConfigShuffleQuestions(config.shuffle_questions);
        setConfigShowPreviousScores((config as any).show_previous_scores ?? false);
      } else {
        setExamConfig(null);
        setConfigTimeLimit(15);
        setConfigIsActive(false);
        setConfigShuffleQuestions(false);
        setConfigShowPreviousScores(false);
      }
    } catch (error) {
      console.error('Failed to fetch exam config:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (filterDept === 'ALL' || filterSection === 'ALL' || filterYear === 'ALL' || filterSemester === 'ALL' || filterSubject === 'ALL') {
      setQuestions([]);
      setExamConfig(null);
      return;
    }

    fetchQuestions();
    fetchExamConfig();
  }, [filterDept, filterSection, filterYear, filterSemester, filterSubject, filterDate, isAuthenticated]);

  const onSubmit = async (data: QuestionForm) => {
    setIsSubmitting(true);
    try {
      await adminAPI.addQuestion({
        department: data.department,
        section: data.section,
        year: data.year,
        semester: data.semester,
        subject: data.subject,
        question: data.question,
        optionA: data.optionA,
        optionB: data.optionB,
        optionC: data.optionC,
        optionD: data.optionD,
        correctOption: data.correctOption,
        imageUrl: data.imageUrl,
        examDate: data.examDate,
      });
      toast({
        title: 'Success',
        description: 'Question added successfully',
      });
      reset();
      setIsAddDialogOpen(false);
      fetchQuestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add question',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data: QuestionForm) => {
    if (!editingQuestion) return;
    setIsSubmitting(true);
    try {
      await adminAPI.updateQuestion(editingQuestion.id, {
        department: data.department,
        section: data.section,
        year: data.year,
        semester: data.semester,
        subject: data.subject,
        question: data.question,
        optionA: data.optionA,
        optionB: data.optionB,
        optionC: data.optionC,
        optionD: data.optionD,
        correctOption: data.correctOption,
        imageUrl: data.imageUrl,
        examDate: data.examDate,
      });
      toast({
        title: 'Success',
        description: 'Question updated successfully',
      });
      resetEdit();
      setIsEditDialogOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update question',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setEditValue('department', question.department);
    setEditValue('section', question.section);
    setEditValue('year', question.year || '1');
    setEditValue('semester', question.semester || '1');
    setEditValue('subject', question.subject || '');
    setEditValue('question', question.question);
    setEditValue('optionA', question.option_a);
    setEditValue('optionB', question.option_b);
    setEditValue('optionC', question.option_c);
    setEditValue('optionD', question.option_d);
    setEditValue('correctOption', question.correct_option);
    setEditValue('imageUrl', question.image_url);
    setEditValue('examDate', question.exam_date);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await adminAPI.deleteQuestion(id);
      toast({
        title: 'Deleted',
        description: 'Question deleted successfully',
      });
      fetchQuestions();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete question',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const handleSaveExamConfig = async () => {
    if (filterDept === 'ALL' || filterSection === 'ALL' || filterYear === 'ALL' || filterSemester === 'ALL' || filterSubject === 'ALL') {
      toast({
        title: 'Error',
        description: 'Please select all filters first',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingConfig(true);
    try {
      await adminAPI.upsertExamConfig({
        department: filterDept,
        section: filterSection,
        year: filterYear,
        semester: filterSemester,
        subject: filterSubject,
        timeLimit: configTimeLimit,
        isActive: configIsActive,
        examDate: filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined,
      });
      toast({
        title: 'Success',
        description: 'Exam configuration saved',
      });
      fetchExamConfig();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save exam config',
        variant: 'destructive',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleExam = async () => {
    if (filterDept === 'ALL' || filterSection === 'ALL' || filterYear === 'ALL' || filterSemester === 'ALL' || filterSubject === 'ALL') {
      toast({
        title: 'Error',
        description: 'Please select all filters first',
        variant: 'destructive',
      });
      return;
    }

    setIsTogglingExam(true);
    try {
      const newStatus = !configIsActive;
      const result = await adminAPI.toggleExamStatus(
        filterDept,
        filterSection,
        filterYear,
        filterSemester,
        filterSubject,
        newStatus,
        filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined
      );
      const resultAny = result as any;
      const errorMsg = resultAny?.error || resultAny?.details || resultAny?.message;
      if (!result || (resultAny?.message && !resultAny.message.toLowerCase().includes('success'))) {
        toast({
          title: 'Error',
          description: errorMsg || 'Failed to toggle exam status',
          variant: 'destructive',
        });
        return;
      }
      setConfigIsActive(newStatus);
      toast({
        title: newStatus ? 'Exam Ongoing' : 'Exam Suspended',
        description: newStatus ? 'Students can now take the exam' : 'Exam is now disabled',
      });
      await fetchExamConfig();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle exam status',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingExam(false);
    }
  };

  const handleToggleShuffle = async () => {
    if (filterDept === 'ALL' || filterSection === 'ALL' || filterYear === 'ALL' || filterSemester === 'ALL' || filterSubject === 'ALL') {
      toast({
        title: 'Error',
        description: 'Please select all filters first',
        variant: 'destructive',
      });
      return;
    }

    setIsTogglingShuffle(true);
    try {
      const newStatus = !configShuffleQuestions;
      const result = await adminAPI.toggleShuffleQuestions(
        filterDept,
        filterSection,
        filterYear,
        filterSemester,
        filterSubject,
        newStatus,
        filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined
      );
      const resultAny = result as any;
      const errorMsg = resultAny?.error || resultAny?.details || resultAny?.message;
      if (!result || (resultAny?.message && !resultAny.message.toLowerCase().includes('success'))) {
        toast({
          title: 'Error',
          description: errorMsg || 'Failed to toggle shuffle status',
          variant: 'destructive',
        });
        return;
      }
      setConfigShuffleQuestions(newStatus);
      toast({
        title: newStatus ? 'Shuffle ON' : 'Shuffle OFF',
        description: newStatus ? 'Questions will be shuffled for students' : 'Questions will appear in order',
      });
      await fetchExamConfig();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle shuffle status',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingShuffle(false);
    }
  };

  const handleTogglePreviousScores = async () => {
    if (filterDept === 'ALL' || filterSection === 'ALL' || filterYear === 'ALL' || filterSemester === 'ALL' || filterSubject === 'ALL') {
      toast({ title: 'Error', description: 'Please select all filters first', variant: 'destructive' });
      return;
    }

    setIsTogglingPreviousScores(true);
    try {
      const newStatus = !configShowPreviousScores;
      const result = await adminAPI.togglePreviousScores(
        filterDept,
        filterSection,
        filterYear,
        filterSemester,
        filterSubject,
        newStatus,
        filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined
      );
      const resultAny = result as any;
      if (!result || (resultAny?.message && !resultAny.message.toLowerCase().includes('success'))) {
        toast({ title: 'Error', description: resultAny?.message || 'Failed to toggle', variant: 'destructive' });
        return;
      }
      setConfigShowPreviousScores(newStatus);
      toast({
        title: newStatus ? 'Previous Scores Enabled' : 'Previous Scores Disabled',
        description: newStatus ? 'Students can view their previous scores' : 'Students cannot view previous scores',
      });
      await fetchExamConfig();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to toggle previous scores', variant: 'destructive' });
    } finally {
      setIsTogglingPreviousScores(false);
    }
  };

  // Check if filters are properly selected (not ALL)
  const filtersSelected =
    filterDept !== 'ALL' &&
    filterSection !== 'ALL' &&
    filterYear !== 'ALL' &&
    filterSemester !== 'ALL' &&
    filterSubject !== 'ALL';

  return (
    <AdminLayout onLogout={handleLogout}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Question Portal
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Manage your question bank and exam configuration.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="filter-dept-label">Department</InputLabel>
                <Select
                  labelId="filter-dept-label"
                  label="Department"
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  disabled={!!adminDept}
                >
                  {!adminDept && <MenuItem value="ALL">All Departments</MenuItem>}
                  {DEPARTMENTS.filter(d => !adminDept || d.value === adminDept).map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel id="filter-section-label">Section</InputLabel>
                <Select
                  labelId="filter-section-label"
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
                <InputLabel id="filter-year-label">Year</InputLabel>
                <Select
                  labelId="filter-year-label"
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
                <InputLabel id="filter-semester-label">Semester</InputLabel>
                <Select
                  labelId="filter-semester-label"
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
                <InputLabel id="filter-subject-label">Subject</InputLabel>
                <Select
                  labelId="filter-subject-label"
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
                    <MenuItem value="" disabled>
                      No subjects
                    </MenuItem>
                  )}
                </Select>
              </FormControl>

              <TextField
                label="Exam Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filterDate ? format(filterDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setFilterDate(e.target.value ? new Date(e.target.value) : undefined)}
                sx={{ minWidth: 180 }}
              />
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                startIcon={<FilterIcon />}
                onClick={fetchQuestions}
                disabled={!filtersSelected}
              >
                Apply Filters
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add Question
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {filtersSelected ? (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title="Exam Configuration"
            subheader="Control test settings for the selected class/subject."
          />
          <CardContent>
            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems="center">
              <TextField
                label="Time Limit (minutes)"
                type="number"
                value={configTimeLimit}
                onChange={(e) => setConfigTimeLimit(Number(e.target.value))}
                sx={{ minWidth: 160 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={configIsActive}
                    onChange={() => setConfigIsActive(!configIsActive)}
                    color="primary"
                  />
                }
                label={configIsActive ? 'Exam Active' : 'Exam Inactive'}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={configShuffleQuestions}
                    onChange={() => setConfigShuffleQuestions(!configShuffleQuestions)}
                    color="primary"
                  />
                }
                label={configShuffleQuestions ? 'Shuffle Questions' : 'No Shuffle'}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={configShowPreviousScores}
                    onChange={() => setConfigShowPreviousScores(!configShowPreviousScores)}
                    color="primary"
                  />
                }
                label={configShowPreviousScores ? 'Previous Scores Visible' : 'Previous Scores Hidden'}
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveExamConfig}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                Save
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Questions"
          subheader={
            filtersSelected
              ? `${questions.length} question${questions.length === 1 ? '' : 's'} found`
              : 'Select all filters to view questions'
          }
        />
        <Divider />
        <CardContent>
          {filtersSelected ? (
            isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : questions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  No questions found for the selected filters.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add First Question
                </Button>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Question</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Year</TableCell>
                      <TableCell>Sem</TableCell>
                      <TableCell>Correct</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id} hover>
                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Typography noWrap>{q.question}</Typography>
                        </TableCell>
                        <TableCell>{q.subject}</TableCell>
                        <TableCell>{q.department}</TableCell>
                        <TableCell>{q.year}</TableCell>
                        <TableCell>{q.semester}</TableCell>
                        <TableCell>
                          <Chip label={q.correct_option} color="success" size="small" />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEdit(q)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDelete(q.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <FilterIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Select all filters to view questions.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Question Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon />
            <span>Add New Question</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
            <QuestionFormFields
              registerFn={register}
              errors={errors}
              deptValue={department}
              sectionValue={section}
              yearValue={year}
              semesterValue={semester}
              subjectValue={subjectField}
              subjectOpts={addSubjectOptions}
              correctOptValue={correctOption}
              imageUrlValue={imageUrl}
              examDateValue={examDateField}
              setValueFn={setValue}
              prefix="add-"
              hideMetaFields={filtersSelected}
            />

            <DialogActions sx={{ mt: 2 }}>
              <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={<AddIcon />}>
                {isSubmitting ? <CircularProgress size={18} /> : 'Add Question'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon />
            <span>Edit Question</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmitEdit(onEditSubmit)} sx={{ mt: 2 }}>
            <QuestionFormFields
              registerFn={registerEdit}
              errors={editErrors}
              deptValue={editDepartment}
              sectionValue={editSection}
              yearValue={editYear}
              semesterValue={editSemester}
              subjectValue={editSubjectField}
              subjectOpts={editSubjectOptions}
              correctOptValue={editCorrectOption}
              imageUrlValue={editImageUrl}
              examDateValue={editExamDateField}
              setValueFn={setEditValue}
              prefix="edit-"
              hideMetaFields={filtersSelected}
            />

            <DialogActions sx={{ mt: 2 }}>
              <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={<SaveIcon />}>
                {isSubmitting ? <CircularProgress size={18} /> : 'Update Question'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
