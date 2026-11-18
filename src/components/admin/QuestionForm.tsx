import { useState, useEffect, useRef } from 'react';
import {
  Box, Button, TextField, Typography, Card, Grid, Divider, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip, LinearProgress, Collapse,
  FormHelperText,
} from '@mui/material';
import {
  Save as SaveIcon, AddCircleOutline as AddIcon, DeleteOutline as DeleteIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  UploadFile as UploadFileIcon, Close as CloseIcon, Code as CodeIcon,
  Dataset as DatasetIcon,
} from '@mui/icons-material';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROGRAMMING_LANGUAGE_OPTIONS = [
  { group: 'Core Languages', options: [
    { label: 'C',    value: 'c' },
    { label: 'C++',  value: 'cpp' },
    { label: 'Java', value: 'java' },
    { label: 'Python', value: 'python' },
  ]},
  { group: 'Advanced Domains', options: [
    { label: 'Data Structures Using C', value: 'data_structures_c' },
    { label: 'Machine Learning',        value: 'machine_learning' },
    { label: 'Data Science',            value: 'data_science' },
    { label: 'Reinforcement Learning',  value: 'reinforcement_learning' },
    { label: 'CVPR',                    value: 'cvpr' },
    { label: 'Deep Learning',           value: 'deep_learning' },
    { label: 'CNN',                     value: 'cnn' },
    { label: 'Speech AI',               value: 'speech_ai' },
  ]},
];

// Flat list for easy lookup
export const ALL_LANG_OPTIONS = PROGRAMMING_LANGUAGE_OPTIONS.flatMap(g => g.options);

// Domains that require Python-based ML environments
export const ML_DOMAINS = ['machine_learning', 'data_science', 'reinforcement_learning', 'cvpr', 'deep_learning', 'cnn', 'speech_ai'];

// Get environment display label
export function getLangLabel(value: string): string {
  return ALL_LANG_OPTIONS.find(o => o.value === value)?.label ?? value;
}

// ─── Dataset upload helper types ─────────────────────────────────────────────

interface DatasetFile {
  file: File;
  uploadProgress: number; // 0-100 (simulated)
  uploaded: boolean;
}

interface DatasetState {
  csv:   DatasetFile | null;
  image: DatasetFile | null;
  rl:    DatasetFile | null;
  audio: DatasetFile | null;
}

