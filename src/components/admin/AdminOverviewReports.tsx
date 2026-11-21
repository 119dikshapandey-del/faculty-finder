import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadAuthenticatedFile } from '../../lib/api';

export interface AdminOverviewPayload {
  metrics: {
    totalRegisteredStudents: number;
    totalStudentsWithKt: number;
    totalVerifiedKtSubjects: number;
    totalClearedSubjects: number;
    totalRemainingKtSubjects: number;
    pendingVerificationCount: number;
  };
  deptStats: Array<{ id: number; name: string; code: string; total_records: number; cleared_count: number; remaining_count: number }>;
  semesterStats: Array<{ semester: number; total_records: number; cleared_count: number; remaining_count: number }>;
  subjectStats: Array<{ id: number; subject_code: string; subject_name: string; semester: number; department_name: string; total_records: number; cleared_count: number; remaining_count: number }>;
  recentImports: Array<Record<string, any>>;
  recentAnnouncements: Array<Record<string, any>>;
  recentLogs: Array<Record<string, any>>;
}

export function AdminDashboardView({
  data,
  onNavigate,
}: {
  data: AdminOverviewPayload;
  onNavigate: (tab: string) => void;
}) {
  const { metrics, deptStats, semesterStats, recentImports, recentAnnouncements, recentLogs } = data;

  const semChartData = semesterStats.map((s) => ({
    name: `Sem ${s.semester}`,
    Cleared: s.cleared_count || 0,
    Remaining: s.remaining_count || 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Registered Students</div>
          <div className="font-mono text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {metrics.totalRegisteredStudents}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Students with KT</div>
          <div className="font-mono text-2xl font-bold text-rose-700 mt-1.5 tabular-nums">
            {metrics.totalStudentsWithKt}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Verified KT Records</div>
          <div className="font-mono text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {metrics.totalVerifiedKtSubjects}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Cleared Subjects</div>
          <div className="font-mono text-2xl font-bold text-emerald-700 mt-1.5 tabular-nums">
            {metrics.totalClearedSubjects}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Remaining KT</div>
          <div className="font-mono text-2xl font-bold text-blue-700 mt-1.5 tabular-nums">
            {metrics.totalRemainingKtSubjects}
          </div>
          {metrics.pendingVerificationCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('verification')}
              className="text-[11px] font-semibold text-amber-800 hover:underline mt-1 block tabular-nums"
            >
              {metrics.pendingVerificationCount} pending verification
            </button>
          )}
        </div>
      </section>

      {/* Department & Semester Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Department-Wise KT Statistics</h2>
            <p className="text-xs text-slate-500">Cleared vs remaining backlog records by department</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cleared_count" name="Cleared" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="remaining_count" name="Remaining KT" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Semester-Wise KT Statistics</h2>
            <p className="text-xs text-slate-500">Distribution of cleared and remaining subjects across semesters</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Cleared" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Remaining" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Recently Imported Results & Announcements */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">Recently Imported Results</h3>
            <button
              type="button"
              onClick={() => onNavigate('result-import')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Upload Results
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {recentImports.map((imp) => (
              <div key={imp.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{imp.file_name}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {imp.matched_rows}/{imp.total_rows} matched · {imp.confirmed_count} confirmed · By {imp.imported_by_name}
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-blue-700 shrink-0">{imp.status}</span>
              </div>
            ))}
            {recentImports.length === 0 && (
              <div className="py-6 text-center text-slate-500">No result imports recorded yet.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">Recent Announcements</h3>
            <button
              type="button"
              onClick={() => onNavigate('announcements')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{a.title}</span>
                  <span className="font-mono text-[11px] text-slate-500">{a.publish_date}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Target: {a.department_name || 'All Departments'} · {a.course_name || 'All Courses'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Activity Logs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">Recent Audit Activity Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-semibold">Timestamp</th>
                <th className="py-2 pr-4 font-semibold">Actor</th>
                <th className="py-2 pr-4 font-semibold">Action</th>
                <th className="py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 font-mono text-slate-500 tabular-nums">{log.created_at}</td>
                  <td className="py-2 pr-4 font-medium text-slate-800">{log.actor_name || 'System'}</td>
                  <td className="py-2 pr-4 font-mono text-blue-700">{log.action}</td>
                  <td className="py-2 text-slate-600">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AdminReportsView({ data }: { data: AdminOverviewPayload }) {
  const { deptStats, semesterStats, subjectStats, recentImports } = data;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Academic &amp; Backlog Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download verified department, student KT ledger, and official result import reports in Excel or CSV format.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/reports/export?type=kt-ledger&format=xlsx', 'KT_Buddy_KT_Ledger.xlsx')}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            KT Ledger (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/reports/export?type=kt-ledger&format=csv', 'KT_Buddy_KT_Ledger.csv')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            KT Ledger (.csv)
          </button>
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/reports/export?type=department&format=xlsx', 'KT_Buddy_Department_Report.xlsx')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Department Report (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/reports/export?type=imports&format=csv', 'KT_Buddy_Import_History.csv')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Import History (.csv)
          </button>
        </div>
      </div>

      {/* Subject-wise Backlog Statistics */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">Subject-Wise Backlog &amp; Clearance Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Subject Code</th>
                <th className="py-2.5 pr-4 font-semibold">Subject Name</th>
                <th className="py-2.5 pr-4 font-semibold">Department</th>
                <th className="py-2.5 pr-4 font-semibold">Semester</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Total Tracked</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Cleared</th>
                <th className="py-2.5 font-semibold text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjectStats.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-4 font-mono font-semibold text-blue-700">{s.subject_code}</td>
                  <td className="py-2.5 pr-4 font-semibold text-slate-900">{s.subject_name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{s.department_name}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">Sem {s.semester}</td>
                  <td className="py-2.5 pr-4 font-mono text-right tabular-nums">{s.total_records || 0}</td>
                  <td className="py-2.5 pr-4 font-mono text-right text-emerald-700 font-semibold tabular-nums">
                    {s.cleared_count || 0}
                  </td>
                  <td className="py-2.5 font-mono text-right text-rose-700 font-semibold tabular-nums">
                    {s.remaining_count || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department + Semester Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">Department Clearance Summary</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 font-semibold text-right">Total</th>
                <th className="py-2 pr-3 font-semibold text-right">Cleared</th>
                <th className="py-2 font-semibold text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptStats.map((d) => (
                <tr key={d.id}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">{d.name}</td>
                  <td className="py-2.5 pr-3 font-mono text-right tabular-nums">{d.total_records || 0}</td>
                  <td className="py-2.5 pr-3 font-mono text-right text-emerald-700 tabular-nums">{d.cleared_count || 0}</td>
                  <td className="py-2.5 font-mono text-right text-rose-700 tabular-nums">{d.remaining_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">Semester &amp; Import Summary</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Semester</th>
                <th className="py-2 pr-3 font-semibold text-right">Total</th>
                <th className="py-2 pr-3 font-semibold text-right">Cleared</th>
                <th className="py-2 font-semibold text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {semesterStats.map((s) => (
                <tr key={s.semester}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">Semester {s.semester}</td>
                  <td className="py-2.5 pr-3 font-mono text-right tabular-nums">{s.total_records}</td>
                  <td className="py-2.5 pr-3 font-mono text-right text-emerald-700 tabular-nums">{s.cleared_count}</td>
                  <td className="py-2.5 font-mono text-right text-rose-700 tabular-nums">{s.remaining_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pt-2 text-[11px] text-slate-500 tabular-nums">
            Total official import batches recorded: {recentImports.length}
          </div>
        </div>
      </div>
    </div>
  );
}
