import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download as DownloadIcon, Search as SearchIcon, FilterList as FilterIcon
} from '@mui/icons-material';
import AdminLayout from '@/components/layouts/AdminLayout';
import { useAdmin } from '@/context/AdminContext';
import { useLookupData } from '@/hooks/use-lookup-data';

export default function ExamAnalytics() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAdmin();
  const { departments, semesters } = useLookupData();

  const [activeTab, setActiveTab] = useState('theory');
  const [filters, setFilters] = useState({
    department: '',
    semester: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  // Mock data - replace with actual API calls
  const stats = {
    averageScore: 78.5,
    highestScore: 98,
    lowestScore: 45,
    totalAttempts: 1247
  };

  const theoryData = [
    { id: 1, student: 'John Doe', subject: 'Mathematics', score: 85, date: '2024-01-15', department: 'CSE', semester: '5' },
    { id: 2, student: 'Jane Smith', subject: 'Physics', score: 92, date: '2024-01-15', department: 'CSE', semester: '5' },
    { id: 3, student: 'Bob Johnson', subject: 'Chemistry', score: 78, date: '2024-01-14', department: 'CSE', semester: '5' },
  ];

  const codingData = [
    { id: 1, student: 'Alice Brown', problem: 'Two Sum', language: 'Python', score: 100, time: '15 mins', attempts: 1 },
    { id: 2, student: 'Charlie Wilson', problem: 'Binary Search', language: 'Java', score: 90, time: '22 mins', attempts: 2 },
    { id: 3, student: 'Diana Prince', problem: 'Sorting Array', language: 'C++', score: 85, time: '18 mins', attempts: 1 },
  ];

  const handleExportCSV = () => {
    // Mock export functionality
    console.log('Exporting CSV...');
  };

  const filteredTheoryData = theoryData.filter(item => {
    const matchesDept = !filters.department || item.department === filters.department;
    const matchesSem = !filters.semester || item.semester === filters.semester;
    return matchesDept && matchesSem;
  });

  const filteredCodingData = codingData.filter(item => {
    // Add filtering logic for coding data if needed
    return true;
  });

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Assessment Analytics
            </h1>
            <p className="text-[var(--text-secondary)] font-medium mt-1">
              Comprehensive performance insights and reports
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="bg-[var(--success)] hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105"
          >
            <DownloadIcon style={{ fontSize: 20 }} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-medium)]">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.value} value={dept.value}>{dept.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Semester
              </label>
              <select
                value={filters.semester}
                onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
              >
                <option value="">All Semesters</option>
                {semesters.map(sem => (
                  <option key={sem.value} value={sem.value}>{sem.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => setActiveTab('theory')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                activeTab === 'theory'
                  ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[rgba(99,102,241,0.05)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.02)]'
              }`}
            >
              Standard Theory Analytics
            </button>
            <button
              onClick={() => setActiveTab('coding')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                activeTab === 'coding'
                  ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[rgba(99,102,241,0.05)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,102,241,0.02)]'
              }`}
            >
              Coding Performance Logs
            </button>
          </div>

          {/* Stats Strip */}
          <div className="p-6 border-b border-[var(--border)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.averageScore}%</div>
                <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.highestScore}%</div>
                <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Highest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.lowestScore}%</div>
                <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Lowest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.totalAttempts}</div>
                <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Attempts</div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
              </div>
            ) : activeTab === 'theory' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTheoryData.map((item) => (
                      <tr key={item.id} className="table-row border-b border-[var(--border)]">
                        <td className="px-4 py-4 font-medium text-[var(--text-primary)]">{item.student}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.subject}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            item.score >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.score >= 75 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {item.score}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.date}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.department}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.semester}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Problem</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Language</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodingData.map((item) => (
                      <tr key={item.id} className="table-row border-b border-[var(--border)]">
                        <td className="px-4 py-4 font-medium text-[var(--text-primary)]">{item.student}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.problem}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.language}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            item.score >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.score >= 75 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {item.score}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.time}</td>
                        <td className="px-4 py-4 text-[var(--text-secondary)]">{item.attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
