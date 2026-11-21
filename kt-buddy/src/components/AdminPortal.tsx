import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Building2,
  CalendarClock,
  CheckSquare,
  FileSpreadsheet,
  FolderUp,
  LayoutDashboard,
  Megaphone,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { NotificationItem, User } from '../types/ktbuddy';
import { AppShell, type NavItem } from './AppShell';
import { AdminDashboardView, type AdminOverviewPayload, AdminReportsView } from './admin/AdminOverviewReports';
import { AdminDepartmentsView, AdminStudentsView, AdminSubjectsView } from './admin/AdminDirectoryManager';
import { AdminKtVerificationView, AdminResultImportView } from './admin/AdminResultImportManager';
import {
  AdminAnnouncementsView,
  AdminExamsManagerView,
  AdminMaterialsManagerView,
  AdminSyllabusManagerView,
} from './admin/AdminAcademicsManager';

interface AdminPortalProps {
  user: User;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
}

export function AdminPortal({
  user,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onLogout,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);

  const loadOverview = async () => {
    try {
      const res = await apiFetch<AdminOverviewPayload>('/api/admin/overview');
      setOverview(res);
    } catch {
      // handled gracefully
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Admin Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'students', label: 'Student Management', icon: <Users className="w-4 h-4" /> },
    { id: 'departments', label: 'Department Management', icon: <Building2 className="w-4 h-4" /> },
    { id: 'subjects', label: 'Subject Management', icon: <BookMarked className="w-4 h-4" /> },
    { id: 'result-import', label: 'Result Import', icon: <FileSpreadsheet className="w-4 h-4" /> },
    {
      id: 'verification',
      label: 'KT Verification',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: overview?.metrics.pendingVerificationCount,
    },
    { id: 'syllabus', label: 'Syllabus Management', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'materials', label: 'Study Materials & PYQs', icon: <FolderUp className="w-4 h-4" /> },
    { id: 'exams', label: 'Exam Management', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <AppShell
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
      onLogout={onLogout}
    >
      {activeTab === 'dashboard' && (
        !overview ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
            Loading Exam Cell statistics...
          </div>
        ) : (
          <AdminDashboardView data={overview} onNavigate={setActiveTab} />
        )
      )}

      {activeTab === 'students' && <AdminStudentsView onRefreshOverview={loadOverview} />}
      {activeTab === 'departments' && <AdminDepartmentsView />}
      {activeTab === 'subjects' && <AdminSubjectsView />}
      {activeTab === 'result-import' && <AdminResultImportView onRefreshOverview={loadOverview} />}
      {activeTab === 'verification' && <AdminKtVerificationView onRefreshOverview={loadOverview} />}
      {activeTab === 'syllabus' && <AdminSyllabusManagerView />}
      {activeTab === 'materials' && <AdminMaterialsManagerView />}
      {activeTab === 'exams' && <AdminExamsManagerView />}
      {activeTab === 'announcements' && <AdminAnnouncementsView />}
      {activeTab === 'reports' && overview && <AdminReportsView data={overview} />}
    </AppShell>
  );
}
