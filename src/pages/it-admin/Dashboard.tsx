import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Pagination,
  Stack,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Business as BuildingIcon,
  Group as UsersIcon,
  CalendarMonth as CalendarIcon,
  MenuBook as BookOpenIcon,
  Description as FileTextIcon,
  School as GraduationCapIcon,
  Add as PlusIcon,
  Delete as Trash2Icon,
} from '@mui/icons-material';

import { useToast } from '@/hooks/use-toast';
import { useITAdmin } from '@/context/ITAdminContext';
import { itAdminAPI, LookupItem, SubjectItem } from '@/lib/itadmin-api';
import ITAdminLayout from '@/components/layouts/ITAdminLayout';
import { useBranding } from '@/context/BrandingContext';

// Generic CRUD section component
function LookupSection({
  title,
  icon: Icon,
  items,
  isLoading,
  onAdd,
  onDelete,
  labelPlaceholder,
  valuePlaceholder,
}: {
  title: string;
  icon: React.ElementType;
  items: LookupItem[];
  isLoading: boolean;
  onAdd: (label: string, value: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  labelPlaceholder: string;
  valuePlaceholder: string;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    setIsAdding(true);
    await onAdd(newLabel.trim(), newValue.trim());
    setNewLabel('');
    setNewValue('');
    setIsAdding(false);
    setIsDialogOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon color="primary" /> {title} ({items.length})
        </Typography>
        <Button variant="contained" startIcon={<PlusIcon />} onClick={() => setIsDialogOpen(true)} size="small">
          Add
        </Button>
      </Box>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add {title.slice(0, -1)}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
              <TextField
                label="Display Label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={labelPlaceholder}
                fullWidth
              />
              <TextField
                label="Value (used in database)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={valuePlaceholder}
                fullWidth
              />
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setIsDialogOpen(false)} disabled={isAdding}>Cancel</Button>
            <Button 
                onClick={handleAdd} 
                disabled={isAdding || !newLabel.trim() || !newValue.trim()} 
                variant="contained"
                startIcon={isAdding ? <CircularProgress size={20} /> : <PlusIcon />}
            >
                Add
            </Button>
        </DialogActions>
      </Dialog>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No {title.toLowerCase()} found</Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Label</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 80, align: 'center' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>
                    <Chip size="small" label={item.value} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2Icon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// Custom TabPanel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: string;
  value: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function DepartmentsSection({
  items,
  isLoading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: LookupItem[];
  isLoading: boolean;
  onAdd: (label: string, value: string, user: string, pass: string) => Promise<void>;
  onUpdate: (id: number, label: string, value: string, user: string, pass: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Edit states
  const [editItem, setEditItem] = useState<LookupItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    setIsAdding(true);
    await onAdd(newLabel.trim(), newValue.trim(), newUser.trim(), newPass.trim());
    setNewLabel('');
    setNewValue('');
    setNewUser('');
    setNewPass('');
    setIsAdding(false);
    setIsDialogOpen(false);
  };

  const handleOpenEdit = (item: LookupItem) => {
    setEditItem(item);
    setEditLabel(item.label);
    setEditValue(item.value);
    setEditUser(item.admin_username || '');
    setEditPass(item.admin_password || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editItem || !editLabel.trim() || !editValue.trim()) return;
    setIsUpdating(true);
    await onUpdate(editItem.id, editLabel.trim(), editValue.trim(), editUser.trim(), editPass.trim());
    setEditItem(null);
    setEditLabel('');
    setEditValue('');
    setEditUser('');
    setEditPass('');
    setIsUpdating(false);
    setIsEditDialogOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildingIcon color="primary" /> Departments ({items.length})
        </Typography>
        <Button variant="contained" startIcon={<PlusIcon />} onClick={() => setIsDialogOpen(true)} size="small">
          Add Department
        </Button>
      </Box>

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Department</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              label="Display Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. CSE (AI & ML)"
              fullWidth
            />
            <TextField
              label="Value (used in database)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g. CSE(AI&ML)"
              fullWidth
            />
            <TextField
              label="Admin Login Username"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="e.g. cseadmin"
              fullWidth
            />
            <TextField
              label="Admin Login Password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="e.g. csepass123"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsDialogOpen(false)} disabled={isAdding}>Cancel</Button>
          <Button 
            onClick={handleAdd} 
            disabled={isAdding || !newLabel.trim() || !newValue.trim()} 
            variant="contained"
            startIcon={isAdding ? <CircularProgress size={20} /> : <PlusIcon />}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Department</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              label="Display Label"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              fullWidth
            />
            <TextField
              label="Value (used in database)"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              fullWidth
            />
            <TextField
              label="Admin Login Username"
              value={editUser}
              onChange={(e) => setEditUser(e.target.value)}
              fullWidth
            />
            <TextField
              label="Admin Login Password"
              value={editPass}
              onChange={(e) => setEditPass(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Cancel</Button>
          <Button 
            onClick={handleUpdate} 
            disabled={isUpdating || !editLabel.trim() || !editValue.trim()} 
            variant="contained"
            startIcon={isUpdating ? <CircularProgress size={20} /> : <SettingsIcon />}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No departments found</Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Label</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Admin Username</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Admin Password</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 150, textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{item.label}</TableCell>
                  <TableCell>
                    <Chip size="small" label={item.value} variant="outlined" color="primary" />
                  </TableCell>
                  <TableCell>{item.admin_username || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={item.admin_password || '—'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenEdit(item)}
                      >
                        Edit
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2Icon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default function ITAdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated } = useITAdmin();
  const { settings, refreshBranding } = useBranding();

  const [brandingForm, setBrandingForm] = useState<any>({
    admin_header_title: '',
    admin_footer_text: '',
    admin_logo: '',
    student_header_title: '',
    student_footer_text: '',
    student_logo: '',
    login_header_title: '',
    login_header_subtitle: '',
    login_footer_text: '',
    login_logo: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setBrandingForm(settings);
    }
  }, [settings]);

  const handleLogoChange = (key: string, file: File | null) => {
    if (!file) {
      setBrandingForm((prev: any) => ({ ...prev, [key]: '' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo image must be smaller than 2MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBrandingForm((prev: any) => ({ ...prev, [key]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const result = await itAdminAPI.saveSettings(brandingForm);
    if (result && !result.error && !result.message?.toLowerCase().includes('failed')) {
      toast({ title: 'Branding Saved', description: 'Branding settings updated successfully.' });
      await refreshBranding();
    } else {
      toast({ title: 'Error', description: result?.message || 'Failed to save settings', variant: 'destructive' });
    }
    setIsSavingSettings(false);
  };

  const [departments, setDepartments] = useState<LookupItem[]>([]);
  const [sections, setSections] = useState<LookupItem[]>([]);
  const [years, setYears] = useState<LookupItem[]>([]);
  const [semesters, setSemesters] = useState<LookupItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingSems, setLoadingSems] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState('departments');

  // Subject filters
  const [subFilterDept, setSubFilterDept] = useState('ALL');
  const [subFilterYear, setSubFilterYear] = useState('ALL');
  const [subFilterSem, setSubFilterSem] = useState('ALL');

  // Student filters
  const [stuFilterDept, setStuFilterDept] = useState('ALL');
  const [stuFilterYear, setStuFilterYear] = useState('ALL');
  const [stuFilterSem, setStuFilterSem] = useState('ALL');
  const [stuFilterSection, setStuFilterSection] = useState('ALL');

  // Student pagination
  const [stuPage, setStuPage] = useState(1);
  const [stuSearchRoll, setStuSearchRoll] = useState('');
  const STU_PER_PAGE = 25;


  // Add subject dialog
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [newSubLabel, setNewSubLabel] = useState('');
  const [newSubValue, setNewSubValue] = useState('');
  const [newSubDept, setNewSubDept] = useState('');
  const [newSubYear, setNewSubYear] = useState('');
  const [newSubSem, setNewSubSem] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Promote students dialog
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteDept, setPromoteDept] = useState('ALL');
  const [promoteFromYear, setPromoteFromYear] = useState('');
  const [promoteFromSem, setPromoteFromSem] = useState('');
  const [promoteToYear, setPromoteToYear] = useState('');
  const [promoteToSem, setPromoteToSem] = useState('');

  useEffect(() => {
    if (!isAuthenticated) navigate('/it-admin');
  }, [isAuthenticated, navigate]);

  const fetchAll = useCallback(async () => {
    setLoadingDepts(true);
    setLoadingSections(true);
    setLoadingYears(true);
    setLoadingSems(true);

    const [depts, secs, yrs, sems] = await Promise.all([
      itAdminAPI.getDepartments(),
      itAdminAPI.getSections(),
      itAdminAPI.getYears(),
      itAdminAPI.getSemesters(),
    ]);

    setDepartments(Array.isArray(depts) ? depts : []);
    setSections(Array.isArray(secs) ? secs : []);
    setYears(Array.isArray(yrs) ? yrs : []);
    setSemesters(Array.isArray(sems) ? sems : []);

    setLoadingDepts(false);
    setLoadingSections(false);
    setLoadingYears(false);
    setLoadingSems(false);
  }, []);

  const fetchSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    const result = await itAdminAPI.getSubjects(
      subFilterDept !== 'ALL' ? subFilterDept : undefined,
      subFilterYear !== 'ALL' ? subFilterYear : undefined,
      subFilterSem !== 'ALL' ? subFilterSem : undefined
    );
    setSubjects(Array.isArray(result) ? result : []);
    setLoadingSubjects(false);
  }, [subFilterDept, subFilterYear, subFilterSem]);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    const result = await itAdminAPI.getStudents(
      stuFilterDept !== 'ALL' ? stuFilterDept : undefined,
      stuFilterYear !== 'ALL' ? stuFilterYear : undefined,
      stuFilterSem !== 'ALL' ? stuFilterSem : undefined,
      stuFilterSection !== 'ALL' ? stuFilterSection : undefined
    );
    setStudents(Array.isArray(result) ? result : []);
    setLoadingStudents(false);
  }, [stuFilterDept, stuFilterYear, stuFilterSem, stuFilterSection]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);
  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Reset student page on filter or search change
  useEffect(() => { setStuPage(1); }, [stuFilterDept, stuFilterYear, stuFilterSem, stuFilterSection, stuSearchRoll]);

  const filteredStudents = students.filter((s: any) => {
    if (!stuSearchRoll.trim()) return true;
    return String(s.roll_number || '').toLowerCase().includes(stuSearchRoll.trim().toLowerCase());
  });

  const stuTotalPages = Math.ceil(filteredStudents.length / STU_PER_PAGE);
  const paginatedStudents = filteredStudents.slice((stuPage - 1) * STU_PER_PAGE, stuPage * STU_PER_PAGE);


  const showResult = (result: any, successMsg: string) => {
    if (result?.message?.toLowerCase().includes('already') || result?.message?.toLowerCase().includes('failed')) {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: successMsg });
    }
  };

  const handleAddSubject = async () => {
    if (!newSubDept || !newSubYear || !newSubSem || !newSubLabel.trim() || !newSubValue.trim()) return;
    setIsAddingSubject(true);
    const result = await itAdminAPI.addSubject({
      department_value: newSubDept,
      year_value: newSubYear,
      semester_value: newSubSem,
      label: newSubLabel.trim(),
      value: newSubValue.trim(),
    });
    showResult(result, 'Subject added');
    setNewSubLabel('');
    setNewSubValue('');
    setNewSubDept('');
    setNewSubYear('');
    setNewSubSem('');
    setIsAddingSubject(false);
    setIsSubjectDialogOpen(false);
    fetchSubjects();
  };

  const handlePromoteStudents = async () => {
    if (!promoteFromYear || !promoteFromSem || !promoteToYear || !promoteToSem) return;
    setIsPromoting(true);
    const result = await itAdminAPI.promoteStudents({
      department: promoteDept === 'ALL' ? undefined : promoteDept,
      fromYear: promoteFromYear,
      fromSem: promoteFromSem,
      toYear: promoteToYear,
      toSem: promoteToSem
    });
    showResult(result, result.message || 'Students promoted successfully');
    setIsPromoting(false);
    setIsPromoteDialogOpen(false);
    
    // reset
    setPromoteFromYear('');
    setPromoteFromSem('');
    setPromoteToYear('');
    setPromoteToSem('');
    
    fetchStudents();
  };

  return (
    <ITAdminLayout onLogout={logout}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{ mx: 'auto', mb: 2, width: 72, height: 72, borderRadius: '50%', bgcolor: 'primary.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>System Configuration</Typography>
          <Typography variant="body1" color="text.secondary">Add or remove departments, sections, years, semesters, and subjects</Typography>
        </Box>

        <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, nv) => setActiveTab(nv)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 2 }}
            >
              <Tab value="departments" label="Depts" icon={<BuildingIcon />} iconPosition="start" />
              <Tab value="sections" label="Sections" icon={<UsersIcon />} iconPosition="start" />
              <Tab value="years" label="Years" icon={<CalendarIcon />} iconPosition="start" />
              <Tab value="semesters" label="Semesters" icon={<BookOpenIcon />} iconPosition="start" />
              <Tab value="subjects" label="Subjects" icon={<FileTextIcon />} iconPosition="start" />
              <Tab value="students" label="Students" icon={<GraduationCapIcon />} iconPosition="start" />
              <Tab value="customization" label="Branding" icon={<SettingsIcon />} iconPosition="start" />
            </Tabs>
          </Box>

          <CardContent sx={{ p: { xs: 2, md: 4 } }}>
            <TabPanel value={activeTab} index="departments">
              <DepartmentsSection
                items={departments}
                isLoading={loadingDepts}
                onAdd={async (label, value, user, pass) => {
                  const r = await itAdminAPI.addDepartment(label, value, user, pass);
                  showResult(r, 'Department added');
                  fetchAll();
                }}
                onUpdate={async (id, label, value, user, pass) => {
                  const r = await itAdminAPI.updateDepartment(id, label, value, user, pass);
                  showResult(r, 'Department updated successfully');
                  fetchAll();
                }}
                onDelete={async (id) => {
                  if (!confirm('Delete this department?')) return;
                  await itAdminAPI.deleteDepartment(id);
                  toast({ title: 'Deleted', description: 'Department deleted' });
                  fetchAll();
                }}
              />
            </TabPanel>

            <TabPanel value={activeTab} index="sections">
              <LookupSection
                title="Sections"
                icon={UsersIcon}
                items={sections}
                isLoading={loadingSections}
                onAdd={async (label, value) => {
                  const r = await itAdminAPI.addSection(label, value);
                  showResult(r, 'Section added');
                  fetchAll();
                }}
                onDelete={async (id) => {
                  if (!confirm('Delete this section?')) return;
                  await itAdminAPI.deleteSection(id);
                  toast({ title: 'Deleted', description: 'Section deleted' });
                  fetchAll();
                }}
                labelPlaceholder="e.g. Section C"
                valuePlaceholder="e.g. C"
              />
            </TabPanel>

            <TabPanel value={activeTab} index="years">
              <LookupSection
                title="Years"
                icon={CalendarIcon}
                items={years}
                isLoading={loadingYears}
                onAdd={async (label, value) => {
                  const r = await itAdminAPI.addYear(label, value);
                  showResult(r, 'Year added');
                  fetchAll();
                }}
                onDelete={async (id) => {
                  if (!confirm('Delete this year?')) return;
                  await itAdminAPI.deleteYear(id);
                  toast({ title: 'Deleted', description: 'Year deleted' });
                  fetchAll();
                }}
                labelPlaceholder="e.g. 5th Year"
                valuePlaceholder="e.g. 5"
              />
            </TabPanel>

            <TabPanel value={activeTab} index="semesters">
              <LookupSection
                title="Semesters"
                icon={BookOpenIcon}
                items={semesters}
                isLoading={loadingSems}
                onAdd={async (label, value) => {
                  const r = await itAdminAPI.addSemester(label, value);
                  showResult(r, 'Semester added');
                  fetchAll();
                }}
                onDelete={async (id) => {
                  if (!confirm('Delete this semester?')) return;
                  await itAdminAPI.deleteSemester(id);
                  toast({ title: 'Deleted', description: 'Semester deleted' });
                  fetchAll();
                }}
                labelPlaceholder="e.g. Sem III"
                valuePlaceholder="e.g. 3"
              />
            </TabPanel>

            <TabPanel value={activeTab} index="subjects">
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileTextIcon color="primary" /> Subjects ({subjects.length})
                  </Typography>
                  <Button variant="contained" startIcon={<PlusIcon />} onClick={() => setIsSubjectDialogOpen(true)} size="small">
                    Add Subject
                  </Button>
                </Box>

                <Dialog open={isSubjectDialogOpen} onClose={() => setIsSubjectDialogOpen(false)} maxWidth="sm" fullWidth>
                  <DialogTitle sx={{ fontWeight: 700 }}>Add Subject</DialogTitle>
                  <DialogContent sx={{ pt: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                          <FormControl fullWidth>
                              <InputLabel>Department</InputLabel>
                              <Select value={newSubDept} label="Department" onChange={(e) => setNewSubDept(e.target.value)}>
                                  {departments.map(d => <MenuItem key={d.id} value={d.value}>{d.label}</MenuItem>)}
                              </Select>
                          </FormControl>
                          <Grid container spacing={2}>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>Year</InputLabel>
                                      <Select value={newSubYear} label="Year" onChange={(e) => setNewSubYear(e.target.value)}>
                                          {years.map(y => <MenuItem key={y.id} value={y.value}>{y.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>Semester</InputLabel>
                                      <Select value={newSubSem} label="Semester" onChange={(e) => setNewSubSem(e.target.value)}>
                                          {semesters.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                          </Grid>
                          <TextField label="Subject Label" value={newSubLabel} onChange={(e) => setNewSubLabel(e.target.value)} placeholder="e.g. Machine Learning III" fullWidth />
                          <TextField label="Subject Value" value={newSubValue} onChange={(e) => setNewSubValue(e.target.value)} placeholder="e.g. ML3" fullWidth />
                      </Box>
                  </DialogContent>
                  <DialogActions sx={{ p: 3 }}>
                      <Button onClick={() => setIsSubjectDialogOpen(false)} disabled={isAddingSubject}>Cancel</Button>
                      <Button onClick={handleAddSubject} disabled={isAddingSubject || !newSubDept || !newSubYear || !newSubSem || !newSubLabel.trim() || !newSubValue.trim()} variant="contained" startIcon={isAddingSubject ? <CircularProgress size={20} /> : <PlusIcon />}>
                          Add Subject
                      </Button>
                  </DialogActions>
                </Dialog>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Department</InputLabel>
                        <Select value={subFilterDept} label="Department" onChange={(e) => setSubFilterDept(e.target.value)}>
                            <MenuItem value="ALL">All Departments</MenuItem>
                            {departments.map(d => <MenuItem key={d.id} value={d.value}>{d.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Year</InputLabel>
                        <Select value={subFilterYear} label="Year" onChange={(e) => setSubFilterYear(e.target.value)}>
                            <MenuItem value="ALL">All Years</MenuItem>
                            {years.map(y => <MenuItem key={y.id} value={y.value}>{y.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Semester</InputLabel>
                        <Select value={subFilterSem} label="Semester" onChange={(e) => setSubFilterSem(e.target.value)}>
                            <MenuItem value="ALL">All Sems</MenuItem>
                            {semesters.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                {loadingSubjects ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                ) : subjects.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No subjects found</Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'background.default' }}>
                          <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Year</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Sem</TableCell>
                          <TableCell sx={{ fontWeight: 700, width: 80, align: 'center' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subjects.map((s) => (
                          <TableRow key={s.id} hover>
                            <TableCell sx={{ fontWeight: 500 }}>{s.label}</TableCell>
                            <TableCell><Chip size="small" label={s.department_value} color="primary" variant="outlined" /></TableCell>
                            <TableCell><Chip size="small" label={`Year ${s.year_value}`} color="info" variant="outlined" /></TableCell>
                            <TableCell><Chip size="small" label={`Sem ${s.semester_value}`} color="success" variant="outlined" /></TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (!confirm('Delete this subject?')) return;
                                  await itAdminAPI.deleteSubject(s.id);
                                  toast({ title: 'Deleted', description: 'Subject deleted' });
                                  fetchSubjects();
                                }}
                              >
                                <Trash2Icon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index="students">
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GraduationCapIcon color="primary" /> Registered Students ({filteredStudents.length}{students.length !== filteredStudents.length ? ` of ${students.length}` : ''})
                  </Typography>
                  <Button variant="contained" color="secondary" onClick={() => setIsPromoteDialogOpen(true)}>
                    Promote Students
                  </Button>
                </Box>


                <Dialog open={isPromoteDialogOpen} onClose={() => setIsPromoteDialogOpen(false)} maxWidth="sm" fullWidth>
                  <DialogTitle sx={{ fontWeight: 700 }}>Promote Students (Upgrade Semester)</DialogTitle>
                  <DialogContent sx={{ pt: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                          <FormControl fullWidth>
                              <InputLabel>Department</InputLabel>
                              <Select value={promoteDept} label="Department" onChange={(e) => setPromoteDept(e.target.value)}>
                                  <MenuItem value="ALL">All Departments</MenuItem>
                                  {departments.map(d => <MenuItem key={d.id} value={d.value}>{d.label}</MenuItem>)}
                              </Select>
                          </FormControl>
                          
                          <Typography variant="subtitle2" color="text.secondary">From (Current Status):</Typography>
                          <Grid container spacing={2}>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>Current Year</InputLabel>
                                      <Select value={promoteFromYear} label="Current Year" onChange={(e) => setPromoteFromYear(e.target.value)}>
                                          {years.map(y => <MenuItem key={y.id} value={y.value}>{y.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>Current Semester</InputLabel>
                                      <Select value={promoteFromSem} label="Current Semester" onChange={(e) => setPromoteFromSem(e.target.value)}>
                                          {semesters.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                          </Grid>

                          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>To (New Status):</Typography>
                          <Grid container spacing={2}>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>New Year</InputLabel>
                                      <Select value={promoteToYear} label="New Year" onChange={(e) => setPromoteToYear(e.target.value)}>
                                          {years.map(y => <MenuItem key={y.id} value={y.value}>{y.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                              <Grid item xs={6}>
                                  <FormControl fullWidth>
                                      <InputLabel>New Semester</InputLabel>
                                      <Select value={promoteToSem} label="New Semester" onChange={(e) => setPromoteToSem(e.target.value)}>
                                          {semesters.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                          </Grid>
                      </Box>
                  </DialogContent>
                  <DialogActions sx={{ p: 3 }}>
                      <Button onClick={() => setIsPromoteDialogOpen(false)} disabled={isPromoting}>Cancel</Button>
                      <Button onClick={handlePromoteStudents} disabled={isPromoting || !promoteFromYear || !promoteFromSem || !promoteToYear || !promoteToSem} variant="contained" color="secondary" startIcon={isPromoting ? <CircularProgress size={20} /> : <GraduationCapIcon />}>
                          Promote
                      </Button>
                  </DialogActions>
                </Dialog>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
                        <InputLabel>Department</InputLabel>
                        <Select value={stuFilterDept} label="Department" onChange={(e) => setStuFilterDept(e.target.value)}>
                            <MenuItem value="ALL">All Departments</MenuItem>
                            {departments.map(d => <MenuItem key={d.id} value={d.value}>{d.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120, flexGrow: 1 }}>
                        <InputLabel>Year</InputLabel>
                        <Select value={stuFilterYear} label="Year" onChange={(e) => setStuFilterYear(e.target.value)}>
                            <MenuItem value="ALL">All Years</MenuItem>
                            {years.map(y => <MenuItem key={y.id} value={y.value}>{y.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120, flexGrow: 1 }}>
                        <InputLabel>Semester</InputLabel>
                        <Select value={stuFilterSem} label="Semester" onChange={(e) => setStuFilterSem(e.target.value)}>
                            <MenuItem value="ALL">All Sems</MenuItem>
                            {semesters.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120, flexGrow: 1 }}>
                        <InputLabel>Section</InputLabel>
                        <Select value={stuFilterSection} label="Section" onChange={(e) => setStuFilterSection(e.target.value)}>
                            <MenuItem value="ALL">All Sections</MenuItem>
                            {sections.map(s => <MenuItem key={s.id} value={s.value}>{s.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Search Roll Number"
                      placeholder="e.g. 22BD1A0001"
                      value={stuSearchRoll}
                      onChange={(e) => setStuSearchRoll(e.target.value)}
                      sx={{ minWidth: 220, flexGrow: 1 }}
                    />
                </Box>


                {loadingStudents ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                ) : filteredStudents.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    {stuSearchRoll.trim() ? 'No students match the roll number search' : 'No students found'}
                  </Typography>
                ) : (

                  <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'background.default' }}>
                          <TableCell sx={{ fontWeight: 700 }}>Roll Number</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Password</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Year</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Sem</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                          <TableCell sx={{ fontWeight: 700, width: 80, align: 'center' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedStudents.map((s: any) => (
                          <TableRow key={s.id} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.roll_number}</TableCell>
                            <TableCell>{s.full_name}</TableCell>
                            <TableCell><Chip size="small" label={s.plain_password || '—'} variant="outlined" /></TableCell>
                            <TableCell><Chip size="small" label={s.department} /></TableCell>
                            <TableCell>{s.year}</TableCell>
                            <TableCell>{s.semester}</TableCell>
                            <TableCell>{s.section}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (!confirm('Delete this student?')) return;
                                  await itAdminAPI.deleteStudent(s.id);
                                  toast({ title: 'Deleted', description: 'Student deleted' });
                                  fetchStudents();
                                }}
                              >
                                <Trash2Icon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {stuTotalPages > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                          <Pagination 
                              count={stuTotalPages} 
                              page={stuPage} 
                              onChange={(_, p) => setStuPage(p)} 
                              color="primary" 
                          />
                      </Box>
                  )}
                  </>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index="customization">
              <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon color="primary" /> Branding & Layout Customization
                </Typography>

                <Grid container spacing={4}>
                  {/* --- Login Page Customization --- */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'primary.main' }}>
                        Login Page Branding
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Login Page Title"
                            fullWidth
                            value={brandingForm.login_header_title || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, login_header_title: e.target.value }))}
                            placeholder="e.g. HARI Portal"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Login Page Subtitle"
                            fullWidth
                            value={brandingForm.login_header_subtitle || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, login_header_subtitle: e.target.value }))}
                            placeholder="e.g. EXAMINATION SYSTEM"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Login Page Footer Text"
                            fullWidth
                            multiline
                            rows={2}
                            value={brandingForm.login_footer_text || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, login_footer_text: e.target.value }))}
                            placeholder="e.g. © 2026 G. Narayanamma Institute of Technology & Science"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                            Login Logo
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {brandingForm.login_logo ? (
                              <Box sx={{ width: 64, height: 64, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', p: 0.5, bgcolor: '#fff' }}>
                                <img src={brandingForm.login_logo} alt="Login Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </Box>
                            ) : (
                              <Box sx={{ width: 64, height: 64, border: '1px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                <Typography variant="caption" color="text.secondary">Default</Typography>
                              </Box>
                            )}
                            <Stack spacing={1}>
                              <Button variant="outlined" component="label" size="small">
                                Upload Logo
                                <input type="file" accept="image/*" hidden onChange={(e) => handleLogoChange('login_logo', e.target.files?.[0] || null)} />
                              </Button>
                              {brandingForm.login_logo && (
                                <Button color="error" variant="text" size="small" onClick={() => setBrandingForm((prev: any) => ({ ...prev, login_logo: '' }))}>
                                  Reset to Default
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>

                  {/* --- Admin Portal Customization --- */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'primary.main' }}>
                        Admin Portal Branding
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            label="Admin Portal Header Title"
                            fullWidth
                            value={brandingForm.admin_header_title || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, admin_header_title: e.target.value }))}
                            placeholder="e.g. Welcome To HARI Examination Admin Portal"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Admin Portal Footer Text"
                            fullWidth
                            multiline
                            rows={2}
                            value={brandingForm.admin_footer_text || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, admin_footer_text: e.target.value }))}
                            placeholder="e.g. G. Narayanamma Institute of Technology & Science - Admin Portal"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                            Admin Portal Logo
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {brandingForm.admin_logo ? (
                              <Box sx={{ width: 64, height: 64, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', p: 0.5, bgcolor: '#fff' }}>
                                <img src={brandingForm.admin_logo} alt="Admin Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </Box>
                            ) : (
                              <Box sx={{ width: 64, height: 64, border: '1px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                <Typography variant="caption" color="text.secondary">Default</Typography>
                              </Box>
                            )}
                            <Stack spacing={1}>
                              <Button variant="outlined" component="label" size="small">
                                Upload Logo
                                <input type="file" accept="image/*" hidden onChange={(e) => handleLogoChange('admin_logo', e.target.files?.[0] || null)} />
                              </Button>
                              {brandingForm.admin_logo && (
                                <Button color="error" variant="text" size="small" onClick={() => setBrandingForm((prev: any) => ({ ...prev, admin_logo: '' }))}>
                                  Reset to Default
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>

                  {/* --- Student Portal Customization --- */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'primary.main' }}>
                        Student Portal Branding
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <TextField
                            label="Student Portal Header Title"
                            fullWidth
                            value={brandingForm.student_header_title || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, student_header_title: e.target.value }))}
                            placeholder="e.g. Welcome To HARI Examination Student Portal"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Student Portal Footer Text"
                            fullWidth
                            multiline
                            rows={2}
                            value={brandingForm.student_footer_text || ''}
                            onChange={(e) => setBrandingForm((prev: any) => ({ ...prev, student_footer_text: e.target.value }))}
                            placeholder="e.g. G. Narayanamma Institute of Technology & Science - Student Portal"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                            Student Portal Logo
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {brandingForm.student_logo ? (
                              <Box sx={{ width: 64, height: 64, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', p: 0.5, bgcolor: '#fff' }}>
                                <img src={brandingForm.student_logo} alt="Student Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </Box>
                            ) : (
                              <Box sx={{ width: 64, height: 64, border: '1px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                <Typography variant="caption" color="text.secondary">Default</Typography>
                              </Box>
                            )}
                            <Stack spacing={1}>
                              <Button variant="outlined" component="label" size="small">
                                Upload Logo
                                <input type="file" accept="image/*" hidden onChange={(e) => handleLogoChange('student_logo', e.target.files?.[0] || null)} />
                              </Button>
                              {brandingForm.student_logo && (
                                <Button color="error" variant="text" size="small" onClick={() => setBrandingForm((prev: any) => ({ ...prev, student_logo: '' }))}>
                                  Reset to Default
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>

                  {/* --- Save Button --- */}
                  <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setBrandingForm(settings)}
                      disabled={isSavingSettings}
                    >
                      Cancel Changes
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      startIcon={isSavingSettings ? <CircularProgress size={20} /> : <SettingsIcon />}
                    >
                      Save Branding Settings
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>
          </CardContent>
        </Card>
      </Box>
    </ITAdminLayout>
  );
}
