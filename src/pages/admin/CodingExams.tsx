import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Button, Card, Typography, TextField, MenuItem, 
  FormControl, InputLabel, Select, IconButton, Switch, FormControlLabel,
  Grid, Chip, Fade, Divider, Paper, CircularProgress, LinearProgress
} from '@mui/material';
import { 
  Search as SearchIcon, Add as AddIcon, ArrowBack as BackIcon,
  Delete as DeleteIcon, Edit as EditIcon, PlayArrow as PlayIcon, 
  Shuffle as ShuffleIcon, AccessTime as TimeIcon, BarChart as BarChartIcon,
  UploadFile as UploadIcon, AssignmentInd as AssignmentIndIcon, Close as CloseIcon
} from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { adminAPI, Question } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLookupData } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';
import QuestionForm, { ALL_LANG_OPTIONS } from '@/components/admin/QuestionForm';
import mammoth from 'mammoth';

export default function CodingExams() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const { toast } = useToast();
  
  // Lookups
  const { departments, years, semesters, sections } = useLookupData();

  // Multi-step wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    const saved = localStorage.getItem('codingExam_step');
    return saved ? (parseInt(saved, 10) as any) : 1;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Global Context & Settings
  const [examContext, setExamContext] = useState(() => {
    const saved = localStorage.getItem('codingExam_examContext');
    return saved ? JSON.parse(saved) : { date: '', dept: '', year: '', sem: '', sec: '', lang: '' };
  });

  useEffect(() => {
    localStorage.setItem('codingExam_step', step.toString());
  }, [step]);

  useEffect(() => {
    localStorage.setItem('codingExam_examContext', JSON.stringify(examContext));
  }, [examContext]);

  // Auto-search on mount if filters were already applied
  useEffect(() => {
    const savedStep = localStorage.getItem('codingExam_step');
    if (savedStep && savedStep !== '1') {
      const savedContext = localStorage.getItem('codingExam_examContext');
      if (savedContext) {
        const parsed = JSON.parse(savedContext);
        if (parsed.date && parsed.dept && parsed.year && parsed.sem && parsed.sec && parsed.lang) {
          const t = setTimeout(() => {
            handleSearch();
          }, 300);
          return () => clearTimeout(t);
        }
      }
    }
  }, []);
  const [examSettings, setExamSettings] = useState({ 
    isLive: false, 
    shuffleLogic: false, 
    timer: 60, 
    showPrev: true,
    enableCopyPaste: false,
    autoSubmitTabSwitch: false
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Student Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [bulkAssignments, setBulkAssignments] = useState<Record<string, number[]>>({});

  const areFiltersFilled = 
    examContext.date && examContext.dept && examContext.year && examContext.sem && examContext.sec && examContext.lang;

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  // --- ACTIONS ---

  const handleSearch = async () => {
    if (!areFiltersFilled) {
      toast({ title: 'Validation Error', description: 'All fields are required to search for an exam configuration.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = await adminAPI.getQuestions();
      if (Array.isArray(data)) {
        let filtered = data.filter(q => {
          try {
            const parsed = JSON.parse(q.question);
            if (!parsed.description && !parsed.title) return false;
            
            if (q.department !== examContext.dept) return false;
            if (q.year !== examContext.year) return false;
            if (q.semester !== examContext.sem) return false;
            if (q.section !== examContext.sec) return false;
            if (parsed.programmingLanguage !== examContext.lang) return false;
            if (q.exam_date) {
              const qDate = new Date(q.exam_date).toISOString().split('T')[0];
              if (qDate !== examContext.date) return false;
            }
            return true;
          } catch {
            return false;
          }
        });
        
        setQuestions(filtered);

        if (filtered.length === 0) {
          // No items found -> Step 2
          setStep(2);
        } else {
          // Items found -> Step 4
          // Inherit the global setting from the first item
          const firstPayload = JSON.parse(filtered[0].question);
          setExamSettings({
            isLive: firstPayload.isActive || false,
            shuffleLogic: firstPayload.shuffleLogic || false,
            timer: firstPayload.timer || 60,
            showPrev: firstPayload.showPrev !== false,
            enableCopyPaste: firstPayload.enableCopyPaste || false,
            autoSubmitTabSwitch: firstPayload.autoSubmitTabSwitch || false
          });
          setStep(4);
        }
      }
    } catch {
      toast({ title: 'Fetch Error', description: 'Failed to retrieve exam questions.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (q: Question) => {
    setSelectedQuestion(q);
    setStep(3);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you certain you want to delete this specific question from the exam?')) return;
    try {
      await adminAPI.deleteQuestion(id);
      toast({ title: 'Deleted', description: 'Question removed.' });
      
      const newQs = questions.filter(q => q.id !== id);
      setQuestions(newQs);

      if (newQs.length === 0) {
        setStep(2); // If we delete the last question, drop to Empty State
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  // The global update handler when user switches LIVE, SHUFFLE, or TIMER in Step 4
  const applySettingsToAll = async (newSettings: typeof examSettings) => {
    setLoading(true);
    setExamSettings(newSettings);
    
    try {
      // Loop out and promise all updates to existing questions
      await Promise.all(questions.map(q => {
        let parsed = JSON.parse(q.question);
        parsed.isActive = newSettings.isLive;
        parsed.shuffleLogic = newSettings.shuffleLogic;
        parsed.timer = newSettings.timer;
        parsed.showPrev = newSettings.showPrev;
        parsed.enableCopyPaste = newSettings.enableCopyPaste;
        parsed.autoSubmitTabSwitch = newSettings.autoSubmitTabSwitch;
        // keep assignedStudents intact
        
        const payload = {
          department: q.department, 
          section: q.section, 
          year: q.year, 
          semester: q.semester, 
          subject: q.subject,
          question: JSON.stringify(parsed), 
          optionA: 'N/A', optionB: 'N/A', optionC: 'N/A', optionD: 'N/A', 
          correctOption: 'A',
          timer: newSettings.timer,
          examDate: examContext.date
        };
        return adminAPI.updateQuestion(q.id, payload);
      }));
      toast({ title: 'Settings Applied', description: 'All questions in this exam profile have been updated with the new settings.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to apply global settings.', variant: 'destructive' });
    } finally {
      // Refresh to ensure integrity
      handleSearch(); 
    }
  };

  const openAssignModal = async () => {
      setLoading(true);
      try {
          // Fetch all students for this specific exam context
          const data = await adminAPI.getStudentsByContext(examContext.dept, examContext.year, examContext.sem, examContext.sec);
          const studentsWithMaster = Array.isArray(data) ? [...data] : [];
          const hasMaster = studentsWithMaster.some(s => s.roll_number === '22251A6601');
          if (!hasMaster) {
             studentsWithMaster.unshift({
                id: 0,
                roll_number: '22251A6601',
                full_name: 'Master Student',
                department: examContext.dept || 'ALL',
                section: examContext.sec || 'ALL',
                year: examContext.year || 'ALL',
                semester: examContext.sem || 'ALL'
             });
          }
          setStudentsList(studentsWithMaster);

          // Build bulkAssignments map from existing questions
          const initialMap: Record<string, number[]> = {};
          studentsWithMaster.forEach(s => { initialMap[s.roll_number] = []; });

          questions.forEach(q => {
             try {
                const parsed = JSON.parse(q.question);
                if (parsed.assignedStudents && Array.isArray(parsed.assignedStudents)) {
                    parsed.assignedStudents.forEach((roll: string) => {
                        const r = roll.toUpperCase();
                        if (!initialMap[r]) initialMap[r] = [];
                        initialMap[r].push(q.id);
                    });
                }
             } catch {}
          });

          setBulkAssignments(initialMap);
          setAssignModalOpen(true);
      } catch {
          toast({ title: 'Error', description: 'Failed to fetch students.', variant: 'destructive' });
      } finally {
          setLoading(false);
      }
  };

  const handleToggleQuestionForStudent = (roll: string, questionId: number) => {
      setBulkAssignments(prev => {
          const current = prev[roll] || [];
          if (current.includes(questionId)) {
              return { ...prev, [roll]: current.filter(id => id !== questionId) };
          } else {
              return { ...prev, [roll]: [...current, questionId] };
          }
      });
  };

  const handleAutoAssign = () => {
    if (questions.length === 0) {
      toast({ title: 'Error', description: 'No questions available to assign.', variant: 'destructive' });
      return;
    }
    const countStr = prompt(`Enter number of questions to assign to each student (Max: ${questions.length}):`, "1");
    if (countStr === null) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      toast({ title: 'Invalid Count', description: 'Please enter a valid positive number.', variant: 'destructive' });
      return;
    }
    if (count > questions.length) {
      toast({ title: 'Invalid Count', description: `Cannot assign ${count} questions. Only ${questions.length} questions exist in this exam.`, variant: 'destructive' });
      return;
    }

    const newBulk: Record<string, number[]> = {};
    const qIds = questions.map(q => q.id);

    studentsList.forEach(student => {
      const shuffled = [...qIds].sort(() => 0.5 - Math.random());
      newBulk[student.roll_number] = shuffled.slice(0, count);
    });

    setBulkAssignments(newBulk);
    toast({ title: 'Success', description: `Randomly assigned ${count} question(s) to each student. Click 'Save Assignments' to apply.` });
  };

  const saveStudentAssignments = async () => {
      setLoading(true);
      try {
          await Promise.all(questions.map(q => {
             const parsed = JSON.parse(q.question);
             
             // Figure out which students have this question checked in bulkAssignments
             const newAssigned: string[] = [];
             Object.entries(bulkAssignments).forEach(([roll, qIds]) => {
                 if (qIds.includes(q.id)) {
                     newAssigned.push(roll);
                 }
             });
             
             parsed.assignedStudents = newAssigned;
             
             const payload = {
                 department: q.department,
                 section: q.section,
                 year: q.year,
                 semester: q.semester,
                 subject: q.subject,
                 question: JSON.stringify(parsed),
                 optionA: q.option_a || 'N/A',
                 optionB: q.option_b || 'N/A',
                 optionC: q.option_c || 'N/A',
                 optionD: q.option_d || 'N/A',
                 correctOption: q.correct_option || 'A',
                 timer: (q as any).time_limit || 60,
                 examDate: examContext.date
             };
             return adminAPI.updateQuestion(q.id, payload as any);
          }));
          
          toast({ title: 'Assignments Saved', description: `Questions successfully assigned to selected students.` });
          await handleSearch(); // refresh
          setAssignModalOpen(false);
      } catch {
          toast({ title: 'Error', description: 'Failed to save student assignments.', variant: 'destructive' });
      } finally {
          setLoading(false);
      }
  };

  const handleSaveQuestion = async (payloadString: string, rawFormData: any) => {
    setLoading(true);
    
    const parsedPayload = JSON.parse(payloadString);
    parsedPayload.isActive = examSettings.isLive;
    parsedPayload.shuffleLogic = examSettings.shuffleLogic;
    parsedPayload.timer = examSettings.timer;
    parsedPayload.showPrev = examSettings.showPrev;
    parsedPayload.enableCopyPaste = examSettings.enableCopyPaste;
    parsedPayload.autoSubmitTabSwitch = examSettings.autoSubmitTabSwitch;
    parsedPayload.usageType = 'exam';
    if (selectedQuestion) {
        const oldParsed = JSON.parse(selectedQuestion.question);
        parsedPayload.assignedStudents = oldParsed.assignedStudents || [];
    } else {
        parsedPayload.assignedStudents = [];
    }
    
    const stringifiedModifiedPayload = JSON.stringify(parsedPayload);
    
    const dbPayload = {
        department: examContext.dept, 
        section: examContext.sec, 
        year: examContext.year, 
        semester: examContext.sem, 
        subject: rawFormData.topic, // Extracted Topic name from step 3
        question: stringifiedModifiedPayload, 
        optionA: 'N/A', optionB: 'N/A', optionC: 'N/A', optionD: 'N/A', 
        correctOption: 'A',
        timer: examSettings.timer,
        examDate: examContext.date
    };

    try {
        if (selectedQuestion) {
            await adminAPI.updateQuestion(selectedQuestion.id, dbPayload);
            toast({ title: 'Question Updated', description: 'Configuration modified natively.' });
        } else {
            await adminAPI.addQuestion(dbPayload);
            toast({ title: 'Question Added', description: 'New coding question injected to current exam schema.' });
        }
        await handleSearch(); // Pull latest data, forcing transition back to Step 4
    } catch {
        toast({ title: 'Error', description: 'Failed to push configuration.', variant: 'destructive' });
    } finally {
        setLoading(false);
    }
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
      let inDescription = false;
      let inInput = false;
      let inOutput = false;
      let currentTC: any = null;

      lines.forEach(line => {
        if (/^Title:\s*(.+)/i.test(line)) {
          if (currentQ) extracted.push(currentQ);
          currentQ = {
            title: line.match(/^Title:\s*(.+)/i)?.[1].trim() || 'Untitled',
            difficulty: 'Medium',
            description: '',
            testCases: []
          };
          inDescription = false;
          inInput = false;
          inOutput = false;
        } else if (currentQ && /^Difficulty:\s*(.+)/i.test(line)) {
          currentQ.difficulty = line.match(/^Difficulty:\s*(.+)/i)?.[1].trim() || 'Medium';
          inDescription = false;
        } else if (currentQ && /^Description:/i.test(line)) {
          inDescription = true;
          const desc = line.replace(/^Description:\s*/i, '').trim();
          if (desc) currentQ.description += desc + '\n';
        } else if (currentQ && /^Input:/i.test(line)) {
          inDescription = false;
          inInput = true;
          inOutput = false;
          currentTC = { input: line.replace(/^Input:\s*/i, '').trim(), output: '' };
        } else if (currentQ && /^Output:/i.test(line)) {
          inInput = false;
          inOutput = true;
          if (currentTC) {
            currentTC.output = line.replace(/^Output:\s*/i, '').trim();
            currentQ.testCases.push({ ...currentTC });
            currentTC = null;
          }
        } else if (currentQ && line === '---') {
            // separator
        } else if (currentQ) {
          if (inDescription) {
            currentQ.description += line + '\n';
          } else if (inInput && currentTC) {
            currentTC.input += '\n' + line;
          } else if (inOutput && currentQ.testCases.length > 0) {
            currentQ.testCases[currentQ.testCases.length - 1].output += '\n' + line;
          }
        }
      });

      if (currentQ) extracted.push(currentQ);

      if (extracted.length === 0) {
        throw new Error('No valid questions found. Ensure you use "Title:" to start a question.');
      }

      toast({ title: 'Saving Questions', description: `Extracted ${extracted.length} questions. Saving to database...` });

      let savedCount = 0;
      let failCount = 0;

      for (const qObj of extracted) {
        try {
          const parsedPayload = {
             title: qObj.title,
             description: qObj.description.trim(),
             difficulty: qObj.difficulty,
             testCases: qObj.testCases.map((tc: any) => ({ input: tc.input.trim(), output: tc.output.trim() })),
             isActive: examSettings.isLive,
             shuffleLogic: examSettings.shuffleLogic,
             timer: examSettings.timer,
             showPrev: examSettings.showPrev,
             enableCopyPaste: examSettings.enableCopyPaste,
             autoSubmitTabSwitch: examSettings.autoSubmitTabSwitch,
             usageType: 'exam'
          };

          const stringifiedModifiedPayload = JSON.stringify(parsedPayload);
          
          const dbPayload = {
              department: examContext.dept, 
              section: examContext.sec, 
              year: examContext.year, 
              semester: examContext.sem, 
              subject: 'Coding', 
              question: stringifiedModifiedPayload, 
              optionA: 'N/A', optionB: 'N/A', optionC: 'N/A', optionD: 'N/A', 
              correctOption: 'A',
              timer: examSettings.timer,
              examDate: examContext.date
          };

          await adminAPI.addQuestion(dbPayload);
          savedCount++;
        } catch (err) {
          failCount++;
        }
      }

      await handleSearch(); // Refresh list

      toast({
        title: 'Import & Save Complete',
        description: `${savedCount} coding questions saved${failCount > 0 ? `, ${failCount} failed` : ''}.`
      });

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


  // --- RENDERING --- //

  const renderStepIndicator = () => (
    <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4].map(s => (
        <React.Fragment key={s}>
          <Box sx={{ 
            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: step === s ? 'secondary.main' : step > s ? 'primary.main' : 'divider',
            color: step === s || step > s ? '#fff' : 'text.disabled', fontWeight: 800, transition: 'all 0.3s'
          }}>
            {s}
          </Box>
          {s < 4 && <Box sx={{ flex: 1, height: 2, bgcolor: step > s ? 'primary.main' : 'divider', transition: 'all 0.3s' }} />}
        </React.Fragment>
      ))}
    </Box>
  );

  return (
    <AdminLayout onLogout={logout}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Coding Exam Builder</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Orchestrate multi-step coding assessments through a unified wizard.</Typography>
        </Box>
        {step > 1 && (
            <Button variant="outlined" color="secondary" onClick={() => { setStep(1); setQuestions([]); }} startIcon={<BackIcon />}>
                Restart Wizard
            </Button>
        )}
      </Box>

      {renderStepIndicator()}

      <Box sx={{ position: 'relative' }}>
        <input type="file" ref={fileInputRef} accept=".doc,.docx" style={{ display: 'none' }} onChange={handleWordUpload} />
          
        {/* STEP 1: SEARCH & FILTER */}
        {step === 1 && (
          <Fade in={step === 1}>
            <Card className="glass" sx={{ p: 4, borderRadius: 4, maxWidth: 1280, mx: 'auto', mt: 4, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>STEP 1: DEFINE EXAM CONTEXT</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>Input the target parameters to locate an existing exam or instantiate a new one.</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: 'flex-end', textAlign: 'left', mb: 2, width: '100%' }}>
                <Box sx={{ flex: '1 1 140px', width: '100%' }}>
                  <TextField 
                      fullWidth type="date" label="Exam Date *" InputLabelProps={{ shrink: true }}
                      value={examContext.date} onChange={e => setExamContext({...examContext, date: e.target.value})}
                  />
                </Box>
                <Box sx={{ flex: '1 1 140px', width: '100%' }}>
                  <FormControl fullWidth>
                      <InputLabel>Department *</InputLabel>
                      <Select value={examContext.dept} label="Department *" onChange={e => setExamContext({...examContext, dept: e.target.value})}>
                          {departments.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                      </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 90px', width: '100%' }}>
                  <FormControl fullWidth>
                      <InputLabel>Year *</InputLabel>
                      <Select value={examContext.year} label="Year *" onChange={e => setExamContext({...examContext, year: e.target.value})}>
                          {years.map(y => <MenuItem key={y.value} value={y.value}>{y.label}</MenuItem>)}
                      </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 90px', width: '100%' }}>
                  <FormControl fullWidth>
                      <InputLabel>Semester *</InputLabel>
                      <Select value={examContext.sem} label="Semester *" onChange={e => setExamContext({...examContext, sem: e.target.value})}>
                          {semesters.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                      </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 90px', width: '100%' }}>
                  <FormControl fullWidth>
                      <InputLabel>Section *</InputLabel>
                      <Select value={examContext.sec} label="Section *" onChange={e => setExamContext({...examContext, sec: e.target.value})}>
                          {sections.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                      </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 150px', width: '100%' }}>
                  <FormControl fullWidth>
                      <InputLabel>Language *</InputLabel>
                      <Select value={examContext.lang} label="Language *" onChange={e => setExamContext({...examContext, lang: e.target.value})}>
                          {ALL_LANG_OPTIONS.map(l => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
                      </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 160px', width: '100%' }}>
                  <Button 
                    variant="contained" color="secondary" size="large" onClick={handleSearch} startIcon={<SearchIcon />} 
                    disabled={loading || !areFiltersFilled} 
                    sx={{ 
                      width: '100%', 
                      height: '56px', 
                      borderRadius: 2, 
                      backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                      textTransform: 'none', 
                      fontWeight: 700 
                    }}
                  >
                      {loading ? 'Searching...' : 'Search & Proceed'}
                  </Button>
                </Box>
              </Box>
            </Card>
          </Fade>
        )}

        {/* STEP 2: EMPTY STATE / FIRST QUESTION ENTRY */}
        {step === 2 && (
          <Fade in={step === 2}>
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 4 }}>
                <Chip color="primary" variant="outlined" label={`Target: ${examContext.date}`} />
                <Chip color="primary" variant="outlined" label={`Dept: ${examContext.dept}`} />
                <Chip color="primary" variant="outlined" label={`Y: ${examContext.year} / S: ${examContext.sem}`} />
                <Chip color="primary" variant="outlined" label={`Sec: ${examContext.sec}`} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 2 }}>
                No Exam Configured Yet
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 5 }}>
                Your selected parameters have no active questions. Begin constructing this new coding sequence by adding your first challenge.
              </Typography>
              
              {isParsing && <LinearProgress sx={{ mb: 3, maxWidth: 400, mx: 'auto', borderRadius: '4px' }} color="primary" />}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Button 
                  variant="outlined" color="primary" size="large" 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isParsing}
                  startIcon={<UploadIcon fontSize="medium" />} 
                  sx={{ px: 6, py: 2, fontSize: '1.1rem', borderRadius: 3, fontWeight: 700, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                >
                    {isParsing ? 'Importing...' : 'Import from Word'}
                </Button>

                <Button 
                  variant="contained" color="secondary" size="large" 
                  onClick={() => { setSelectedQuestion(null); setStep(3); }} 
                  startIcon={<AddIcon fontSize="medium" />} 
                  sx={{ px: 6, py: 2, fontSize: '1.1rem', borderRadius: 3, backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)' }}
                >
                    Add First Question
                </Button>
              </Box>
            </Box>
          </Fade>
        )}

        {/* STEP 3: QUESTION FORM */}
        {step === 3 && (
          <Fade in={step === 3}>
            <Box>
               <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontWeight: 700 }}>
                 Adding to Context: {examContext.date} | {examContext.dept} | {examContext.year}-{examContext.sem} | Sec {examContext.sec}
               </Typography>
               <QuestionForm 
                  onSave={handleSaveQuestion}
                  onCancel={() => {
                    if (questions.length > 0) setStep(4);
                    else setStep(2);
                  }}
                  isLoading={loading}
                  initialData={selectedQuestion ? JSON.parse(selectedQuestion.question) : { programmingLanguage: examContext.lang }}
                  editId={selectedQuestion ? selectedQuestion.id : null}
                />
            </Box>
          </Fade>
        )}

        {/* STEP 4: REVIEW & MANAGE DASHBOARD */}
        {step === 4 && (
          <Fade in={step === 4}>
            <Box>
              {/* Top Section */}
              <Card className="glass" sx={{ p: 4, borderRadius: 4, mb: 4, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>EXAM DASHBOARD</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={examContext.date} />
                      <Chip size="small" label={examContext.dept} />
                      <Chip size="small" label={`Yr ${examContext.year} • Sem ${examContext.sem}`} />
                      <Chip size="small" label={`Section: ${examContext.sec}`} />
                    </Box>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Row 1: Inputs */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 600 }}>
                    <TextField
                      type="number"
                      size="small"
                      label="Questions Count"
                      sx={{ flex: '1 1 150px', '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(0,0,0,0.02)' } }}
                      value={questions.length}
                      disabled
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Time Duration (minutes)"
                      sx={{ flex: '1 1 150px', '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      value={examSettings.timer}
                      onChange={e => setExamSettings({...examSettings, timer: Number(e.target.value) || 0})}
                      onBlur={() => applySettingsToAll(examSettings)}
                      inputProps={{ min: 1 }}
                    />
                  </Box>

                  {/* Row 2: All 5 Toggle Buttons in One Row */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, pt: 1 }}>
                    {/* Exam Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Exam Status:</Typography>
                      <Box
                        onClick={() => applySettingsToAll({...examSettings, isLive: !examSettings.isLive})}
                        sx={{
                          width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                          bgcolor: examSettings.isLive ? '#10B981' : '#EF4444',
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examSettings.isLive ? 'left' : 'right', px: 1 }}>
                          {examSettings.isLive ? 'ON' : 'OFF'}
                        </Typography>
                        <Box sx={{
                          width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                          position: 'absolute', top: 4,
                          left: examSettings.isLive ? 'calc(100% - 32px)' : 4,
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }} />
                      </Box>
                    </Box>

                    {/* Shuffle Questions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Shuffle Questions:</Typography>
                      <Box
                        onClick={() => applySettingsToAll({...examSettings, shuffleLogic: !examSettings.shuffleLogic})}
                        sx={{
                          width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                          bgcolor: examSettings.shuffleLogic ? '#10B981' : '#EF4444',
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examSettings.shuffleLogic ? 'left' : 'right', px: 1 }}>
                          {examSettings.shuffleLogic ? 'ON' : 'OFF'}
                        </Typography>
                        <Box sx={{
                          width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                          position: 'absolute', top: 4,
                          left: examSettings.shuffleLogic ? 'calc(100% - 32px)' : 4,
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }} />
                      </Box>
                    </Box>

                    {/* Show Previous Score */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Show Previous Score:</Typography>
                      <Box
                        onClick={() => applySettingsToAll({...examSettings, showPrev: !examSettings.showPrev})}
                        sx={{
                          width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                          bgcolor: examSettings.showPrev ? '#10B981' : '#EF4444',
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examSettings.showPrev ? 'left' : 'right', px: 1 }}>
                          {examSettings.showPrev ? 'ON' : 'OFF'}
                        </Typography>
                        <Box sx={{
                          width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                          position: 'absolute', top: 4,
                          left: examSettings.showPrev ? 'calc(100% - 32px)' : 4,
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }} />
                      </Box>
                    </Box>

                    {/* Copy Paste */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Copy Paste:</Typography>
                      <Box
                        onClick={() => applySettingsToAll({...examSettings, enableCopyPaste: !examSettings.enableCopyPaste})}
                        sx={{
                          width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                          bgcolor: examSettings.enableCopyPaste ? '#10B981' : '#EF4444',
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examSettings.enableCopyPaste ? 'left' : 'right', px: 1 }}>
                          {examSettings.enableCopyPaste ? 'ON' : 'OFF'}
                        </Typography>
                        <Box sx={{
                          width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                          position: 'absolute', top: 4,
                          left: examSettings.enableCopyPaste ? 'calc(100% - 32px)' : 4,
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }} />
                      </Box>
                    </Box>

                    {/* Auto Submit */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Auto Submit:</Typography>
                      <Box
                        onClick={() => applySettingsToAll({...examSettings, autoSubmitTabSwitch: !examSettings.autoSubmitTabSwitch})}
                        sx={{
                          width: 80, height: 36, borderRadius: '20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', position: 'relative', px: 1,
                          bgcolor: examSettings.autoSubmitTabSwitch ? '#10B981' : '#EF4444',
                          transition: 'background-color 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', width: '100%', textAlign: examSettings.autoSubmitTabSwitch ? 'left' : 'right', px: 1 }}>
                          {examSettings.autoSubmitTabSwitch ? 'ON' : 'OFF'}
                        </Typography>
                        <Box sx={{
                          width: 28, height: 28, bgcolor: '#fff', borderRadius: '50%',
                          position: 'absolute', top: 4,
                          left: examSettings.autoSubmitTabSwitch ? 'calc(100% - 32px)' : 4,
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }} />
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Card>

              {/* Main Grid Section */}
              <Grid container spacing={3} sx={{ mb: 6 }}>
                {questions.map((q, idx) => {
                  const payload = JSON.parse(q.question);
                  return (
                    <Grid item xs={12} md={6} lg={4} key={q.id}>
                      <Card sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                        <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800 }}>Question {idx + 1}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.2 }}>{payload.title || 'Untitled'}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Topic: {q.subject || 'Uncategorized'}</Typography>
                        
                        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled' }}>ID: {q.id}</Typography>
                          <Box>
                            <IconButton color="secondary" onClick={() => navigate(`/admin/exam-analytics/ALL?date=${examContext.date}&dept=${examContext.dept}`)} title="View Analytics"><BarChartIcon fontSize="small" /></IconButton>
                            <IconButton color="primary" onClick={() => handleEdit(q)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton color="error" onClick={() => handleDelete(q.id)}><DeleteIcon fontSize="small" /></IconButton>
                          </Box>
                        </Box>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>

              {/* Bottom Section */}
              <Box sx={{ textAlign: 'center', pb: 4 }}>
                {isParsing && <LinearProgress sx={{ mb: 3, borderRadius: '4px' }} color="primary" />}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
                    <Button 
                      variant="contained" color="secondary" size="large" 
                      onClick={openAssignModal} 
                      startIcon={<AssignmentIndIcon />} 
                      sx={{ px: 4, py: 1.5, borderRadius: 2, fontWeight: 700, backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}
                    >
                        Assign to Students
                    </Button>
                    <Button 
                      variant="outlined" color="primary" size="large" 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isParsing}
                      startIcon={<UploadIcon />} 
                      sx={{ px: 4, py: 1.5, borderRadius: 2, fontWeight: 700, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                        {isParsing ? 'Importing...' : 'Import from Word (.docx)'}
                    </Button>

                    <Button 
                      variant="contained" color="primary" size="large" 
                      onClick={() => { setSelectedQuestion(null); setStep(3); }} 
                      startIcon={<AddIcon />} 
                      sx={{ px: 6, py: 1.5, borderRadius: 2, fontWeight: 700, backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: '#fff' }}
                    >
                        Add Next Question
                    </Button>
                </Box>
                </Box>
              </Box>
            </Fade>
          )}
          
          {/* STUDENT ASSIGNMENT MODAL (GRID BASED) */}
        {assignModalOpen && (
          <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, md: 4 } }}>
             <Fade in={assignModalOpen}>
                <Card className="glass" sx={{ p: 4, borderRadius: 4, width: '100%', maxWidth: 1000, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box>
                         <Typography variant="h5" sx={{ fontWeight: 800 }}>Student Question Assignments</Typography>
                         <Typography variant="body2" color="text.secondary">
                            Tap the circular bubbles to assign specific questions to each student.
                         </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                         {studentsList.length > 0 && (
                           <Button 
                              variant="contained" 
                              color="primary" 
                              size="small" 
                              onClick={handleAutoAssign}
                              sx={{ borderRadius: 2, fontWeight: 700, px: 3, py: 1, backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', textTransform: 'none' }}
                           >
                              Auto Assign
                           </Button>
                         )}
                         <IconButton onClick={() => setAssignModalOpen(false)}><CloseIcon /></IconButton>
                      </Box>
                   </Box>
                   
                   <Box sx={{ flexGrow: 1, overflowY: 'auto', mt: 2, mb: 4, pr: 1 }}>
                      {studentsList.length === 0 ? (
                          <Box sx={{ textAlign: 'center', p: 4 }}>
                              <Typography color="text.secondary">No students found matching this exam's context.</Typography>
                          </Box>
                      ) : (
                          <Grid container spacing={2}>
                              {studentsList.map(student => (
                                  <Grid item xs={12} key={student.roll_number}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider', transition: '0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                                          <Box sx={{ minWidth: 150 }}>
                                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#2affff' }}>{student.roll_number}</Typography>
                                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 140 }}>{student.full_name}</Typography>
                                          </Box>
                                          
                                          <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
                                          
                                          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                              {questions.map((q, idx) => {
                                                  const isAssigned = (bulkAssignments[student.roll_number] || []).includes(q.id);
                                                  return (
                                                      <Box 
                                                          key={q.id}
                                                          onClick={() => handleToggleQuestionForStudent(student.roll_number, q.id)}
                                                          sx={{ 
                                                              width: 40, height: 40, borderRadius: '50%', 
                                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                              cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem',
                                                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                              bgcolor: isAssigned ? '#2affff' : 'rgba(255,255,255,0.05)',
                                                              color: isAssigned ? '#000' : 'text.disabled',
                                                              boxShadow: isAssigned ? '0 0 15px rgba(42, 255, 255, 0.4)' : 'none',
                                                              border: '2px solid',
                                                              borderColor: isAssigned ? '#2affff' : 'rgba(255,255,255,0.1)',
                                                              '&:hover': { transform: 'scale(1.1)', borderColor: '#2affff', color: isAssigned ? '#000' : '#2affff' }
                                                          }}
                                                          title={`Question ${idx + 1}`}
                                                      >
                                                          {idx + 1}
                                                      </Box>
                                                  );
                                              })}
                                          </Box>
                                      </Box>
                                  </Grid>
                              ))}
                          </Grid>
                      )}
                   </Box>

                   <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Button onClick={() => setAssignModalOpen(false)} variant="outlined" size="large">Cancel</Button>
                      <Button onClick={saveStudentAssignments} variant="contained" size="large" color="secondary" disabled={loading} sx={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', px: 6 }}>
                          {loading ? 'Saving...' : 'Save Assignments'}
                      </Button>
                   </Box>
                </Card>
             </Fade>
          </Box>
        )}

      </Box>
    </AdminLayout>
  );
}
