import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Copy, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { unreadCount, useStore } from '../lib/store';
import { Alert, Avatar, useToast } from './ui';
import { GpsPublisher } from './RouteSharing';
import { BARANGAY_NAME, MUNICIPALITY } from '../lib/geography';
import { cn } from '../utils/cn';
export function Logo({ light, className }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn('h-9 w-9 shrink-0 rounded-xl', !light && 'shadow-sm shadow-green-600/30')}
        aria-hidden
      >
        <defs>
          <linearGradient id={light ? 'ecoLogoLight' : 'ecoLogoDark'} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={light ? '#ffffff' : '#22c55e'} />
            <stop offset="1" stopColor={light ? '#dcfce7' : '#15803d'} />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${light ? 'ecoLogoLight' : 'ecoLogoDark'})`} />
        <path
          d="M9 21c0-7 5-12 14-12 0 9-5 14-12 14"
          fill="none"
          stroke={light ? '#16A34A' : '#fff'}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M9 23c3-4 6-7 10-9"
          fill="none"
          stroke={light ? '#16A34A' : '#fff'}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          'font-display text-lg font-extrabold tracking-tight',
          light ? 'text-white' : 'text-gray-900',
        )}
      >
        Eco<span className={light ? 'text-green-200' : 'text-green-600'}>Rescue</span>
      </span>
    </span>
  );
}
function useNav(role) {
  const { db } = useStore();
  const { user } = useAuth();
  const unread = user ? unreadCount(db, user.id) : 0;
  if (role === 'admin') {
    const pendingRes = db.users.filter((u) => u.role === 'resident' && u.status === 'pending').length;
    const pendingRep = db.reports.filter((r) => r.status === 'pending').length;
    const openIssues = db.issues.filter((i) => i.status === 'open').length;
    return [
      { to: '/admin', label: 'Dashboard', end: true },
      { to: '/admin/residents', label: 'Residents', badge: pendingRes },
      { to: '/admin/reports', label: 'Waste Reports', badge: pendingRep },
      { to: '/admin/schedules', label: 'Schedules' },
      { to: '/admin/notifications', label: 'Notifications', badge: unread },
      { to: '/admin/announcements', label: 'Announcements' },
      { to: '/admin/collectors', label: 'Collectors' },
      { to: '/admin/trucks', label: 'Trucks' },
      { to: '/admin/issues', label: 'Collector Reports', badge: openIssues },
      { to: '/admin/routes', label: 'Routes' },
      { to: '/admin/map', label: 'Live Map' },
      { to: '/admin/activity', label: 'Activity Log' },
    ];
  }
  if (role === 'resident') {
    return [
      { to: '/resident', label: 'Dashboard', end: true },
      { to: '/resident/schedule', label: 'Schedule' },
      { to: '/resident/tracking', label: 'Live Tracking' },
      { to: '/resident/report', label: 'Report' },
      { to: '/resident/my-reports', label: 'My Reports' },
      { to: '/resident/notifications', label: 'Notifications', badge: unread },
      { to: '/resident/profile', label: 'Profile' },
    ];
  }
  const assignedOpen = user
    ? db.reports.filter(
        (r) => r.collectorId === user.id && (r.status === 'pending' || r.status === 'in_progress'),
      ).length
    : 0;
  return [
    { to: '/collector', label: 'Dashboard', end: true },
    { to: '/collector/collections', label: 'Collections' },
    { to: '/collector/add-report', label: 'Add Report' },
    { to: '/collector/assigned', label: 'Assigned Reports', badge: assignedOpen },
    { to: '/collector/notifications', label: 'Notifications', badge: unread },
    { to: '/collector/profile', label: 'Profile' },
  ];
}
const ROLE_LABEL = { admin: 'Administrator', resident: 'Resident', collector: 'Collector' };
export default function Layout({ role }) {
  const { user, logout } = useAuth();
  const { syncError, offlineNotice } = useStore();
  const nav = useNav(role);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const menuRef = useRef(null);
  useEffect(() => {
    setDrawer(false);
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setDrawer(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);
  if (!user) return null;
  const current =
    nav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) ?? nav[0];
  const doLogout = async () => {
    try {
      const result = await logout();
      navigate('/login', { replace: true });
      toast.success('You have been signed out.');
      if (result?.warning) toast.error(result.warning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };
  const copyAccountId = async () => {
    try {
      await navigator.clipboard.writeText(user.code);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
      toast.success(`${ROLE_LABEL[role]} ID copied.`);
    } catch {
      toast.error('Could not copy the ID on this device.');
    }
  };
  const sidebar = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <Link
          to="/"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Logo light />
        </Link>
        <button
          className="rounded-lg p-1.5 text-green-100 hover:bg-white/10 lg:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="px-5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-green-300/80">
        {ROLE_LABEL[role]} portal
      </p>
      <nav
        className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2"
        aria-label="Main navigation"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                isActive
                  ? 'bg-white text-green-800 shadow-sm shadow-black/10'
                  : 'text-green-50/90 hover:bg-white/10 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-amber-300 transition-all',
                    isActive ? 'w-1' : 'w-0',
                  )}
                  aria-hidden
                />
                <span className="flex-1">{n.label}</span>
                {!!n.badge && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] font-bold',
                      isActive ? 'bg-green-100 text-green-800' : 'bg-amber-400 text-amber-950',
                    )}
                  >
                    {n.badge > 99 ? '99+' : n.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          to="/"
          className="block rounded-xl px-4 py-2.5 text-sm text-green-100/90 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ← Public homepage
        </Link>
      </div>
    </div>
  );
  const asideClass = 'bg-gradient-to-b from-[#15803d] to-[#14532d]';
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {role === 'collector' && <GpsPublisher />}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden w-64 lg:block', asideClass)}>{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <aside
            className={cn('absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl', asideClass)}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200/70 bg-white/80 px-4 shadow-sm shadow-gray-900/[0.02] backdrop-blur-lg sm:px-6">
          <button
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{current.label}</p>
            <p className="hidden truncate text-xs text-gray-500 sm:block">
              {BARANGAY_NAME}, {MUNICIPALITY} · Waste Management
            </p>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              aria-haspopup="menu"
              aria-expanded={menu}
            >
              <Avatar name={user.name} />
              <span className="hidden text-left md:block">
                <span className="block text-sm font-medium leading-tight text-gray-900">{user.name}</span>
                <span className="block text-xs leading-tight text-gray-500">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {menu && (
              <div
                role="menu"
                className="eco-animate-in absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-xl shadow-gray-900/10 ring-1 ring-black/5"
              >
                <div className="min-w-0 px-3 py-2">
                  <p className="break-words text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                  <div className="mt-2 rounded-lg bg-green-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-green-800">
                      {ROLE_LABEL[role]} ID
                    </p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5 text-green-900">
                        {user.code}
                      </code>
                      <button
                        aria-label={`Copy ${ROLE_LABEL[role]} ID`}
                        className="shrink-0 rounded-md p-1 text-green-800 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                        onClick={copyAccountId}
                        role="menuitem"
                        title={`Copy ${ROLE_LABEL[role]} ID`}
                        type="button"
                      >
                        {copiedId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="my-1 border-t border-gray-100" />
                {role !== 'admin' && (
                  <Link
                    role="menuitem"
                    to={`/${role}/profile`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <UserIcon className="h-4 w-4" /> My profile
                  </Link>
                )}
                <button
                  role="menuitem"
                  onClick={doLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main
          key={location.pathname}
          className="eco-main eco-animate-in mx-auto max-w-7xl px-3 py-5 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))] sm:px-6 sm:py-6 lg:py-8"
        >
          {offlineNotice && (
            <div className="mb-4">
              <Alert tone="amber" title="Not connected to a backend">
                {offlineNotice}
              </Alert>
            </div>
          )}
          {syncError && (
            <div className="mb-4">
              <Alert tone="red" title="Supabase sync problem">
                {syncError}
              </Alert>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
