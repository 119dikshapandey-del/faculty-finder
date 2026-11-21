import { useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { FacultyDashboard } from './components/FacultyDashboard';
import { PublicPortal } from './components/PublicPortal';
import { StudentDashboard } from './components/StudentDashboard';
import { apiFetch, setAuthToken } from './lib/api';
import type { User } from './types/campusmitra';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleAuthenticated = (authUser: User, authToken: string) => {
    setAuthToken(authToken);
    setToken(authToken);
    setUser(authUser);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout error
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  if (!user || !token) {
    return <PublicPortal onAuthenticated={handleAuthenticated} />;
  }

  if (user.role === 'student') {
    return <StudentDashboard user={user} token={token} onLogout={handleLogout} />;
  }

  if (user.role === 'faculty') {
    return <FacultyDashboard user={user} token={token} onLogout={handleLogout} />;
  }

  return <AdminDashboard user={user} token={token} onLogout={handleLogout} />;
}
