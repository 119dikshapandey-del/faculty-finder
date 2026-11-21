import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarPlus,
  CheckCheck,
  Download,
  ExternalLink,
  FileText,
  Megaphone,
  Search,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import type {
  AnnouncementItem,
  CourseItem,
  DepartmentItem,
  ExamScheduleItem,
  NotificationItem,
  StudyMaterialItem,
  SubjectItem,
  SyllabusItem,
} from '../../types/ktbuddy';

interface CatalogData {
  departments: DepartmentItem[];
  courses: CourseItem[];
  subjects: SubjectItem[];
}

export function StudentSyllabusView({ initialSubjectId }: { initialSubjectId?: number | null }) {
  const [catalog, setCatalog] = useState<CatalogData>({ departments: [], courses: [], subjects: [] });
  const [syllabi, setSyllabi] = useState<SyllabusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [deptId, setDeptId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubjectId ? String(initialSubjectId) : '');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (initialSubjectId) setSubjectId(String(initialSubjectId));
  }, [initialSubjectId]);

  useEffect(() => {
    apiFetch<CatalogData>('/api/resources/catalog').then(setCatalog).catch(() => {});
  }, []);

  const loadSyllabi = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptId) params.set('departmentId', deptId);
      if (courseId) params.set('courseId', courseId);
      if (semester) params.set('semester', semester);
      if (subjectId) params.set('subjectId', subjectId);
      if (query.trim()) params.set('q', query.trim());
      const res = await apiFetch<{ syllabi: SyllabusItem[] }>(`/api/resources/syllabi?${params.toString()}`);
      setSyllabi(res.syllabi);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyllabi();
  }, [deptId, courseId, semester, subjectId]);

  const handleDownload = async (syl: SyllabusItem) => {
    await downloadAuthenticatedFile(`/api/resources/syllabi/${syl.id}/download`, syl.file_name);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadSyllabi();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search syllabus by subject name, code, or version..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Search Syllabus
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Departments</option>
            {catalog.departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Courses</option>
            {catalog.courses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6].map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Subjects</option>
            {catalog.subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.subject_code} — {s.subject_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          Loading syllabus archive...
        </div>
      ) : syllabi.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          No syllabus PDFs match your filter selection.
        </div>
      ) : (
        <div className="space-y-4">
          {syllabi.map((syl) => (
            <div key={syl.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-700">{syl.subject_code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600">{syl.department_name} / {syl.course_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600">Semester {syl.semester}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-700">AY {syl.academic_year}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">{syl.title}</h3>
                  <div className="text-xs font-semibold text-slate-700">
                    Version: {syl.version_label}{' '}
                    {syl.is_latest === 1 ? (
                      <span className="ml-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Latest Official
                      </span>
                    ) : (
                      <span className="ml-2 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        Prior Academic Cycle
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(syl)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Download Syllabus PDF
                </button>
              </div>

              {syl.unit_topics && syl.unit_topics.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Unit-wise Syllabus Topics</div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                    {syl.unit_topics.map((topic, idx) => (
                      <li key={idx} className="bg-slate-50 border border-slate-200/70 rounded-lg px-3 py-2">
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentMaterialsView({
  mode,
  initialSubjectId,
}: {
  mode: 'all' | 'pyqs';
  initialSubjectId?: number | null;
}) {
  const [catalog, setCatalog] = useState<CatalogData>({ departments: [], courses: [], subjects: [] });
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [deptId, setDeptId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState(initialSubjectId ? String(initialSubjectId) : '');
  const [resourceType, setResourceType] = useState(mode === 'pyqs' ? 'PYQ' : 'All');
  const [academicYear, setAcademicYear] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setResourceType(mode === 'pyqs' ? 'PYQ' : 'All');
  }, [mode]);

  useEffect(() => {
    if (initialSubjectId) setSubjectId(String(initialSubjectId));
  }, [initialSubjectId]);

  useEffect(() => {
    apiFetch<CatalogData>('/api/resources/catalog').then(setCatalog).catch(() => {});
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptId) params.set('departmentId', deptId);
      if (courseId) params.set('courseId', courseId);
      if (semester) params.set('semester', semester);
      if (subjectId) params.set('subjectId', subjectId);
      if (mode === 'pyqs') {
        params.set('resourceType', 'PYQ');
      } else if (resourceType !== 'All') {
        params.set('resourceType', resourceType);
      }
      if (academicYear !== 'All') params.set('academicYear', academicYear);
      if (query.trim()) params.set('q', query.trim());

      const res = await apiFetch<{ materials: StudyMaterialItem[] }>(`/api/resources/materials?${params.toString()}`);
      setMaterials(res.materials);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [deptId, courseId, semester, subjectId, resourceType, academicYear, mode]);

  const handleDownload = async (m: StudyMaterialItem) => {
    await downloadAuthenticatedFile(`/api/resources/materials/${m.id}/download`, m.file_name || `${m.subject_code}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadMaterials();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'pyqs' ? 'Search Previous Year Question Papers...' : 'Search study notes, PYQs, important questions...'}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Filter
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Departments</option>
            {catalog.departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Courses</option>
            {catalog.courses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6].map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Subjects</option>
            {catalog.subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.subject_code} — {s.subject_name}
              </option>
            ))}
          </select>

          {mode === 'all' ? (
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="All">All Resource Types</option>
              <option value="PYQ">Previous Year Question Paper</option>
              <option value="Notes">Subject Notes</option>
              <option value="Important Questions">Important Questions</option>
              <option value="Unit Material">Unit Material</option>
              <option value="Reference Book">Reference Book / Link</option>
              <option value="Practical Material">Practical Material</option>
            </select>
          ) : (
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="All">All Academic Years</option>
              <option value="2025-26">2025-26</option>
              <option value="2024-25">2024-25</option>
              <option value="2023-24">2023-24</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          Loading study repository...
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          No matching study materials found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((m) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-blue-700">
                    {m.subject_code} · Sem {m.semester}
                  </span>
                  <span className="text-slate-600 font-semibold">{m.resource_type}</span>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">{m.title}</h3>
                {m.description && <p className="text-xs text-slate-600 leading-relaxed">{m.description}</p>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-[11px] font-mono text-slate-500">
                  AY {m.academic_year} · {m.created_at.slice(0, 10)}
                </div>
                {m.file_name ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(m)}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File
                  </button>
                ) : m.external_url ? (
                  <a
                    href={m.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Resource
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentTimetableView() {
  const [schedules, setSchedules] = useState<ExamScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesterFilter, setSemesterFilter] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (semesterFilter) params.set('semester', semesterFilter);
      if (upcomingOnly) params.set('upcomingOnly', 'true');
      const res = await apiFetch<{ schedules: ExamScheduleItem[] }>(`/api/student/timetable?${params.toString()}`);
      setSchedules(res.schedules);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [semesterFilter, upcomingOnly]);

  const changedSchedules = schedules.filter((s) => s.is_changed === 1);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6].map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(e) => setUpcomingOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            Show upcoming dates only
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/student/timetable/pdf', 'KT_Timetable.pdf')}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download Timetable PDF
          </button>
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/student/timetable/ics', 'KT_Exams_Calendar.ics')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Add to Calendar (.ics)
          </button>
        </div>
      </div>

      {changedSchedules.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5 text-xs text-amber-950">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Examination Schedule Change Notice
          </div>
          {changedSchedules.map((c) => (
            <div key={c.id}>
              <span className="font-mono font-semibold">{c.subject_code}</span> ({c.subject_name}):{' '}
              {c.change_note || `Updated to ${c.exam_date} at ${c.venue}`}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Loading examination timetable...</div>
        ) : schedules.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">No examination dates found for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Subject</th>
                  <th className="py-2.5 pr-4 font-semibold">Semester</th>
                  <th className="py-2.5 pr-4 font-semibold">Exam Date</th>
                  <th className="py-2.5 pr-4 font-semibold">Time</th>
                  <th className="py-2.5 pr-4 font-semibold">Session</th>
                  <th className="py-2.5 pr-4 font-semibold">Venue</th>
                  <th className="py-2.5 font-semibold">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((ex) => (
                  <tr key={ex.id} className={ex.is_personal_kt ? 'bg-blue-50/35' : ''}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">
                        {ex.subject_name}{' '}
                        <span className="font-mono font-normal text-slate-500">({ex.subject_code})</span>
                      </div>
                      {ex.is_personal_kt === 1 && (
                        <span className="inline-block mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                          Your Backlog Subject
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums">Sem {ex.semester}</td>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900 tabular-nums">{ex.exam_date}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums">
                      {ex.start_time} – {ex.end_time}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{ex.exam_session}</td>
                    <td className="py-3 pr-4 font-medium text-slate-800">{ex.venue || 'TBA'}</td>
                    <td className="py-3 text-slate-600 max-w-xs">{ex.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentNotificationsView({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    apiFetch<{ announcements: AnnouncementItem[] }>(`/api/resources/announcements?${params.toString()}`)
      .then((res) => setAnnouncements(res.announcements))
      .catch(() => {});
  }, [search]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-700" />
            <h2 className="font-display text-base font-bold text-slate-900">Personal Notification Feed</h2>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read ({unreadCount})
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">No personal notifications yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className={`py-3.5 px-3 rounded-lg ${n.is_read ? '' : 'bg-blue-50/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-bold text-slate-900">{n.title}</div>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="text-[11px] font-semibold text-blue-700 hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {new Date(n.created_at + (n.created_at.includes('Z') ? '' : 'Z')).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-700" />
          <h2 className="font-display text-base font-bold text-slate-900">Targeted Academic Announcements</h2>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements..."
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
        />

        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-blue-700">{a.category}</span>
                <span className="font-mono">{a.publish_date}</span>
              </div>
              <div className="text-xs font-bold text-slate-900">{a.title}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{a.content}</p>
            </div>
          ))}
          {announcements.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-6">No matching announcements.</div>
          )}
        </div>
      </div>
    </div>
  );
}
