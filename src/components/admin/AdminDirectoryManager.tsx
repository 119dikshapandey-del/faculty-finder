import { useEffect, useState } from 'react';
import { Plus, Search, UserCheck, UserX } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { CourseItem, DepartmentItem, SubjectItem } from '../../types/ktbuddy';

export function AdminStudentsView({ onRefreshOverview }: { onRefreshOverview: () => void }) {
  const [students, setStudents] = useState<Array<Record<string, any>>>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [q, setQ] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');

  // Add / Edit state
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [deptId, setDeptId] = useState<number>(0);
  const [courseId, setCourseId] = useState<number>(0);
  const [yearOfStudy, setYearOfStudy] = useState<number>(2);
  const [semester, setSemester] = useState<number>(3);
  const [editingStudent, setEditingStudent] = useState<Record<string, any> | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (deptFilter) params.set('departmentId', deptFilter);
    if (semFilter) params.set('semester', semFilter);

    const [studRes, catRes] = await Promise.all([
      apiFetch<{ students: Array<Record<string, any>> }>(`/api/admin/students?${params.toString()}`),
      apiFetch<{ departments: DepartmentItem[]; courses: CourseItem[] }>('/api/resources/catalog'),
    ]);
    setStudents(studRes.students);
    setDepartments(catRes.departments);
    setCourses(catRes.courses);
    if (!deptId && catRes.departments.length > 0) setDeptId(catRes.departments[0].id);
    if (!courseId && catRes.courses.length > 0) setCourseId(catRes.courses[0].id);
  };

  useEffect(() => {
    loadData();
  }, [deptFilter, semFilter]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          rollNumber,
          email,
          departmentId: deptId,
          courseId,
          yearOfStudy,
          semester,
        }),
      });
      setFeedback({ type: 'ok', text: res.message });
      setFullName('');
      setRollNumber('');
      setEmail('');
      await loadData();
      onRefreshOverview();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message });
    }
  };

  const handleToggleActive = async (stud: Record<string, any>) => {
    await apiFetch(`/api/admin/students/${stud.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: stud.is_active !== 1 }),
    });
    await loadData();
    onRefreshOverview();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    await apiFetch(`/api/admin/students/${editingStudent.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: editingStudent.full_name,
        departmentId: editingStudent.department_id,
        courseId: editingStudent.course_id,
        yearOfStudy: editingStudent.year_of_study,
        semester: editingStudent.semester,
      }),
    });
    setEditingStudent(null);
    setFeedback({ type: 'ok', text: 'Student details updated.' });
    await loadData();
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleAddStudent} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">Add Student Account</h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Vikram Joshi"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="BCA2024020"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vikram@nitm.edu"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
              <input
                type="number"
                min={1}
                max={4}
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
              <input
                type="number"
                min={1}
                max={8}
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Student
          </button>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadData();
              }}
              className="flex-1 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by roll number or student name..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <button type="submit" className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg">
                Search
              </button>
            </form>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Depts</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Sems</option>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <option key={s} value={String(s)}>
                  Sem {s}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Roll No</th>
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 pr-3 font-semibold">Dept / Course</th>
                  <th className="py-2 pr-3 font-semibold">Sem</th>
                  <th className="py-2 pr-3 font-semibold text-right">Active KTs</th>
                  <th className="py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-blue-700">{s.roll_number}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{s.full_name}</div>
                      <div className="text-[11px] text-slate-500">{s.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {s.department_name} · {s.course_name}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums">Sem {s.semester}</td>
                    <td className="py-2.5 pr-3 font-mono text-right tabular-nums">
                      <span className={s.active_kt_count > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'}>
                        {s.active_kt_count}
                      </span>
                    </td>
                    <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingStudent({ ...s })}
                        className="text-blue-700 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className={`inline-flex items-center gap-1 font-semibold ${
                          s.is_active === 1 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {s.is_active === 1 ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <form onSubmit={handleSaveEdit} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Edit Student ({editingStudent.roll_number})
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={editingStudent.full_name}
                onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={editingStudent.department_id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, department_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
                <select
                  value={editingStudent.course_id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, course_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={editingStudent.year_of_study}
                  onChange={(e) => setEditingStudent({ ...editingStudent, year_of_study: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={editingStudent.semester}
                  onChange={(e) => setEditingStudent({ ...editingStudent, semester: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminDepartmentsView() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [headName, setHeadName] = useState('');

  const [courseDeptId, setCourseDeptId] = useState<number>(0);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [totalSemesters, setTotalSemesters] = useState(6);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await apiFetch<{ departments: DepartmentItem[]; courses: CourseItem[] }>('/api/admin/departments');
    setDepartments(res.departments);
    setCourses(res.courses);
    if (!courseDeptId && res.departments.length > 0) setCourseDeptId(res.departments[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ message: string }>('/api/admin/departments', {
      method: 'POST',
      body: JSON.stringify({ name: deptName, code: deptCode, headName }),
    });
    setMsg(res.message);
    setDeptName('');
    setDeptCode('');
    setHeadName('');
    load();
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ message: string }>('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ departmentId: courseDeptId, name: courseName, code: courseCode, totalSemesters }),
    });
    setMsg(res.message);
    setCourseName('');
    setCourseCode('');
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleAddDept} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">Add Department</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="Data Science"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              required
            />
            <input
              type="text"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              placeholder="DS"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
              required
            />
          </div>
          <input
            type="text"
            value={headName}
            onChange={(e) => setHeadName(e.target.value)}
            placeholder="Head of Department (optional)"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <button type="submit" className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg">
            Add Department
          </button>
        </form>

        <form onSubmit={handleAddCourse} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">Assign Course to Department</h2>
          <select
            value={courseDeptId}
            onChange={(e) => setCourseDeptId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2.5">
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="B.Sc. Data Science"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg col-span-1"
              required
            />
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="BSCDS"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
              required
            />
            <input
              type="number"
              min={2}
              max={10}
              value={totalSemesters}
              onChange={(e) => setTotalSemesters(Number(e.target.value))}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg">
            Create Course
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">Departments</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {departments.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {d.name} <span className="font-mono text-blue-700">({d.code})</span>
                  </div>
                  <div className="text-slate-500">HOD: {d.head_name || 'TBA'}</div>
                </div>
                <div className="font-mono text-slate-600 tabular-nums">
                  {d.course_count} courses · {d.student_count} students
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">Courses</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {courses.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {c.name} <span className="font-mono text-blue-700">({c.code})</span>
                  </div>
                  <div className="text-slate-500">{c.department_name}</div>
                </div>
                <span className="font-mono text-slate-600 tabular-nums">{c.total_semesters} semesters</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminSubjectsView() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);

  const [deptId, setDeptId] = useState<number>(0);
  const [courseId, setCourseId] = useState<number>(0);
  const [semester, setSemester] = useState(2);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [credits, setCredits] = useState(4);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [subRes, catRes] = await Promise.all([
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
      apiFetch<{ departments: DepartmentItem[]; courses: CourseItem[] }>('/api/resources/catalog'),
    ]);
    setSubjects(subRes.subjects);
    setDepartments(catRes.departments);
    setCourses(catRes.courses);
    if (!deptId && catRes.departments.length > 0) setDeptId(catRes.departments[0].id);
    if (!courseId && catRes.courses.length > 0) setCourseId(catRes.courses[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await apiFetch<{ message: string }>('/api/admin/subjects', {
      method: 'POST',
      body: JSON.stringify({ departmentId: deptId, courseId, semester, subjectCode, subjectName, credits }),
    });
    setMsg(res.message);
    setSubjectCode('');
    setSubjectName('');
    load();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-900">Add Subject to Course &amp; Semester</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            value={deptId}
            onChange={(e) => setDeptId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={courseId}
            onChange={(e) => setCourseId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            placeholder="Code (BCA401)"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
            required
          />
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="Subject Name"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            required
          />
          <button type="submit" className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
            Add Subject
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-semibold">Code</th>
                <th className="py-2 pr-4 font-semibold">Subject Name</th>
                <th className="py-2 pr-4 font-semibold">Department</th>
                <th className="py-2 pr-4 font-semibold">Course</th>
                <th className="py-2 pr-4 font-semibold">Semester</th>
                <th className="py-2 font-semibold text-right">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((sub) => (
                <tr key={sub.id}>
                  <td className="py-2.5 pr-4 font-mono font-semibold text-blue-700">{sub.subject_code}</td>
                  <td className="py-2.5 pr-4 font-semibold text-slate-900">{sub.subject_name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{sub.department_name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{sub.course_name}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">Sem {sub.semester}</td>
                  <td className="py-2.5 font-mono text-right tabular-nums">{sub.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
