import { useState, type ReactNode } from 'react';
import { Bell, CheckCheck, LogOut, Menu, X } from 'lucide-react';
import type { NotificationItem, User } from '../types/campusmitra';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface AppShellProps {
  user: User;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  navItems,
  activeTab,
  onSelectTab,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const activeNav = navItems.find((n) => n.id === activeTab);

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="font-display text-lg font-bold tracking-tight text-slate-900">Campusmitra</div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">{user.college_name}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0 truncate">
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
                    isActive ? 'bg-blue-800 text-white' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-900 truncate">{user.full_name}</div>
          <div className="text-[11px] font-mono text-slate-500 truncate capitalize">
            {user.role} · {user.identifier}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarBody}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[82vw] h-full z-10">{sidebarBody}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 capitalize">
                {user.role} Portal / {activeNav?.label || 'Dashboard'}
              </div>
              <h1 className="font-display text-lg font-bold text-slate-900 truncate">
                {activeNav?.label || 'Campusmitra'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
            {unreadCount > 0 && (
              <span className="font-mono text-[11px] font-bold text-white bg-blue-700 px-1.5 py-0.5 rounded tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/35" onClick={() => setNotifOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Notifications</h2>
                <p className="text-xs text-slate-500 tabular-nums">{unreadCount} unread updates</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-4 space-y-1.5 ${n.is_read ? 'bg-white' : 'bg-blue-50/40'}`}>
                    <div className="flex items-start justify-between gap-2">
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
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(n.created_at + (n.created_at.includes('Z') ? '' : 'Z')).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
