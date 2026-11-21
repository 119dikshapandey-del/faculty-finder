import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Megaphone,
  Shield,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { downloadAuthenticatedFile } from '../../lib/api';
import type {
  AnnouncementItem,
  ExamScheduleItem,
  ResultRecordItem,
  StudentKtItem,
  StudyMaterialItem,
} from '../../types/ktbuddy';
import { ClearanceStatusLabel } from '../StatusLabel';

export interface StudentDashboardPayload {
  profile: Record<string, any>;
  stats: {
    totalKtSubjects: number;
    clearedSubjects: number;
    remainingSubjects: number;
    confirmedActiveKt: number;
    upcomingExamsCount: number;
    clearanceProgressPercent: number;
  };
  ktSubjects: StudentKtItem[];
  upcomingExams: ExamScheduleItem[];
  announcements: AnnouncementItem[];
  recentMaterials: StudyMaterialItem[];
  latestResults: ResultRecordItem[];
}

export function StudentDashboardView({
  data,
  onNavigate,
}: {
  data: StudentDashboardPayload;
  onNavigate: (tab: string) => void;
}) {
  const { profile, stats, ktSubjects, upcomingExams, announcements, recentMaterials, latestResults } = data;

  const chartData = [
    { name: 'Cleared', value: stats.clearedSubjects, color: '#16a34a' },
    { name: 'Remaining / Pending', value: stats.remainingSubjects, color: '#1d4ed8' },
  ];

  const handleDownloadMaterial = async (m: StudyMaterialItem) => {
    try {
      await downloadAuthenticatedFile(`/api/resources/materials/${m.id}/download`, m.file_name || `${m.subject_code}.pdf`);
    } catch {
      // ignore if external url
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-blue-700">Student Academic Workspace</p>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Welcome back, {profile.full_name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
            <span className="font-mono font-semibold text-slate-800">{profile.roll_number}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.department_name}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.course_name}</span>
            <span aria-hidden="true">·</span>
            <span>Semester {profile.semester}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('kt-subjects')}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <span>View My KT Subjects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('timetable')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Exam Timetable
          </button>
        </div>
      </section>

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total KT Subjects</div>
          <div className="font-mono text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {stats.totalKtSubjects}
          </div>
          <div className="text-xs text-slate-500 mt-1">Tracked across all semesters</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Cleared Subjects</div>
          <div className="font-mono text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
            {stats.clearedSubjects}
          </div>
          <div className="text-xs text-slate-500 mt-1">Verified passed &amp; cleared</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Remaining Subjects</div>
          <div className="font-mono text-3xl font-bold text-rose-700 mt-2 tabular-nums">
            {stats.remainingSubjects}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {stats.confirmedActiveKt} confirmed KT active
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Upcoming Examinations</div>
          <div className="font-mono text-3xl font-bold text-blue-700 mt-2 tabular-nums">
            {stats.upcomingExamsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Scheduled supplementary dates</div>
        </div>
      </section>

      {/* Progress Chart + Upcoming Exams */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">KT Clearance Progress</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated directly from your verified academic records.
            </p>
          </div>

          <div className="h-52 w-full my-4 flex items-center justify-center relative">
            {stats.totalKtSubjects === 0 ? (
              <div className="text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900">No KT Backlogs Recorded</div>
                <div className="text-xs text-slate-500">100% clear academic standing</div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {stats.clearanceProgressPercent}%
                  </span>
                  <span className="text-[11px] text-slate-500">Cleared</span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Cleared</span>
              <span className="font-mono font-bold text-emerald-700 tabular-nums">{stats.clearedSubjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Remaining</span>
              <span className="font-mono font-bold text-blue-700 tabular-nums">{stats.remainingSubjects}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Upcoming KT Examination Dates</h3>
              <p className="text-xs text-slate-500 mt-0.5">Personal backlog schedules and course exam updates</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('timetable')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
            >
              Full Timetable
            </button>
          </div>

          {upcomingExams.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">No upcoming examination schedules published.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingExams.slice(0, 4).map((ex) => (
                <div key={ex.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-700">{ex.subject_code}</span>
                      <span className="text-sm font-semibold text-slate-900 truncate">{ex.subject_name}</span>
                      {ex.is_personal_kt === 1 && (
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                          Your KT
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Semester {ex.semester} · {ex.venue || 'Venue TBA'}
                    </div>
                    {ex.is_changed === 1 && ex.change_note && (
                      <div className="text-xs text-amber-800 mt-1">{ex.change_note}</div>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-slate-900 tabular-nums">{ex.exam_date}</div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {ex.start_time} – {ex.end_time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tracked KT Summary + Announcements + Recent Materials + Latest Result Updates */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">Important Announcements</h3>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          {announcements.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">No active announcements for your semester.</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-blue-700 inline-flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      {a.category}
                    </span>
                    <span className="font-mono tabular-nums">{a.publish_date}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{a.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">Recently Uploaded Study Materials</h3>
            <button
              type="button"
              onClick={() => onNavigate('resources')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Browse All
            </button>
          </div>
          {recentMaterials.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">No study materials uploaded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentMaterials.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{m.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.subject_code} · {m.resource_type} · AY {m.academic_year}
                    </div>
                  </div>
                  {m.file_name ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadMaterial(m)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md inline-flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  ) : m.external_url ? (
                    <a
                      href={m.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md shrink-0"
                    >
                      Open Link
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest Result Updates */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Latest Official Result Updates</h3>
            <p className="text-xs text-slate-500">Recent status updates and verified subject transitions</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('results')}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Go to My Results
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Subject</th>
                <th className="py-2.5 pr-4 font-semibold">Semester</th>
                <th className="py-2.5 pr-4 font-semibold">Attempt</th>
                <th className="py-2.5 pr-4 font-semibold">Previous</th>
                <th className="py-2.5 pr-4 font-semibold">Latest Status</th>
                <th className="py-2.5 font-semibold">Declaration Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ktSubjects.slice(0, 6).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {item.subject_name}{' '}
                    <span className="font-mono font-normal text-slate-500">({item.subject_code})</span>
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums">Sem {item.semester}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">Attempt {item.attempt_number}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.previous_status || 'Initial'}</td>
                  <td className="py-3 pr-4">
                    <ClearanceStatusLabel status={item.clearance_status} />
                  </td>
                  <td className="py-3 font-mono text-slate-600 tabular-nums">
                    {item.result_declaration_date || 'Pending'}
                  </td>
                </tr>
              ))}
              {ktSubjects.length === 0 && latestResults.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No official result updates available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function StudentProfileView({ profile }: { profile: Record<string, any> }) {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">{profile.full_name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{profile.roll_number} · {profile.email}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            Active Student
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <dt className="text-xs text-slate-500">College</dt>
            <dd className="font-semibold text-slate-900 mt-0.5">{profile.college_name}</dd>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <dt className="text-xs text-slate-500">Department</dt>
            <dd className="font-semibold text-slate-900 mt-0.5">{profile.department_name}</dd>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <dt className="text-xs text-slate-500">Course</dt>
            <dd className="font-semibold text-slate-900 mt-0.5">{profile.course_name}</dd>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <dt className="text-xs text-slate-500">Academic Year &amp; Semester</dt>
            <dd className="font-semibold text-slate-900 mt-0.5 font-mono tabular-nums">
              Year {profile.year_of_study} · Semester {profile.semester}
            </dd>
          </div>
        </dl>

        <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-950">
          <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Record Integrity &amp; Privacy Guarantee</div>
            <p className="text-blue-900/80 leading-relaxed">
              Your academic backlog and result records are private to your student ID and can only be modified by authorized Examination Cell administrators. You may submit optional supporting result documents under &ldquo;My Results&rdquo;, which remain marked &ldquo;Pending Verification&rdquo; until reviewed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
