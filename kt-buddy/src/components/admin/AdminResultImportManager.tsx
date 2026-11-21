import { useEffect, useState } from 'react';
import { Check, Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import type { ClearanceStatus, ResultRecordItem, ResultRuleItem, StudentKtItem, SubjectItem } from '../../types/ktbuddy';
import { ClearanceStatusLabel } from '../StatusLabel';

const CLEARANCE_STATUSES: ClearanceStatus[] = [
  'KT',
  'Cleared',
  'Result Awaited',
  'Under Verification',
  'Revaluation Pending',
];

export function AdminResultImportView({ onRefreshOverview }: { onRefreshOverview: () => void }) {
  const [rules, setRules] = useState<ResultRuleItem[]>([]);
  const [imports, setImports] = useState<Array<Record<string, any>>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [autoVerifyConfigured, setAutoVerifyConfigured] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add/update rule form
  const [rawCode, setRawCode] = useState('');
  const [mappedStatus, setMappedStatus] = useState<ClearanceStatus>('Under Verification');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [ruleDesc, setRuleDesc] = useState('');

  const loadRulesAndHistory = async () => {
    const [rRes, hRes] = await Promise.all([
      apiFetch<{ rules: ResultRuleItem[] }>('/api/admin/result-rules'),
      apiFetch<{ imports: Array<Record<string, any>> }>('/api/admin/results/imports'),
    ]);
    setRules(rRes.rules);
    setImports(hRes.imports);
  };

  useEffect(() => {
    loadRulesAndHistory();
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await apiFetch<{ message: string }>('/api/admin/result-rules', {
      method: 'POST',
      body: JSON.stringify({ rawCode, mappedClearanceStatus: mappedStatus, autoConfirm, description: ruleDesc }),
    });
    setFeedback({ type: 'ok', text: res.message });
    setRawCode('');
    setRuleDesc('');
    loadRulesAndHistory();
  };

  const handleDeleteRule = async (id: number) => {
    await apiFetch(`/api/admin/result-rules/${id}`, { method: 'DELETE' });
    loadRulesAndHistory();
  };

  const handlePreviewUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoadingPreview(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<Record<string, any>>('/api/admin/results/preview', {
        method: 'POST',
        body: formData,
      });
      setPreview(res);
      await loadRulesAndHistory();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!preview?.importId) return;
    setCommitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/admin/results/commit/${preview.importId}`, {
        method: 'POST',
        body: JSON.stringify({ autoVerifyConfigured }),
      });
      setFeedback({ type: 'ok', text: res.message });
      setPreview(null);
      setFile(null);
      await loadRulesAndHistory();
      onRefreshOverview();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message });
    } finally {
      setCommitting(false);
    }
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

      {/* Upload Official Excel/CSV File */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Upload Official Excel / CSV Result Sheet</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validate roll numbers, detect duplicates/unmatched rows, apply university mapping rules, and preview before committing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/results/template', 'KT_Buddy_Official_Result_Template.xlsx')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download Sample Excel (.xlsx)
          </button>
        </div>

        <form onSubmit={handlePreviewUpload} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 text-xs text-slate-600 border border-slate-300 rounded-lg p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
            required
          />
          <button
            type="submit"
            disabled={loadingPreview || !file}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            {loadingPreview ? 'Validating...' : 'Validate & Preview Import'}
          </button>
        </form>
      </div>

      {/* Preview Before Commit */}
      {preview && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-mono text-blue-700 font-semibold">Import Preview — {preview.fileName}</div>
              <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                {preview.summary.matchedRows} Matched · {preview.summary.needsReviewRows} Staged for Verification · {preview.summary.unmatchedRows + preview.summary.duplicateRows + preview.summary.invalidRows} Flagged Issues
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoVerifyConfigured}
                  onChange={(e) => setAutoVerifyConfigured(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                Auto-confirm rules marked safe (PASS/CLEARED/KT)
              </label>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || preview.summary.matchedRows === 0}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                {committing ? 'Committing...' : 'Confirm & Import Matched Records'}
              </button>
            </div>
          </div>

          {preview.errors?.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-950">
              <div className="font-bold">Validation Error &amp; Duplicate Report ({preview.errors.length})</div>
              <ul className="space-y-1 max-h-36 overflow-y-auto">
                {preview.errors.map((err: any, idx: number) => (
                  <li key={idx}>
                    Row {err.rowNumber} [{err.type}]: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Row</th>
                  <th className="py-2 pr-3 font-semibold">Roll No</th>
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 pr-3 font-semibold">Subject</th>
                  <th className="py-2 pr-3 font-semibold">Raw Code</th>
                  <th className="py-2 pr-3 font-semibold">Mapped Status</th>
                  <th className="py-2 pr-3 font-semibold">Validation</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.previewRows.map((row: any) => (
                  <tr key={row.rowNumber}>
                    <td className="py-2 pr-3 font-mono text-slate-500 tabular-nums">{row.rowNumber}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-slate-900">{row.rollNumber || '-'}</td>
                    <td className="py-2 pr-3">{row.studentName || <span className="text-rose-700">Unmatched</span>}</td>
                    <td className="py-2 pr-3 font-mono">
                      {row.subjectCode} {row.subjectName ? `(${row.subjectName})` : ''}
                    </td>
                    <td className="py-2 pr-3 font-mono font-semibold">{row.rawStatus}</td>
                    <td className="py-2 pr-3">
                      <ClearanceStatusLabel status={row.mappedStatus} />
                    </td>
                    <td className="py-2 pr-3 font-semibold">
                      <span
                        className={
                          row.validationStatus === 'Valid'
                            ? 'text-emerald-700'
                            : row.validationStatus === 'Needs Review'
                            ? 'text-amber-800'
                            : 'text-rose-700'
                        }
                      >
                        {row.validationStatus}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600">{row.issueNote || 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configurable University Result-Status Mapping Rules */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">Configurable University Result-Status Rules</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statuses like Withheld (WH), Absent (AB), Result Pending (RP), and Revaluation (REV) stay unconfirmed until manually verified by an admin.
          </p>
        </div>

        <form onSubmit={handleSaveRule} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">University Code</label>
            <input
              type="text"
              value={rawCode}
              onChange={(e) => setRawCode(e.target.value)}
              placeholder="e.g., WH, AB, PASS"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Maps to Status</label>
            <select
              value={mappedStatus}
              onChange={(e) => setMappedStatus(e.target.value as ClearanceStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {CLEARANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={ruleDesc}
              onChange={(e) => setRuleDesc(e.target.value)}
              placeholder="Rule note"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(e) => setAutoConfirm(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            Allow auto-confirm
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Rule
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-semibold">Raw Code</th>
                <th className="py-2 pr-4 font-semibold">Mapped Status</th>
                <th className="py-2 pr-4 font-semibold">Verification Mode</th>
                <th className="py-2 pr-4 font-semibold">Rule Description</th>
                <th className="py-2 font-semibold text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-4 font-mono font-bold text-blue-700">{r.raw_code}</td>
                  <td className="py-2.5 pr-4">
                    <ClearanceStatusLabel status={r.mapped_clearance_status} />
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700">
                    {r.auto_confirm === 1 ? 'Eligible for auto-confirm' : 'Requires manual admin verification'}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.description || '-'}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-rose-700 hover:text-rose-900 p-1"
                      aria-label={`Delete rule ${r.raw_code}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-700" />
          <h3 className="font-display text-base font-bold text-slate-900">Official Result Import History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">File Name</th>
                <th className="py-2 pr-3 font-semibold">Total</th>
                <th className="py-2 pr-3 font-semibold">Matched</th>
                <th className="py-2 pr-3 font-semibold">Unmatched</th>
                <th className="py-2 pr-3 font-semibold">Duplicates</th>
                <th className="py-2 pr-3 font-semibold">Confirmed</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">Imported By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">{imp.file_name}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">{imp.total_rows}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">{imp.matched_rows}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">{imp.unmatched_rows}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">{imp.duplicate_rows}</td>
                  <td className="py-2.5 pr-3 font-mono font-bold text-emerald-700 tabular-nums">{imp.confirmed_count}</td>
                  <td className="py-2.5 pr-3 font-semibold">{imp.status}</td>
                  <td className="py-2.5 text-slate-600">{imp.imported_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminKtVerificationView({ onRefreshOverview }: { onRefreshOverview: () => void }) {
  const [records, setRecords] = useState<ResultRecordItem[]>([]);
  const [ktLedger, setKtLedger] = useState<StudentKtItem[]>([]);
  const [students, setStudents] = useState<Array<Record<string, any>>>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, ClearanceStatus>>({});
  const [editingKt, setEditingKt] = useState<StudentKtItem | null>(null);
  const [editStatus, setEditStatus] = useState<ClearanceStatus>('Cleared');
  const [editIncrementAttempt, setEditIncrementAttempt] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  // Manual KT Entry state
  const [manualStudentId, setManualStudentId] = useState<number>(0);
  const [manualSubjectId, setManualSubjectId] = useState<number>(0);
  const [manualStatus, setManualStatus] = useState<ClearanceStatus>('KT');
  const [manualNotes, setManualNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = async () => {
    const [qRes, sRes, subRes] = await Promise.all([
      apiFetch<{ records: ResultRecordItem[]; ktLedger: StudentKtItem[] }>('/api/admin/results/verification-queue'),
      apiFetch<{ students: Array<Record<string, any>> }>('/api/admin/students'),
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
    ]);
    setRecords(qRes.records);
    setKtLedger(qRes.ktLedger);
    setStudents(sRes.students);
    setSubjects(subRes.subjects);
    if (!manualStudentId && sRes.students.length > 0) setManualStudentId(sRes.students[0].id);
    if (!manualSubjectId && subRes.subjects.length > 0) setManualSubjectId(subRes.subjects[0].id);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleDecision = async (rec: ResultRecordItem, decision: 'Verify' | 'Reject') => {
    const confirmedStatus = statusOverrides[rec.id] || rec.mapped_status;
    const res = await apiFetch<{ message: string }>(`/api/admin/results/verify/${rec.id}`, {
      method: 'POST',
      body: JSON.stringify({ decision, confirmedStatus }),
    });
    setMsg(res.message);
    await loadAll();
    onRefreshOverview();
  };

  const handleUpdateKt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKt) return;
    const res = await apiFetch<{ message: string }>(`/api/admin/results/kt/${editingKt.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        clearanceStatus: editStatus,
        incrementAttempt: editIncrementAttempt,
        notes: editNotes,
      }),
    });
    setMsg(res.message);
    setEditingKt(null);
    await loadAll();
    onRefreshOverview();
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ message: string }>('/api/admin/results/manual-kt', {
      method: 'POST',
      body: JSON.stringify({
        studentId: manualStudentId,
        subjectId: manualSubjectId,
        clearanceStatus: manualStatus,
        notes: manualNotes,
      }),
    });
    setMsg(res.message);
    setManualNotes('');
    await loadAll();
    onRefreshOverview();
  };

  const pendingRecords = records.filter((r) => r.verification_status === 'Pending Verification');

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}

      {/* Pending Verification Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Pending Verification Queue ({pendingRecords.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review withheld/absent/revaluation rows from official imports and optional supporting marksheets submitted by students.
          </p>
        </div>

        {pendingRecords.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">All imported &amp; submitted records have been verified.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 pr-3 font-semibold">Subject</th>
                  <th className="py-2 pr-3 font-semibold">Raw Input</th>
                  <th className="py-2 pr-3 font-semibold">Confirm Status As</th>
                  <th className="py-2 pr-3 font-semibold">Remarks / Proof</th>
                  <th className="py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900">{rec.student_name || rec.roll_number}</div>
                      <div className="font-mono text-[11px] text-slate-500">{rec.roll_number}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-mono font-semibold text-blue-700">{rec.subject_code}</div>
                      <div className="text-slate-600">{rec.subject_name}</div>
                    </td>
                    <td className="py-3 pr-3 font-mono">{rec.raw_result_status}</td>
                    <td className="py-3 pr-3">
                      <select
                        value={statusOverrides[rec.id] || rec.mapped_status}
                        onChange={(e) =>
                          setStatusOverrides({ ...statusOverrides, [rec.id]: e.target.value as ClearanceStatus })
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        {CLEARANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 max-w-xs text-slate-600">
                      <div>{rec.remarks || '-'}</div>
                      {rec.supporting_file_path && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadAuthenticatedFile(
                              `/api/admin/results/supporting-file/${rec.id}`,
                              `Supporting_${rec.roll_number}_${rec.subject_code}`
                            )
                          }
                          className="text-blue-700 font-semibold hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          View Attachment
                        </button>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDecision(rec, 'Verify')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(rec, 'Reject')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Verified KT Entry Manually */}
      <form onSubmit={handleManualAdd} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">Record / Update Official Student KT Manually</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={manualStudentId}
            onChange={(e) => setManualStudentId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roll_number} — {s.full_name}
              </option>
            ))}
          </select>
          <select
            value={manualSubjectId}
            onChange={(e) => setManualSubjectId(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.subject_code} — {sub.subject_name}
              </option>
            ))}
          </select>
          <select
            value={manualStatus}
            onChange={(e) => setManualStatus(e.target.value as ClearanceStatus)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {CLEARANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Official verification note"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <button type="submit" className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
            Save Verified Record
          </button>
        </div>
      </form>

      {/* Verified KT Ledger with Revaluation / Supplementary Updates */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Verified Student KT Ledger (Revaluation &amp; Supplementary Updates)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Updating a student&apos;s record automatically preserves their previous status and logs attempt history.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Student</th>
                <th className="py-2 pr-3 font-semibold">Subject</th>
                <th className="py-2 pr-3 font-semibold">Sem</th>
                <th className="py-2 pr-3 font-semibold">Attempt</th>
                <th className="py-2 pr-3 font-semibold">Previous</th>
                <th className="py-2 pr-3 font-semibold">Current Status</th>
                <th className="py-2 font-semibold text-right">Update Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ktLedger.map((k) => (
                <tr key={k.id}>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-slate-900">{k.student_name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{k.roll_number}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-mono font-semibold text-blue-700">{k.subject_code}</span> — {k.subject_name}
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">Sem {k.semester}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">#{k.attempt_number}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{k.previous_status || 'Initial'}</td>
                  <td className="py-2.5 pr-3">
                    <ClearanceStatusLabel status={k.clearance_status} />
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKt(k);
                        setEditStatus(k.clearance_status);
                        setEditNotes(k.notes || '');
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-md inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Update Outcome
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingKt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <form onSubmit={handleUpdateKt} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Update Result: {editingKt.roll_number} · {editingKt.subject_code}
            </h3>
            <p className="text-xs text-slate-500">
              Previous status ({editingKt.clearance_status}) will be preserved in audit and student result history.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">New Official Clearance Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ClearanceStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {CLEARANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editIncrementAttempt}
                onChange={(e) => setEditIncrementAttempt(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              Increment examination attempt number (#{editingKt.attempt_number + 1})
            </label>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g., Cleared after revaluation list #4"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingKt(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                Save &amp; Notify Student
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
