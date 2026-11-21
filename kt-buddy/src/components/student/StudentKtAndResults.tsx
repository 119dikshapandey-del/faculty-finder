import { useEffect, useState } from 'react';
import { BookOpen, Eye, FileSpreadsheet, Search, Upload, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ClearanceStatus, ResultRecordItem, StudentKtItem } from '../../types/ktbuddy';
import { ClearanceStatusLabel } from '../StatusLabel';

export function StudentKtSubjectsView({
  onOpenSubjectResource,
}: {
  onOpenSubjectResource: (tab: 'syllabus' | 'resources' | 'pyqs' | 'timetable', subjectId: number) => void;
}) {
  const [subjects, setSubjects] = useState<StudentKtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesterFilter, setSemesterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<StudentKtItem | null>(null);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (semesterFilter) params.set('semester', semesterFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await apiFetch<{ subjects: StudentKtItem[] }>(`/api/student/kt-subjects?${params.toString()}`);
      setSubjects(res.subjects);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [semesterFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSubjects();
  };

  const STATUS_OPTIONS = ['All', 'KT', 'Cleared', 'Result Awaited', 'Under Verification', 'Revaluation Pending'];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject name or subject code (e.g., BCA201, Java)..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              Search
            </button>
          </form>

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
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          Loading your verified KT subjects...
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <div className="text-sm font-bold text-slate-900">No KT subject records matched your filters</div>
          <p className="text-xs text-slate-500">Try clearing the search query or selecting All Semesters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((sub) => (
            <div key={sub.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-blue-700">
                      {sub.subject_code} · Semester {sub.semester}
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5 truncate">
                      {sub.subject_name}
                    </h3>
                  </div>
                  <ClearanceStatusLabel status={sub.clearance_status} />
                </div>

                <dl className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100">
                  <div>
                    <dt className="text-slate-500">Academic Year</dt>
                    <dd className="font-mono font-semibold text-slate-900">{sub.academic_year}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Examination Attempt</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">Attempt #{sub.attempt_number}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Official Result Status</dt>
                    <dd className="font-semibold text-slate-900">{sub.latest_status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Declaration Date</dt>
                    <dd className="font-mono text-slate-900 tabular-nums">{sub.result_declaration_date || 'Pending'}</dd>
                  </div>
                </dl>

                {sub.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200/60">
                    {sub.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500">
                  {sub.syllabus_count || 0} syllabi · {sub.material_count || 0} study files
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenSubjectResource('syllabus', sub.subject_id)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap"
                  >
                    Syllabus &amp; PYQs
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subject Detail Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-mono font-semibold text-blue-700">
                  {selectedSubject.subject_code} · Semester {selectedSubject.semester}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {selectedSubject.subject_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current Clearance Status</span>
                <ClearanceStatusLabel status={selectedSubject.clearance_status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Previous Status</span>
                <span className="font-semibold text-slate-900">{selectedSubject.previous_status || 'Initial Entry'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verified By</span>
                <span className="font-semibold text-slate-900">{selectedSubject.verified_by_name || 'Examination Cell'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Next Scheduled Exam</span>
                <span className="font-mono font-semibold text-slate-900">
                  {selectedSubject.next_exam_date || 'Not scheduled yet'}
                </span>
              </div>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/70 leading-relaxed">
                Note: Only authorized college administrators can edit official KT status records.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  const id = selectedSubject.subject_id;
                  setSelectedSubject(null);
                  onOpenSubjectResource('syllabus', id);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open Syllabus
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = selectedSubject.subject_id;
                  setSelectedSubject(null);
                  onOpenSubjectResource('pyqs', id);
                }}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                View PYQs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentMyResultsView({ onRefreshDashboard }: { onRefreshDashboard: () => void }) {
  const [summary, setSummary] = useState({ total: 0, cleared: 0, remaining: 0, progressPercent: 0 });
  const [subjectResults, setSubjectResults] = useState<StudentKtItem[]>([]);
  const [history, setHistory] = useState<ResultRecordItem[]>([]);
  const [courseSubjects, setCourseSubjects] = useState<Array<{ id: number; subject_code: string; subject_name: string; semester: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Optional student supporting submission form state
  const [subCode, setSubCode] = useState('');
  const [claimedStatus, setClaimedStatus] = useState<ClearanceStatus>('Cleared');
  const [attemptNum, setAttemptNum] = useState(2);
  const [declarationDate, setDeclarationDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadResults = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        summary: typeof summary;
        subjectResults: StudentKtItem[];
        history: ResultRecordItem[];
        courseSubjects: Array<{ id: number; subject_code: string; subject_name: string; semester: number }>;
      }>('/api/student/results');
      setSummary(res.summary);
      setSubjectResults(res.subjectResults);
      setHistory(res.history);
      setCourseSubjects(res.courseSubjects);
      if (res.courseSubjects.length > 0 && !subCode) {
        setSubCode(res.courseSubjects[0].subject_code);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const handleSupportingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('subjectCode', subCode);
      formData.append('claimedStatus', claimedStatus);
      formData.append('attemptNumber', String(attemptNum));
      if (declarationDate) formData.append('declarationDate', declarationDate);
      if (remarks) formData.append('remarks', remarks);
      if (supportingFile) formData.append('supportingFile', supportingFile);

      const res = await apiFetch<{ message: string }>('/api/student/supporting-result', {
        method: 'POST',
        body: formData,
      });
      setFeedback({ type: 'ok', text: res.message });
      setRemarks('');
      setSupportingFile(null);
      await loadResults();
      onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clearance Progress Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Overall KT Clearance Progress</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only administrator-verified official results update your final clearance status.
            </p>
          </div>
          <div className="font-mono text-xl font-bold text-blue-700 tabular-nums">
            {summary.cleared} / {summary.total} Cleared ({summary.progressPercent}%)
          </div>
        </div>

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${summary.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Subject-Wise Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">Subject-Wise Result &amp; Clearance Tracking</h3>
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading result comparison...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Subject</th>
                  <th className="py-2.5 pr-4 font-semibold">Semester</th>
                  <th className="py-2.5 pr-4 font-semibold">Previous Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Latest Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Attempt</th>
                  <th className="py-2.5 pr-4 font-semibold">Declaration Date</th>
                  <th className="py-2.5 font-semibold">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectResults.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      {row.subject_name}{' '}
                      <span className="font-mono font-normal text-slate-500">({row.subject_code})</span>
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums">Sem {row.semester}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.previous_status || 'KT'}</td>
                    <td className="py-3 pr-4">
                      <ClearanceStatusLabel status={row.clearance_status} />
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums">#{row.attempt_number}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums">{row.result_declaration_date || 'Pending'}</td>
                    <td className="py-3 text-slate-600">{row.verified_by_name || 'Exam Cell'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attempt History + Optional Supporting Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900">Examination Attempt &amp; Verification History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Subject</th>
                  <th className="py-2 pr-3 font-semibold">Attempt</th>
                  <th className="py-2 pr-3 font-semibold">Reported</th>
                  <th className="py-2 pr-3 font-semibold">Verification</th>
                  <th className="py-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">
                      {h.subject_code} — {h.subject_name}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums">#{h.attempt_number}</td>
                    <td className="py-2.5 pr-3">{h.mapped_status}</td>
                    <td className="py-2.5 pr-3">
                      <ClearanceStatusLabel status={h.verification_status} />
                    </td>
                    <td className="py-2.5 font-mono text-slate-500 tabular-nums">
                      {h.result_declaration_date || h.created_at.slice(0, 10)}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No examination attempt history logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleSupportingSubmit} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Submit Supporting Result Copy</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Optional: Upload your marksheet snapshot for Exam Cell review. Submitted records remain labeled &ldquo;Pending Verification&rdquo; until approved by an administrator.
            </p>
          </div>

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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
            <select
              value={subCode}
              onChange={(e) => setSubCode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              required
            >
              {courseSubjects.map((s) => (
                <option key={s.id} value={s.subject_code}>
                  {s.subject_code} — {s.subject_name} (Sem {s.semester})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reported Status</label>
              <select
                value={claimedStatus}
                onChange={(e) => setClaimedStatus(e.target.value as ClearanceStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Cleared">Cleared</option>
                <option value="Revaluation Pending">Revaluation Pending</option>
                <option value="Result Awaited">Result Awaited</option>
                <option value="KT">KT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Attempt #</label>
              <input
                type="number"
                min={1}
                max={10}
                value={attemptNum}
                onChange={(e) => setAttemptNum(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Declaration Date (optional)</label>
            <input
              type="date"
              value={declarationDate}
              onChange={(e) => setDeclarationDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Supporting PDF / Marksheet Image</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setSupportingFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Cleared in supplementary revaluation list"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit for Admin Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
