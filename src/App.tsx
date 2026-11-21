import { useCallback, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from './lib/api';
import type { NotificationItem, User } from './types/ktbuddy';
import { PublicPortal } from './components/PublicPortal';
import { StudentPortal } from './components/StudentPortal';
import { AdminPortal } from './components/AdminPortal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, [user, loadNotifications]);

  const handleAuthenticated = (authenticatedUser: User, token: string) => {
    setAuthToken(token);
    setUser(authenticatedUser);
  };

  const handleMarkRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await loadNotifications();
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
  };

  if (!user) {
    return <PublicPortal onAuthenticated={handleAuthenticated} />;
  }

  if (user.role === 'admin') {
    return (
      <AdminPortal
        user={user}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <StudentPortal
      user={user}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
      onLogout={handleLogout}
    />
  );
}
