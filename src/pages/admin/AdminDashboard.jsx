import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  Loader,
  Map,
  Megaphone,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Truck,
} from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { activeScheduleFor, gpsFor, routeById, upcomingSchedules, userName, useStore } from '../../lib/store';
import { collectorMarkers } from '../../components/LiveTracking';
import { MapView } from '../../components/OsmMap';
import { formatDayDate, formatTime, timeAgo } from '../../lib/time';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { CategoryTag } from '../../components/WasteCategoryPicker';
export default function AdminDashboard() {
  const user = useCurrentUser();
  const { db } = useStore();
  const res = db.users.filter((u) => u.role === 'resident');
  const cols = db.users.filter((u) => u.role === 'collector');
  const pending = res.filter((u) => u.status === 'pending');
  const activeCollectors = cols.filter((c) => c.active && gpsFor(db, c.id)?.state !== 'offline').length;
  const upcoming = upcomingSchedules(db);
  const recentReports = [...db.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const onRoute = cols.filter((c) => gpsFor(db, c.id)?.state === 'on_route');
  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]}`}
        subtitle="Overview of barangay waste collection operations."
        actions={
          <>
            <Link to="/admin/schedules">
              <Button variant="outline" icon={<CalendarPlus className="h-4 w-4" />}>
                New schedule
              </Button>
            </Link>
            <Link to="/admin/announcements">
              <Button icon={<Megaphone className="h-4 w-4" />}>Post announcement</Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total residents"
          value={res.length}
          icon={<Users className="h-5 w-5" />}
          to="/admin/residents"
        />
        <StatCard
          label="Approved residents"
          value={res.filter((r) => r.status === 'approved').length}
          icon={<UserCheck className="h-5 w-5" />}
          to="/admin/residents"
        />
        <StatCard
          label="Pending applications"
          value={pending.length}
          icon={<UserPlus className="h-5 w-5" />}
          tone="amber"
          to="/admin/residents"
        />
        <StatCard
          label="Total collectors"
          value={cols.length}
          icon={<UserCog className="h-5 w-5" />}
          tone="blue"
          to="/admin/collectors"
        />
        <StatCard
          label="Active collectors"
          value={activeCollectors}
          hint={`${onRoute.length} on route now`}
          icon={<Truck className="h-5 w-5" />}
          tone="blue"
          to="/admin/map"
        />
        <StatCard
          label="Pending reports"
          value={db.reports.filter((r) => r.status === 'pending').length}
          icon={<FileText className="h-5 w-5" />}
          tone="amber"
          to="/admin/reports"
        />
        <StatCard
          label="Reports in progress"
          value={db.reports.filter((r) => r.status === 'in_progress').length}
          icon={<Loader className="h-5 w-5" />}
          tone="blue"
          to="/admin/reports"
        />
        <StatCard
          label="Resolved reports"
          value={db.reports.filter((r) => r.status === 'resolved').length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          to="/admin/reports"
        />
        <StatCard
          label="Upcoming collections"
          value={upcoming.length}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="purple"
          to="/admin/schedules"
        />
        <StatCard
          label="Open collector issues"
          value={db.issues.filter((i) => i.status === 'open').length}
          icon={<Activity className="h-5 w-5" />}
          tone="red"
          to="/admin/issues"
        />
      </div>

      <Card
        className="mt-6"
        title={`Live trucks · ${onRoute.length} on route`}
        action={
          <Link to="/admin/map" className="text-xs font-medium text-green-700 hover:underline">
            Open live map
          </Link>
        }
      >
        {onRoute.length === 0 ? (
          <EmptyState
            icon={<Map className="h-6 w-6" />}
            title="No collector is on route right now"
            message="When a collector presses Start Route, their GPS location appears here."
          />
        ) : (
          <MapView
            db={db}
            routes={onRoute
              .map((c) => routeById(db, activeScheduleFor(db, c.id)?.routeId))
              .filter((r) => !!r)}
            markers={collectorMarkers(db, onRoute)}
            visited={onRoute.flatMap((c) => activeScheduleFor(db, c.id)?.visited ?? [])}
            showPuroks={false}
          />
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Recent waste reports"
          action={
            <Link to="/admin/reports" className="text-xs font-medium text-green-700 hover:underline">
              View all
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          {recentReports.length === 0 ? (
            <EmptyState title="No reports yet" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentReports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                      <span className="font-mono text-xs text-gray-500">{r.code}</span>
                      <CategoryTag category={r.category} />
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-600">{r.description}</p>
                    <p className="text-xs text-gray-400">
                      {userName(db, r.residentId, 'Unknown')} · {r.purok} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Quick actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/admin/residents', label: 'Review applications', icon: UserCheck },
              { to: '/admin/reports', label: 'Manage reports', icon: FileText },
              { to: '/admin/schedules', label: 'Schedules', icon: CalendarPlus },
              { to: '/admin/map', label: 'Live map', icon: Map },
              { to: '/admin/collectors', label: 'Collectors', icon: UserCog },
              { to: '/admin/activity', label: 'Activity log', icon: Activity },
            ].map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm font-medium text-gray-800 transition hover:border-green-300 hover:bg-green-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <q.icon className="h-5 w-5 text-green-600" />
                {q.label}
              </Link>
            ))}
          </div>
        </Card>

        <Card
          title="Pending applications"
          action={
            <Link to="/admin/residents" className="text-xs font-medium text-green-700 hover:underline">
              Review
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          {pending.length === 0 ? (
            <EmptyState icon={<UserCheck className="h-6 w-6" />} title="No pending applications" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {pending.slice(0, 5).map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">
                      {u.purok} · {timeAgo(u.createdAt)}
                    </p>
                  </div>
                  <Badge tone="amber">Pending</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Upcoming collections"
          action={
            <Link to="/admin/schedules" className="text-xs font-medium text-green-700 hover:underline">
              View all
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No upcoming collections" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.slice(0, 5).map((s) => (
                <li key={s.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{formatDayDate(s.date)}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {formatTime(s.time)} · {routeById(db, s.routeId)?.name ?? 'No route'} ·{' '}
                    {userName(db, s.collectorId)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent activity"
          action={
            <Link to="/admin/activity" className="text-xs font-medium text-green-700 hover:underline">
              View log
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          <ul className="divide-y divide-gray-100">
            {db.activity.slice(0, 6).map((a) => (
              <li key={a.id} className="px-4 py-3 sm:px-5">
                <p className="text-sm font-medium text-gray-900">{a.action}</p>
                <p className="line-clamp-2 text-xs text-gray-600">{a.details}</p>
                <p className="text-xs text-gray-400">
                  {a.actorName} · {timeAgo(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
