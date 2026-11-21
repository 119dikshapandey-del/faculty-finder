import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Clock,
  LayoutDashboard,
  Map as MapIcon,
  Search,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, connectCollegeSocket } from '../lib/api';
import type {
  AppointmentItem,
  BuildingItem,
  FacultyDirectoryItem,
  NotificationItem,
  QueueEntry,
  TimetableSlot,
  User,
} from '../types/campusmitra';
import { AppShell, type NavItem } from './AppShell';
import { CampusMap } from './CampusMap';

interface StudentDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

const STATUS_FILTERS = [
  'All',
  'Available',
  'In Lecture',
  'In Meeting',
  'Temporarily Away',
  'Busy',
  'On Leave',
  'Status Not Confirmed',
];

function statusStyle(status: string): string {
  switch (status) {
    case 'Available':
      return 'text-emerald-700 font-semibold';
    case 'In Lecture':
    case 'In Meeting':
      return 'text-blue-700 font-semibold';
    case 'Temporarily Away':
    case 'Busy':
      return 'text-amber-700 font-semibold';
    case 'On Leave':
      return 'text-rose-700 font-semibold';
    default:
      return 'text-slate-500 font-semibold';
  }
}

export function StudentDashboard({ user, token, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [faculty, setFaculty] = useState<FacultyDirectoryItem[]>([]);
  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [collegeCenter, setCollegeCenter] = useState<{ lat: number; lng: number }>({ lat: 19.076, lng: 72.8777 });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);

  const [selectedFaculty, setSelectedFaculty] = useState<FacultyDirectoryItem | null>(null);
  const [selectedTimetable, setSelectedTimetable] = useState<TimetableSlot[]>([]);
  const [queueReason, setQueueReason] = useState('');
  const [apptDate, setApptDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [apptSlot, setApptSlot] = useState('11:00 AM - 11:15 AM');
  const [apptReason, setApptReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [facRes, ovRes, notifRes] = await Promise.all([
        apiFetch<{ faculty: FacultyDirectoryItem[] }>('/api/student/faculty'),
        apiFetch<{
          queues: QueueEntry[];
          appointments: AppointmentItem[];
          buildings: BuildingItem[];
          college: { center_lat: number; center_lng: number } | null;
        }>('/api/student/overview'),
        apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/auth/notifications'),
      ]);
      setFaculty(facRes.faculty);
      setQueues(ovRes.queues);
      setAppointments(ovRes.appointments);
      setBuildings(ovRes.buildings);
      if (ovRes.college) {
        setCollegeCenter({ lat: ovRes.college.center_lat, lng: ovRes.college.center_lng });
      }
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
    } catch {
      // handled silently on background refresh
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = connectCollegeSocket(token);
    socket.on('faculty:updated', loadData);
    socket.on('queue:updated', loadData);
    socket.on('appointments:updated', loadData);
    socket.on('notification:new', loadData);
    return () => {
      socket.disconnect();
    };
  }, [token, loadData]);

  const openFacultyProfile = async (fac: FacultyDirectoryItem) => {
    setSelectedFaculty(fac);
    setActionError(null);
    setActionMessage(null);
    setRecentlyViewedIds((prev) => [fac.user_id, ...prev.filter((id) => id !== fac.user_id)].slice(0, 4));
    try {
      const res = await apiFetch<{ faculty: FacultyDirectoryItem; timetable: TimetableSlot[] }>(
        `/api/student/faculty/${fac.user_id}`
      );
      setSelectedFaculty(res.faculty);
      setSelectedTimetable(res.timetable);
    } catch {
      setSelectedTimetable([]);
    }
  };

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await apiFetch<{ tokenNumber: number }>('/api/student/queue/join', {
        method: 'POST',
        body: JSON.stringify({ facultyUserId: selectedFaculty.user_id, reason: queueReason }),
      });
      setActionMessage(`Joined virtual queue with Token #${res.tokenNumber}.`);
      setQueueReason('');
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiFetch('/api/student/appointments', {
        method: 'POST',
        body: JSON.stringify({
          facultyUserId: selectedFaculty.user_id,
          requestedDate: apptDate,
          requestedSlot: apptSlot,
          reason: apptReason,
        }),
      });
      setActionMessage('Appointment request submitted to faculty.');
      setApptReason('');
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCancelQueue = async (id: number) => {
    await apiFetch(`/api/student/queue/${id}/cancel`, { method: 'POST' });
    await loadData();
  };

  const handleCancelAppointment = async (id: number) => {
    await apiFetch(`/api/student/appointments/${id}/cancel`, { method: 'POST' });
    await loadData();
  };

  const filteredFaculty = faculty.filter((f) => {
    const matchesStatus = statusFilter === 'All' || f.effective_status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      f.full_name.toLowerCase().includes(q) ||
      (f.department_name || '').toLowerCase().includes(q) ||
      f.subjects.toLowerCase().includes(q) ||
      f.designation.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeQueues = queues.filter((q) => q.status === 'waiting' || q.status === 'called');
  const upcomingAppointments = appointments.filter((a) => a.status === 'pending' || a.status === 'approved' || a.status === 'rescheduled');
  const recentlyViewed = recentlyViewedIds
    .map((id) => faculty.find((f) => f.user_id === id))
    .filter((f): f is FacultyDirectoryItem => Boolean(f));

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'find', label: 'Find Faculty', icon: <Users className="w-4 h-4" /> },
    { id: 'queue', label: 'Queue & Appointments', icon: <Ticket className="w-4 h-4" />, badge: activeQueues.length },
    { id: 'map', label: 'Campus Map', icon: <MapIcon className="w-4 h-4" /> },
  ];

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <AppShell
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkRead={async (id) => {
        await apiFetch(`/api/auth/notifications/${id}/read`, { method: 'PATCH' });
        await loadData();
      }}
      onMarkAllRead={async () => {
        await apiFetch('/api/auth/notifications/read-all', { method: 'POST' });
        await loadData();
      }}
      onLogout={onLogout}
    >
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Welcome, {user.full_name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {user.identifier} · {user.department_name || 'Student'} · Semester {user.student_semester || '-'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('find')}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
              >
                Join Virtual Queue / Book
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg whitespace-nowrap"
              >
                Open Campus Map
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Faculty Available Now</div>
              <div className="font-display text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                {faculty.filter((f) => f.effective_status === 'Available').length}
              </div>
              <div className="text-xs text-slate-500 mt-1 tabular-nums">Out of {faculty.length} faculty</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Active Queue Tokens</div>
              <div className="font-display text-2xl font-bold text-blue-700 mt-1 tabular-nums">{activeQueues.length}</div>
              <div className="text-xs text-slate-500 mt-1">
                {activeQueues[0] ? `Token #${activeQueues[0].token_number} · Pos ${activeQueues[0].position}` : 'Not in any queue'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Upcoming Appointments</div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {upcomingAppointments.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Pending &amp; approved visits</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Unread Notifications</div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">{unreadCount}</div>
              <div className="text-xs text-slate-500 mt-1">Real-time campus updates</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">Faculty Availability Overview</h3>
                <button type="button" onClick={() => setActiveTab('find')} className="text-xs font-semibold text-blue-700 hover:underline">
                  View All
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {faculty.slice(0, 5).map((f) => (
                  <button
                    key={f.user_id}
                    type="button"
                    onClick={() => openFacultyProfile(f)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={f.avatar_url || '/src/assets/images/faculty_portrait_1_1795250771794.jpg'}
                        alt={f.full_name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{f.full_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {f.department_name} · {f.cabin_number} · {f.building_name}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs shrink-0 ${statusStyle(f.effective_status)}`}>{f.effective_status}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900">Upcoming Appointments</h3>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-xs text-slate-500">No upcoming appointments booked.</p>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingAppointments.slice(0, 3).map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{a.faculty_name}</span>
                          <span className="font-mono capitalize text-blue-700">{a.status}</span>
                        </div>
                        <div className="text-slate-600 font-mono">
                          {a.requested_date} · {a.suggested_slot || a.requested_slot}
                        </div>
                        <div className="text-slate-500">{a.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {recentlyViewed.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900">Recently Viewed Faculty</h3>
                  <div className="space-y-2">
                    {recentlyViewed.map((f) => (
                      <button
                        key={f.user_id}
                        type="button"
                        onClick={() => openFacultyProfile(f)}
                        className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-900 truncate">{f.full_name}</span>
                        <span className={statusStyle(f.effective_status)}>{f.effective_status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'find' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by faculty name, department, subject, or designation..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFaculty.map((f) => (
              <div key={f.user_id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={f.avatar_url || '/src/assets/images/faculty_portrait_1_1795250771794.jpg'}
                      alt={f.full_name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">{f.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {f.designation} · {f.department_name}
                      </div>
                      <div className={`text-xs mt-1 ${statusStyle(f.effective_status)}`}>{f.effective_status}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800">Subjects:</span> {f.subjects}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {f.cabin_number} · {f.building_name || 'Campus Building'}
                      </span>
                    </div>
                    {f.expected_return_time && (
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Expected return: {f.expected_return_time}</span>
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-slate-400">
                      Updated: {new Date(f.last_updated_at + (f.last_updated_at.includes('Z') ? '' : 'Z')).toLocaleString()}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openFacultyProfile(f)}
                  className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Open Profile &amp; Actions
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">My Virtual Queue Tokens</h2>
            {queues.length === 0 ? (
              <p className="text-xs text-slate-500">You have not joined any virtual queues yet.</p>
            ) : (
              <div className="space-y-3">
                {queues.map((q) => (
                  <div key={q.id} className="p-4 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">{q.faculty_name}</div>
                      <span className="font-mono text-xs font-bold text-blue-700">
                        Token #{q.token_number} · {q.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {q.cabin_number} · {q.building_name}
                    </div>
                    <div className="text-xs text-slate-600">Reason: {q.reason}</div>
                    {q.status === 'waiting' && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-semibold text-amber-700 tabular-nums">
                          Queue Position: #{q.position}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelQueue(q.id)}
                          className="text-xs font-semibold text-rose-700 hover:underline"
                        >
                          Leave Queue
                        </button>
                      </div>
                    )}
                    {q.status === 'called' && (
                      <div className="text-xs font-bold text-emerald-700 pt-1">
                        You are being called now. Proceed to {q.cabin_number}.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">My Appointments</h2>
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-500">No appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="p-4 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">{a.faculty_name}</div>
                      <span className="font-mono text-xs font-semibold capitalize text-blue-700">{a.status}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-600">
                      {a.requested_date} · {a.suggested_slot || a.requested_slot}
                    </div>
                    <div className="text-xs text-slate-600">{a.reason}</div>
                    {a.faculty_note && <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">Note: {a.faculty_note}</div>}
                    {(a.status === 'pending' || a.status === 'approved' || a.status === 'rescheduled') && (
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(a.id)}
                        className="text-xs font-semibold text-rose-700 hover:underline"
                      >
                        Cancel Appointment
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <CampusMap
          buildings={buildings}
          faculty={faculty}
          centerLat={collegeCenter.lat}
          centerLng={collegeCenter.lng}
          onSelectFaculty={(f) => openFacultyProfile(f)}
        />
      )}

      {/* Faculty Profile + Queue + Appointment Modal */}
      {selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedFaculty.avatar_url || '/src/assets/images/faculty_portrait_1_1795250771794.jpg'}
                  alt={selectedFaculty.full_name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">{selectedFaculty.full_name}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedFaculty.designation} · {selectedFaculty.department_name}
                  </p>
                  <p className={`text-xs mt-1 ${statusStyle(selectedFaculty.effective_status)}`}>
                    {selectedFaculty.effective_status}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFaculty(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div>
                <span className="font-semibold text-slate-700">Cabin &amp; Building:</span>
                <div className="text-slate-900 mt-0.5">
                  {selectedFaculty.cabin_number} · {selectedFaculty.building_name}
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Working Hours:</span>
                <div className="text-slate-900 mt-0.5">{selectedFaculty.working_hours}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Subjects Taught:</span>
                <div className="text-slate-900 mt-0.5">{selectedFaculty.subjects}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Current Location / Return:</span>
                <div className="text-slate-900 mt-0.5">
                  {selectedFaculty.approved_location || selectedFaculty.building_name}
                  {selectedFaculty.expected_return_time ? ` · Return: ${selectedFaculty.expected_return_time}` : ''}
                </div>
              </div>
            </div>

            {selectedFaculty.status_message && (
              <div className="text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                Status Note: {selectedFaculty.status_message}
              </div>
            )}

            {selectedTimetable.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-blue-700" />
                  Published Timetable (Advisory Only)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTimetable.map((slot) => (
                    <div key={slot.id} className="text-xs p-2.5 rounded border border-slate-200">
                      <span className="font-mono font-semibold text-slate-900">
                        {DAYS[slot.day_of_week]} {slot.start_time}-{slot.end_time}
                      </span>
                      <div className="text-slate-600">
                        {slot.subject_name} · {slot.room_label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionError && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{actionError}</div>}
            {actionMessage && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{actionMessage}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <form onSubmit={handleJoinQueue} className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900">
                  Join Virtual Queue ({selectedFaculty.waiting_count} waiting)
                </h3>
                <input
                  type="text"
                  value={queueReason}
                  onChange={(e) => setQueueReason(e.target.value)}
                  placeholder="Reason for visit (e.g. Project review)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  required
                />
                <button
                  type="submit"
                  disabled={!selectedFaculty.queue_open}
                  className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                >
                  {selectedFaculty.queue_open ? 'Join Virtual Queue' : 'Queue Currently Closed'}
                </button>
              </form>

              <form onSubmit={handleBookAppointment} className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900">Book Appointment</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                    required
                  />
                  <input
                    type="text"
                    value={apptSlot}
                    onChange={(e) => setApptSlot(e.target.value)}
                    placeholder="11:00 AM - 11:15 AM"
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <input
                  type="text"
                  value={apptReason}
                  onChange={(e) => setApptReason(e.target.value)}
                  placeholder="Purpose of appointment"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                >
                  Request Appointment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
