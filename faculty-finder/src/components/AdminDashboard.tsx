import { useCallback, useEffect, useState } from 'react';
import { Building2, LayoutDashboard, Plus, ShieldCheck, Users } from 'lucide-react';
import { apiFetch, connectCollegeSocket } from '../lib/api';
import type { BuildingItem, NotificationItem, User } from '../types/campusmitra';
import { AppShell, type NavItem } from './AppShell';

interface AdminDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

export function AdminDashboard({ user, token, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Add Faculty form
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPassword, setFPassword] = useState('Campus@2026');
  const [fDeptId, setFDeptId] = useState<number>(0);
  const [fDesig, setFDesig] = useState('Assistant Professor');
  const [fSubjects, setFSubjects] = useState('');
  const [fCabin, setFCabin] = useState('');
  const [fBuildingId, setFBuildingId] = useState<number>(0);

  // Add Building form
  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bFloors, setBFloors] = useState(3);
  const [bLat, setBLat] = useState('19.0762');
  const [bLng, setBLng] = useState('72.8780');

  const loadData = useCallback(async () => {
    try {
      const [ov, notif] = await Promise.all([
        apiFetch<any>('/api/admin/overview'),
        apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/auth/notifications'),
      ]);
      setData(ov);
      setNotifications(notif.notifications);
      setUnreadCount(notif.unreadCount);
      if (ov.departments?.length > 0 && !fDeptId) setFDeptId(ov.departments[0].id);
      if (ov.buildings?.length > 0 && !fBuildingId) setFBuildingId(ov.buildings[0].id);
    } catch {
      // background refresh
    }
  }, [fDeptId, fBuildingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = connectCollegeSocket(token);
    socket.on('faculty:updated', loadData);
    socket.on('queue:updated', loadData);
    socket.on('appointments:updated', loadData);
    return () => {
      socket.disconnect();
    };
  }, [token, loadData]);

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await apiFetch('/api/admin/faculty', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fName,
          identifier: fId,
          email: fEmail,
          password: fPassword,
          departmentId: fDeptId,
          designation: fDesig,
          subjects: fSubjects,
          cabinNumber: fCabin,
          buildingId: fBuildingId,
        }),
      });
      setMsg(`Faculty member ${fName} added to ${user.college_code}.`);
      setFName('');
      setFId('');
      setFEmail('');
      setFSubjects('');
      setFCabin('');
      await loadData();
    } catch (error: any) {
      setErr(error.message);
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await apiFetch('/api/admin/buildings', {
        method: 'POST',
        body: JSON.stringify({
          name: bName,
          code: bCode,
          floors: bFloors,
          latitude: Number(bLat),
          longitude: Number(bLng),
        }),
      });
      setMsg(`Campus building ${bName} added.`);
      setBName('');
      setBCode('');
      await loadData();
    } catch (error: any) {
      setErr(error.message);
    }
  };

  const navItems: NavItem[] = [
    { id: 'overview', label: 'College Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'directory', label: 'Faculty & Students', icon: <Users className="w-4 h-4" /> },
    { id: 'buildings', label: 'Campus Buildings', icon: <Building2 className="w-4 h-4" /> },
    { id: 'logs', label: 'Audit Logs', icon: <ShieldCheck className="w-4 h-4" /> },
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
      {err && <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{err}</div>}
      {msg && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}

      {activeTab === 'overview' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Faculty Members</div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">{data.metrics.totalFaculty}</div>
              <div className="text-xs text-emerald-700 mt-1 tabular-nums">{data.metrics.availableNow} Available Now</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Registered Students</div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">{data.metrics.totalStudents}</div>
              <div className="text-xs text-slate-500 mt-1">Isolated to {user.college_code}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Active Queue Tokens</div>
              <div className="font-display text-2xl font-bold text-blue-700 mt-1 tabular-nums">{data.metrics.activeQueues}</div>
              <div className="text-xs text-slate-500 mt-1">Across all cabins</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Pending Appointments</div>
              <div className="font-display text-2xl font-bold text-amber-700 mt-1 tabular-nums">{data.metrics.pendingAppointments}</div>
              <div className="text-xs text-slate-500 mt-1">{data.metrics.totalBuildings} campus buildings</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">Live Faculty Availability Monitor</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">Faculty</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Cabin</th>
                    <th className="py-2 pr-4">Effective Status</th>
                    <th className="py-2">Queue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.faculty.map((f: any) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">{f.full_name}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{f.department_name}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{f.cabin_number} · {f.building_name}</td>
                      <td className="py-2.5 pr-4 font-semibold text-blue-700">{f.effective_status}</td>
                      <td className="py-2.5 font-mono">{f.queue_open ? 'OPEN' : 'CLOSED'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'directory' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateFaculty} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
            <h2 className="font-display text-base font-bold text-slate-900">Add Faculty Member</h2>
            <input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Full Name (e.g. Dr. Meera Nair)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={fId}
                onChange={(e) => setFId(e.target.value)}
                placeholder="Faculty ID (FAC105)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
                required
              />
              <input
                type="email"
                value={fEmail}
                onChange={(e) => setFEmail(e.target.value)}
                placeholder="Email"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={fDeptId}
                onChange={(e) => setFDeptId(Number(e.target.value))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {data.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select
                value={fBuildingId}
                onChange={(e) => setFBuildingId(Number(e.target.value))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {data.buildings.map((b: BuildingItem) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={fDesig}
                onChange={(e) => setFDesig(e.target.value)}
                placeholder="Designation"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={fCabin}
                onChange={(e) => setFCabin(e.target.value)}
                placeholder="Cabin (C-208)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={fSubjects}
              onChange={(e) => setFSubjects(e.target.value)}
              placeholder="Subjects taught (comma separated)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <input
              type="password"
              value={fPassword}
              onChange={(e) => setFPassword(e.target.value)}
              placeholder="Initial password"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              required
            />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create Faculty Account
            </button>
          </form>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-900">College Faculty Directory</h3>
              <div className="divide-y divide-slate-100">
                {data.faculty.map((f: any) => (
                  <div key={f.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{f.full_name}</div>
                      <div className="text-slate-500 font-mono">
                        {f.identifier} · {f.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/users/${f.id}/toggle-active`, { method: 'PATCH' });
                        await loadData();
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        f.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {f.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-900">College Student Accounts</h3>
              <div className="divide-y divide-slate-100">
                {data.students.map((s: any) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{s.full_name}</div>
                      <div className="text-slate-500 font-mono">
                        {s.identifier} · {s.email} · Sem {s.student_semester || '-'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/users/${s.id}/toggle-active`, { method: 'PATCH' });
                        await loadData();
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'buildings' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateBuilding} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
            <h2 className="font-display text-base font-bold text-slate-900">Add Campus Building</h2>
            <input
              type="text"
              value={bName}
              onChange={(e) => setBName(e.target.value)}
              placeholder="Building Name"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                placeholder="Code (BLK-D)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
                required
              />
              <input
                type="number"
                min={1}
                value={bFloors}
                onChange={(e) => setBFloors(Number(e.target.value))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bLat}
                onChange={(e) => setBLat(e.target.value)}
                placeholder="Latitude"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
              <input
                type="text"
                value={bLng}
                onChange={(e) => setBLng(e.target.value)}
                placeholder="Longitude"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
            >
              Add Building Pin
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">Approved Campus Locations</h2>
            <div className="divide-y divide-slate-100">
              {data.buildings.map((b: BuildingItem) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      {b.name} ({b.code})
                    </div>
                    <div className="text-slate-500">
                      {b.floors} floors · {b.description}
                    </div>
                  </div>
                  <div className="font-mono text-slate-500">
                    {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && data && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">College Audit Trail</h2>
          <div className="divide-y divide-slate-100">
            {data.logs.map((l: any) => (
              <div key={l.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-mono font-bold text-blue-700 mr-2">{l.action}</span>
                  <span className="text-slate-700">{l.details}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {new Date(l.created_at + (l.created_at.includes('Z') ? '' : 'Z')).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
