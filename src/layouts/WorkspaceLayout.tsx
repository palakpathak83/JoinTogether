import { useEffect, useState } from 'react';
import {
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Sparkles,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.tsx';
import { API_BASE, apiRequest } from '../lib/api.ts';
import type { AppNotification } from '../types/index.ts';

export default function WorkspaceLayout() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadNotifications() {
      try {
        const data = await apiRequest<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications');
        if (active) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Ignore transient notification fetch failure
      }
    }

    loadNotifications();
    return () => {
      active = false;
    };
  }, [user, location.pathname]);

  // Listen for real-time notifications on authenticated user channel
  useEffect(() => {
    if (!accessToken || !user) return;

    const socketUrl = API_BASE || window.location.origin;
    const socket: Socket = io(socketUrl, {
      auth: { token: accessToken },
      withCredentials: true,
    });

    socket.on('notification:new', (notif: AppNotification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev].slice(0, 25);
      });
      setUnreadCount((c) => c + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, user]);

  async function markAllRead() {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItems = [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/app/requests', label: 'My Requests', icon: ClipboardList, end: false },
    { to: '/app/matches', label: 'Find Matches', icon: Sparkles, end: false },
    { to: '/app/groups', label: 'Groups', icon: Users, end: false },
    { to: '/app/profile', label: 'Profile', icon: UserIcon, end: false },
  ];

  if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
    navItems.push({ to: '/app/admin', label: 'Admin Console', icon: Shield, end: false });
  }

  const pageLabel =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    )?.label ?? 'Workspace';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-slate-900">
            JoinTogether
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user?.role} · {user?.city || 'Location unset'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm text-slate-500">
              <span>Workspace</span>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">{pageLabel}</span>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-slate-600" />
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span className="font-mono font-semibold text-blue-700 tabular-nums">
                  ({unreadCount})
                </span>
              )}
            </button>

            <Link
              to="/app/requests"
              className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              New Request
            </Link>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-slate-500">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.relatedGroupId) navigate(`/app/groups/${n.relatedGroupId}`);
                        }}
                        className={`cursor-pointer px-4 py-3 hover:bg-slate-50 ${
                          n.isRead ? 'bg-white' : 'bg-blue-50/40'
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
