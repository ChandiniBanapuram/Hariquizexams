import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  Box, Typography, Button, CircularProgress, Select, MenuItem,
  FormControl, Tabs, Tab, Chip, IconButton, Tooltip, Stack,
  LinearProgress, Divider, Card, Grid
} from '@mui/material';
import {
  PlayArrow, Send as SendIcon, Fullscreen, FullscreenExit,
  ChevronLeft, ChevronRight, BugReport, Terminal, Code as CodeIcon,
  Assignment, History, CheckCircle, Cancel, Refresh,
  EmojiEvents, Timer, MemoryRounded, ContentCopy,
} from '@mui/icons-material';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { studentAPI, codingAPI, Question } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import StudentLayout from '@/components/layouts/StudentLayout';

const DEFAULT_CODE: Record<string, string> = {
  "": `// Please select a programming language from the dropdown above to start coding.\n\n`,
  python: `# Write your solution here\n# Use input() or sys.stdin.read() to read input\n\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n        \n    }\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}\n`,
  js: `"use strict";\n\nconst fs = require("fs");\nconst input = fs.readFileSync(0, "utf8");\n\nfunction solve(input) {\n    // Write your solution here\n    \n}\n\nsolve(input);\n`,
};

// ─── Resize Handle ──────────────────────────────────────
const ResizeHandle = ({ dir = 'h' }: { dir?: 'h' | 'v' }) => (
  <PanelResizeHandle>
    <Box
      sx={{
        width: dir === 'h' ? 8 : '100%',
        height: dir === 'v' ? 8 : '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: dir === 'h' ? 'col-resize' : 'row-resize',
        bgcolor: 'transparent',
        '&:hover > div': { bgcolor: '#2affff', boxShadow: '0 0 10px #2affff' },
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Box
        sx={{
          width: dir === 'h' ? 2 : 50,
          height: dir === 'v' ? 2 : 50,
          bgcolor: 'rgba(255,255,255,0.05)',
          borderRadius: 4,
          transition: 'all 0.2s',
        }}
      />
    </Box>
  </PanelResizeHandle>
);

// ─── Difficulty Badge ──────────────────────────────────
const DiffBadge = ({ d }: { d: string }) => {
  const map: Record<string, string> = { Easy: '#4ade80', Medium: '#fbbf24', Hard: '#f87171' };
  return (
    <Chip
      label={(d || 'Medium').toUpperCase()}
      size="small"
      sx={{
        bgcolor: (map[d] || '#2affff') + '15',
        color: map[d] || '#2affff',
        fontWeight: 900, 
        fontSize: '0.65rem', 
        height: 22, 
        borderRadius: '6px',
        border: `1px solid ${(map[d] || '#2affff')}33`,
        letterSpacing: 1
      }}
    />
  );
};

// ─── Mono Box ─────────────────────────────────────────
const MonoBox = ({ children, error = false }: { children: React.ReactNode; error?: boolean }) => (
  <Box
    sx={{
      bgcolor: error ? 'rgba(239, 68, 68, 0.05)' : 'rgba(15, 23, 42, 0.5)',
      color: error ? '#fca5a5' : '#e6edf3',
      fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
      fontSize: '0.8rem', 
      p: 2, 
      borderRadius: '12px',
      whiteSpace: 'pre-wrap', 
      overflowY: 'auto',
      border: `1px solid ${error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)'}`,
      maxHeight: 200,
      backdropFilter: 'blur(10px)'
    }}
  >
    {children}
  </Box>
);

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function CodingPractice() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { student, logout, isAuthenticated } = useStudentAuth();

  // ── Question state ─────────────────────────────────
  const [allQs, setAllQs] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selSubject, setSelSubject] = useState('');
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Editor state ───────────────────────────────────
  const [language, setLanguage] = useState<'python' | 'java' | 'cpp' | 'c' | 'js' | ''>('');
  const [code, setCode] = useState('// Please select a programming language from the dropdown above to start coding.\n\n');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const loadedFromDbRef = React.useRef(false);

  // Auto-enter browser fullscreen on mount & listen to state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial sync
    setIsFullscreen(!!document.fullscreenElement);

    const tryFullscreen = () => {
      try {
        const elem: any = document.documentElement;
        if (!document.fullscreenElement && elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        }
      } catch { /* noop */ }
    };
    const t = setTimeout(tryFullscreen, 300);

    return () => {
      clearTimeout(t);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        const elem: any = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (e) {
      console.error("Error toggling fullscreen:", e);
    }
  };

  // ── Execution state ────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [statusText, setStatusText] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [runSummary, setRunSummary] = useState<{
    passed: number; total: number; score: number; totalScore: number;
    result: string; execTime: string; memory: number;
  } | null>(null);

  // ── Editor refs & markers ──────────────────────────
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [warnings, setWarnings] = useState<{ line: number; message: string }[]>([]);
  const [warningMsg, setWarningMsg] = useState('');

  const resultsEndRef = React.useRef<HTMLDivElement>(null);

  // ── Custom input state ─────────────────────────────
  const [customIn, setCustomIn] = useState('');
  const [customOut, setCustomOut] = useState<{
    stdout: string; stderr: string; time: string; status: string;
  } | null>(null);
  const [isCustomRun, setIsCustomRun] = useState(false);

  // ── UI tab state ───────────────────────────────────
  const [leftTab, setLeftTab] = useState(0);   // 0=Problem 1=Submissions 2=Discuss
  const [bottomTab, setBottomTab] = useState(0);   // 0=Results 1=Custom
  const [submissions, setSubmissions] = useState<any[]>([]);

  // ── Parse current question ─────────────────────────
  const currentQ = questions[idx];
  const storageKey = `cp_${student?.id}_${currentQ?.id}_${language}`;

  const parsedQ = (() => {
    if (!currentQ) return { title: '', description: '', difficulty: 'Medium', inputFormat: '', outputFormat: '', testCases: [] };
    try {
      const p = JSON.parse(currentQ.question);
      let tcs: any[] = [];
      if (Array.isArray(p.testCases)) tcs = p.testCases;
      else if (Array.isArray(p.cases)) tcs = p.cases;
      else if (typeof p.testCases === 'string' && p.testCases.startsWith('[')) {
        try { tcs = JSON.parse(p.testCases); } catch { /**/ }
      }
      return {
        title: p.title || 'Untitled',
        description: p.description || currentQ.question,
        difficulty: p.difficulty || 'Medium',
        score: p.score || 100,
        inputFormat: p.inputFormat || '',
        outputFormat: p.outputFormat || '',
        testCases: tcs,
      };
    } catch {
      return { title: 'Untitled', description: currentQ.question, difficulty: 'Medium', score: 100, inputFormat: '', outputFormat: '', testCases: [] };
    }
  })();

  // ── Fetch questions ────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { navigate('/student/login'); return; }
    
    const params = new URLSearchParams(window.location.search);
    const diffParam = params.get('difficulty');
    const topicParam = params.get('topic');

    (async () => {
      setLoading(true);
      try {
        if (diffParam && topicParam) {
          // ── GLOBAL PRACTICE MODE ──
          const apiDiff = diffParam === 'All' ? undefined : diffParam;
          const res = await codingAPI.getPracticeQuestions(apiDiff, topicParam);
          const rawData = res.data || res.questions || [];
          
          if (rawData.length > 0) {
            const formatted = rawData.map((q: any) => ({
              id: q.id,
              subject: q.topic, 
              question: JSON.stringify({
                title: q.title,
                description: q.description,
                difficulty: q.difficulty,
                inputFormat: q.input_format,
                outputFormat: q.output_format,
                testCases: q.visible_test_cases,
                hiddenCases: q.hidden_test_cases
              })
            }));
            setAllQs(formatted);
            const subs = [...new Set(formatted.map((q: any) => q.subject))];
            setSubjects(subs as string[]);
            if (subs.length) setSelSubject(subs[0] as string);
          } else {
            // No questions found
            setAllQs([]);
            setSubjects([]);
            setSelSubject('');
          }
        } else {
          // ── ACADEMIC PRACTICE MODE ──
          const data = await studentAPI.getCodingQuestions('practice');
          if (Array.isArray(data) && student) {
            const valid = data.filter(q => {
              const d1 = (q.department || '').toLowerCase().trim();
              const d2 = (student.department || '').toLowerCase().trim();
              return (d1 === d2 || d1.includes(d2) || d2.includes(d1))
                && q.year === student.year
                && q.semester === student.semester;
            });
            setAllQs(valid);
            const subs = [...new Set(valid.map(q => q.subject))];
            setSubjects(subs);
            if (subs.length) setSelSubject(subs[0]);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [isAuthenticated, student, navigate]);

  useEffect(() => {
    if (!selSubject) return;
    const matched = allQs.filter(q => q.subject === selSubject);
    setQuestions(matched);
    
    // Read the specific question ID from URL if coming from the Setup list view
    const qidParam = new URLSearchParams(window.location.search).get('qid');
    let startingIdx = 0;
    if (qidParam && matched.length > 0) {
      const found = matched.findIndex(q => String(q.id) === qidParam);
      if (found !== -1) startingIdx = found;
    }
    
    setIdx(startingIdx);
    resetEnv();
  }, [selSubject, allQs]);

  // Reset status when code changes
  useEffect(() => {
    if (loadedFromDbRef.current) {
      loadedFromDbRef.current = false;
      return;
    }
    setStatusType(null);
    setStatusText('');
  }, [code, language]);

  // Auto-scroll to results
  useEffect(() => {
    if ((statusType || isRunning || isSubmitting || isCompiling) && bottomTab === 0) {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [statusType, isRunning, isSubmitting, isCompiling, bottomTab]);

  // ── Unified Auto-load from DB or LocalStorage ─────────────────
  useEffect(() => {
    if (!student || !currentQ) return;

    let active = true;

    const loadCode = async () => {
      setStatusType(null);
      setStatusText('');
      setResults([]);
      setRunSummary(null);

      try {
        const res = await codingAPI.getSubmissions(student.id, currentQ.id);
        if (!active) return;

        const subs = res.submissions || [];
        if (subs.length > 0) {
          const bestSub = subs.find((s: any) => s.status === 'Accepted') || subs[0];
          if (bestSub && bestSub.code) {
            loadedFromDbRef.current = true;
            setLanguage(bestSub.language);
            setCode(bestSub.code);

            const isAccepted = bestSub.status === 'Accepted';
            setStatusType(isAccepted ? 'success' : 'error');
            setStatusText(bestSub.status);

            const totalTC = bestSub.total_test_cases || 1;
            const passedTC = bestSub.passed_test_cases || 0;
            const reconstructedResults = Array.from({ length: totalTC }, (_, i) => ({
              testCase: i + 1,
              status: i < passedTC ? 'Accepted' : 'Wrong Answer',
              passed: i < passedTC,
              expectedOutput: 'Passed',
              actualOutput: 'Passed'
            }));
            setResults(reconstructedResults);
            setRunSummary({
              passed: passedTC,
              total: totalTC,
              score: bestSub.score || 0,
              totalScore: totalTC,
              result: bestSub.status,
              execTime: bestSub.execution_time || '0.0',
              memory: bestSub.memory || 0
            });
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load past submission:', err);
      }

      if (!active) return;
      const savedLang = localStorage.getItem(`cp_${student.id}_${currentQ.id}_last_lang`) || '';
      setLanguage(savedLang as any);

      const lKey = `cp_${student.id}_${currentQ.id}_${savedLang}`;
      const savedCode = localStorage.getItem(lKey);
      setCode(savedCode ?? DEFAULT_CODE[savedLang] ?? '// Please select a programming language from the dropdown above to start coding.\n\n');
    };

    loadCode();

    return () => {
      active = false;
    };
  }, [idx, student, currentQ]);

  // Save changes to localStorage
  useEffect(() => {
    if (!currentQ || !code.trim() || !language || code === DEFAULT_CODE[language]) return;
    const t = setTimeout(() => localStorage.setItem(storageKey, code), 1000);
    return () => clearTimeout(t);
  }, [code, storageKey, language]);

  // Save last used language
  useEffect(() => {
    if (!currentQ || !language || !student) return;
    localStorage.setItem(`cp_${student.id}_${currentQ.id}_last_lang`, language);
  }, [language, currentQ, student]);

  // Real-time debounced compilation
  useEffect(() => {
    if (!code.trim() || code === '# Write your solution here\n\n') return;
    const timer = setTimeout(() => {
      // Small silent compile in background
      handleCompile(true);
    }, 1200); // 1.2s to be safe with piston limits
    return () => clearTimeout(timer);
  }, [code, language]);

  // ── Error Parsing & Markers ──────────────────────
  const parsePistonError = (stderr: string, lang: string) => {
    if (!stderr) return [];
    const extractedErrors: { line: number; message: string }[] = [];
    const lines = stderr.split('\n');

    // Improved regex for multi-line/multi-error detection
    if (lang === 'java') {
      const matches = [...stderr.matchAll(/Main\.java:(\d+): error: (.*)/g)];
      matches.forEach(m => extractedErrors.push({ line: parseInt(m[1]), message: m[2].trim() }));
    } else if (lang === 'python') {
      const matches = [...stderr.matchAll(/File ".*", line (\d+)(?:, in .*)?\n\s*(.*)/g)];
      if (matches.length > 0) {
        matches.forEach(m => extractedErrors.push({ line: parseInt(m[1]), message: m[2].trim() }));
      } else {
        const lineMatch = stderr.match(/line (\d+)/);
        if (lineMatch) extractedErrors.push({ line: parseInt(lineMatch[1]), message: lines[lines.length - 2] || "Runtime Error" });
      }
    } else if (lang === 'cpp' || lang === 'c') {
      const matches = [...stderr.matchAll(/solution\.(?:cpp|c):(\d+):(?:\d+:)? error: (.*)/g)];
      matches.forEach(m => extractedErrors.push({ line: parseInt(m[1]), message: m[2].trim() }));
    } else if (lang === 'js') {
      const matches = [...stderr.matchAll(/solution\.js:(\d+)\n(.*)/g)];
      matches.forEach(m => extractedErrors.push({ line: parseInt(m[1]), message: m[2].trim() }));
    }

    if (extractedErrors.length === 0 && stderr.toLowerCase().includes('error')) {
      const genericMatch = stderr.match(/:(\d+):/);
      if (genericMatch) extractedErrors.push({ line: parseInt(genericMatch[1]), message: "Error detected" });
    }

    return extractedErrors;
  };

  const checkSuspiciousPatterns = (code: string, lang: string) => {
    const warns: { line: number; message: string }[] = [];
    const lines = code.split('\n');

    lines.forEach((l, i) => {
      // Example: Detect potential infinite loops or empty blocks
      if (l.includes('while(true)') || l.includes('while (true)') || /for\s*\(\s*;\s*;\s*\)/.test(l)) {
        warns.push({ line: i + 1, message: "Potential infinite loop detected." });
      }
      if (lang === 'python' && l.trim() === 'pass') {
        warns.push({ line: i + 1, message: "Empty block (pass) detected." });
      }
      if (/{\s*}/.test(l) && !l.includes('=>')) {
        warns.push({ line: i + 1, message: "Empty block detected." });
      }
      // Basic unused variable detection (very naive regex for common patterns)
      if (lang === 'java' || lang === 'cpp' || lang === 'c') {
        const varMatch = l.match(/(?:int|float|double|char|long)\s+(\w+)\s*;/);
        if (varMatch && !code.includes(varMatch[1], code.indexOf(varMatch[0]) + varMatch[0].length)) {
          warns.push({ line: i + 1, message: `Variable '${varMatch[1]}' declared but not used.` });
        }
      }
    });

    return warns;
  };

  const updateEditorMarkers = useCallback((errs: { line: number; message: string }[], warns: { line: number; message: string }[] = []) => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers = [
      ...errs.map(e => ({
        startLineNumber: e.line,
        endLineNumber: e.line,
        startColumn: 1,
        endColumn: model.getLineContent(e.line).length + 1,
        message: e.message,
        severity: monacoRef.current.MarkerSeverity.Error,
      })),
      ...warns.map(w => ({
        startLineNumber: w.line,
        endLineNumber: w.line,
        startColumn: 1,
        endColumn: model.getLineContent(w.line).length + 1,
        message: w.message,
        severity: monacoRef.current.MarkerSeverity.Warning,
      }))
    ];

    monacoRef.current.editor.setModelMarkers(model, "owner", markers);
    if (errs.length > 0) {
      editorRef.current.revealLineInCenter(errs[0].line);
    }
  }, []);

  const resetEnv = useCallback(() => {
    setResults([]);
    setRunSummary(null);
    setBottomTab(0);
    setCustomOut(null);
    setStatusText('');
    setStatusType(null);
    setErrorLine(null);
    setErrorMsg('');
    setErrors([]);
    setWarnings([]);
    setWarningMsg('');
    updateEditorMarkers([], []);
  }, [updateEditorMarkers]);

  const copyResults = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Result output copied to clipboard.' });
  }, [toast]);

  const normalizeResponse = (res: any) => {
    return {
      stdout: res?.stdout || res?.run?.stdout || "",
      stderr: res?.stderr || res?.compile_output || res?.run?.stderr || "",
      code: res?.run?.code ?? (res?.error ? 1 : 0),
      time: res?.time || res?.run?.time || "0.0",
      memory: res?.memory || res?.run?.memory || 0
    };
  };

  const isError = statusType === 'error';

  // ── Run code ───────────────────────────────────────
  const execCode = useCallback(async (mode: 'run' | 'submit') => {
    if (!currentQ) return;

    if (!language) {
      toast({
        title: "Select Language",
        description: "Please select a programming language from the dropdown above to start coding.",
        variant: "destructive",
      });
      return;
    }

    // Switch state based on mode
    if (mode === 'submit') {
      setIsSubmitting(true);
      setBottomTab(0); // Results tab for submit
    } else {
      setIsRunning(true);
      setBottomTab(1); // Custom Input tab for run
    }

    setResults([]);
    setRunSummary(null);
    setStatusText('');
    setCustomOut(null);

    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      if (mode === 'run') {
        const rawRes = await studentAPI.runCode({ code, language, stdin: customIn }, controllerRef.current.signal);
        const res = normalizeResponse(rawRes);
        if (!rawRes.error) {
          const hasError = (res.stderr && res.stderr.trim() !== "") || res.code !== 0;
          setCustomOut({
            stdout: res.stdout || 'No output',
            stderr: res.stderr,
            time: res.time,
            status: hasError ?
              (res.stderr.toLowerCase().includes('traceback') || res.stderr.toLowerCase().includes('exception') ? 'Runtime Error' : 'Error')
              : 'Execution Successful'
          });

          if (hasError) {
            const errs = parsePistonError(res.stderr, language).slice(0, 10);
            setErrors(errs);
            if (errs.length > 0) {
              setErrorLine(errs[0].line);
              setErrorMsg(errs[0].message);
              updateEditorMarkers(errs, []);
            }
            setStatusType('error');
            setStatusText(res.stderr.toLowerCase().includes('traceback') || res.stderr.toLowerCase().includes('exception') ? "Runtime Error" : "Error");
            setBottomTab(0); // switch to results on error
          } else {
            setStatusType('success');
            setStatusText("Execution Successful");
            setErrors([]);
            updateEditorMarkers([], []);
          }
        } else {
          if (rawRes.name === 'AbortError') return;
          setCustomOut({ stdout: '', stderr: rawRes.message || 'Unknown error', time: '0.0', status: 'Error' });
          setStatusType('error');
          setStatusText("Error");
          setBottomTab(0);
        }
      } else {
        // Submit Mode (all test cases)
        let passedCount = 0;
        const detailedResults: any[] = [];
        let totalTime = 0;
        let totalMem = 0;
        let finalStatusType: 'success' | 'error' = 'success';

        if (parsedQ.testCases.length === 0) {
            const rawRes = await studentAPI.runCode({ code, language, stdin: '' }, controllerRef.current.signal);
            const res = normalizeResponse(rawRes);
            if (rawRes.error) {
                if (rawRes.name === 'AbortError') return;
                finalStatusType = 'error';
                detailedResults.push({ testCase: 1, status: 'Error', passed: false, error: rawRes.message });
            } else {
                const hasError = (res.stderr && res.stderr.trim() !== "") || res.code !== 0;
                if (hasError) {
                    finalStatusType = 'error';
                    detailedResults.push({ testCase: 1, status: 'Runtime Error', passed: false, error: res.stderr || 'Execution failed' });
                } else {
                    detailedResults.push({ testCase: 1, status: 'Accepted', passed: true, actualOutput: res.stdout || 'Success', expectedOutput: 'No output expected' });
                    passedCount = 1;
                }
            }
            if (res.time) totalTime += parseFloat(res.time);
            if (res.memory) totalMem = Math.max(totalMem, res.memory);
        } else {
            for (let i = 0; i < parsedQ.testCases.length; i++) {
              const tc = parsedQ.testCases[i];
              const rawRes = await studentAPI.runCode({ code, language, stdin: tc.input || '' }, controllerRef.current.signal);
              const res = normalizeResponse(rawRes);

              if (rawRes.error) {
                if (rawRes.name === 'AbortError') return;
                setStatusType('error');
                setStatusText(`❌ ${rawRes.message || 'Execution Failed'}`);
                setResults([{ testCase: i + 1, status: 'Error', passed: false, error: rawRes.message }]);
                setIsRunning(false);
                setIsSubmitting(false);
                return;
              }

              // Lenient comparison: trim each line, collapse whitespace, case-insensitive
              const normalize = (s: string) => (s || '')
                .replace(/\r\n/g, '\n')
                .split('\n')
                .map(l => l.trim().replace(/\s+/g, ' '))
                .filter(l => l.length > 0)
                .join('\n')
                .toLowerCase();
              const rawOutput = res.stdout || '';
              const rawExpected = tc.output || '';
              const hasError = (res.stderr && res.stderr.trim() !== "") || res.code !== 0;

              if (hasError) {
                const errs = parsePistonError(res.stderr, language).slice(0, 10);
                setErrors(errs);
                if (errs.length > 0) {
                  setErrorLine(errs[0].line);
                  setErrorMsg(errs[0].message);
                  updateEditorMarkers(errs, []);
                }
                finalStatusType = 'error';
              }

              const isPassed = !hasError && normalize(rawOutput) === normalize(rawExpected);

              if (isPassed) passedCount++;
              else finalStatusType = 'error';

              detailedResults.push({
                testCase: i + 1,
                passed: isPassed,
                status: isPassed ? 'Accepted' : (hasError ?
                  (res.stderr.toLowerCase().includes('traceback') || res.stderr.toLowerCase().includes('exception') ? 'Runtime Error' : 'Error')
                  : 'Wrong Answer'),
                time: res.time,
                compileError: '',
                runtimeError: res.stderr,
                actualOutput: res.stdout || (hasError ? "" : "No output"),
                expectedOutput: tc.output,
                input: tc.input
              });

              if (res.time) totalTime += parseFloat(res.time);
              if (res.memory) totalMem = Math.max(totalMem, res.memory);

              if (!isPassed) {
                break; // Stop on first failure for UX efficiency
              }
            }
        }

        setResults(detailedResults);
        setStatusType(finalStatusType);

        if (parsedQ.testCases.length === 0) {
          const maxMarks = parsedQ.score || 100;
          setStatusText(finalStatusType === 'success' ? "✅ Accepted (No Test Cases)" : "❌ Error");
          setRunSummary({
            passed: finalStatusType === 'success' ? 1 : 0, total: 1, score: finalStatusType === 'success' ? maxMarks : 0, totalScore: maxMarks,
            result: finalStatusType === 'success' ? 'Accepted' : 'Error', execTime: totalTime.toFixed(3), memory: totalMem
          });
          if (finalStatusType === 'success') toast({ title: '✅ Accepted!', description: `Code is correct. Score: ${maxMarks}` });
        } else if (passedCount === parsedQ.testCases.length) {
          setStatusText("✅ Accepted");
          setRunSummary({
            passed: passedCount, total: parsedQ.testCases.length,
            score: parsedQ.score || 100, totalScore: parsedQ.score || 100,
            result: 'Accepted', execTime: totalTime.toFixed(3), memory: totalMem
          });
          toast({ title: '✅ Accepted!', description: `All test cases passed. Score: ${parsedQ.score || 100}` });
        } else {
          setStatusText("❌ Wrong Answer");
          setRunSummary({
            passed: passedCount, total: parsedQ.testCases.length,
            score: 0, totalScore: parsedQ.score || 100,
            result: 'Wrong Answer', execTime: totalTime.toFixed(3), memory: totalMem
          });
          const failedTc = detailedResults.find(r => !r.passed);
          toast({ title: '❌ Wrong Answer', description: `Failed at test case #${failedTc?.testCase ?? 1}`, variant: 'destructive' });
        }

        // ── Submission Logic ──
        if (mode === 'submit' && student) {
          try {
            // Calculate score using (passed / total) * maxMarks
            const maxMarks = parsedQ.score || 100;
            let normalizedScore = 0;
            if (parsedQ.testCases.length > 0) {
                normalizedScore = Math.round((passedCount / parsedQ.testCases.length) * maxMarks);
            } else {
                normalizedScore = finalStatusType === 'success' ? maxMarks : 0;
            }

            const submitPayload = {
              studentId: String(student.id),
              questionId: String(currentQ.id),
              examId: null, // Practice mode
              code: code,
              language: language,
              status: finalStatusType === 'success' ? 'Accepted' : (detailedResults.find(r => !r.passed)?.status || 'Error'),
              passedTestCases: passedCount,
              totalTestCases: parsedQ.testCases.length,
              score: normalizedScore,
              executionTime: parseFloat(totalTime.toFixed(3)),
              memory: totalMem
            };

            await codingAPI.saveSubmission(submitPayload);
            toast({ title: 'Submitted', description: 'Your solution has been evaluated and saved.' });

            // Refresh submissions
            fetchSubmissions();
          } catch (submitErr) {
            console.error('Submission storage failed:', submitErr);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Execution Error:', err);
      setStatusText('❌ Network Error');
      setResults([{ testCase: 1, status: 'Network Error', passed: false, error: 'Unable to connect to compiler. Please try again.' }]);
    } finally {
      setIsRunning(false);
      setIsSubmitting(false);
    }
  }, [code, language, currentQ, student, toast, parsedQ, customIn, updateEditorMarkers, leftTab]);

  // ── Compile code ───────────────────────────────────
  const handleCompile = useCallback(async (silent = false) => {
    if (!currentQ) return;

    if (!language) {
      if (!silent) {
        toast({
          title: "Select Language",
          description: "Please select a programming language first.",
          variant: "destructive",
        });
      }
      return;
    }

    // Prevent excessive calls
    if (code.trim().length < 15 || isCompiling) return;

    setIsCompiling(true);
    if (!silent) {
      setBottomTab(0); // Results tab
      setResults([]);
      setRunSummary(null);
      setStatusText('');
      setCustomOut(null);
    }
    setWarningMsg('');

    // Abort previous request if any
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      // Force execution with dummy input to catch runtime/naming errors during "Compile"
      const rawRes = await studentAPI.runCode({ code, language, stdin: '1\n1' }, controllerRef.current.signal);
      const res = normalizeResponse(rawRes);

      if (!rawRes.error) {
        // Check stderr OR non-zero exit code OR silent crash (empty stdout with no err)
        const isSilentCrash = res.stdout.trim() === "" && res.stderr.trim() === "" && res.code === 0;
        const hasError = (res.stderr && res.stderr.trim() !== "") || res.code !== 0 || isSilentCrash;

        if (hasError) {
          const errs = parsePistonError(res.stderr, language).slice(0, 10);
          setErrors(errs);

          let classification = "Error";
          const lowerStderr = res.stderr.toLowerCase();
          if (lowerStderr.includes('exception') || lowerStderr.includes('traceback')) {
            classification = "Runtime Error";
          } else if (lowerStderr.includes('cannot find symbol') || lowerStderr.includes('error:') || lowerStderr.includes('compilation')) {
            classification = "Compilation Error";
          }

          if (errs.length > 0) {
            setErrorLine(errs[0].line);
            setErrorMsg(errs[0].message);
            updateEditorMarkers(errs, []);
          } else if (isSilentCrash) {
            setWarningMsg("Possible logical or variable issue detected (Silent Crash)");
          }

          // Add some simple logic-based warnings
          const extraWarns = checkSuspiciousPatterns(code, language).slice(0, 10);
          setWarnings(extraWarns);
          updateEditorMarkers(errs, extraWarns);

          setStatusType('error');
          setStatusText(classification);
          setResults([{
            testCase: 1,
            status: classification,
            passed: false,
            error: res.stderr || (isSilentCrash ? "Possible undeclared variable or invalid code (Silent Crash)" : "Execution failed with exit code " + res.code),
          }]);
        } else {
          setStatusType('success');
          setStatusText("Compilation Successful");
          setErrors([]);
          updateEditorMarkers([], []);
          setRunSummary({
            passed: 0, total: 0, score: 0, totalScore: 0,
            result: 'Compilation Successful', execTime: res.time, memory: res.memory
          });
          setResults([{
            testCase: 1,
            passed: true,
            status: 'Success',
            actualOutput: "✅ Compilation successful. No syntax errors found.",
          }]);
        }
      } else {
        setStatusType('error');
        setStatusText("Error");
        setResults([{ testCase: 1, status: 'Error', passed: false, error: rawRes.message || 'Unknown error' }]);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Compilation Error:', e);
      setStatusType('error');
      setStatusText('Network Error');
      setResults([{ testCase: 1, status: 'Network Error', passed: false, error: 'Unable to connect to compiler. Please try again.' }]);
    } finally {
      setIsCompiling(false);
    }
  }, [code, language, currentQ, updateEditorMarkers, checkSuspiciousPatterns, isCompiling]);

  // ── Custom-input run ──────────────────────────────
  // ── Submissions logic ──────────────────────────────
  const fetchSubmissions = useCallback(async () => {
    if (!student || !currentQ) return;
    try {
      const res = await codingAPI.getSubmissions(student.id, currentQ.id);
      setSubmissions(res.submissions || []);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  }, [student, currentQ]);

  useEffect(() => {
    if (leftTab === 1) fetchSubmissions();
  }, [leftTab, fetchSubmissions]);

  const runCustom = useCallback(async () => {
    if (!language) {
      toast({
        title: "Select Language",
        description: "Please select a programming language first.",
        variant: "destructive",
      });
      return;
    }
    if (!code.trim()) return;
    resetEnv();
    setIsCustomRun(true);

    // Abort previous request if any
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      const rawRes = await studentAPI.runCode({ code, language, stdin: customIn }, controllerRef.current.signal);
      const res = normalizeResponse(rawRes);
      if (!rawRes.error) {
        const hasError = (res.stderr && res.stderr.trim() !== "") || res.code !== 0;
        if (hasError) {
          const errs = parsePistonError(res.stderr, language).slice(0, 10);
          setErrors(errs);
          if (errs.length > 0) {
            setErrorLine(errs[0].line);
            setErrorMsg(errs[0].message);
            updateEditorMarkers(errs, []);
          }
          setBottomTab(0); // Auto switch to results on error
        } else {
          setErrors([]);
          updateEditorMarkers([], []);
        }
        setCustomOut({
          stdout: res.stdout || 'No output',
          stderr: res.stderr,
          time: res.time,
          status: hasError ? (res.stderr.toLowerCase().includes('traceback') || res.stderr.toLowerCase().includes('exception') ? 'Runtime Error' : 'Error') : 'Success'
        });
        setStatusType(hasError ? 'error' : 'success');
        setStatusText(hasError ? (res.stderr.toLowerCase().includes('traceback') || res.stderr.toLowerCase().includes('exception') ? "Runtime Error" : "Error") : "Success");
      } else {
        if (rawRes.name === 'AbortError') return;
        setStatusType('error');
        setStatusText("Error");
        setCustomOut({ stdout: '', stderr: rawRes.message || 'Unknown error', time: '0', status: 'Error' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStatusType('error');
      setStatusText('Network Error');
      setCustomOut({ stdout: '', stderr: 'Network error', time: '0', status: 'Error' });
    } finally {
      setIsCustomRun(false);
    }
  }, [code, language, customIn, resetEnv, updateEditorMarkers]);

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════
  if (loading) {
    return (
      <StudentLayout user={student} onLogout={logout} noPadding>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', gap: 2 }}>
          <CircularProgress sx={{ color: '#22c55e' }} />
          <Typography variant="body2" color="text.secondary">Loading coding workspace…</Typography>
        </Box>
      </StudentLayout>
    );
  }

  if (!questions.length && !loading) {
    return (
      <StudentLayout user={student} onLogout={logout} noPadding>
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          {/* Subject selector bar */}
          {subjects.length > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>Subject:</Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={selSubject}
                  onChange={e => setSelSubject(e.target.value)}
                  sx={{ fontSize: '0.85rem' }}
                >
                  {subjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 1.5 }}>
            <Assignment sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">No Questions Available</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', maxWidth: 400 }}>
              {new URLSearchParams(window.location.search).get('difficulty') 
                ? "We couldn't find any questions matching your selected difficulty and topic."
                : "Ask your instructor to add coding practice questions for your department & semester."}
            </Typography>
            {new URLSearchParams(window.location.search).get('difficulty') && (
              <Button variant="outlined" onClick={() => navigate('/student/coding-practice')} sx={{ mt: 2 }}>
                Go Back to Setup
              </Button>
            )}
          </Box>
        </Box>
      </StudentLayout>
    );
  }

  // ── Tab style helper
  const tabSx = {
    minHeight: 32, py: 0, px: 2, fontSize: '0.75rem',
    textTransform: 'uppercase', fontWeight: 900,
    borderRadius: '12px 12px 0 0',
    letterSpacing: 1,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&.Mui-selected': { 
      color: '#2affff',
      bgcolor: 'rgba(42, 255, 255, 0.05)'
    },
    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.02)' }
  };
  const darkTabsSx = {
    minHeight: 32,
    '& .MuiTabs-indicator': { bgcolor: '#2affff', height: 2 },
    '& .MuiTab-root': { ...tabSx, color: 'rgba(255,255,255,0.4)' },
  };

  return (
    <StudentLayout user={student} onLogout={logout} noPadding>

      {/* ── Top control bar (subject + question nav + lang + fullscreen) ── */}
      {!isFullscreen && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 2,
            flexWrap: 'wrap', px: 3, py: 1,
            bgcolor: 'rgba(9,9,11,0.9)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Subject picker */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selSubject}
              onChange={e => { setSelSubject(e.target.value); }}
              sx={{ borderRadius: '50px', bgcolor: 'rgba(255,255,255,0.02)', color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, fontSize: '0.8rem', fontWeight: 700 }}
            >
              {subjects.map(s => <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{s}</MenuItem>)}
            </Select>
          </FormControl>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

          {/* Prev / Question info / Next */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" disabled={idx === 0} onClick={() => { setIdx(i => i - 1); resetEnv(); }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#2affff', bgcolor: 'rgba(42, 255, 255, 0.05)' } }}>
              <ChevronLeft fontSize="small" />
            </IconButton>
            <Chip
              label={`${idx + 1} / ${questions.length}`}
              size="small"
              sx={{ fontWeight: 900, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.7rem', height: 24, borderRadius: '50px', px: 1 }}
            />
            <IconButton size="small" disabled={idx === questions.length - 1} onClick={() => { setIdx(i => i + 1); resetEnv(); }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#2affff', bgcolor: 'rgba(42, 255, 255, 0.05)' } }}>
              <ChevronRight fontSize="small" />
            </IconButton>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

          {/* Language selector */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={language}
              displayEmpty
              onChange={e => setLanguage(e.target.value as any)}
              sx={{ borderRadius: '50px', bgcolor: 'rgba(255,255,255,0.02)', color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, fontSize: '0.8rem', fontWeight: 900 }}
            >
              <MenuItem value="" disabled sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Select Language</MenuItem>
              {[['python', 'PYTHON 3'], ['java', 'JAVA 17'], ['cpp', 'C++ 20'], ['c', 'C (GCC)'], ['js', 'JAVASCRIPT']].map(([v, l]) => (
                <MenuItem key={v as string} value={v as string} sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{l as string}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          {/* Fullscreen toggle */}
          <Tooltip title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}>
            <IconButton size="small" onClick={toggleBrowserFullscreen} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#2affff', bgcolor: 'rgba(42, 255, 255, 0.05)' } }}>
              {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* ════════════════════════════════════════════════
           MAIN SPLIT WORKSPACE
         ════════════════════════════════════════════════ */}
      <Box
        sx={{
          height: isFullscreen ? '100vh' : 'calc(100vh - 64px - 50px)',
          minHeight: 400,
          flexGrow: 1,
          position: isFullscreen ? 'fixed' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? 0 : 'auto',
          right: isFullscreen ? 0 : 'auto',
          bottom: isFullscreen ? 0 : 'auto',
          zIndex: isFullscreen ? 1300 : 'auto',
          bgcolor: '#09090b',
          overflow: 'hidden',
        }}
      >
        {/* Fullscreen exit button overlay */}
        {isFullscreen && (
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1400 }}>
            <Tooltip title="Exit Fullscreen (Esc)">
              <IconButton size="small" onClick={toggleBrowserFullscreen} sx={{ bgcolor: '#1c1c1c', color: '#fff', '&:hover': { bgcolor: '#27272a' } }}>
                <FullscreenExit fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* ── Horizontal split: LEFT (problem) | RIGHT (editor + console) ── */}
        <PanelGroup direction="horizontal" style={{ height: '100%' }}>

          {/* ═══ LEFT PANEL — Problem description ═══ */}
          <Panel defaultSize={38} minSize={22} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}>

              {/* Left tab strip */}
              <Box sx={{ bgcolor: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', px: 0.5 }}>
                <Tabs value={leftTab} onChange={(_, v) => setLeftTab(v)} sx={darkTabsSx}>
                  <Tab icon={<Assignment sx={{ fontSize: 14 }} />} iconPosition="start" label="PROBLEM" />
                  <Tab icon={<History sx={{ fontSize: 14 }} />} iconPosition="start" label="HISTORY" />
                  <Tab icon={<EmojiEvents sx={{ fontSize: 14 }} />} iconPosition="start" label="RANKING" />
                </Tabs>
              </Box>

              {/* Left content */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 4, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(42, 255, 255, 0.1)', borderRadius: 4 } }}>

                {/* ── PROBLEM TAB ── */}
                {leftTab === 0 && currentQ && (
                  <Box>
                    {questions.length > 1 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ChevronLeft fontSize="small" />}
                          disabled={idx === 0}
                          onClick={() => { setIdx(i => i - 1); resetEnv(); }}
                          sx={{ color: '#2affff', borderColor: 'rgba(42,255,255,0.3)', textTransform: 'none', fontWeight: 700, fontSize: '0.7rem' }}
                        >
                          Prev
                        </Button>
                        <Chip label={`Q ${idx + 1} / ${questions.length}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 800, fontSize: '0.65rem' }} />
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                          size="small"
                          variant="contained"
                          endIcon={<ChevronRight fontSize="small" />}
                          disabled={idx === questions.length - 1}
                          onClick={() => { setIdx(i => i + 1); resetEnv(); }}
                          sx={{ bgcolor: '#2affff', color: '#000', textTransform: 'none', fontWeight: 800, fontSize: '0.7rem', '&:hover': { bgcolor: '#5affff' } }}
                        >
                          Next
                        </Button>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', flexGrow: 1, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                        {parsedQ.title || `Problem ${idx + 1}`}
                      </Typography>
                      <DiffBadge d={parsedQ.difficulty} />
                    </Box>

                    <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, mb: 4, whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                      {parsedQ.description}
                    </Typography>

                    {parsedQ.inputFormat && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 1.5 }}>INPUT SPECIFICATION</Typography>
                        <Box className="premium-glass-card" sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.02) !important' }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontWeight: 500 }}>{parsedQ.inputFormat}</Typography>
                        </Box>
                      </Box>
                    )}

                    {parsedQ.outputFormat && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 1.5 }}>EXPECTED OUTPUT</Typography>
                        <Box className="premium-glass-card" sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.02) !important' }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontWeight: 500 }}>{parsedQ.outputFormat}</Typography>
                        </Box>
                      </Box>
                    )}

                    {parsedQ.testCases.length > 0 && (
                      <>
                        <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>Test Cases / Examples</Typography>
                        {parsedQ.testCases.map((tc: any, i: number) => (
                          <Box key={i} sx={{ mb: 2, bgcolor: '#18181b', borderRadius: 1.5, p: 2, border: '1px solid #27272a' }}>
                            <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 700 }}>Example {i + 1}</Typography>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600 }}>Input:</Typography>
                              <MonoBox>{tc.input || '(empty)'}</MonoBox>
                            </Box>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600 }}>Output:</Typography>
                              <MonoBox>{tc.output || '(empty)'}</MonoBox>
                            </Box>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* ── INLINE OUTPUT (left side) ── */}
                    {(customOut || errors.length > 0) && (
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 1.5 }}>
                          Your Code Output
                        </Typography>
                        {customOut?.stderr ? (
                          <MonoBox error>
                            {errors.length > 0 && (
                              <Box sx={{ color: '#fca5a5', fontWeight: 700, mb: 1 }}>
                                ⚠ Error on line {errors[0].line}: {errors[0].message}
                              </Box>
                            )}
                            {customOut.stderr}
                          </MonoBox>
                        ) : (
                          <MonoBox>{customOut?.stdout || '(no output yet — click RUN CODE)'}</MonoBox>
                        )}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Submissions Tab */}
                {leftTab === 1 && (
                  <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <History /> My Submissions
                    </Typography>

                    {submissions.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                        <Typography variant="body2">No submissions yet for this problem.</Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        {submissions.map((sub) => (
                          <Box key={sub.id} className="premium-glass-card" sx={{ p: 2, borderLeft: '4px solid', borderColor: sub.status === 'Accepted' ? '#4ade80' : '#f87171', bgcolor: 'rgba(255,255,255,0.01) !important', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Box>
                                <Chip
                                  label={sub.status}
                                  size="small"
                                  color={sub.status === 'Accepted' ? 'success' : 'error'}
                                  sx={{ fontWeight: 800, height: 20, mb: 1 }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  Score: {sub.score}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {new Date(sub.created_at).toLocaleDateString()} {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CodeIcon sx={{ fontSize: 14 }} /> {sub.language}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Timer sx={{ fontSize: 14 }} /> {sub.execution_time || 0}s
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <MemoryRounded sx={{ fontSize: 14 }} /> {sub.memory ? (sub.memory / 1024).toFixed(0) : 0} KB
                              </Typography>
                            </Stack>

                            <button
                              className="pill-btn-teal"
                              style={{ padding: '4px 12px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}
                              onClick={() => {
                                toast({ title: 'LOADING CODE', description: 'Restoring this submission to your local IDE...' });
                                setCode(sub.code);
                              }}
                            >
                              VIEW CODE
                            </button>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}

                {/* ── LEADERBOARD TAB ── */}
                {leftTab === 2 && (
                  <Box sx={{ textAlign: 'center', py: 10, bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <EmojiEvents sx={{ fontSize: 48, color: '#fbbf24', mb: 2, filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.3))' }} />
                    <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3, fontWeight: 700 }}>EXPLORE THE HALL OF FAME</Typography>
                    <button
                      className="pill-btn-teal"
                      onClick={() => navigate('/student/leaderboard')}
                      style={{ padding: '8px 24px', fontSize: '0.8rem' }}
                    >
                      VIEW RANKINGS →
                    </button>
                  </Box>
                )}
              </Box>
            </Box>
          </Panel>

          <ResizeHandle dir="h" />

          {/* ═══ RIGHT PANEL — Editor + Console (vertical split) ═══ */}
          <Panel defaultSize={62} minSize={35} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <PanelGroup direction="vertical" style={{ height: '100%' }}>

              {/* ─── EDITOR PANEL ─── */}
              <Panel defaultSize={62} minSize={30} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1e1e1e' }}>

                  {/* Editor header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, bgcolor: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 1.5 }}>
                    <Stack direction="row" spacing={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f87171', boxShadow: '0 0 8px #f87171' }} />
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', ml: 2, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>
                      {parsedQ.title || 'SOURCE'}.{(language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'cpp' ? 'cpp' : language === 'js' ? 'js' : 'c').toUpperCase()}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    {isCompiling && (
                      <Chip
                        icon={<Refresh sx={{ fontSize: '12px !important', animation: 'spin 1s linear infinite', color: '#2affff !important' }} />}
                        label="ANALYZING"
                        size="small"
                        sx={{ height: 22, bgcolor: 'rgba(42, 255, 255, 0.1)', color: '#2affff', border: '1px solid rgba(42, 255, 255, 0.2)', fontWeight: 900, fontSize: '0.65rem', letterSpacing: 1 }}
                      />
                    )}
                    {errorLine && !isCompiling && (
                      <Chip
                        label={`ERR L:${errorLine}`}
                        size="small"
                        onClick={() => {
                          if (editorRef.current) editorRef.current.revealLineInCenter(errorLine);
                        }}
                        sx={{
                          height: 22, bgcolor: 'rgba(248, 113, 113, 0.1)', color: '#f87171',
                          border: '1px solid rgba(248, 113, 113, 0.2)', fontWeight: 900, fontSize: '0.65rem',
                          cursor: 'pointer', '&:hover': { bgcolor: 'rgba(248, 113, 113, 0.2)' },
                          letterSpacing: 0.5
                        }}
                      />
                    )}
                    <Tooltip title="Reset IDE">
                      <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#2affff' } }} onClick={() => setCode(DEFAULT_CODE[language] || '# Write your solution here\n\n')}>
                        <Refresh sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Monaco Editor */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Editor
                      height="100%"
                      language={language === 'cpp' ? 'cpp' : language === 'js' ? 'javascript' : language}
                      theme="vs-dark"
                      value={code}
                      onChange={val => setCode(val || '')}
                      onMount={(editor, monaco) => {
                        editorRef.current = editor;
                        monacoRef.current = monaco;
                      }}
                      options={{
                        readOnly: !language,
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
                        lineHeight: 1.6,
                        padding: { top: 12 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        bracketPairColorization: { enabled: true },
                        formatOnPaste: true,
                        automaticLayout: true,
                        wordWrap: 'on',
                        tabSize: language === 'python' ? 4 : 2,
                      }}
                    />
                  </Box>

                  {/* ─── ERROR/WARNING PANEL (VS Code local feel) ─── */}
                  {(errors.length > 0 || warnings.length > 0 || warningMsg) && (
                    <Box sx={{ bgcolor: '#1e1e1e', borderTop: '1px solid #333', maxHeight: 120, overflowY: 'auto', p: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#333' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Problems ({errors.length + warnings.length})
                        </Typography>
                        {warningMsg && <Chip label={warningMsg} size="small" sx={{ height: 16, fontSize: '0.65rem', bgcolor: 'rgba(234,179,8,0.1)', color: '#eab308' }} />}
                      </Box>
                      <Stack spacing={0.5}>
                        {errors.map((e, i) => (
                          <Box
                            key={`err-${i}`}
                            onClick={() => editorRef.current?.revealLineInCenter(e.line)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.3, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(239,68,68,0.05)' }, borderRadius: 0.5 }}
                          >
                            <Cancel sx={{ fontSize: 13, color: '#ef4444' }} />
                            <Typography variant="caption" sx={{ color: '#fca5a5', fontFamily: 'monospace' }}>Line {e.line}: {e.message}</Typography>
                          </Box>
                        ))}
                        {warnings.map((w, i) => (
                          <Box
                            key={`warn-${i}`}
                            onClick={() => editorRef.current?.revealLineInCenter(w.line)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.3, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(234,179,8,0.05)' }, borderRadius: 0.5 }}
                          >
                            <BugReport sx={{ fontSize: 13, color: '#eab308' }} />
                            <Typography variant="caption" sx={{ color: '#fde047', fontFamily: 'monospace' }}>Line {w.line}: {w.message}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Panel>

              <ResizeHandle dir="v" />

              {/* ─── CONSOLE / BOTTOM PANEL ─── */}
              <Panel defaultSize={38} minSize={18} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#111113', borderTop: '1px solid #27272a' }}>

                  {/* Console header: tabs + Run / Submit buttons */}
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', px: 1, gap: 1 }}>
                    <Tabs
                      value={bottomTab}
                      onChange={(_, v) => setBottomTab(v)}
                      sx={{ ...darkTabsSx, flexGrow: 1 }}
                    >
                      <Tab
                        icon={<Terminal sx={{ fontSize: 14 }} />}
                        iconPosition="start"
                        label={
                          <Box display="flex" alignItems="center" gap={1}>
                            <span>RESULTS</span>
                            {statusText && (
                                <Box sx={{ 
                                    height: 18, fontSize: '0.6rem', fontWeight: 900,
                                    bgcolor: isError ? 'rgba(248, 113, 113, 0.1)' : 'rgba(42, 255, 255, 0.1)',
                                    color: isError ? '#f87171' : '#2affff',
                                    borderRadius: '4px',
                                    border: `1px solid ${isError ? 'rgba(248, 113, 113, 0.2)' : 'rgba(42, 255, 255, 0.2)'}`,
                                    px: 1,
                                    letterSpacing: 0.5
                                }}>
                                    {statusText.toUpperCase()}
                                </Box>
                            )}
                          </Box>
                        }
                      />
                      <Tab icon={<CodeIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="CUSTOM I/O" />
                    </Tabs>

                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', gap: 1.5, pr: 1, py: 1 }}>
                      <button
                        className="pill-btn-teal"
                        style={{ padding: '6px 16px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.6)' }}
                        disabled={isRunning || isSubmitting || isCompiling}
                        onClick={() => handleCompile()}
                      >
                        {isCompiling ? 'ANALYZING...' : 'COMPILE'}
                      </button>
                      <button
                        className="pill-btn-teal"
                        style={{ padding: '6px 16px', fontSize: '0.75rem', background: 'rgba(42, 255, 255, 0.05)' }}
                        disabled={isRunning || isSubmitting || isCompiling}
                        onClick={() => execCode('run')}
                      >
                        {isRunning ? 'RUNNING...' : 'RUN CODE'}
                      </button>
                      <button
                        className="pill-btn-teal"
                        style={{ padding: '8px 24px', fontSize: '0.8rem', minWidth: 120 }}
                        disabled={isRunning || isSubmitting || isCompiling}
                        onClick={() => execCode('submit')}
                      >
                        {isSubmitting ? 'SUBMITTING...' : 'SUBMIT SOLUTION'}
                      </button>
                    </Box>
                  </Box>

                  {/* ── Console content ── */}
                  <Box
                    sx={{
                      flexGrow: 1, overflowY: 'auto', p: 1.5,
                      '&::-webkit-scrollbar': { width: 5 },
                      '&::-webkit-scrollbar-thumb': { bgcolor: '#27272a', borderRadius: 4 },
                    }}
                  >

                    {/* ══ TAB 0: TEST RESULTS ══ */}
                    {bottomTab === 0 && (
                      <Box>
                        {(isRunning || isSubmitting || isCompiling) && (
                          <Box sx={{ mb: 2 }}>
                            <LinearProgress sx={{ borderRadius: 4, height: 3, bgcolor: '#27272a', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                            <Typography variant="caption" color="#71717a" mt={0.5} display="block" textAlign="center">
                              Executing on Piston sandbox…
                            </Typography>
                          </Box>
                        )}

                        {/* Summary bar */}
                        {runSummary && (
                          <Box
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 1.5,
                              bgcolor: statusType === 'success' ? '#14532d' : (errors.length > 0 ? '#7f1d1d' : '#422006'),
                              border: `1px solid ${statusType === 'success' ? '#22c55e44' : (errors.length > 0 ? '#ef444444' : '#eab30844')}`,
                              borderRadius: 1.5,
                              color: statusType === 'success' ? '#86efac' : (errors.length > 0 ? '#fca5a5' : '#fde047'),
                            }}
                          >
                            {statusType === 'success'
                              ? <CheckCircle sx={{ color: '#22c55e', fontSize: 20 }} />
                              : (errors.length > 0 ? <Cancel sx={{ color: '#ef4444', fontSize: 20 }} /> : <BugReport sx={{ color: '#eab308', fontSize: 20 }} />)
                            }
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" fontWeight={700} color="inherit">
                                {statusType === 'success' ? '✅ ' + statusText : (errors.length > 0 ? '❌ ' + statusText : '⚠️ ' + statusText)}
                              </Typography>
                              <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                                {runSummary.total > 0 && `${runSummary.passed}/${runSummary.total} test cases passed`}
                                {runSummary.totalScore > 100 && ` · Score: ${runSummary.score}/${runSummary.totalScore}`}
                                {warningMsg && ` · ${warningMsg}`}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Tooltip title="Copy Output">
                                <IconButton size="small" onClick={() => copyResults(JSON.stringify(results, null, 2))} sx={{ color: 'inherit', opacity: 0.7 }}>
                                  <ContentCopy sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              {runSummary.execTime && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Timer sx={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} />
                                  <Typography variant="caption" color="inherit" sx={{ opacity: 0.7 }}>{runSummary.execTime}s</Typography>
                                </Box>
                              )}
                              {runSummary.memory ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <MemoryRounded sx={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} />
                                  <Typography variant="caption" color="inherit" sx={{ opacity: 0.7 }}>{(runSummary.memory / 1024).toFixed(0)} KB</Typography>
                                </Box>
                              ) : null}
                            </Box>
                          </Box>
                        )}

                        {/* Per-test-case cards */}
                        {results.length === 0 && !isRunning && !isSubmitting && !isCompiling && (
                          <Box sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="body2" color="#52525b" fontFamily="monospace">
                              // Click "Run Code" or "Compile" to see results
                            </Typography>
                          </Box>
                        )}

                        <Stack spacing={1.5}>
                          {results.map((r: any, i: number) => (
                            <Box
                              key={i}
                              className="premium-glass-card"
                              sx={{
                                borderLeft: `4px solid ${r.passed ? '#4ade80' : '#f87171'} !important`,
                                p: 2,
                                bgcolor: 'rgba(255,255,255,0.01) !important'
                              }}
                            >
                              {/* Header row */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                {r.passed
                                  ? <CheckCircle sx={{ color: '#4ade80', fontSize: 18 }} />
                                  : <Cancel sx={{ color: '#f87171', fontSize: 18 }} />
                                }
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: r.passed ? '#4ade80' : '#f87171', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                  {statusText === 'Compilation Successful' ? 'ANALYSIS COMPLETED' : `TEST CASE ${r.testCase}`}{r.isHidden ? ' (HIDDEN)' : ''}
                                </Typography>
                                {r.time && (
                                  <Box sx={{ ml: 'auto', px: 1, py: 0.2, borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 800 }}>{r.time}s</Box>
                                )}
                              </Box>

                              {/* Error output */}
                              {(!r.passed && (r.compileError || r.runtimeError || r.error)) ? (
                                <MonoBox error>
                                  {r.compileError || r.runtimeError || r.error}
                                </MonoBox>
                              ) : (
                                /* Input / Expected / Actual  */
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {r.actualOutput && (
                                    <Box>
                                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 1, mb: 1, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        <Terminal sx={{ fontSize: 12, color: '#2affff' }} /> STDOUT
                                      </Typography>
                                      <MonoBox error={!r.passed}>
                                        {r.actualOutput}
                                      </MonoBox>
                                    </Box>
                                  )}

                                  {!statusText.includes('Compilation') && (
                                    <Grid container spacing={2}>
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>INPUT</Typography>
                                        <MonoBox>{r.isHidden ? '(HIDDEN)' : (r.input || '(EMPTY)')}</MonoBox>
                                      </Grid>
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>EXPECTED</Typography>
                                        <MonoBox>{r.isHidden && !r.passed ? '(HIDDEN)' : (r.expectedOutput || '(EMPTY)')}</MonoBox>
                                      </Grid>
                                    </Grid>
                                  )}
                                </Box>
                              )}
                            </Box>
                          ))}
                          <div ref={resultsEndRef} />
                        </Stack>
                      </Box>
                    )}

                    {/* ══ TAB 1: CUSTOM INPUT ══ */}
                    {bottomTab === 1 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="#71717a" fontWeight={600}>
                            Stdin — enter your custom test input
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={isCustomRun || !code.trim()}
                            onClick={runCustom}
                            startIcon={isCustomRun ? <CircularProgress size={11} sx={{ color: '#fff' }} /> : <PlayArrow sx={{ fontSize: 15 }} />}
                            sx={{
                              bgcolor: '#6366f1', color: '#fff', textTransform: 'none',
                              fontSize: '0.75rem', py: 0.3, fontWeight: 600,
                              '&:hover': { bgcolor: '#4f46e5' },
                            }}
                          >
                            {isCustomRun ? 'Running…' : 'Run Custom'}
                          </Button>
                        </Box>

                        {/* Textarea */}
                        <Box
                          component="textarea"
                          value={customIn}
                          onChange={(e: any) => setCustomIn(e.target.value)}
                          placeholder="3&#10;1 2 3"
                          rows={5}
                          spellCheck={false}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            backgroundColor: '#0d1117', color: '#e6edf3',
                            border: '1px solid #21262d', borderRadius: 6,
                            padding: '10px 12px',
                            fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
                            fontSize: '0.82rem', lineHeight: 1.5,
                            resize: 'vertical', outline: 'none',
                          }}
                        />

                        {/* Custom output */}
                        {customOut && (
                          <Box sx={{ bgcolor: '#18181b', border: '1px solid #27272a', borderRadius: 1.5, p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="caption" color="#71717a" fontWeight={600}>Output</Typography>
                              <Chip
                                label={customOut.status}
                                size="small"
                                sx={{
                                  height: 16, fontSize: '0.6rem', fontWeight: 700,
                                  bgcolor: customOut.stderr ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
                                  color: customOut.stderr ? '#fca5a5' : '#86efac',
                                }}
                              />
                              <Typography variant="caption" color="#52525b">{customOut.time}s</Typography>
                            </Box>
                            {customOut.stderr ? (
                              <MonoBox error>{customOut.stderr}</MonoBox>
                            ) : (
                              <MonoBox>{customOut.stdout || '(no output)'}</MonoBox>
                            )}
                          </Box>
                        )}
                      </Box>
                    )}

                  </Box>{/* end console content */}
                </Box>
              </Panel>{/* end console panel */}

            </PanelGroup>{/* end vertical split */}
          </Panel>{/* end right panel */}

        </PanelGroup>{/* end horizontal split */}
      </Box>{/* end workspace box */}
    </StudentLayout>
  );
}
