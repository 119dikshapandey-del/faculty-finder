import { useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, KeyRound, Lock, Mail, ShieldCheck, Users } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { User, UserRole } from '../types/campusmitra';

interface PublicPortalProps {
  onAuthenticated: (user: User, token: string) => void;
}

const DEMO_ACCOUNTS: { label: string; identifier: string; role: UserRole }[] = [
  { label: 'Aryan Mehta — Student', identifier: 'aryan.mehta@nitm.edu', role: 'student' },
  { label: 'Dr. Anand Deshmukh — Faculty', identifier: 'dr.anand@nitm.edu', role: 'faculty' },
  { label: 'Rajesh Kulkarni — College Admin', identifier: 'admin@nitm.edu', role: 'admin' },
];

export function PublicPortal({ onAuthenticated }: PublicPortalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [subMode, setSubMode] = useState<'login' | 'forgot'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('Campus@2026');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [issuedCodeHint, setIssuedCodeHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openRoleLogin = (role: UserRole) => {
    setSelectedRole(role);
    setSubMode('login');
    setError(null);
    setNotice(null);
    const demo = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (demo) {
      setIdentifier(demo.identifier);
      setPassword('Campus@2026');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, role: selectedRole }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string; demoResetCode: string | null }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setNotice(res.message);
      setIssuedCodeHint(res.demoResetCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, code: resetCode, newPassword }),
      });
      setNotice(res.message);
      setIssuedCodeHint(null);
      setSubMode('login');
      setIdentifier(forgotEmail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center px-6 py-12">
        <div className="max-w-5xl w-full mx-auto space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
              Campusmitra
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Smart Faculty Finder &amp; Campus Availability System
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <button
              type="button"
              onClick={() => openRoleLogin('student')}
              className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-display text-lg font-bold text-slate-900">Student</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Search faculty availability, locate cabins on the campus map, join virtual queues, and book appointments.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-700 group-hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                <span>Student Login</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => openRoleLogin('faculty')}
              className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-display text-lg font-bold text-slate-900">Faculty</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Update live availability status, manage virtual queues, review appointment requests, and edit timetables.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-900 group-hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                <span>Faculty Login</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => openRoleLogin('admin')}
              className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-display text-lg font-bold text-slate-900">Admin</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Manage college faculty &amp; student directories, campus buildings, and live campus availability logs.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 group-hover:bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                <span>Admin Login</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <button
          type="button"
          onClick={() => {
            setSelectedRole(null);
            setError(null);
            setNotice(null);
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Role Selection</span>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 capitalize">
                {subMode === 'login' ? `${selectedRole} Login` : 'Forgot Password'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Sign in with your college email or institutional ID.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSubMode('login')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  subMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setSubMode('forgot')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  subMode === 'forgot' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Reset
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {notice}
            </div>
          )}

          {subMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  College Email or ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or ID"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setSubMode('forgot')}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Demo password: <span className="font-mono text-slate-700">Campus@2026</span></span>
                <span>College-isolated accounts</span>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleRequestReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Registered College Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="aryan.mehta@nitm.edu"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                >
                  Generate Reset Code
                </button>
              </form>

              {issuedCodeHint && (
                <form onSubmit={handleConfirmReset} className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    Verification code: <span className="font-mono font-bold">{issuedCodeHint}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">6-Digit Code</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    Update Password
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
