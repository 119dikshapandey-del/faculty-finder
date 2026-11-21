import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Plus, Ticket, Trash2 } from 'lucide-react';
import { apiFetch, connectCollegeSocket } from '../lib/api';
import type {
  AppointmentItem,
  NotificationItem,
  QueueEntry,
  TimetableSlot,
  User,
} from '../types/campusmitra';
import { AppShell, type NavItem } from './AppShell';

interface FacultyDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

const STATUS_OPTIONS = [
  'Available',
  'In Lecture',
  'In Meeting',
  'Temporarily Away',
  'Busy',
  'On Leave',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FacultyDashboard({ user, token, onLogout }: FacultyDashboardProps) {
  const [activeTab, setActiveTab] = useState('availability');
  const [profile, setProfile] = useState<any>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [buildings, setBuildings] = useState<{ id: number; name: string; code: string }[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Availability form
  const [availabilityStatus, setAvailabilityStatus] = useState('Available');
  const [statusMessage, setStatusMessage] = useState('');
  const [approvedLocation, setApprovedLocation] = useState('');
  const [expectedReturnTime, setExpectedReturnTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [queueOpen, setQueueOpen] = useState(true);
  const [workingHours, setWorkingHours] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Timetable add form
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [subjectName, setSubjectName] = useState('');
  const [roomLabel, setRoomLabel] = useState('');

  // Appointment inline action state
  const [noteByAppt, setNoteByAppt] = useState<Record<number, string>>({});
  const [slotByAppt, setSlotByAppt] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [dash, notif] = await Promise.all([
        apiFetch<any>('/api/faculty/dashboard'),
        apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/auth/notifications'),
      ]);
      setProfile(dash.profile);
      setQueue(dash.queue);
      setAppointments(dash.appointments);
      setTimetable(dash.timetable);
      setBuildings(dash.buildings);
      setNotifications(notif.notifications);
      setUnreadCount(notif.unreadCount);

      if (dash.profile) {
        setAvailabilityStatus(dash.profile.availability_status);
        setStatusMessage(dash.profile.status_message || '');
        setApprovedLocation(dash.profile.approved_location || '');
        setExpectedReturnTime(dash.profile.expected_return_time || '');
        setQueueOpen(Boolean(dash.profile.queue_open));
        setWorkingHours(dash.profile.working_hours || '');
      }
    } catch {
      // background refresh
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = connectCollegeSocket(token);
    socket.on('queue:updated', loadData);
    socket.on('appointments:updated', loadData);
    socket.on('notification:new', loadData);
    return () => {
      socket.disconnect();
    };
  }, [token, loadData]);

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiFetch('/api/faculty/availability', {
        method: 'PUT',
        body: JSON.stringify({
          availabilityStatus,
          statusMessage,
          approvedLocation,
          expectedReturnTime,
          durationMinutes,
          queueOpen,
          workingHours,
        }),
      });
      setFeedback('Availability status updated and broadcast to students.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCallNext = async () => {
    setFeedback(null);
    const res = await apiFetch<{ called: any; message?: string }>('/api/faculty/queue/call-next', { method: 'POST' });
    setFeedback(res.called ? `Called Token #${res.called.token_number}.` : res.message || 'Queue updated.');
    await loadData();
  };

  const handleQueueEntryAction = async (id: number, action: 'completed' | 'skipped') => {
    await apiFetch(`/api/faculty/queue/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    await loadData();
  };

  const handleToggleCloseQueue = async (closeQueue: boolean, cancelWaiting: boolean) => {
    await apiFetch('/api/faculty/queue/close-clear', {
      method: 'POST',
      body: JSON.stringify({ closeQueue, cancelWaiting }),
    });
    await loadData();
  };

  const handleApptAction = async (
    id: number,
    status: 'approved' | 'rejected' | 'rescheduled' | 'completed'
  ) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/faculty/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          facultyNote: noteByAppt[id] || '',
          suggestedSlot: slotByAppt[id] || '',
        }),
      });
      setFeedback(`Appointment updated (${status}).`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiFetch('/api/faculty/timetable', {
        method: 'POST',
        body: JSON.stringify({ dayOfWeek, startTime, endTime, subjectName, roomLabel }),
      });
      setSubjectName('');
      setRoomLabel('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const navItems: NavItem[] = [
    { id: 'availability', label: 'Availability', icon: <Clock className="w-4 h-4" /> },
    { id: 'queue', label: 'Virtual Queue', icon: <Ticket className="w-4 h-4" />, badge: queue.length },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: appointments.filter((a) => a.status === 'pending').length,
    },
    { id: 'timetable', label: 'Timetable', icon: <CalendarClock className="w-4 h-4" /> },
  ];

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
      {errorMsg && <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{errorMsg}</div>}
      {feedback && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{feedback}</div>}

      {activeTab === 'availability' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveAvailability} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Availability Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manual updates take priority over timetable suggestions. Expired statuses automatically revert to &ldquo;Status Not Confirmed&rdquo;.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setAvailabilityStatus(st);
                    if (st === 'On Leave' || st === 'In Lecture' || st === 'In Meeting') {
                      setQueueOpen(false);
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    availabilityStatus === st
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Approved Campus Location</label>
                <input
                  type="text"
                  list="campus-locations"
                  value={approvedLocation}
                  onChange={(e) => setApprovedLocation(e.target.value)}
                  placeholder="Academic Block C · Cabin C-204"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <datalist id="campus-locations">
                  {buildings.map((b) => (
                    <option key={b.id} value={`${b.name} (${b.code})`} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expected Return Time (Optional)</label>
                <input
                  type="text"
                  value={expectedReturnTime}
                  onChange={(e) => setExpectedReturnTime(e.target.value)}
                  placeholder="e.g. 03:30 PM"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Short Status Message</label>
              <input
                type="text"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="Available for project synopsis review"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status Expiry Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>Full day (8 hours)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Working Hours</label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={queueOpen}
                onChange={(e) => setQueueOpen(e.target.checked)}
                className="rounded border-slate-300"
              />
              Accept students in Virtual Queue
            </label>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
            >
              Publish Availability Update
            </button>
          </form>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-900">Live Student View Preview</h3>
              {profile ? (
                <div className="space-y-2 text-xs">
                  <div className="text-base font-bold text-blue-700">{profile.effective_status}</div>
                  {profile.is_status_expired && (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
                      Your previous status expired, so students currently see &ldquo;Status Not Confirmed&rdquo;.
                    </div>
                  )}
                  <div className="text-slate-600">
                    Cabin: {profile.cabin_number} · {profile.building_name}
                  </div>
                  {profile.timetable_suggestion && (
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-700">
                      Timetable suggestion right now: {profile.timetable_suggestion}
                    </div>
                  )}
                  <div className="font-mono text-[11px] text-slate-400">
                    Last updated: {new Date(profile.last_updated_at + (profile.last_updated_at.includes('Z') ? '' : 'Z')).toLocaleString()}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Loading profile...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Virtual Queue Management</h2>
              <p className="text-xs text-slate-500">
                Queue is currently {profile?.queue_open ? 'OPEN' : 'CLOSED'} · {queue.length} active tokens
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCallNext}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
              >
                Call Next Student
              </button>
              <button
                type="button"
                onClick={() => handleToggleCloseQueue(Boolean(profile?.queue_open), false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg whitespace-nowrap"
              >
                {profile?.queue_open ? 'Close Queue' : 'Reopen Queue'}
              </button>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleToggleCloseQueue(true, true)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg whitespace-nowrap"
                >
                  Close &amp; Clear All
                </button>
              )}
            </div>
          </div>

          {queue.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No students currently waiting in your virtual queue.</p>
          ) : (
            <div className="space-y-3">
              {queue.map((q) => (
                <div key={q.id} className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">Token #{q.token_number}</span>
                      <span className="text-sm font-bold text-slate-900">{q.student_name}</span>
                      <span className="text-xs text-slate-500 font-mono">({q.student_identifier})</span>
                    </div>
                    <div className="text-xs text-slate-600">Reason: {q.reason}</div>
                    <div className="text-[11px] font-mono uppercase text-slate-500">Status: {q.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQueueEntryAction(q.id, 'completed')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      Mark Completed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQueueEntryAction(q.id, 'skipped')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Appointment Management</h2>
          {appointments.length === 0 ? (
            <p className="text-xs text-slate-500">No appointment requests yet.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="p-4 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {a.student_name} <span className="font-mono text-xs text-slate-500">({a.student_identifier})</span>
                      </div>
                      <div className="text-xs font-mono text-slate-600 mt-0.5">
                        {a.requested_date} · {a.requested_slot}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold capitalize text-blue-700">{a.status}</span>
                  </div>
                  <div className="text-xs text-slate-700">Purpose: {a.reason}</div>

                  {(a.status === 'pending' || a.status === 'approved' || a.status === 'rescheduled') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="text"
                        placeholder="Note / rejection reason"
                        value={noteByAppt[a.id] || ''}
                        onChange={(e) => setNoteByAppt((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Suggest alternate slot (e.g. 04:00 PM)"
                        value={slotByAppt[a.id] || ''}
                        onChange={(e) => setSlotByAppt((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <div className="sm:col-span-2 flex flex-wrap gap-2">
                        {a.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleApptAction(a.id, 'approved')}
                            className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg"
                          >
                            Accept
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleApptAction(a.id, 'rescheduled')}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg"
                        >
                          Suggest Another Time
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApptAction(a.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg"
                        >
                          Reject
                        </button>
                        {a.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleApptAction(a.id, 'completed')}
                            className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'timetable' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleAddTimetable} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
            <h2 className="font-display text-base font-bold text-slate-900">Add Timetable Slot</h2>
            <p className="text-xs text-slate-500">
              Timetable slots generate advisory availability hints when your manual status is not overriding.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {DAYS.map((d, idx) => (
                  <option key={d} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Data Structures"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Room / Lab</label>
              <input
                type="text"
                value={roomLabel}
                onChange={(e) => setRoomLabel(e.target.value)}
                placeholder="Hall C-102"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Class Slot
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">Weekly Class Schedule</h2>
            {timetable.length === 0 ? (
              <p className="text-xs text-slate-500">No timetable slots configured.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {timetable.map((slot) => (
                  <div key={slot.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {DAYS[slot.day_of_week]} · <span className="font-mono">{slot.start_time} - {slot.end_time}</span>
                      </div>
                      <div className="text-slate-600">
                        {slot.subject_name} · {slot.room_label}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/faculty/timetable/${slot.id}`, { method: 'DELETE' });
                        await loadData();
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      aria-label="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
