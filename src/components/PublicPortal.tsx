import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { CollegePublic, CourseItem, DepartmentItem, User } from '../types/ktbuddy';

type PublicView = 'landing' | 'login' | 'register';

interface PublicPortalProps {
  onAuthenticated: (user: User, token: string) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Rahul Sharma — Student (BCA Sem 4)',
    identifier: 'BCA2024001',
    email: 'rahul.sharma@nitm.edu',
    role: 'student' as const,
  },
  {
    label: 'Ananya Verma — Student (BCA Sem 4)',
    identifier: 'BCA2024002',
    email: 'ananya.verma@nitm.edu',
    role: 'student' as const,
  },
  {
    label: 'Rajeshwari Kulkarni — Exam Cell Admin',
    identifier: 'admin@nitm.edu',
    email: 'admin@nitm.edu',
    role: 'admin' as const,
  },
];

export function PublicPortal({ onAuthenticated }: PublicPortalProps) {
  const [view, setView] = useState<PublicView>('landing');
  const [authSubMode, setAuthSubMode] = useState<'login' | 'forgot'>('login');

  const [colleges, setColleges] = useState<CollegePublic[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);

  // Login fields
  const [identifier, setIdentifier] = useState('BCA2024001');
  const [password, setPassword] = useState('KTBuddy@2026');
  const [loginRoleHint, setLoginRoleHint] = useState<'any' | 'student' | 'admin'>('any');

  // Student registration fields
  const [regCollegeId, setRegCollegeId] = useState<number>(0);
  const [regName, setRegName] = useState('');
  const [regRoll, setRegRoll] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDeptId, setRegDeptId] = useState<number>(0);
  const [regCourseId, setRegCourseId] = useState<number>(0);
  const [regYear, setRegYear] = useState<number>(2);
  const [regSemester, setRegSemester] = useState<number>(3);
  const [regPassword, setRegPassword] = useState('');

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [issuedCodeHint, setIssuedCodeHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ colleges: CollegePublic[] }>('/api/auth/colleges-public')
      .then((res) => {
        setColleges(res.colleges);
        if (res.colleges.length > 0) {
          setRegCollegeId(res.colleges[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!regCollegeId) return;
    apiFetch<{ departments: DepartmentItem[]; courses: CourseItem[] }>(
      `/api/auth/colleges-public/${regCollegeId}/catalog`
    )
      .then((res) => {
        setDepartments(res.departments);
        setCourses(res.courses);
        const firstDept = res.departments[0]?.id || 0;
        setRegDeptId(firstDept);
        const matchingCourse = res.courses.find((c) => c.department_id === firstDept) || res.courses[0];
        setRegCourseId(matchingCourse?.id || 0);
      })
      .catch(() => {});
  }, [regCollegeId]);

  const navigate = (nextView: PublicView) => {
    setView(nextView);
    setAuthSubMode('login');
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLoginWithRole = (role: 'student' | 'admin') => {
    setLoginRoleHint(role);
    const demo = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (demo) {
      setIdentifier(demo.identifier);
      setPassword('KTBuddy@2026');
    }
    navigate('login');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
          role: loginRoleHint === 'any' ? undefined : loginRoleHint,
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          collegeId: regCollegeId,
          fullName: regName,
          rollNumber: regRoll,
          email: regEmail,
          departmentId: regDeptId,
          courseId: regCourseId,
          yearOfStudy: regYear,
          semester: regSemester,
          password: regPassword,
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
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
      setAuthSubMode('login');
      setIdentifier(forgotEmail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((c) => !regDeptId || c.department_id === regDeptId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* HOME PORTAL SELECTION */}
      {view === 'landing' && (
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-5xl space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                KT Buddy
              </h1>
              <p className="text-sm sm:text-base text-slate-600">
                Smart Backlog Management &amp; Academic Information System
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              <button
                type="button"
                onClick={() => openLoginWithRole('student')}
                className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
              >
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-display text-lg font-bold text-slate-900">Student Login</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Access your verified KT records, previous semester syllabi, PYQs, and exam schedules.
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
                onClick={() => openLoginWithRole('admin')}
                className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
              >
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-display text-lg font-bold text-slate-900">Admin Exam Cell Login</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Upload official Excel/CSV result sheets, manage KT statuses, syllabi, and notifications.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-900 group-hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                  <span>Admin Exam Cell Login</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('register')}
                className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-6 flex flex-col justify-between gap-6 transition-colors"
              >
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-display text-lg font-bold text-slate-900">New Student Registration</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Register with your student roll number, department, course, and college email.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 group-hover:bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                  <span>New Student Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* LOGIN & FORGOT PASSWORD */}
      {view === 'login' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    {authSubMode === 'login' ? 'Sign In to KT Buddy' : 'Password Recovery'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Access your Student backlog workspace or Exam Cell Admin console.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAuthSubMode('login')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      authSubMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthSubMode('forgot')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      authSubMode === 'forgot' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Forgot Password
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

              {authSubMode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      College Email or Student ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="BCA2024001 or admin@nitm.edu"
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
                        onClick={() => setAuthSubMode('forgot')}
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

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span>New student at the college?</span>
                    <button
                      type="button"
                      onClick={() => navigate('register')}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Register Student Account
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleRequestResetCode} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Registered College Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="rahul.sharma@nitm.edu"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                    >
                      Generate Verification Code
                    </button>
                  </form>

                  {issuedCodeHint && (
                    <form onSubmit={handleConfirmReset} className="pt-4 border-t border-slate-200 space-y-3">
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                        Development verification code: <span className="font-mono font-bold">{issuedCodeHint}</span>
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

          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-bold text-slate-900">Development Demo Accounts</h2>
                </div>
                <span className="text-xs font-mono text-slate-500">Password: KTBuddy@2026</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                These accounts are pre-seeded for development testing. Select an account below to pre-fill the login form. Admin accounts cannot be created via public registration.
              </p>

              <div className="space-y-2.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.identifier}
                    type="button"
                    onClick={() => {
                      setLoginRoleHint(acc.role);
                      setIdentifier(acc.identifier);
                      setPassword('KTBuddy@2026');
                      setAuthSubMode('login');
                      setError(null);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{acc.label}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                        ID: {acc.identifier} · {acc.email}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 shrink-0 whitespace-nowrap">Use Account</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </main>
      )}

      {/* STUDENT REGISTRATION */}
      {view === 'register' && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 space-y-6">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <form onSubmit={handleRegister} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">Student Registration</h1>
              <p className="text-xs text-slate-600 mt-1">
                Create your personal student account. Administrator accounts are provisioned securely by the Examination Cell.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800" role="alert">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Priya Deshpande"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student ID / Roll Number</label>
                <input
                  type="text"
                  value={regRoll}
                  onChange={(e) => setRegRoll(e.target.value)}
                  placeholder="BCA2024099"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">College Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="priya.d@nitm.edu"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">College</label>
                <select
                  value={regCollegeId}
                  onChange={(e) => setRegCollegeId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={regDeptId}
                  onChange={(e) => {
                    const nextDept = Number(e.target.value);
                    setRegDeptId(nextDept);
                    const matching = courses.find((c) => c.department_id === nextDept);
                    if (matching) setRegCourseId(matching.id);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
                <select
                  value={regCourseId}
                  onChange={(e) => setRegCourseId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  {filteredCourses.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Academic Year</label>
                <select
                  value={regYear}
                  onChange={(e) => setRegYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Current Semester</label>
                <select
                  value={regSemester}
                  onChange={(e) => setRegSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 6 chars)</label>
                <input
                  type="password"
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Creating Account...' : 'Register Student Account'}
              </button>
              <button
                type="button"
                onClick={() => navigate('login')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Already registered? Sign In
              </button>
            </div>
          </form>
        </main>
      )}

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span className="font-display font-bold text-slate-900">KT Buddy</span>
          <span>Smart Backlog Management &amp; Academic Information System</span>
        </div>
      </footer>
    </div>
  );
}
