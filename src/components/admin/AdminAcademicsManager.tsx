import { useEffect, useState } from 'react';
import { CalendarClock, Download, Megaphone, Plus, Trash2, Upload } from 'lucide-react';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import type {
  AnnouncementItem,
  CourseItem,
  DepartmentItem,
  ExamScheduleItem,
  StudyMaterialItem,
  SubjectItem,
  SyllabusItem,
} from '../../types/ktbuddy';

export function AdminSyllabusManagerView() {
  const [syllabi, setSyllabi] = useState<SyllabusItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [versionLabel, setVersionLabel] = useState('v2.2 (Latest KT Syllabus)');
  const [title, setTitle] = useState('');
  const [unitTopics, setUnitTopics] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [sylRes, subRes] = await Promise.all([
      apiFetch<{ syllabi: SyllabusItem[] }>('/api/resources/syllabi'),
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
    ]);
    setSyllabi(sylRes.syllabi);
    setSubjects(subRes.subjects);
    if (!subjectId && subRes.subjects.length > 0) setSubjectId(subRes.subjects[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('subjectId', String(subjectId));
    formData.append('academicYear', academicYear);
    formData.append('versionLabel', versionLabel);
    formData.append('title', title);
    formData.append('unitTopics', unitTopics);
    formData.append('isLatest', 'true');
    if (file) formData.append('file', file);

    const res = await apiFetch<{ message: string }>('/api/admin/syllabi', { method: 'POST', body: formData });
    setMsg(res.message);
    setTitle('');
    setUnitTopics('');
    setFile(null);
    load();
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/syllabi/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}

      <form onSubmit={handleUpload} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-900">Upload / Replace Official Syllabus PDF</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_code} — {s.subject_name} (Sem {s.semester})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="AY 2025-26"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
          <input
            type="text"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder="Version label"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Syllabus Title"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
        </div>
        <textarea
          rows={3}
          value={unitTopics}
          onChange={(e) => setUnitTopics(e.target.value)}
          placeholder="Unit-wise topics (one unit per line)"
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Publish Syllabus &amp; Notify
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">Published Syllabi ({syllabi.length})</h3>
        <div className="divide-y divide-slate-100 text-xs">
          {syllabi.map((syl) => (
            <div key={syl.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  <span className="font-mono text-blue-700">{syl.subject_code}</span> · {syl.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {syl.department_name} · {syl.course_name} · Sem {syl.semester} · AY {syl.academic_year} · {syl.version_label}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadAuthenticatedFile(`/api/resources/syllabi/${syl.id}/download`, syl.file_name)}
                  className="text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(syl.id)}
                  className="text-rose-700 hover:text-rose-900"
                  aria-label="Delete syllabus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminMaterialsManagerView() {
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [resourceType, setResourceType] = useState('PYQ');
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [matRes, subRes] = await Promise.all([
      apiFetch<{ materials: StudyMaterialItem[] }>('/api/resources/materials'),
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
    ]);
    setMaterials(matRes.materials);
    setSubjects(subRes.subjects);
    if (!subjectId && subRes.subjects.length > 0) setSubjectId(subRes.subjects[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const formData = new FormData();
      formData.append('subjectId', String(subjectId));
      formData.append('resourceType', resourceType);
      formData.append('academicYear', academicYear);
      formData.append('title', title);
      if (description) formData.append('description', description);
      if (externalUrl) formData.append('externalUrl', externalUrl);
      if (file) formData.append('file', file);

      const res = await apiFetch<{ message: string }>('/api/admin/materials', { method: 'POST', body: formData });
      setMsg(res.message);
      setTitle('');
      setDescription('');
      setExternalUrl('');
      setFile(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/materials/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{err}</div>}

      <form onSubmit={handleUpload} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-900">Upload PYQ, Study Notes, or Educational Link</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_code} — {s.subject_name} (Sem {s.semester})
              </option>
            ))}
          </select>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="PYQ">PYQ (Question Paper)</option>
            <option value="Notes">Notes</option>
            <option value="Important Questions">Important Questions</option>
            <option value="Unit Material">Unit Material</option>
            <option value="Reference Book">Reference Book / Link</option>
            <option value="Practical Material">Practical Material</option>
          </select>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="AY 2025-26"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resource Title"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="External educational URL (optional if uploading file)"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Publish Resource
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">Study Repository ({materials.length})</h3>
        <div className="divide-y divide-slate-100 text-xs">
          {materials.map((m) => (
            <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  <span className="font-mono text-blue-700">{m.subject_code}</span> · {m.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {m.resource_type} · Sem {m.semester} · AY {m.academic_year}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {m.file_name && (
                  <button
                    type="button"
                    onClick={() => downloadAuthenticatedFile(`/api/resources/materials/${m.id}/download`, m.file_name || 'file.pdf')}
                    className="text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    File
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="text-rose-700 hover:text-rose-900"
                  aria-label="Delete material"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminExamsManagerView() {
  const [schedules, setSchedules] = useState<ExamScheduleItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [examSession, setExamSession] = useState('KT Supplementary Cycle');
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('13:00');
  const [venue, setVenue] = useState('Block A, Hall 201');
  const [instructions, setInstructions] = useState('Carry college ID card and hall ticket.');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [exRes, subRes] = await Promise.all([
      apiFetch<{ schedules: ExamScheduleItem[] }>('/api/admin/exams'),
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
    ]);
    setSchedules(exRes.schedules);
    setSubjects(subRes.subjects);
    if (!subjectId && subRes.subjects.length > 0) setSubjectId(subRes.subjects[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/exams', {
        method: 'POST',
        body: JSON.stringify({ subjectId, examSession, examDate, startTime, endTime, venue, instructions }),
      });
      setMsg(res.message);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const handleQuickVenueChange = async (ex: ExamScheduleItem) => {
    const nextVenue = ex.venue?.includes('Hall 102') ? 'Block A, Examination Hall 208' : 'Block B, Examination Hall 102';
    const res = await apiFetch<{ message: string }>(`/api/admin/exams/${ex.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        venue: nextVenue,
        changeNote: `Venue updated to ${nextVenue} by Examination Cell.`,
      }),
    });
    setMsg(res.message);
    load();
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">{err}</div>}

      <form onSubmit={handleAddExam} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-700" />
          <h2 className="font-display text-base font-bold text-slate-900">Publish KT Examination Schedule</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white lg:col-span-2"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_code} — {s.subject_name} (Sem {s.semester})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={examSession}
            onChange={(e) => setExamSession(e.target.value)}
            placeholder="Session label"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <button type="submit" className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Schedule &amp; Notify Students
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Subject</th>
                <th className="py-2 pr-3 font-semibold">Sem</th>
                <th className="py-2 pr-3 font-semibold">Date &amp; Time</th>
                <th className="py-2 pr-3 font-semibold">Venue</th>
                <th className="py-2 pr-3 font-semibold">Change Notice</th>
                <th className="py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((ex) => (
                <tr key={ex.id}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">
                    <span className="font-mono text-blue-700">{ex.subject_code}</span> — {ex.subject_name}
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">Sem {ex.semester}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">
                    {ex.exam_date} · {ex.start_time}–{ex.end_time}
                  </td>
                  <td className="py-2.5 pr-3">{ex.venue || 'TBA'}</td>
                  <td className="py-2.5 pr-3 text-amber-800">{ex.change_note || '-'}</td>
                  <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleQuickVenueChange(ex)}
                      className="text-blue-700 font-semibold hover:underline"
                    >
                      Change Venue &amp; Notify
                    </button>
                    <button type="button" onClick={() => handleDelete(ex.id)} className="text-rose-700">
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminAnnouncementsView() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Examination');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetSemester, setTargetSemester] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [aRes, catRes] = await Promise.all([
      apiFetch<{ announcements: AnnouncementItem[] }>('/api/admin/announcements'),
      apiFetch<{ departments: DepartmentItem[]; courses: CourseItem[] }>('/api/resources/catalog'),
    ]);
    setAnnouncements(aRes.announcements);
    setDepartments(catRes.departments);
    setCourses(catRes.courses);
  };

  useEffect(() => {
    load();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ message: string }>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        category,
        targetDepartmentId: targetDeptId ? Number(targetDeptId) : null,
        targetCourseId: targetCourseId ? Number(targetCourseId) : null,
        targetSemester: targetSemester ? Number(targetSemester) : null,
        expiryDate: expiryDate || null,
      }),
    });
    setMsg(res.message);
    setTitle('');
    setContent('');
    load();
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}

      <form onSubmit={handlePublish} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-700" />
          <h2 className="font-display text-base font-bold text-slate-900">Publish Targeted Announcement</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement Title"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg lg:col-span-2"
            required
          />
          <select
            value={targetDeptId}
            onChange={(e) => setTargetDeptId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={targetCourseId}
            onChange={(e) => setTargetCourseId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={targetSemester}
            onChange={(e) => setTargetSemester(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Announcement details (only matching students will be notified)..."
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="Examination">Examination</option>
              <option value="Academic">Academic</option>
              <option value="Results">Results</option>
            </select>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
              aria-label="Expiry date"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
          >
            Publish Announcement
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">Published Announcements ({announcements.length})</h3>
        <div className="divide-y divide-slate-100 text-xs">
          {announcements.map((a) => (
            <div key={a.id} className="py-3 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-900">{a.title}</div>
                <p className="text-slate-600">{a.content}</p>
                <div className="text-[11px] text-slate-500">
                  {a.category} · {a.department_name || 'College-wide'} · {a.course_name || 'All Courses'} · Publish {a.publish_date}
                </div>
              </div>
              <button type="button" onClick={() => handleDelete(a.id)} className="text-rose-700 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
