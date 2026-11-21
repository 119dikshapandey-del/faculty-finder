import { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  FileArchive,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  UserCircle2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { NotificationItem, User } from '../types/ktbuddy';
import { AppShell, type NavItem } from './AppShell';
import { StudentDashboardView, type StudentDashboardPayload, StudentProfileView } from './student/StudentDashboardHome';
import { StudentKtSubjectsView, StudentMyResultsView } from './student/StudentKtAndResults';
import {
  StudentMaterialsView,
  StudentNotificationsView,
  StudentSyllabusView,
  StudentTimetableView,
} from './student/StudentResourcesAndExams';

interface StudentPortalProps {
  user: User;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
}

export function StudentPortal({
  user,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onLogout,
}: StudentPortalProps) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [dashboardData, setDashboardData] = useState<StudentDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedSubjectId, setFocusedSubjectId] = useState<number | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await apiFetch<StudentDashboardPayload>('/api/student/dashboard');
      setDashboardData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Student Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'profile', label: 'My Profile', icon: <UserCircle2 className="w-4 h-4" /> },
    {
      id: 'kt-subjects',
      label: 'My KT Subjects',
      icon: <ListChecks className="w-4 h-4" />,
      badge: dashboardData?.stats.remainingSubjects,
    },
    { id: 'results', label: 'My Results', icon: <Award className="w-4 h-4" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'resources', label: 'Study Resources', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'pyqs', label: 'Previous Year Papers', icon: <FileArchive className="w-4 h-4" /> },
    { id: 'timetable', label: 'Exam Timetable', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadCount },
  ];

  const handleOpenSubjectResource = (tab: 'syllabus' | 'resources' | 'pyqs' | 'timetable', subjectId: number) => {
    setFocusedSubjectId(subjectId);
    setActiveTab(tab);
  };

  return (
    <AppShell
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setFocusedSubjectId(null);
        setActiveTab(tab);
      }}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
      onLogout={onLogout}
    >
      {activeTab === 'dashboard' && (
        loading || !dashboardData ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
            Loading your personalized KT Buddy dashboard...
          </div>
        ) : (
          <StudentDashboardView data={dashboardData} onNavigate={(t) => setActiveTab(t)} />
        )
      )}

      {activeTab === 'profile' && (
        <StudentProfileView
          profile={
            dashboardData?.profile || {
              full_name: user.full_name,
              roll_number: user.roll_number || user.identifier,
              email: user.email,
              college_name: user.college_name,
              department_name: user.department_name,
              course_name: user.course_name,
              year_of_study: user.year_of_study || 1,
              semester: user.semester || 1,
            }
          }
        />
      )}

      {activeTab === 'kt-subjects' && (
        <StudentKtSubjectsView onOpenSubjectResource={handleOpenSubjectResource} />
      )}

      {activeTab === 'results' && <StudentMyResultsView onRefreshDashboard={loadDashboard} />}

      {activeTab === 'syllabus' && <StudentSyllabusView initialSubjectId={focusedSubjectId} />}

      {activeTab === 'resources' && <StudentMaterialsView mode="all" initialSubjectId={focusedSubjectId} />}

      {activeTab === 'pyqs' && <StudentMaterialsView mode="pyqs" initialSubjectId={focusedSubjectId} />}

      {activeTab === 'timetable' && <StudentTimetableView />}

      {activeTab === 'notifications' && (
        <StudentNotificationsView
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
        />
      )}
    </AppShell>
  );
}
