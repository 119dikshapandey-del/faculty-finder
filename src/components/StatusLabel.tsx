import { AlertTriangle, CheckCircle2, Clock, FileCheck2, RefreshCw, XCircle } from 'lucide-react';
import type { ClearanceStatus } from '../types/ktbuddy';

export function ClearanceStatusLabel({ status }: { status: ClearanceStatus | string }) {
  switch (status) {
    case 'Cleared':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Cleared
        </span>
      );
    case 'KT':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          KT
        </span>
      );
    case 'Result Awaited':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Result Awaited
        </span>
      );
    case 'Under Verification':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
          Under Verification
        </span>
      );
    case 'Revaluation Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          Revaluation Pending
        </span>
      );
    case 'Verified':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Verified
        </span>
      );
    case 'Pending Verification':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Pending Verification
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
          {status}
        </span>
      );
  }
}