interface QuestionFormProps {
  initialData?: any;
  editId?: number | null;
  onSave: (payloadString: string, rawFormData: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestionForm({
  initialData,
  editId,
  onSave,
  onCancel,
  isLoading = false,
}: QuestionFormProps) {
  const [formData, setFormData] = useState({
    topic: '',
    title: '',
    problemObj: '',
    inFormat: '',
    outFormat: '',
    hiddenCases: '',
    programmingLanguage: '' as string,
  });

  const [testCases, setTestCases] = useState([
    { input: '', output: '' },
    { input: '', output: '' },
    { input: '', output: '' },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [datasets, setDatasets] = useState<DatasetState>({ csv: null, image: null, rl: null, audio: null });

  const csvRef   = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const rlRef    = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        topic:               initialData.subject || initialData.topic || '',
        title:               initialData.title   || '',
        problemObj:          initialData.description || '',
        inFormat:            initialData.inputFormat  || '',
        outFormat:           initialData.outputFormat || '',
        hiddenCases:         initialData.hiddenCases
          ? (typeof initialData.hiddenCases === 'string'
              ? initialData.hiddenCases
              : JSON.stringify(initialData.hiddenCases, null, 2))
          : '',
        programmingLanguage: initialData.programmingLanguage || '',
      });

      if (initialData.testCases && Array.isArray(initialData.testCases) && initialData.testCases.length > 0) {
        setTestCases(initialData.testCases);
      } else if (initialData.cases && Array.isArray(initialData.cases) && initialData.cases.length > 0) {
        setTestCases(initialData.cases);
      }
    }
  }, [initialData]);

  // ── Dataset file handler ──
  const handleDatasetUpload = (
    type: 'csv' | 'image' | 'rl' | 'audio',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extensions
    if (type === 'csv' && !file.name.toLowerCase().endsWith('.csv')) {
      setErrors(prev => ({ ...prev, [`ds_${type}`]: 'Only .csv files allowed' }));
      return;
    }
    if (type === 'image' && !(/\.(zip|jpg|jpeg|png)$/i.test(file.name))) {
      setErrors(prev => ({ ...prev, [`ds_${type}`]: 'Only .zip, .jpg, .png files allowed' }));
      return;
    }
    if (type === 'rl' && !file.name.toLowerCase().endsWith('.json')) {
      setErrors(prev => ({ ...prev, [`ds_${type}`]: 'Only .json files allowed' }));
      return;
    }
    if (type === 'audio' && !(/\.(wav|mp3|flac)$/i.test(file.name))) {
      setErrors(prev => ({ ...prev, [`ds_${type}`]: 'Only .wav, .mp3, .flac files allowed' }));
      return;
    }

    // Size limits: CSV 50MB, Image ZIP 500MB, JSON 5MB, Audio 100MB
    const maxSize = type === 'image' ? 500 * 1024 * 1024 : type === 'audio' ? 100 * 1024 * 1024 : type === 'csv' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxLabel = type === 'image' ? '500MB' : type === 'audio' ? '100MB' : type === 'csv' ? '50MB' : '5MB';
      setErrors(prev => ({ ...prev, [`ds_${type}`]: `File exceeds ${maxLabel} limit` }));
      return;
    }

    setErrors(prev => { const n = { ...prev }; delete n[`ds_${type}`]; return n; });
    setDatasets(prev => ({ ...prev, [type]: { file, uploadProgress: 0, uploaded: false } }));

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10 + Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setDatasets(prev => ({ ...prev, [type]: prev[type] ? { ...prev[type]!, uploadProgress: 100, uploaded: true } : null }));
      } else {
        setDatasets(prev => ({ ...prev, [type]: prev[type] ? { ...prev[type]!, uploadProgress: progress } : null }));
      }
    }, 200);
  };

  const removeDataset = (type: 'csv' | 'image' | 'rl' | 'audio') => {
    setDatasets(prev => ({ ...prev, [type]: null }));
    if (type === 'csv' && csvRef.current)   csvRef.current.value   = '';
    if (type === 'image' && imageRef.current) imageRef.current.value = '';
    if (type === 'rl' && rlRef.current)     rlRef.current.value    = '';
    if (type === 'audio' && audioRef.current) audioRef.current.value = '';
  };

  // ── Test-case handlers ──
  const handleTestCaseChange = (index: number, field: 'input' | 'output', value: string) => {
    const newCases = [...testCases];
    newCases[index][field] = value;
    setTestCases(newCases);
    if (errors[`tc_${index}_${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`tc_${index}_${field}`];
      setErrors(newErrors);
    }
  };

  const handleAddTestCase = () => setTestCases([...testCases, { input: '', output: '' }]);

  const handleRemoveTestCase = (index: number) => {
    const newCases = [...testCases];
    newCases.splice(index, 1);
    setTestCases(newCases);
  };

  // ── Validation ──
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.topic.trim())           newErrors.topic           = 'Topic is required';
    if (!formData.title.trim())           newErrors.title           = 'Title is required';
    if (!formData.problemObj.trim())      newErrors.problemObj      = 'Problem description is required';
    if (!formData.programmingLanguage)    newErrors.programmingLanguage = 'Programming Language / Domain is required';

    if (testCases.length === 0) newErrors.testCases = 'At least 1 test case is required';
    testCases.forEach((tc, i) => {
      if (!tc.input.trim())  newErrors[`tc_${i}_input`]  = 'Required';
      if (!tc.output.trim()) newErrors[`tc_${i}_output`] = 'Required';
    });

    if (formData.hiddenCases.trim()) {
      try {
        const parsed = JSON.parse(formData.hiddenCases);
        if (!Array.isArray(parsed)) newErrors.hiddenCases = 'Hidden cases must be a JSON array';
      } catch {
        newErrors.hiddenCases = 'Invalid JSON format for hidden cases';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save ──
  const handleSave = async () => {
    if (!validate()) return;

    const datasetMeta = {
      csv:   datasets.csv   ? { name: datasets.csv.file.name,   size: datasets.csv.file.size }   : null,
      image: datasets.image ? { name: datasets.image.file.name, size: datasets.image.file.size } : null,
      rl:    datasets.rl    ? { name: datasets.rl.file.name,    size: datasets.rl.file.size }    : null,
      audio: datasets.audio ? { name: datasets.audio.file.name, size: datasets.audio.file.size } : null,
    };

    const payload = JSON.stringify({
      title:               formData.title,
      description:         formData.problemObj,
      inputFormat:         formData.inFormat,
      outputFormat:        formData.outFormat,
      programmingLanguage: formData.programmingLanguage,
      dataset:             datasetMeta,
      testCases:           testCases.map(tc => ({ input: tc.input.trim(), output: tc.output.trim() })),
      hiddenCases:         formData.hiddenCases.trim() ? JSON.parse(formData.hiddenCases) : [],
    });

    await onSave(payload, formData);
  };

  // ── Dataset upload card helper ──
  const DatasetCard = ({
    type,
    label,
    accept,
    hint,
    inputRef,
  }: {
    type: 'csv' | 'image' | 'rl' | 'audio';
    label: string;
    accept: string;
    hint: string;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => {
    const ds = datasets[type];
    const err = errors[`ds_${type}`];
    return (
      <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            {label}
          </Typography>
          {ds && (
            <IconButton size="small" color="error" onClick={() => removeDataset(type)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {ds ? (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, fontFamily: 'monospace' }} noWrap>
                {ds.file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(ds.file.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={ds.uploadProgress}
              color={ds.uploaded ? 'success' : 'primary'}
              sx={{ borderRadius: 4, height: 6 }}
            />
            {ds.uploaded && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700, mt: 0.5, display: 'block' }}>
                ✓ Upload complete
              </Typography>
            )}
          </Box>
        ) : (
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => inputRef.current?.click()}
            fullWidth
            sx={{ borderStyle: 'dashed', borderRadius: 2, py: 1.5 }}
          >
            {hint}
          </Button>
        )}
        {err && <FormHelperText error>{err}</FormHelperText>}
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => handleDatasetUpload(type, e)} />
      </Card>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Box className="glass" sx={{ p: 4, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: 'primary.main' }}>
        QUESTION FORM
      </Typography>

      {/* Topic + Title */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
        <TextField
          fullWidth label="Topic Name *" size="medium"
          value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })}
          error={!!errors.topic} helperText={errors.topic || 'e.g. Arrays, Strings, Algorithms'}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <TextField
          fullWidth label="Problem Title *" size="medium"
          value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
          error={!!errors.title} helperText={errors.title}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Box>

      {/* Programming Language / Domain */}
      <FormControl fullWidth error={!!errors.programmingLanguage} sx={{ mb: 3 }}>
        <InputLabel>Programming Language / Domain *</InputLabel>
        <Select
          value={formData.programmingLanguage}
          label="Programming Language / Domain *"
          onChange={e => setFormData({ ...formData, programmingLanguage: e.target.value })}
          startAdornment={<CodeIcon sx={{ mr: 1, fontSize: 20, color: 'secondary.main' }} />}
          sx={{ borderRadius: 2 }}
        >
          {PROGRAMMING_LANGUAGE_OPTIONS.map(group => [
            <MenuItem disabled key={group.group} sx={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: 1, color: 'text.disabled', py: 0.5 }}>
              — {group.group} —
            </MenuItem>,
            ...group.options.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {opt.label}
                  {ML_DOMAINS.includes(opt.value) && (
                    <Chip label="Python ML" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(168,85,247,0.15)', color: 'secondary.main', fontWeight: 800 }} />
                  )}
                </Box>
              </MenuItem>
            )),
          ])}
        </Select>
        <FormHelperText>{errors.programmingLanguage || 'Students will only be able to code in this language/domain'}</FormHelperText>
      </FormControl>

      {/* Problem Description */}
      <TextField
        fullWidth multiline minRows={4} label="Problem Description *"
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        value={formData.problemObj} onChange={e => setFormData({ ...formData, problemObj: e.target.value })}
        error={!!errors.problemObj} helperText={errors.problemObj}
      />

      {/* Input / Output Format */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
        <TextField
          fullWidth multiline minRows={3} label="Input Format"
          value={formData.inFormat} onChange={e => setFormData({ ...formData, inFormat: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <TextField
          fullWidth multiline minRows={3} label="Output Format"
          value={formData.outFormat} onChange={e => setFormData({ ...formData, outFormat: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Test Cases */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Dynamic Test Cases</Typography>
        <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={handleAddTestCase} size="small" sx={{ borderRadius: 2 }}>
          Add More Test Case
        </Button>
      </Box>

      {errors.testCases && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{errors.testCases}</Typography>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {testCases.map((tc, idx) => (
          <Grid item xs={12} md={6} key={idx}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3, position: 'relative', bgcolor: 'background.paper', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Test Case {idx + 1}</Typography>
                {testCases.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => handleRemoveTestCase(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth multiline minRows={2} label="Input" size="small"
                    value={tc.input} onChange={e => handleTestCaseChange(idx, 'input', e.target.value)}
                    error={!!errors[`tc_${idx}_input`]} helperText={errors[`tc_${idx}_input`]}
                    sx={{ '& .MuiOutlinedInput-root': { fontFamily: 'monospace' } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth multiline minRows={2} label="Expected Output" size="small"
                    value={tc.output} onChange={e => handleTestCaseChange(idx, 'output', e.target.value)}
                    error={!!errors[`tc_${idx}_output`]} helperText={errors[`tc_${idx}_output`]}
                    sx={{ '& .MuiOutlinedInput-root': { fontFamily: 'monospace' } }}
                  />
                </Grid>
              </Grid>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Hidden Test Cases */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Hidden Test Cases (JSON)</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Example: <code>[&#123; "input": "7", "output": "Prime" &#125;]</code>
      </Typography>

      <TextField
        fullWidth multiline minRows={4}
        placeholder="Paste your JSON array here..."
        value={formData.hiddenCases} onChange={e => setFormData({ ...formData, hiddenCases: e.target.value })}
        error={!!errors.hiddenCases} helperText={errors.hiddenCases}
        sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace' } }}
      />

      <Divider sx={{ mb: 3 }} />

      {/* Dataset & Resources (collapsible) */}
      <Box
        onClick={() => setDatasetOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider', mb: 2, transition: '0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DatasetIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Dataset &amp; Resources</Typography>
          {(datasets.csv || datasets.image || datasets.rl || datasets.audio) && (
            <Chip
              label={[datasets.csv, datasets.image, datasets.rl, datasets.audio].filter(Boolean).length + ' file(s)'}
              size="small"
              color="secondary"
              sx={{ height: 20, fontWeight: 800 }}
            />
          )}
        </Box>
        {datasetOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      <Collapse in={datasetOpen}>
        <Box sx={{ mb: 4, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'rgba(0,0,0,0.03)' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload datasets for ML, CVPR, and Reinforcement Learning exams. Students will be able to download these within the exam workspace.
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <DatasetCard
                type="csv"
                label="📊 CSV Dataset"
                accept=".csv"
                hint="Upload CSV file (max 50MB)"
                inputRef={csvRef}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatasetCard
                type="image"
                label="🖼️ Image Dataset"
                accept=".zip,.jpg,.jpeg,.png"
                hint="Upload ZIP / Image (max 500MB)"
                inputRef={imageRef}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatasetCard
                type="rl"
                label="🤖 RL Environment"
                accept=".json"
                hint="Upload JSON config (max 5MB)"
                inputRef={rlRef}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatasetCard
                type="audio"
                label="🎙️ Audio Dataset"
                accept=".wav,.mp3,.flac"
                hint="Upload Audio file (max 100MB)"
                inputRef={audioRef}
              />
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
        <Button onClick={onCancel} disabled={isLoading} sx={{ px: 4, borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained" color="secondary"
          startIcon={<SaveIcon />} onClick={handleSave}
          disabled={isLoading}
          sx={{ px: 4, borderRadius: 2, backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', boxShadow: '0 4px 14px 0 rgba(99,102,241,0.39)' }}
        >
          {editId ? 'Update Question' : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  );
}
