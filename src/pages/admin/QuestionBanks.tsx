import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Add as AddIcon, Search as SearchIcon, MoreVert as MoreVertIcon,
  PictureAsPdf, Download as DownloadIcon, Visibility as ViewIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { useLookupData, useLookupSubjectsForFilter } from '@/hooks/use-lookup-data';
import AdminLayout from '@/components/layouts/AdminLayout';

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
  fileData: string;
}

export default function QuestionBanks() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { departments, years, semesters } = useLookupData();

  const [searchQuery, setSearchQuery] = useState('');
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

  // Upload Form
  const [uploadDept, setUploadDept] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadSubjectsList = useLookupSubjectsForFilter(
    uploadDept || undefined,
    uploadYear || undefined,
    uploadSemester || undefined
  );

  const [pdfs, setPdfs] = useState<PDFMeta[]>([]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('question_banks_meta');
      if (stored) setPdfs(JSON.parse(stored));
    } catch (e) { }
  }, []);

  const saveToStorage = (newData: PDFMeta[]) => {
    setPdfs(newData);
    localStorage.setItem('question_banks_meta', JSON.stringify(newData));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return toast({ title: 'Invalid File', description: 'Please select a valid PDF file.', variant: 'destructive' });
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!uploadDept || !uploadSemester || !uploadSubject || !selectedFile) {
      return toast({ title: 'Missing Details', description: 'Please fill all fields and select a PDF file before uploading.', variant: 'destructive' });
    }

    toast({ title: 'Uploading PDF', description: 'Saving your question bank into the system...' });

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newPdf: PDFMeta = {
        id: Date.now(),
        name: uploadLabel.trim() || selectedFile.name.replace('.pdf', ''),
        size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        date: new Date().toLocaleDateString(),
        department: uploadDept,
        year: uploadYear,
        semester: uploadSemester,
        subject: uploadSubject,
        label: uploadLabel.trim() || '',
        fileData: base64,
      };
      saveToStorage([newPdf, ...pdfs]);
      setSelectedFile(null);
      setUploadDept('');
      setUploadYear('');
      setUploadSemester('');
      setUploadSubject('');
      setUploadLabel('');
      setOpenUploadDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'Upload Success', description: 'PDF has been successfully stored and is available for student download.' });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    const updated = pdfs.filter(p => p.id !== id);
    saveToStorage(updated);
    toast({ title: 'Deleted', description: 'Question bank removed successfully.' });
  };

  const filteredPdfs = useMemo(() => {
    return pdfs.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pdfs, searchQuery]);

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Question Banks
            </h1>
            <p className="text-[var(--text-secondary)] font-medium mt-1">
              Manage and organize question repositories
            </p>
          </div>
          <button
            onClick={() => setOpenUploadDialog(true)}
            className="btn-gradient px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2"
          >
            <AddIcon style={{ fontSize: 20 }} />
            Add Question
          </button>
        </div>

        {/* Search */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-medium)]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SearchIcon className="text-[var(--text-secondary)] text-lg" />
            </div>
            <input
              type="text"
              placeholder="Search question banks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {/* List View */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          {filteredPdfs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PictureAsPdf className="text-red-600 dark:text-red-400 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">No question banks found</h3>
              <p className="text-[var(--text-secondary)]">Try adjusting your search or add a new question bank.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filteredPdfs.map((pdf) => (
                <div key={pdf.id} className="p-6 hover:bg-[rgba(99,102,241,0.02)] transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-xl flex items-center justify-center flex-shrink-0">
                        <PictureAsPdf className="text-red-600 dark:text-red-400 text-lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                          {pdf.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm text-[var(--text-secondary)]">
                            {pdf.subject}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)]">
                            {pdf.date}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 text-xs font-medium bg-[rgba(99,102,241,0.1)] text-[var(--primary)] rounded-lg">
                            {pdf.subject}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium bg-[rgba(0,0,0,0.05)] text-[var(--text-secondary)] rounded-lg">
                            {pdf.department} • S{pdf.semester}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toast({ title: 'System Notification', description: 'Opening secure document preview.' })}
                        className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors duration-200"
                        title="View"
                      >
                        <ViewIcon className="text-[var(--text-secondary)] text-lg" />
                      </button>
                      <button
                        onClick={() => toast({ title: 'Download Stream', description: 'Initializing secure file transfer.' })}
                        className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors duration-200"
                        title="Download"
                      >
                        <DownloadIcon className="text-green-600 dark:text-green-400 text-lg" />
                      </button>
                      <button
                        onClick={() => handleDelete(pdf.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors duration-200"
                        title="Delete"
                      >
                        <DeleteIcon className="text-red-600 dark:text-red-400 text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog - Keeping original MUI dialog for now */}
      {openUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-large)] max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Upload Question Bank</h2>
              <p className="text-[var(--text-secondary)] mb-6">Deploy a new PDF asset into the repository.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Department</option>
                    {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <select
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Target Year</option>
                    {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={uploadSemester}
                    onChange={(e) => setUploadSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Target Semester</option>
                    {semesters.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Mapping Subject</option>
                    {uploadSubjectsList.length > 0
                      ? uploadSubjectsList.map(s => <option key={s.value} value={s.value}>{s.label}</option>)
                      : <option value="" disabled>No mapped subjects</option>
                    }
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Question Title (Optional)"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />

                <label className="block">
                  <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--primary)] hover:bg-[rgba(99,102,241,0.02)] transition-colors">
                    <PictureAsPdf className="text-[var(--text-secondary)] text-2xl mx-auto mb-2" />
                    <span className="text-[var(--text-secondary)]">
                      {selectedFile ? selectedFile.name : 'Select PDF Asset for Deployment'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setOpenUploadDialog(false)}
                  className="flex-1 px-4 py-2 text-[var(--text-secondary)] font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 btn-gradient px-4 py-2 text-white font-semibold rounded-lg"
                >
                  Execute Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
