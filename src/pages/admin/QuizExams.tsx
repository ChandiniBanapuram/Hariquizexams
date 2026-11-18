import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Typography, CircularProgress, TextField, MenuItem,
  FormControl, InputLabel, Select, IconButton, LinearProgress,
  InputBase, Divider, Switch, FormControlLabel, Tooltip, Radio,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, UploadFile as UploadIcon,
  Search as SearchIcon, Save as SaveIcon, PowerSettingsNew as PowerIcon,
  Shuffle as ShuffleIcon, Visibility as VisibilityIcon,
  ContentCopy as CopyIcon, Download as DownloadIcon
} from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLookupData, useLookupSubjects } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';

import mammoth from 'mammoth';
import { ImageUpload } from '@/components/ImageUpload';

export default function QuizExams() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { departments, years, semesters, sections } = useLookupData();

  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [hasSearched, setHasSearched] = useState(() => {
    return localStorage.getItem('quiz_hasSearched') === 'true';
  });

  // Step 1: Exam Data
  const [examConf, setExamConf] = useState(() => {
    const saved = localStorage.getItem('quiz_examConf');
    return saved ? JSON.parse(saved) : {
      date: '', dept: '', sec: 'ALL', year: '', sem: '', subj: '',
      timeLimit: 60, questionCount: '' as string | number, isVisible: false, shuffle: false, showPrev: true
    };
  });
  const [showEditor, setShowEditor] = useState(false);
  const { subjects } = useLookupSubjects(examConf.dept, examConf.year, examConf.sem);

  // Step 2: Question Data List
  const [questions, setQuestions] = useState<any[]>([]);

  const isFirstRender = useRef(true);

  // Persist config and search state
  useEffect(() => {
    localStorage.setItem('quiz_examConf', JSON.stringify(examConf));
  }, [examConf]);

  useEffect(() => {
    localStorage.setItem('quiz_hasSearched', hasSearched.toString());
  }, [hasSearched]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  // Auto-search on mount if filters were already applied before refresh
  // Clean up config on client-side navigation away from this page
  useEffect(() => {
    let isReloading = false;
    const handleBeforeUnload = () => {
      isReloading = true;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const savedHasSearched = localStorage.getItem('quiz_hasSearched') === 'true';
    let t: ReturnType<typeof setTimeout>;
    if (savedHasSearched) {
      const savedConf = localStorage.getItem('quiz_examConf');
      if (savedConf) {
        const parsed = JSON.parse(savedConf);
        if (parsed.date && parsed.dept && parsed.year && parsed.sem && parsed.subj) {
          // Trigger search automatically after a short delay to let component mount
          t = setTimeout(() => {
            handleSearch();
          }, 300);
        }
      }
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (t) clearTimeout(t);
      if (!isReloading) {
        localStorage.removeItem('quiz_examConf');
        localStorage.removeItem('quiz_hasSearched');
      }
    };
  }, []);

  useEffect(() => {
    if (examConf.subj) {
      try {
        const savedMap = localStorage.getItem(`quiz_config_${examConf.subj}`);
        if (savedMap) {
          const parsed = JSON.parse(savedMap);
          setExamConf(prev => ({
            ...prev,
            shuffle: !!parsed.shuffle,
            showPrev: parsed.showPrev !== false,
          }));
        }
      } catch (e) { }
    }
  }, [examConf.subj]);

  // Reset subject when dept/year/sem changes to fix subject loading (skipped on initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setExamConf(prev => ({ ...prev, subj: '' }));
    setShowEditor(false);
    setHasSearched(false);
  }, [examConf.dept, examConf.year, examConf.sem]);

  const mapBackendQuestionToState = (q: any) => {
    const qType = q.question_type || 'mcq';
    let parsedOptions = q.options;
    if (typeof parsedOptions === 'string') {
      try { parsedOptions = JSON.parse(parsedOptions); } catch { parsedOptions = null; }
    }
    if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
      parsedOptions = [q.option_a, q.option_b, q.option_c, q.option_d].filter(v => v !== null && v !== undefined && v !== '');
      if (parsedOptions.length === 0) {
        parsedOptions = ['', '', '', ''];
      }
    }
    let parsedCorrect = q.correct_answer_index;
    if (parsedCorrect == null && q.correct_option) {
      parsedCorrect = 'ABCD'.indexOf(q.correct_option.toUpperCase());
      if (parsedCorrect < 0) parsedCorrect = 0;
    }
    if (parsedCorrect == null) parsedCorrect = 0;

    let parsedAccepted = q.accepted_answers;
    if (typeof parsedAccepted === 'string') {
      try { parsedAccepted = JSON.parse(parsedAccepted); } catch { parsedAccepted = null; }
    }
    if (!Array.isArray(parsedAccepted)) {
      parsedAccepted = [''];
    }

    return {
      id: q.id,
      q: q.question,
      questionType: qType,
      options: parsedOptions,
      correctIndex: parsedCorrect,
      acceptedAnswers: parsedAccepted,
      imageUrl: q.image_url || ''
    };
  };

  const loadExistingQuestions = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getQuestions();
      if (Array.isArray(data)) {
        const scopedQs = data.filter(q => {
          if (q.subject !== examConf.subj) return false;
          if (!q.exam_date) return false;
          try {
            const qDate = new Date(q.exam_date).toISOString().split('T')[0];
            return qDate === examConf.date;
          } catch (e) { return false; }
        });

        if (scopedQs.length > 0) {
          setQuestions(scopedQs.map(mapBackendQuestionToState));
        } else {
          setQuestions([]);
        }
      }
    } catch (err) {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!examConf.date || !examConf.dept || !examConf.year || !examConf.sem || !examConf.subj) {
      return toast({ title: 'Missing Details', description: 'Please fill all fields including Date before searching.', variant: 'destructive' });
    }
    setLoading(true);
    try {
      const configs = await adminAPI.getExamConfigs(
        examConf.dept, examConf.sec !== 'ALL' ? examConf.sec : undefined,
        examConf.year, examConf.sem, examConf.subj, examConf.date
      );
      if (Array.isArray(configs) && configs.length > 0) {
        const cfg = configs[0];
        setExamConf(prev => ({
          ...prev,
          timeLimit: cfg.time_limit ?? cfg.duration ?? prev.timeLimit,
          isVisible: !!cfg.is_active,
          shuffle: cfg.shuffle_questions ?? prev.shuffle,
        }));
      }
      const data = await adminAPI.getQuestions(
        examConf.dept, examConf.sec !== 'ALL' ? examConf.sec : undefined,
        examConf.year, examConf.sem, examConf.subj, examConf.date
      );
      if (Array.isArray(data) && data.length > 0) {
        setQuestions(data.map(mapBackendQuestionToState));
      } else {
        setQuestions([]);
      }
    } catch (err) {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
    setShowEditor(true);
    setHasSearched(true);
  };

  const handleAddQuestionSlot = (type: 'mcq' | 'fill_blank') => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        q: '',
        questionType: type,
        options: type === 'mcq' ? ['', '', '', ''] : [],
        correctIndex: 0,
        acceptedAnswers: type === 'fill_blank' ? [''] : [],
        imageUrl: ''
      }
    ]);
  };

  const handleAddOption = (qId: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        if (q.options.length >= 4) return q;
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const handleDeleteOption = (qId: number, optIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        if (q.options.length <= 2) return q;
        const nextOptions = q.options.filter((_, i) => i !== optIndex);
        let nextCorrect = q.correctIndex;
        if (nextCorrect >= nextOptions.length) {
          nextCorrect = nextOptions.length - 1;
        }
        return { ...q, options: nextOptions, correctIndex: nextCorrect };
      }
      return q;
    }));
  };

  const handleRemoveQuestion = async (id: number) => {
    if (questions.length <= 1) return toast({ title: 'Cannot Delete', description: 'Exam must have at least one question.', variant: 'destructive' });

    if (id < 1000000000000) {
      try {
        await adminAPI.deleteQuestion(id);
      } catch (e) { }
    }
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestionState = (id: number, field: string, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleWordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.doc') && !file.name.toLowerCase().endsWith('.docx')) {
      return toast({ title: 'Invalid File', description: 'Please upload a .doc or .docx file', variant: 'destructive' });
    }

    setIsParsing(true);
    toast({ title: 'Importing Questions', description: 'Extracting data from Word Document...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      if (!text.trim()) {
        throw new Error('Word document appears to be empty.');
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let extracted: any[] = [];
      let currentQ: any = null;
      let lastOption = '';

      lines.forEach(line => {
        if (/^(Q\d+[\.\):]|\d+Q[\.\):]|\d+[\.\)])\s*/i.test(line)) {
          if (currentQ) {
            if (currentQ.options.length === 0 || currentQ.options.every((o: string) => !o)) {
              currentQ.questionType = 'fill_blank';
              currentQ.options = [];
            }
            extracted.push(currentQ);
          }
          currentQ = {
            id: Date.now() + Math.random(),
            q: line.replace(/^(Q\d+[\.\):]|\d+Q[\.\):]|\d+[\.\)])\s*/i, '').trim(),
            questionType: 'mcq',
            options: ['', '', '', ''],
            correctIndex: 0,
            acceptedAnswers: [],
            imageUrl: ''
          };
          lastOption = '';
        }
        else if (currentQ && /^[A-Da-d][\.\):\s]/i.test(line)) {
          const choice = line[0].toUpperCase();
          const content = line.replace(/^[A-Da-d][\.\):\s]\s*/i, '').trim();
          const optIdx = 'ABCD'.indexOf(choice);
          if (optIdx >= 0) {
            currentQ.options[optIdx] = content;
            lastOption = choice;
          }
        }
        else if (currentQ && /^(Answer|Ans|Correct)\s*[:=]\s*(.+)/i.test(line)) {
          const match = line.match(/^(Answer|Ans|Correct)\s*[:=]\s*(.+)/i);
          if (match) {
            const ansText = match[2].trim();
            const isSingleLetterOption = /^[A-D]$/i.test(ansText);
            const hasOptions = currentQ.options.some((o: string) => o && o.trim().length > 0);

            if (isSingleLetterOption && hasOptions) {
              currentQ.questionType = 'mcq';
              currentQ.correctIndex = 'ABCD'.indexOf(ansText.toUpperCase());
            } else {
              currentQ.questionType = 'fill_blank';
              currentQ.options = [];
              currentQ.acceptedAnswers = ansText.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          lastOption = '';
        }
        else if (currentQ && !lastOption) {
          currentQ.q += ' ' + line;
        }
        else if (currentQ && lastOption) {
          const optIdx = 'ABCD'.indexOf(lastOption);
          if (optIdx >= 0) {
            currentQ.options[optIdx] += ' ' + line;
          }
        }
      });

      if (currentQ) {
        if (currentQ.options.length === 0 || currentQ.options.every((o: string) => !o)) {
          currentQ.questionType = 'fill_blank';
          currentQ.options = [];
        }
        extracted.push(currentQ);
      }

      if (extracted.length === 0) {
        throw new Error('No questions found. Check your document formatting.');
      }

      const newQuestions = (() => {
        const prev = questions;
        if (prev.length === 1 && !prev[0].q && (!prev[0].options || prev[0].options.every((o: string) => !o))) return extracted;
        return [...prev, ...extracted];
      })();
      setQuestions(newQuestions);

      toast({ title: 'Saving Questions', description: `Extracted ${extracted.length} questions. Saving to database...` });

      if (!examConf.date || !examConf.dept || !examConf.sem || !examConf.subj) {
        toast({ title: 'Import Done (Not Saved)', description: `Extracted ${extracted.length} questions but exam filters are incomplete. Fill all fields and save manually.`, variant: 'destructive' });
      } else {
        let savedCount = 0;
        let failCount = 0;
        for (const qObj of extracted) {
          try {
            const optA = qObj.options[0] || '';
            const optB = qObj.options[1] || '';
            const optC = qObj.options[2] || '';
            const optD = qObj.options[3] || '';
            const correctOpt = 'ABCD'[qObj.correctIndex] || 'A';

            const resp = await adminAPI.addQuestion({
              department: examConf.dept,
              section: examConf.sec,
              year: examConf.year,
              semester: examConf.sem,
              subject: examConf.subj,
              question: qObj.q,
              questionType: qObj.questionType,
              options: qObj.questionType === 'mcq' ? qObj.options : undefined,
              correctIndex: qObj.questionType === 'mcq' ? qObj.correctIndex : undefined,
              acceptedAnswers: qObj.questionType === 'fill_blank' ? qObj.acceptedAnswers : undefined,
              optionA: optA,
              optionB: optB,
              optionC: optC,
              optionD: optD,
              correctOption: correctOpt,
              imageUrl: qObj.imageUrl,
              examDate: examConf.date
            });
            if (resp && (resp.id || resp.insertId)) {
              qObj.id = resp.id || resp.insertId;
            }
            savedCount++;
          } catch (err) {
            failCount++;
          }
        }
        setQuestions([...newQuestions]);
        toast({
          title: 'Import & Save Complete',
          description: `${savedCount} questions saved to database${failCount > 0 ? `, ${failCount} failed` : ''}.`
        });
      }
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message || 'Failed to parse word document',
        variant: 'destructive'
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAdvancedToggle = async (newState: boolean) => {
    if (!examConf.date || !examConf.dept || !examConf.year || !examConf.sem || !examConf.subj) {
      toast({ title: 'Missing Details', description: 'Filters must be completely filled.', variant: 'destructive' });
      return;
    }
    if (newState && (!examConf.timeLimit || examConf.timeLimit <= 0 || questions.length === 0)) {
      toast({ title: 'Validation Error', description: 'Time duration and at least one question are required to turn ON the exam.', variant: 'destructive' });
      return;
    }

    setExamConf(prev => ({ ...prev, isVisible: newState }));
    setLoading(true);
    try {
      if (newState) {
        await adminAPI.saveAdvancedExamConfig({
          department: examConf.dept,
          year: examConf.year,
          semester: examConf.sem,
          section: examConf.sec,
          subject: examConf.subj,
          duration: examConf.timeLimit,
          questionCount: questions.length,
          shuffle: examConf.shuffle,
          showPreviousScore: examConf.showPrev,
          is_active: true,
          examDate: examConf.date
        });
        toast({ title: 'Exam Active', description: 'Exam configuration saved and is now live.' });
      } else {
        await adminAPI.saveAdvancedExamConfig({
          department: examConf.dept,
          year: examConf.year,
          semester: examConf.sem,
          section: examConf.sec,
          subject: examConf.subj,
          duration: examConf.timeLimit,
          questionCount: questions.length,
          is_active: false,
          examDate: examConf.date
        });
        toast({ title: 'Exam Disabled', description: 'Exam is now inactive.' });
      }
      
      localStorage.setItem(`quiz_config_${examConf.subj}_${examConf.date}`, JSON.stringify({
        shuffle: examConf.shuffle,
        showPrev: examConf.showPrev,
        timeLimit: examConf.timeLimit,
        isVisible: newState,
      }));

    } catch (err) {
      setExamConf(prev => ({ ...prev, isVisible: !newState })); // revert
      toast({ title: 'Error', description: 'Failed to update exam status.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!examConf.date || !examConf.dept || !examConf.subj) {
      return toast({ title: 'Missing Details', description: 'Cannot save config without subject and date.', variant: 'destructive' });
    }
    if (!examConf.timeLimit || examConf.timeLimit <= 0) {
      return toast({ title: 'Validation Error', description: 'Time duration must be greater than 0.', variant: 'destructive' });
    }
    setLoading(true);
    try {
      await adminAPI.saveAdvancedExamConfig({
        department: examConf.dept,
        year: examConf.year,
        semester: examConf.sem,
        section: examConf.sec,
        subject: examConf.subj,
        duration: examConf.timeLimit,
        questionCount: questions.length,
        shuffle: examConf.shuffle,
        showPreviousScore: examConf.showPrev,
        is_active: examConf.isVisible,
        examDate: examConf.date
      });
      localStorage.setItem(`quiz_config_${examConf.subj}_${examConf.date}`, JSON.stringify({
        shuffle: examConf.shuffle,
        showPrev: examConf.showPrev,
        timeLimit: examConf.timeLimit,
        isVisible: examConf.isVisible,
      }));

      toast({ title: 'Success', description: 'Exam configuration saved successfully.' });
    } catch (err) {
      toast({ title: 'Error Saving Settings', description: 'Failed to update exam settings.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (qId: number) => {
    const qObj = questions.find(q => q.id === qId);
    if (!qObj || !qObj.q) {
      return toast({ title: 'Incomplete Question', description: 'Please fill out the question text.', variant: 'destructive' });
    }
    const qType = qObj.questionType || 'mcq';
    if (qType === 'mcq') {
      if (!qObj.options || qObj.options.length < 2) {
        return toast({ title: 'Incomplete MCQ', description: 'Please fill out at least two options.', variant: 'destructive' });
      }
      if (qObj.options.some((opt: string) => !opt.trim())) {
        return toast({ title: 'Incomplete Options', description: 'Please fill out all option texts or delete the unused ones.', variant: 'destructive' });
      }
    } else {
      if (!qObj.acceptedAnswers || qObj.acceptedAnswers.length === 0 || qObj.acceptedAnswers.some((ans: string) => !ans.trim())) {
        return toast({ title: 'Incomplete Answer', description: 'Please enter at least one accepted answer.', variant: 'destructive' });
      }
    }

    setLoading(true);
    try {
      let optA = '', optB = '', optC = '', optD = '';
      let correctOpt = 'A';
      if (qType === 'mcq') {
        optA = qObj.options[0] || '';
        optB = qObj.options[1] || '';
        optC = qObj.options[2] || '';
        optD = qObj.options[3] || '';
        if (qObj.correctIndex != null && qObj.correctIndex >= 0 && qObj.correctIndex <= 3) {
          correctOpt = 'ABCD'[qObj.correctIndex];
        }
      }

      let resp;
      if (qId < 1000000000000) {
        resp = await adminAPI.updateQuestion(qId, {
          department: examConf.dept,
          section: examConf.sec,
          year: examConf.year,
          semester: examConf.sem,
          subject: examConf.subj,
          question: qObj.q,
          questionType: qType,
          options: qType === 'mcq' ? qObj.options : undefined,
          correctIndex: qType === 'mcq' ? qObj.correctIndex : undefined,
          acceptedAnswers: qType === 'fill_blank' ? qObj.acceptedAnswers : undefined,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctOption: correctOpt,
          imageUrl: qObj.imageUrl,
          examDate: examConf.date
        });
      } else {
        resp = await adminAPI.addQuestion({
          department: examConf.dept,
          section: examConf.sec,
          year: examConf.year,
          semester: examConf.sem,
          subject: examConf.subj,
          question: qObj.q,
          questionType: qType,
          options: qType === 'mcq' ? qObj.options : undefined,
          correctIndex: qType === 'mcq' ? qObj.correctIndex : undefined,
          acceptedAnswers: qType === 'fill_blank' ? qObj.acceptedAnswers : undefined,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctOption: correctOpt,
          imageUrl: qObj.imageUrl,
          examDate: examConf.date
        });
        if (resp && (resp.id || resp.insertId)) {
          const newId = resp.id || resp.insertId;
          setQuestions(prev => prev.map(q => q.id === qId ? { ...q, id: newId } : q));
        }
      }

      toast({ title: 'Question Saved', description: 'Unit successfully committed to database.' });
    } catch (err) {
      toast({ title: 'Error Saving Question', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Copy & Import Dialog States
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [targetSection, setTargetSection] = useState('ALL');
  const [isCopying, setIsCopying] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFilters, setImportFilters] = useState({
    date: '',
    dept: '',
    year: '',
    sem: '',
    sec: 'ALL'
  });
  const [isImporting, setIsImporting] = useState(false);

  const handleExecuteCopy = async () => {
    if (questions.length === 0) {
      return toast({ title: 'No Questions', description: 'There are no questions to copy.', variant: 'destructive' });
    }
    setIsCopying(true);
    toast({ title: 'Copying Questions...', description: `Assigning ${questions.length} questions to Section ${targetSection}...` });

    try {
      let count = 0;
      for (const qObj of questions) {
        const qType = qObj.questionType || 'mcq';
        let optA = '', optB = '', optC = '', optD = '';
        let correctOpt = 'A';
        if (qType === 'mcq') {
          optA = qObj.options[0] || '';
          optB = qObj.options[1] || '';
          optC = qObj.options[2] || '';
          optD = qObj.options[3] || '';
          if (qObj.correctIndex != null && qObj.correctIndex >= 0 && qObj.correctIndex <= 3) {
            correctOpt = 'ABCD'[qObj.correctIndex];
          }
        }

        await adminAPI.addQuestion({
          department: examConf.dept,
          section: targetSection,
          year: examConf.year,
          semester: examConf.sem,
          subject: examConf.subj,
          question: qObj.q,
          questionType: qType,
          options: qType === 'mcq' ? qObj.options : undefined,
          correctIndex: qType === 'mcq' ? qObj.correctIndex : undefined,
          acceptedAnswers: qType === 'fill_blank' ? qObj.acceptedAnswers : undefined,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctOption: correctOpt,
          imageUrl: qObj.imageUrl,
          examDate: examConf.date
        });
        count++;
      }

      await adminAPI.saveAdvancedExamConfig({
        department: examConf.dept,
        year: examConf.year,
        semester: examConf.sem,
        section: targetSection,
        subject: examConf.subj,
        duration: examConf.timeLimit,
        questionCount: questions.length,
        shuffle: examConf.shuffle,
        showPreviousScore: examConf.showPrev,
        is_active: examConf.isVisible,
        examDate: examConf.date
      });

      toast({
        title: 'Success!',
        description: `Successfully copied all ${count} questions and settings to Section "${targetSection}"!`
      });
      setCopyDialogOpen(false);
    } catch (err: any) {
      toast({
        title: 'Copy Failed',
        description: err.message || 'Failed to copy questions.',
        variant: 'destructive'
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importFilters.date || !importFilters.dept || !importFilters.year || !importFilters.sem) {
      return toast({ title: 'Missing Filters', description: 'Please fill out Date, Department, Year, and Semester.', variant: 'destructive' });
    }
    setIsImporting(true);
    try {
      const data = await adminAPI.getQuestions(
        importFilters.dept,
        importFilters.sec !== 'ALL' ? importFilters.sec : undefined,
        importFilters.year,
        importFilters.sem,
        examConf.subj,
        importFilters.date
      );

      if (Array.isArray(data) && data.length > 0) {
        const imported = data.map(mapBackendQuestionToState);
        setQuestions(prev => {
          const existingQs = prev.map(q => (q.q || '').trim().toLowerCase());
          const newItems = imported.filter(iq => !existingQs.includes((iq.q || '').trim().toLowerCase())).map(iq => ({
            ...iq,
            id: Date.now() + Math.random()
          }));
          return [...prev, ...newItems];
        });
        toast({
          title: 'Import Successful',
          description: `Loaded ${data.length} questions from ${importFilters.dept} Sec-${importFilters.sec} (${importFilters.date}).`
        });
        setImportDialogOpen(false);
      } else {
        toast({
          title: 'No Questions Found',
          description: `No questions found matching the selected Date, Dept, Year, Sem, and Section filters.`,
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message || 'Failed to import questions.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveAndNext = async (qId: number) => {
    const qObj = questions.find(q => q.id === qId);
    const type = qObj ? qObj.questionType || 'mcq' : 'mcq';
    await handleSaveQuestion(qId);
    handleAddQuestionSlot(type);
  };

  return (
    <AdminLayout onLogout={logout}>
      <Box sx={{ mb: 4, mt: 1 }}>
        <Typography variant="h4" sx={{
          fontWeight: 900,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 0.5
        }}>
          Quiz Engineering Studio
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Orchestrate high-fidelity assessments through a streamlined workflow.
        </Typography>
      </Box>

      {/* COMPACT FILTERS ROW */}
      <Card className="glass" sx={{ p: 3, mb: 4, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <TextField
            type="date"
            size="small"
            label="Date"
            InputLabelProps={{ shrink: true }}
            sx={{ flex: '1 1 150px' }}
            value={examConf.date}
            onChange={e => setExamConf({ ...examConf, date: e.target.value })}
          />
          <FormControl size="small" sx={{ flex: '1 1 150px' }}>
            <InputLabel>Dept</InputLabel>
            <Select value={examConf.dept} onChange={e => setExamConf({ ...examConf, dept: e.target.value })} label="Dept">
              {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: '1 1 120px' }}>
            <InputLabel>Year</InputLabel>
            <Select value={examConf.year} onChange={e => setExamConf({ ...examConf, year: e.target.value })} label="Year">
              {years.map(y => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: '1 1 100px' }}>
            <InputLabel>Sem</InputLabel>
            <Select value={examConf.sem} onChange={e => setExamConf({ ...examConf, sem: e.target.value })} label="Sem">
              {semesters.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: '1 1 120px' }}>
            <InputLabel>Section</InputLabel>
            <Select value={examConf.sec} onChange={e => setExamConf({ ...examConf, sec: e.target.value })} label="Section">
              <MenuItem value="ALL">Global</MenuItem>
              {sections.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: '2 1 200px' }}>
            <InputLabel>Subject</InputLabel>
            <Select
              value={examConf.subj}
              onChange={e => setExamConf({ ...examConf, subj: e.target.value })}
              label="Subject"
              sx={{ borderRadius: '10px' }}
            >
              {subjects.length > 0
                ? subjects.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)
                : <MenuItem value="" disabled>No subjects</MenuItem>
              }
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{
              borderRadius: '10px', px: 3, py: 1, fontWeight: 700, whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
              '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)' }
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Apply'}
          </Button>
        </Box>
      </Card>

      {/* EXAM CONFIGURATION SECTION */}
      {showEditor && (
        <Card className="glass" sx={{ p: 3, mb: 4, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
            {/* A. QUESTIONS COUNT */}
            <TextField
              type="number"
              size="small"
              label="Questions Count"
              sx={{ flex: '1 1 150px', '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(0,0,0,0.02)' } }}
              value={questions.length}
              disabled
            />

            {/* B. TIME DURATION */}
            <TextField
              type="number"
              size="small"
              label="Time Duration (minutes)"
              sx={{ flex: '1 1 150px', '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              value={examConf.timeLimit}
              onChange={e => setExamConf({ ...examConf, timeLimit: Number(e.target.value) })}
              inputProps={{ min: 1 }}
            />

            {/* C. EXAM ON/OFF TOGGLE */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Exam Status:</Typography>
              <Box
                onClick={() => setExamConf({ ...examConf, isVisible: !examConf.isVisible })}
                sx={{
                  width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                  bgcolor: examConf.isVisible ? '#10B981' : '#EF4444',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examConf.isVisible ? 'left' : 'right', px: 1 }}>
                  {examConf.isVisible ? 'ON' : 'OFF'}
                </Typography>
                <Box sx={{
                  width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                  position: 'absolute', top: 4,
                  left: examConf.isVisible ? 'calc(100% - 32px)' : 4,
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }} />
              </Box>
            </Box>

            {/* D. SHUFFLE QUESTIONS TOGGLE */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Shuffle Questions:</Typography>
              <Box
                onClick={() => setExamConf({ ...examConf, shuffle: !examConf.shuffle })}
                sx={{
                  width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                  bgcolor: examConf.shuffle ? '#10B981' : '#EF4444',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examConf.shuffle ? 'left' : 'right', px: 1 }}>
                  {examConf.shuffle ? 'ON' : 'OFF'}
                </Typography>
                <Box sx={{
                  width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                  position: 'absolute', top: 4,
                  left: examConf.shuffle ? 'calc(100% - 32px)' : 4,
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }} />
              </Box>
            </Box>

            {/* E. SHOW PREVIOUS SCORE TOGGLE */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Show Previous Score:</Typography>
              <Box
                onClick={() => setExamConf({ ...examConf, showPrev: !examConf.showPrev })}
                sx={{
                  width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                  bgcolor: examConf.showPrev ? '#10B981' : '#EF4444',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examConf.showPrev ? 'left' : 'right', px: 1 }}>
                  {examConf.showPrev ? 'ON' : 'OFF'}
                </Typography>
                <Box sx={{
                  width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                  position: 'absolute', top: 4,
                  left: examConf.showPrev ? 'calc(100% - 32px)' : 4,
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }} />
              </Box>
            </Box>

            {/* F. SAVE CHANGES BUTTON */}
            <Button
              variant="contained"
              onClick={handleSaveConfig}
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#fff',
                fontWeight: 900,
                borderRadius: '20px',
                px: 3,
                py: 1,
                textTransform: 'none',
                fontSize: '0.85rem',
                flex: '0 0 auto',
                boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
              }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
            </Button>
          </Box>
        </Card>
      )}

      {/* QUESTIONS & CONFIG EDITOR (Only visible after Search) */}
      {showEditor && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
              Question List ({questions.length})
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  setImportFilters({
                    date: examConf.date || '',
                    dept: examConf.dept || '',
                    year: examConf.year || '',
                    sem: examConf.sem || '',
                    sec: examConf.sec || 'ALL'
                  });
                  setImportDialogOpen(true);
                }}
                disabled={loading || isImporting}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  px: 2,
                  borderColor: 'var(--border-subtle)',
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.03)', borderColor: 'text.secondary' }
                }}
              >
                Import from Section
              </Button>

              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => setCopyDialogOpen(true)}
                disabled={loading || questions.length === 0}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  px: 2,
                  borderColor: 'var(--border-subtle)',
                  color: 'primary.main',
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.05)', borderColor: 'primary.main' }
                }}
              >
                Copy to Section
              </Button>

              <input type="file" ref={fileInputRef} accept=".doc,.docx" style={{ display: 'none' }} onChange={handleWordUpload} />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  px: 2,
                  borderColor: 'var(--border-subtle)',
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.03)', borderColor: 'text.secondary' }
                }}
              >
                Import from Word (.docx)
              </Button>
            </Box>
          </Box>

          {isParsing && <LinearProgress sx={{ mb: 3, borderRadius: '4px' }} color="primary" />}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {questions.map((qObj, index) => (
              <Card
                key={qObj.id}
                sx={{
                  p: 0,
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: (t) => t.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.06)',
                  bgcolor: 'background.paper',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ p: 3, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.015)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem'
                    }}>
                      {index + 1}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      Question Unit
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => handleRemoveQuestion(qObj.id)}
                    size="small"
                    sx={{ color: 'text.secondary', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 2 }}>
                    Type: {qObj.questionType === 'fill_blank' ? 'Fill in the Blanks' : 'Multiple Choice Question (MCQ)'}
                  </Typography>

                  <TextField
                    fullWidth
                    minRows={4}
                    multiline
                    label="Question Text"
                    placeholder="Enter the main question text here..."
                    sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    value={qObj.q}
                    onChange={e => updateQuestionState(qObj.id, 'q', e.target.value)}
                  />

                  <Box sx={{ mb: 4 }}>
                    <ImageUpload
                      value={qObj.imageUrl}
                      onChange={(url) => updateQuestionState(qObj.id, 'imageUrl', url || '')}
                      label="Question Image (Optional)"
                    />
                  </Box>

                  {qObj.questionType === 'fill_blank' ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="Accepted Answer(s) (comma-separated if multiple options)"
                      placeholder="e.g. Class, class"
                      sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      value={(qObj.acceptedAnswers || []).join(', ')}
                      onChange={e => {
                        const val = e.target.value;
                        const list = val.split(',').map((s: string) => s.trim()).filter(Boolean);
                        updateQuestionState(qObj.id, 'acceptedAnswers', list);
                      }}
                    />
                  ) : (
                    <Box sx={{ mb: 4 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 2 }}>
                        {(qObj.options || []).map((optText: string, optIdx: number) => (
                          <Box key={optIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title="Mark as correct answer">
                              <Radio
                                checked={qObj.correctIndex === optIdx}
                                onChange={() => updateQuestionState(qObj.id, 'correctIndex', optIdx)}
                                sx={{
                                  color: qObj.correctIndex === optIdx ? '#10B981 !important' : 'inherit',
                                  '&.Mui-checked': { color: '#10B981 !important' }
                                }}
                              />
                            </Tooltip>
                            <TextField
                              fullWidth
                              size="small"
                              label={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={optText}
                              onChange={e => {
                                const nextOpts = [...qObj.options];
                                nextOpts[optIdx] = e.target.value;
                                updateQuestionState(qObj.id, 'options', nextOpts);
                              }}
                              InputProps={{
                                sx: { borderRadius: '10px' }
                              }}
                            />
                            {qObj.options.length > 2 && (
                              <Tooltip title="Delete Option">
                                <IconButton
                                  onClick={() => handleDeleteOption(qObj.id, optIdx)}
                                  size="small"
                                  sx={{ color: 'text.secondary', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' } }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ))}
                      </Box>
                      {qObj.options.length < 4 && (
                        <Button
                          variant="text"
                          startIcon={<AddIcon />}
                          onClick={() => handleAddOption(qObj.id)}
                          sx={{ fontWeight: 700, textTransform: 'none', color: 'primary.main' }}
                        >
                          Add Option
                        </Button>
                      )}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', p: 2, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-subtle)' }}>
                    <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
                      <Button
                        variant="outlined"
                        onClick={() => handleSaveQuestion(qObj.id)}
                        disabled={loading}
                        sx={{ borderRadius: '8px', fontWeight: 700, color: 'text.primary', borderColor: 'var(--border-subtle)' }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => handleSaveAndNext(qObj.id)}
                        disabled={loading}
                        sx={{
                          borderRadius: '8px', fontWeight: 700, px: 3,
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                          '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
                        }}
                      >
                        Save & Add Next
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 3, mt: 3, mb: 8 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleAddQuestionSlot('mcq')}
              sx={{
                flex: 1,
                py: 2,
                borderRadius: '16px',
                borderStyle: 'dashed',
                borderWidth: 2,
                fontWeight: 700,
                borderColor: 'var(--border-subtle)',
                color: 'text.secondary',
                bgcolor: 'background.paper',
                '&:hover': { borderWidth: 2, borderColor: 'primary.main', bgcolor: 'rgba(99, 102, 241, 0.02)', color: 'primary.main' }
              }}
              fullWidth
            >
              Add Multiple Choice Question
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleAddQuestionSlot('fill_blank')}
              sx={{
                flex: 1,
                py: 2,
                borderRadius: '16px',
                borderStyle: 'dashed',
                borderWidth: 2,
                fontWeight: 700,
                borderColor: 'var(--border-subtle)',
                color: 'text.secondary',
                bgcolor: 'background.paper',
                '&:hover': { borderWidth: 2, borderColor: 'primary.main', bgcolor: 'rgba(99, 102, 241, 0.02)', color: 'primary.main' }
              }}
              fullWidth
            >
              Add Fill in the Blanks
            </Button>
          </Box>
        </Box>
      )}

      {/* COPY TO SECTION DIALOG */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Copy Questions to Section</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Copy and assign all <strong>{questions.length}</strong> questions and exam settings from <strong>{examConf.sec === 'ALL' ? 'Global' : `Section ${examConf.sec}`}</strong> to another section:
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Target Section</InputLabel>
            <Select
              value={targetSection}
              onChange={(e) => setTargetSection(e.target.value)}
              label="Target Section"
            >
              <MenuItem value="ALL">ALL / Global Sections</MenuItem>
              {sections.map((s) => (
                <MenuItem key={s.value} value={s.value}>Section {s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCopyDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleExecuteCopy}
            variant="contained"
            disabled={isCopying}
            startIcon={isCopying ? <CircularProgress size={16} color="inherit" /> : <CopyIcon />}
            sx={{
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#fff',
              fontWeight: 700
            }}
          >
            {isCopying ? 'Copying...' : 'Copy & Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* IMPORT FROM SECTION DIALOG WITH FULL FILTERS */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Import Questions from Section</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
            Select source <strong>Date, Department, Year, Semester, and Section</strong> to import questions into current subject (<strong>{examConf.subj}</strong>):
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              type="date"
              size="small"
              label="Source Date"
              InputLabelProps={{ shrink: true }}
              value={importFilters.date}
              onChange={(e) => setImportFilters({ ...importFilters, date: e.target.value })}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={importFilters.dept}
                onChange={(e) => setImportFilters({ ...importFilters, dept: e.target.value })}
                label="Department"
              >
                {departments.map((d) => (
                  <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                value={importFilters.year}
                onChange={(e) => setImportFilters({ ...importFilters, year: e.target.value })}
                label="Year"
              >
                {years.map((y) => (
                  <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Semester</InputLabel>
              <Select
                value={importFilters.sem}
                onChange={(e) => setImportFilters({ ...importFilters, sem: e.target.value })}
                label="Semester"
              >
                {semesters.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth sx={{ gridColumn: { sm: 'span 2' } }}>
              <InputLabel>Source Section</InputLabel>
              <Select
                value={importFilters.sec}
                onChange={(e) => setImportFilters({ ...importFilters, sec: e.target.value })}
                label="Source Section"
              >
                <MenuItem value="ALL">ALL / Global Sections</MenuItem>
                {sections.map((s) => (
                  <MenuItem key={s.value} value={s.value}>Section {s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setImportDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleExecuteImport}
            variant="contained"
            disabled={isImporting}
            startIcon={isImporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            sx={{
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#fff',
              fontWeight: 700
            }}
          >
            {isImporting ? 'Importing...' : 'Import Questions'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
