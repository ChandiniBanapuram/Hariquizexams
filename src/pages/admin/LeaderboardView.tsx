import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Search as SearchIcon
} from '@mui/icons-material';

import { codingAPI } from '@/lib/api';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/layouts/AdminLayout';
import * as XLSX from 'xlsx';

export default function LeaderboardView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, isAuthenticated } = useAdmin();

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [examId, setExamId] = useState('ALL');

  useEffect(() => {
    if (!isAuthenticated) navigate('/admin');
    fetchLeaderboard();
  }, [isAuthenticated, examId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const id = examId === 'ALL' ? undefined : examId;
      const res = await codingAPI.getLeaderboard(id);
      setLeaderboard(Array.isArray(res.leaderboard) ? res.leaderboard : []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch leaderboard', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const data = leaderboard.map(r => ({
      Rank: r.rank,
      Name: r.name,
      Roll: r.roll_number,
      Department: r.department,
      'Total Score': r.total_score,
      'Problems Solved': r.problems_solved,
      'Total Time (s)': r.total_time,
      'Last Submitted': new Date(r.last_submitted).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
    XLSX.writeFile(wb, `Leaderboard_${examId}_${Date.now()}.xlsx`);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <TrophyIcon className="text-yellow-400 text-lg" />;
    if (rank === 2) return <TrophyIcon className="text-gray-400 text-base" />;
    if (rank === 3) return <TrophyIcon className="text-amber-600 text-sm" />;
    return null;
  };

  return (
    <AdminLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Coding <span className="text-cyan-400">Leaderboard</span>
            </h1>
            <p className="text-[var(--text-secondary)] font-medium mt-1">
              Real-time rankings based on total score and execution efficiency.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full font-bold text-sm transition-colors"
            >
              EXPORT (XLSX)
            </button>
            <button
              onClick={fetchLeaderboard}
              className="px-4 py-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white rounded-full font-bold text-sm transition-colors"
            >
              REFRESH
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-medium)]">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">Leaderboard Context</label>
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-full text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="ALL">Global Practice</option>
                <option value="1">Data Structures - Mid 1</option>
                <option value="2">Algorithms - Final</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-full">
              <SearchIcon className="text-cyan-500 text-sm" />
              <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                FILTERED BY: <span className="text-cyan-500">{examId === 'ALL' ? 'PRACTICE' : `EXAM ID ${examId}`}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-medium)] overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[var(--text-secondary)]">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--text-secondary)]">No leaderboard data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cyan-50 dark:bg-cyan-900/20 border-b border-[var(--border)]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Student Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Total Score</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Solved</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Total Time</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {leaderboard.map((entry) => (
                    <tr key={entry.rank} className="hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-lg text-[var(--text-primary)]">{entry.rank}</span>
                          {getRankIcon(entry.rank)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center border border-cyan-200 dark:border-cyan-800">
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                              {entry.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text-primary)] text-sm">{entry.name}</div>
                            <div className="text-xs text-[var(--text-secondary)] font-mono font-bold">{entry.roll_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{entry.department}</td>
                      <td className="px-6 py-4">
                        <span className="font-black text-cyan-500 text-lg">{entry.total_score}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{entry.problems_solved}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">
                        {parseFloat(entry.total_time || 0).toFixed(2)}s
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                        {new Date(entry.last_submitted).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
