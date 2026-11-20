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
  watchFn,
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
  watchFn: ReturnType<typeof useForm<QuestionForm>>['watch'];
  prefix: string;
  hideMetaFields?: boolean;
}) {
  const { departments: DEPARTMENTS, sections: SECTIONS, years: YEARS, semesters: SEMESTERS } = useLookupData();
  const questionType = (watchFn('questionType') as 'mcq' | 'fill_blank') || 'mcq';
  const options = (watchFn('options') as string[] | undefined) || ['', '', '', ''];
  const correctIndex = (watchFn('correctIndex') as number | undefined);
  const acceptedAnswers = (watchFn('acceptedAnswers') as string[] | undefined) || [''];

  const updateOption = (idx: number, val: string) => {
    const next = [...options]; next[idx] = val;
    setValueFn('options' as any, next as any, { shouldValidate: true });
  };
  const addOption = () => {
    if (options.length >= 6) return;
    setValueFn('options' as any, [...options, ''] as any);
  };
  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== idx);
    setValueFn('options' as any, next as any);
    if (correctIndex != null && correctIndex >= next.length) setValueFn('correctIndex' as any, next.length - 1 as any);
  };
  const updateAnswer = (idx: number, val: string) => {
    const next = [...acceptedAnswers]; next[idx] = val;
    setValueFn('acceptedAnswers' as any, next as any, { shouldValidate: true });
  };
  const addAnswer = () => setValueFn('acceptedAnswers' as any, [...acceptedAnswers, ''] as any);
  const removeAnswer = (idx: number) => {
    if (acceptedAnswers.length <= 1) return;
    setValueFn('acceptedAnswers' as any, acceptedAnswers.filter((_, i) => i !== idx) as any);
  };

  return (
    <Stack spacing={2}>
      {!hideMetaFields && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}dept-label`}>Department</InputLabel>
            <Select labelId={`${prefix}dept-label`} label="Department" value={deptValue}
              {...registerFn('department')} onChange={(e) => setValueFn('department', e.target.value)}>
              {DEPARTMENTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
            {errors.department && <FormHelperText error>{errors.department.message}</FormHelperText>}
          </FormControl>
          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}section-label`}>Section</InputLabel>
            <Select labelId={`${prefix}section-label`} label="Section" value={sectionValue}
              {...registerFn('section')} onChange={(e) => setValueFn('section', e.target.value)}>
              {SECTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
            {errors.section && <FormHelperText error>{errors.section.message}</FormHelperText>}
          </FormControl>
          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}year-label`}>Year</InputLabel>
            <Select labelId={`${prefix}year-label`} label="Year" value={yearValue}
              {...registerFn('year')} onChange={(e) => setValueFn('year', e.target.value)}>
              {YEARS.map((y) => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
            </Select>
            {errors.year && <FormHelperText error>{errors.year.message}</FormHelperText>}
          </FormControl>
          <FormControl fullWidth sx={{ minWidth: FIELD_WIDTH }}>
            <InputLabel id={`${prefix}semester-label`}>Semester</InputLabel>
            <Select labelId={`${prefix}semester-label`} label="Semester" value={semesterValue}
              {...registerFn('semester')} onChange={(e) => setValueFn('semester', e.target.value)}>
              {SEMESTERS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
            {errors.semester && <FormHelperText error>{errors.semester.message}</FormHelperText>}
          </FormControl>
        </Stack>
      )}

      <FormControl fullWidth>
        <InputLabel id={`${prefix}subject-label`}>Subject</InputLabel>
        <Select labelId={`${prefix}subject-label`} label="Subject" value={subjectValue}
          {...registerFn('subject')} onChange={(e) => setValueFn('subject', e.target.value)}>
          {subjectOpts.length > 0 ? (
            subjectOpts.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)
          ) : (
            <MenuItem value="" disabled>No subjects</MenuItem>
          )}
        </Select>
        {errors.subject && <FormHelperText error>{errors.subject.message}</FormHelperText>}
      </FormControl>

      {/* Question Type Selector */}
      <FormControl fullWidth>
        <InputLabel id={`${prefix}qtype-label`}>Question Type</InputLabel>
        <Select
          labelId={`${prefix}qtype-label`}
          label="Question Type"
          value={questionType}
          onChange={(e) => setValueFn('questionType' as any, e.target.value as any, { shouldValidate: true })}
        >
          <MenuItem value="mcq">Multiple Choice</MenuItem>
          <MenuItem value="fill_blank">Fill in the Blank</MenuItem>
        </Select>
      </FormControl>

      <TextField label="Question" multiline minRows={3} fullWidth
        {...registerFn('question')} error={Boolean(errors.question)} helperText={errors.question?.message} />

      {questionType === 'mcq' ? (
        <>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Options (2–6)</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addOption} disabled={options.length >= 6}>
                Add option
              </Button>
            </Stack>
            {(errors as any).options && (
              <FormHelperText error>{((errors as any).options?.message) || 'Fix options'}</FormHelperText>
            )}
            {options.map((opt, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <FormControlLabel
                  control={<Switch checked={correctIndex === i} onChange={() => setValueFn('correctIndex' as any, i as any, { shouldValidate: true })} />}
                  label={<Chip label={correctIndex === i ? 'Correct' : `#${i + 1}`} size="small" color={correctIndex === i ? 'success' : 'default'} />}
                  sx={{ m: 0 }}
                />
                <TextField
                  fullWidth size="small" value={opt} onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <IconButton size="small" color="error" onClick={() => removeOption(i)} disabled={options.length <= 2}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {(errors as any).correctIndex && (
              <FormHelperText error>{(errors as any).correctIndex.message}</FormHelperText>
            )}
          </Stack>
        </>
      ) : (
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Accepted Answers</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addAnswer}>Add answer</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            A student's answer is marked correct if it matches any of these (case-insensitive, contains, or ≥80% similar).
          </Typography>
          {acceptedAnswers.map((ans, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth size="small" value={ans} onChange={(e) => updateAnswer(i, e.target.value)}
                placeholder={`Accepted answer ${i + 1}`}
              />
              <IconButton size="small" color="error" onClick={() => removeAnswer(i)} disabled={acceptedAnswers.length <= 1}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {(errors as any).acceptedAnswers && (
            <FormHelperText error>{(errors as any).acceptedAnswers.message}</FormHelperText>
          )}
        </Stack>
      )}

      <TextField label="Exam Date" type="date" InputLabelProps={{ shrink: true }}
        value={examDateValue || ''} onChange={(e) => setValueFn('examDate', e.target.value)} fullWidth />

      <ImageUpload value={imageUrlValue} onChange={(url) => setValueFn('imageUrl', url)} label="Question Diagram (Optional)" />
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
        department: data.department, section: data.section, year: data.year,
        semester: data.semester, subject: data.subject, question: data.question,
        questionType: data.questionType || 'mcq',
        options: data.options,
        correctIndex: data.correctIndex,
        acceptedAnswers: data.acceptedAnswers,
        optionA: data.optionA, optionB: data.optionB, optionC: data.optionC, optionD: data.optionD,
        correctOption: data.correctOption,
        imageUrl: data.imageUrl, examDate: data.examDate,
      });
      toast({ title: 'Success', description: 'Question added successfully' });
      reset({ questionType: 'mcq', options: ['', '', '', ''], correctIndex: 0, acceptedAnswers: [''] } as any);
      setIsAddDialogOpen(false);
      fetchQuestions();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add question', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data: QuestionForm) => {
    if (!editingQuestion) return;
    setIsSubmitting(true);
    try {
      await adminAPI.updateQuestion(editingQuestion.id, {
        department: data.department, section: data.section, year: data.year,
        semester: data.semester, subject: data.subject, question: data.question,
        questionType: data.questionType || 'mcq',
        options: data.options,
        correctIndex: data.correctIndex,
        acceptedAnswers: data.acceptedAnswers,
        optionA: data.optionA, optionB: data.optionB, optionC: data.optionC, optionD: data.optionD,
        correctOption: data.correctOption,
        imageUrl: data.imageUrl, examDate: data.examDate,
      });
      toast({ title: 'Success', description: 'Question updated successfully' });
      resetEdit();
      setIsEditDialogOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update question', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    const type = (question.question_type as 'mcq' | 'fill_blank') || 'mcq';
    const opts = question.options && question.options.length
      ? question.options
      : [question.option_a || '', question.option_b || '', question.option_c || '', question.option_d || ''];
    const idx = question.correct_answer_index != null
      ? question.correct_answer_index
      : (question.correct_option ? 'ABCD'.indexOf(question.correct_option) : 0);

    resetEdit({
      department: question.department,
      section: question.section,
      year: question.year || '1',
      semester: question.semester || '1',
      subject: question.subject || '',
      question: question.question,
      questionType: type,
      options: opts,
      correctIndex: idx >= 0 ? idx : 0,
      acceptedAnswers: question.accepted_answers && question.accepted_answers.length ? question.accepted_answers : [''],
      optionA: question.option_a || '',
      optionB: question.option_b || '',
      optionC: question.option_c || '',
      optionD: question.option_d || '',
      correctOption: (question.correct_option as any) || undefined,
      imageUrl: question.image_url,
      examDate: question.exam_date,
    } as any);
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
      <Box sx={{ mb: 4, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Question Portal
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Manage your question bank and exam parameters.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { reset({ questionType: 'mcq', options: ['', '', '', ''], correctIndex: 0, acceptedAnswers: [''] } as any); setIsAddDialogOpen(true); }}
        >
          Add Question
        </Button>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ mb: 3, p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 2 }}>
          Filters
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select 
                value={filterDept} 
                label="Department" 
                onChange={(e) => setFilterDept(e.target.value)}
                disabled={!!adminDept}
              >
                {!adminDept && <MenuItem value="ALL">All Departments</MenuItem>}
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
              <InputLabel>Semester</InputLabel>
              <Select value={filterSemester} label="Semester" onChange={(e) => setFilterSemester(e.target.value)}>
                <MenuItem value="ALL">All Semesters</MenuItem>
                {SEMESTERS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Subject</InputLabel>
              <Select value={filterSubject} label="Subject" onChange={(e) => setFilterSubject(e.target.value)}>
                <MenuItem value="ALL">All Subjects</MenuItem>
                {filterSubjectOptions.length > 0 ? (
                  filterSubjectOptions.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)
                ) : (
                  <MenuItem value="" disabled>No subjects</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              size="small"
              fullWidth
              label="Date"
              InputLabelProps={{ shrink: true }}
              value={filterDate ? format(filterDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFilterDate(e.target.value ? new Date(e.target.value) : undefined)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button fullWidth variant="outlined" onClick={fetchQuestions}>
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Exam Config */}
      {filtersSelected && (
        <Paper variant="outlined" sx={{ mb: 3, p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Exam Configuration</Typography>
          <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems="center">
            <TextField
              type="number"
              size="small"
              label="Time Limit (min)"
              value={configTimeLimit}
              onChange={(e) => setConfigTimeLimit(Number(e.target.value))}
              sx={{ width: { xs: '100%', md: 160 } }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={configIsActive}
                  onChange={() => setConfigIsActive(!configIsActive)}
                  color="primary"
                />
              }
              label={configIsActive ? 'Exam Live' : 'Exam Hidden'}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={configShuffleQuestions}
                  onChange={() => setConfigShuffleQuestions(!configShuffleQuestions)}
                  color="primary"
                />
              }
              label={configShuffleQuestions ? 'Shuffle ON' : 'Shuffle OFF'}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={configShowPreviousScores}
                  onChange={() => setConfigShowPreviousScores(!configShowPreviousScores)}
                  color="primary"
                />
              }
              label={configShowPreviousScores ? 'Scores Visible' : 'Scores Hidden'}
            />

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveExamConfig}
              disabled={isSavingConfig}
            >
              {isSavingConfig ? 'Saving...' : 'Save Config'}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Questions Table */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Questions</Typography>
          <Typography variant="caption" color="text.secondary">
            {filtersSelected ? `${questions.length} records found` : 'Select all filters to view questions'}
          </Typography>
        </Box>
        <Divider />
        {filtersSelected ? (
          isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : questions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>No questions found</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAddDialogOpen(true)}>
                Add First Question
              </Button>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Question</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Subject</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Mapping</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Answer</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={q.id} hover>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>{q.question}</Typography>
                      </TableCell>
                      <TableCell>{q.subject}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {q.department} • Y{q.year}/S{q.semester}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={q.correct_option} color="success" variant="outlined" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => handleEdit(q)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(q.id)}>
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
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <FilterIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
            <Typography color="text.secondary">Select all filters to view questions</Typography>
          </Box>
        )}
      </Paper>

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
              watchFn={watch}
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
              watchFn={watchEdit}
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
