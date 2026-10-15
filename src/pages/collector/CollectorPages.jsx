import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  FilePlus2,
  KeyRound,
  MapPin,
  Megaphone,
  Radio,
  Route as RouteIcon,
  Save,
  Send,
  Truck,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '../../lib/auth';
import {
  actorOf,
  activeScheduleFor,
  addLog,
  adminIds,
  announcementVisibleTo,
  gpsFor,
  nextCode,
  notify,
  routeById,
  scheduleSort,
  truckFor,
  useStore,
} from '../../lib/store';
import { COLLECTION_DAYS, COLLECTION_TIME, PUROKS, describeDays } from '../../lib/geography';
import { formatDate, formatDayDate, formatTime, nowISO, timeAgo, todayISO } from '../../lib/time';
import { combineName, isPhone, normalizePhone, passwordProblem, splitName } from '../../lib/validation';
import { uid } from '../../lib/storage';
import {
  Alert,
  Badge,
  Button,
  Card,
  DetailRow,
  EmptyState,
  Field,
  ImageUpload,
  Input,
  PageHeader,
  PasswordInput,
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '../../components/ui';
import { RouteSharingPanel } from '../../components/RouteSharing';
import { collectorMarkers, routeProgress } from '../../components/LiveTracking';
import { MapView } from '../../components/OsmMap';
import { ISSUE_TYPES } from '../admin/AdminIssues';
function useMyCollections() {
  const user = useCurrentUser();
  const { db } = useStore();
  const t = todayISO();
  const mine = db.schedules.filter((s) => s.collectorId === user.id).sort(scheduleSort);
  return {
    today: mine.filter((s) => s.date === t && s.status !== 'cancelled'),
    upcoming: mine.filter((s) => s.date > t && s.status === 'scheduled'),
    history: mine
      .filter(
        (s) => s.date < t || s.status === 'completed' || s.status === 'missed' || s.status === 'cancelled',
      )
      .filter((s) => s.date !== t || s.status !== 'scheduled')
      .reverse(),
  };
}
/* ---------------- Dashboard ---------------- */
export function CollectorDashboard() {
  const user = useCurrentUser();
  const { db } = useStore();
  const { today, upcoming } = useMyCollections();
  const g = gpsFor(db, user.id);
  const truck = truckFor(db, user.id);
  const route = routeById(db, user.routeId);
  const active = activeScheduleFor(db, user.id);
  const assigned = db.reports.filter(
    (r) => r.collectorId === user.id && (r.status === 'pending' || r.status === 'in_progress'),
  );
  const anns = db.announcements
    .filter((a) => announcementVisibleTo(a, user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const myIssues = db.issues.filter((i) => i.collectorId === user.id && i.status !== 'closed');
  const featured = active ?? today.find((s) => s.status === 'scheduled');
  const alerts = [];
  if (!truck) alerts.push('No vehicle is assigned to you. Contact the administrator.');
  else if (truck.status === 'maintenance')
    alerts.push(`Your vehicle ${truck.vehicleId} is under maintenance.`);
  if (active && !g?.sharing) alerts.push('You are on route but location sharing is paused.');
  if (!route) alerts.push('You have no assigned route.');
  return (
    <>
      <PageHeader
        title={`Magandang araw, ${user.name.split(' ')[0]}!`}
        subtitle={`${user.code} · ${route?.name ?? 'No route assigned'}`}
        actions={
          <Link to="/collector/add-report">
            <Button variant="outline" icon={<AlertTriangle className="h-4 w-4" />}>
              Report an issue
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today's collections"
          value={today.length}
          icon={<Calendar className="h-5 w-5" />}
          to="/collector/collections"
        />
        <StatCard
          label="Status"
          value={<StatusBadge status={g?.state ?? 'offline'} />}
          hint={g?.sharing ? `Sharing · ${timeAgo(g.updatedAt)}` : 'GPS not sharing'}
          icon={<Radio className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Assigned reports"
          value={assigned.length}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="amber"
          to="/collector/assigned"
        />
        <StatCard
          label="Upcoming"
          value={upcoming.length}
          hint={
            upcoming[0]
              ? `Next: ${formatDate(upcoming[0].date, { month: 'short', day: 'numeric' })}`
              : undefined
          }
          icon={<RouteIcon className="h-5 w-5" />}
          tone="purple"
          to="/collector/collections"
        />
      </div>
      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((a) => (
            <Alert key={a} tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
              {a}
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={active ? 'Active route' : "Today's collection"}>
          {featured ? (
            <RouteSharingPanel schedule={featured} />
          ) : (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No collection scheduled today"
              message={
                upcoming[0]
                  ? `Next: ${formatDayDate(upcoming[0].date)} at ${formatTime(upcoming[0].time)}`
                  : undefined
              }
            />
          )}
        </Card>
        <div className="space-y-6">
          <Card title="My assignment">
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Route">{route?.name ?? 'None'}</DetailRow>
              <DetailRow label="Stops">{route ? route.stops.join(' → ') : '—'}</DetailRow>
              <DetailRow label="Weekly plan">
                {route ? (
                  <>
                    <b>{(route.days ?? COLLECTION_DAYS).length}× a week</b> ·{' '}
                    {describeDays(route.days ?? COLLECTION_DAYS)} at{' '}
                    {formatTime(route.time ?? COLLECTION_TIME)}
                  </>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow label="Puroks">
                {(user.puroks ?? []).length ? (
                  <div className="flex flex-wrap gap-1">
                    {(user.puroks ?? []).map((p) => (
                      <Badge key={p}>{p}</Badge>
                    ))}
                  </div>
                ) : (
                  'None'
                )}
              </DetailRow>
              <DetailRow label="Vehicle">
                {truck ? (
                  <>
                    {truck.vehicleId} · {truck.plate}
                    <br />
                    <span className="text-xs text-gray-500">
                      {truck.model} · {truck.capacityKg.toLocaleString()} kg
                    </span>{' '}
                    <StatusBadge status={truck.status} />
                  </>
                ) : (
                  'None'
                )}
              </DetailRow>
            </dl>
          </Card>
          <Card title="Open issues & alerts">
            {myIssues.length === 0 ? (
              <p className="text-sm text-gray-500">No open operational issues.</p>
            ) : (
              <ul className="space-y-2">
                {myIssues.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {ISSUE_TYPES[i.type]} · {i.purok}
                    </span>
                    <StatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card
          className="lg:col-span-2"
          title="Assigned waste reports"
          action={
            <Link to="/collector/assigned" className="text-xs font-medium text-green-700 hover:underline">
              View all
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          {assigned.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No open reports assigned" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {assigned.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-gray-500">
                      {r.code} · {r.purok}
                    </p>
                    <p className="truncate text-sm text-gray-800">{r.description}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Announcements" bodyClass="p-0 sm:p-0">
          {anns.length === 0 ? (
            <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {anns.map((a) => (
                <li key={a.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                  <p className="line-clamp-2 text-sm text-gray-600">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
/* ---------------- Collections ---------------- */
export function CollectorCollections() {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const { today, upcoming, history } = useMyCollections();
  const [tab, setTab] = useState('today');
  const active = activeScheduleFor(db, user.id);
  const route = active ? routeById(db, active.routeId) : routeById(db, user.routeId);
  // Lets a collector begin a collection today even if the admin didn't pre-generate
  // today's schedule — as long as they have an assigned route with stops.
  const createTodayCollection = () => {
    if (!route || !route.stops.length) return;
    commit((d) => {
      const r = d.routes.find((x) => x.id === route.id);
      if (!r) return;
      d.schedules.push({
        id: uid('sc-'),
        date: todayISO(),
        time: r.time ?? COLLECTION_TIME,
        routeId: r.id,
        collectorId: user.id,
        puroks: [...r.stops],
        notes: 'Collection started by the collector.',
        status: 'scheduled',
        visited: [],
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
      addLog(d, actorOf(user), 'Collection added', `${user.name} started today's collection for ${r.name}.`);
    });
    toast.success("Today's collection created. Tap Start Route to share your GPS.");
  };
  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Start routes, mark Puroks as collected and complete collections."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'today', label: 'Today', count: today.length },
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'history', label: 'History', count: history.length },
        ]}
      />
      <div className="mt-4">
        {tab === 'today' &&
          (today.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="No collection scheduled today"
                message={
                  route && route.stops.length
                    ? `You're assigned to ${route.name}. Start a collection now to share your live GPS with the admin and residents.`
                    : upcoming[0]
                      ? `Next: ${formatDayDate(upcoming[0].date)} at ${formatTime(upcoming[0].time)}`
                      : 'You have no assigned route yet. Contact the administrator.'
                }
                action={
                  route && route.stops.length ? (
                    <Button icon={<RouteIcon className="h-4 w-4" />} onClick={createTodayCollection}>
                      Start today's collection
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid gap-6 xl:grid-cols-5">
              <div className="space-y-4 xl:col-span-2">
                {today.map((s) => (
                  <Card key={s.id}>
                    <RouteSharingPanel schedule={s} />
                  </Card>
                ))}
              </div>
              <Card className="xl:col-span-3" title="Route map">
                <MapView
                  db={db}
                  routes={route ? [route] : []}
                  markers={collectorMarkers(db, [user])}
                  highlight={active?.puroks ?? today[0]?.puroks ?? []}
                  visited={active?.visited ?? []}
                  followId={active ? user.id : null}
                />
              </Card>
            </div>
          ))}
        {tab === 'upcoming' &&
          (upcoming.length === 0 ? (
            <Card>
              <EmptyState icon={<Calendar className="h-6 w-6" />} title="No upcoming collections" />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {upcoming.map((s) => (
                <MiniSchedule key={s.id} s={s} />
              ))}
            </div>
          ))}
        {tab === 'history' &&
          (history.length === 0 ? (
            <Card>
              <EmptyState icon={<Calendar className="h-6 w-6" />} title="No collection history yet" />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {history.map((s) => (
                <MiniSchedule key={s.id} s={s} />
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
function MiniSchedule({ s }) {
  const { db } = useStore();
  const p = routeProgress(s);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{formatDayDate(s.date)}</p>
          <p className="text-sm text-gray-500">
            {formatTime(s.time)} · {routeById(db, s.routeId)?.name ?? 'Custom collection'}
          </p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {s.puroks.map((x) => (
          <Badge key={x} tone={s.visited.includes(x) ? 'green' : 'gray'}>
            {s.visited.includes(x) ? '✓ ' : ''}
            {x}
          </Badge>
        ))}
      </div>
      {(s.status === 'completed' || s.status === 'missed') && (
        <div className="mt-2">
          <ProgressBar value={p.pct} />
          <p className="mt-1 text-xs text-gray-500">
            {p.done}/{p.total} Puroks collected
          </p>
        </div>
      )}
      {s.notes && <p className="mt-2 whitespace-pre-line text-xs text-gray-500">{s.notes}</p>}
      {s.missedReason && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Missed: {s.missedReason}</p>
      )}
    </div>
  );
}
/* ---------------- Add operational report ---------------- */
export function CollectorAddReport() {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [f, setF] = useState({
    type: '',
    description: '',
    location: '',
    purok: (user.puroks ?? [])[0] ?? PUROKS[0],
    image: undefined,
  });
  const [e, setE] = useState({});
  const [loading, setLoading] = useState(false);
  const mine = db.issues
    .filter((i) => i.collectorId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const submit = async (ev) => {
    ev.preventDefault();
    const err = {};
    if (!f.type) err.type = 'Select an issue type.';
    if (f.description.trim().length < 10) err.description = 'Describe the issue (at least 10 characters).';
    if (f.location.trim().length < 3) err.location = 'Location is required.';
    setE(err);
    if (Object.keys(err).length) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const code = nextCode(
      db.issues.map((i) => i.code),
      'OPS-',
      4,
    );
    commit((d) => {
      const at = nowISO();
      d.issues.unshift({
        id: uid('is-'),
        code,
        collectorId: user.id,
        type: f.type,
        description: f.description.trim(),
        location: f.location.trim(),
        purok: f.purok,
        image: f.image,
        status: 'open',
        adminNotes: '',
        createdAt: at,
        updatedAt: at,
      });
      notify(d, adminIds(d), {
        title: 'Operational issue reported',
        message: `${user.name}: ${ISSUE_TYPES[f.type]} in ${f.purok}.`,
        type: 'issue',
        link: '/admin/issues',
      });
      addLog(
        d,
        actorOf(user),
        'Operational issue reported',
        `${code}: ${ISSUE_TYPES[f.type]} at ${f.location.trim()} (${f.purok}).`,
      );
    });
    setLoading(false);
    setF({ ...f, type: '', description: '', location: '', image: undefined });
    toast.success(`Issue ${code} sent to the administrator.`);
  };
  return (
    <>
      <PageHeader
        title="Add Operational Report"
        subtitle="Report field problems such as breakdowns, obstructions or a full truck."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field label="Issue type" htmlFor="op-type" required error={e.type}>
              <Select
                id="op-type"
                value={f.type}
                onChange={(ev) => setF({ ...f, type: ev.target.value })}
                invalid={!!e.type}
              >
                <option value="">Select issue type</option>
                {Object.keys(ISSUE_TYPES).map((t) => (
                  <option key={t} value={t}>
                    {ISSUE_TYPES[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor="op-desc" required error={e.description}>
              <Textarea
                id="op-desc"
                rows={4}
                value={f.description}
                onChange={(ev) => setF({ ...f, description: ev.target.value })}
                invalid={!!e.description}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Location" htmlFor="op-loc" required error={e.location} className="sm:col-span-2">
                <Input
                  id="op-loc"
                  value={f.location}
                  onChange={(ev) => setF({ ...f, location: ev.target.value })}
                  invalid={!!e.location}
                  placeholder="Street or landmark"
                />
              </Field>
              <Field label="Purok" htmlFor="op-purok" required>
                <Select
                  id="op-purok"
                  value={f.purok}
                  onChange={(ev) => setF({ ...f, purok: ev.target.value })}
                >
                  {PUROKS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Photo (optional)</p>
              <ImageUpload id="op-img" value={f.image} onChange={(v) => setF({ ...f, image: v })} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={loading} icon={<Send className="h-4 w-4" />}>
                Submit report
              </Button>
            </div>
          </form>
        </Card>
        <Card className="lg:col-span-2" title="My submitted reports" bodyClass="p-0 sm:p-0">
          {mine.length === 0 ? (
            <EmptyState icon={<FilePlus2 className="h-6 w-6" />} title="No reports submitted" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {mine.map((i) => (
                <li key={i.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {i.code} · {ISSUE_TYPES[i.type]}
                    </p>
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-gray-600">{i.description}</p>
                  <p className="text-xs text-gray-400">
                    <MapPin className="mr-0.5 inline h-3 w-3" />
                    {i.location}, {i.purok} · {timeAgo(i.createdAt)}
                  </p>
                  {i.adminNotes && (
                    <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">
                      Admin: {i.adminNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
/* ---------------- Profile ---------------- */
export function CollectorProfile() {
  const user = useCurrentUser();
  const { changePassword } = useAuth();
  const { db, commit } = useStore();
  const toast = useToast();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pe, setPe] = useState({});
  const route = routeById(db, user.routeId);
  const truck = truckFor(db, user.id);
  const { upcoming, history } = useMyCollections();
  const changePw = async (ev) => {
    ev.preventDefault();
    const err = {};
    const p = passwordProblem(pw.next);
    if (p) err.next = p;
    if (pw.next !== pw.confirm) err.confirm = 'Passwords do not match.';
    setPe(err);
    if (Object.keys(err).length) return;
    const result = await changePassword(pw.current, pw.next);
    if (!result.ok) {
      setPe({ current: result.error });
      return;
    }
    setPw({ current: '', next: '', confirm: '' });
    toast.success('Password changed.');
  };
  return (
    <>
      <PageHeader title="My Profile" subtitle="Your details and collection responsibilities." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Personal information">
          <dl className="divide-y divide-gray-100">
            <DetailRow label="Name">{user.name}</DetailRow>
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Phone">{user.phone || '—'}</DetailRow>
            <DetailRow label="Address">{user.address || '—'}</DetailRow>
            <DetailRow label="Purok">{user.purok || '—'}</DetailRow>
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            Your details are managed by the barangay administrator. Contact them to request any changes.
          </p>
        </Card>
        <div className="space-y-6">
          <Card title="Responsibilities">
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Collector ID">{user.code}</DetailRow>
              <DetailRow label="Route">
                {route ? (
                  <>
                    {route.name}
                    <br />
                    <span className="text-xs text-gray-500">{route.stops.join(' → ')}</span>
                  </>
                ) : (
                  'None'
                )}
              </DetailRow>
              <DetailRow label="Puroks">{(user.puroks ?? []).join(', ') || 'None'}</DetailRow>
              <DetailRow label="Vehicle">
                {truck ? (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    {truck.vehicleId} · {truck.plate}
                  </span>
                ) : (
                  'None'
                )}
              </DetailRow>
              <DetailRow label="Upcoming">{upcoming.length} collection(s)</DetailRow>
              <DetailRow label="Completed">
                {history.filter((s) => s.status === 'completed').length} collection(s)
              </DetailRow>
            </dl>
            <p className="mt-2 text-xs text-gray-500">
              Route, Purok and vehicle assignments are managed by the administrator.
            </p>
          </Card>
          <Card title="Change password">
            <form onSubmit={changePw} noValidate className="space-y-3">
              <Field label="Current password" htmlFor="cpw-cur" error={pe.current}>
                <PasswordInput
                  id="cpw-cur"
                  autoComplete="current-password"
                  value={pw.current}
                  onChange={(ev) => setPw({ ...pw, current: ev.target.value })}
                  invalid={!!pe.current}
                />
              </Field>
              <Field label="New password" htmlFor="cpw-new" error={pe.next}>
                <PasswordInput
                  id="cpw-new"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(ev) => setPw({ ...pw, next: ev.target.value })}
                  invalid={!!pe.next}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="cpw-con" error={pe.confirm}>
                <PasswordInput
                  id="cpw-con"
                  autoComplete="new-password"
                  value={pw.confirm}
                  onChange={(ev) => setPw({ ...pw, confirm: ev.target.value })}
                  invalid={!!pe.confirm}
                />
              </Field>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                icon={<KeyRound className="h-4 w-4" />}
              >
                Update password
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
