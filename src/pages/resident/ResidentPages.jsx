import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FilePlus2,
  Hourglass,
  KeyRound,
  Megaphone,
  Navigation,
  Save,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '../../lib/auth';
import {
  actorOf,
  addLog,
  adminIds,
  announcementVisibleTo,
  nextCode,
  notify,
  routeById,
  scheduleSort,
  unreadCount,
  userName,
  useStore,
} from '../../lib/store';
import {
  COLLECTION_DAYS,
  COLLECTION_TIME,
  DEFAULT_ADDRESS,
  PUROKS,
  describeDays,
  purokLabel,
} from '../../lib/geography';
import {
  formatDate,
  formatDateTime,
  formatDayDate,
  formatTime,
  nowISO,
  timeAgo,
  todayISO,
} from '../../lib/time';
import { combineName, isPhone, normalizePhone, passwordProblem, splitName } from '../../lib/validation';
import { REPORT_STATUS_LABEL } from '../../lib/email';
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
  Modal,
  PageHeader,
  PasswordInput,
  SearchInput,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '../../components/ui';
import WasteCategoryPicker, { CategoryTag } from '../../components/WasteCategoryPicker';
import ReportDetails from '../../components/ReportDetails';
import { collectorEta, routeProgress } from '../../components/LiveTracking';
/* ---------------- helpers ---------------- */
function useMySchedules() {
  const user = useCurrentUser();
  const { db } = useStore();
  const t = todayISO();
  const mine = db.schedules.filter((s) => s.puroks.includes(user.purok)).sort(scheduleSort);
  const upcoming = mine.filter(
    (s) => s.date >= t && (s.status === 'scheduled' || s.status === 'in_progress'),
  );
  return { mine, upcoming };
}
function ResubmitProof({ onClose }) {
  const user = useCurrentUser();
  const { commit } = useStore();
  const toast = useToast();
  const [img, setImg] = useState();
  const [err, setErr] = useState();
  const submit = () => {
    if (!img) {
      setErr('Please upload a new proof of residency.');
      return;
    }
    commit((d) => {
      const u = d.users.find((x) => x.id === user.id);
      if (!u || u.status !== 'rejected') return;
      u.proofImage = img;
      u.status = 'pending';
      u.rejectionReason = undefined;
      u.updatedAt = nowISO();
      notify(d, adminIds(d), {
        title: 'Residency proof resubmitted',
        message: `${u.name} (${u.code}) uploaded a new proof of residency.`,
        type: 'application',
        link: '/admin/residents',
      });
      addLog(d, actorOf(user), 'Proof resubmitted', `${u.name} (${u.code}) resubmitted proof of residency.`);
    });
    toast.success('New proof submitted. Your application is pending review again.');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Submit new proof of residency"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Submit for review</Button>
        </>
      }
    >
      <ImageUpload
        id="resubmit"
        value={img}
        onChange={setImg}
        error={err}
        label="Upload barangay certificate, ID or utility bill"
      />
    </Modal>
  );
}
export function VerificationBanner() {
  const user = useCurrentUser();
  const [resubmit, setResubmit] = useState(false);
  if (user.status === 'approved') return null;
  return (
    <div className="mb-6">
      {user.status === 'pending' ? (
        <Alert tone="amber" icon={<Hourglass className="h-5 w-5" />} title="Application pending approval">
          Your proof of residency was submitted on {formatDate(user.createdAt)} and is waiting for barangay
          review. You can view schedules and announcements, but waste reporting unlocks after approval.
        </Alert>
      ) : (
        <Alert tone="red" icon={<ShieldAlert className="h-5 w-5" />} title="Application rejected">
          <p>Reason: {user.rejectionReason ?? 'No reason provided.'}</p>
          <Button
            size="sm"
            variant="danger"
            className="mt-2"
            icon={<Upload className="h-3.5 w-3.5" />}
            onClick={() => setResubmit(true)}
          >
            Submit new proof
          </Button>
        </Alert>
      )}
      {resubmit && <ResubmitProof onClose={() => setResubmit(false)} />}
    </div>
  );
}
/* ---------------- Dashboard ---------------- */
export function ResidentDashboard() {
  const user = useCurrentUser();
  const { db } = useStore();
  const { upcoming } = useMySchedules();
  const next = upcoming[0];
  const active = upcoming.find((s) => s.status === 'in_progress');
  const myReports = db.reports
    .filter((r) => r.residentId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const anns = db.announcements
    .filter((a) => announcementVisibleTo(a, user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const unread = unreadCount(db, user.id);
  const approved = user.status === 'approved';
  const eta = active?.collectorId ? collectorEta(db, active.collectorId, user.purok) : null;
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}!`}
        subtitle={`${user.address}, ${purokLabel(user.purok)}`}
        actions={
          approved ? (
            <>
              <Link to="/resident/tracking">
                <Button variant="outline" icon={<Navigation className="h-4 w-4" />}>
                  Track truck
                </Button>
              </Link>
              <Link to="/resident/report">
                <Button icon={<FilePlus2 className="h-4 w-4" />}>Report waste</Button>
              </Link>
            </>
          ) : undefined
        }
      />
      <VerificationBanner />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Residency status"
          value={<StatusBadge status={user.status ?? 'pending'} />}
          icon={
            user.status === 'approved' ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Hourglass className="h-5 w-5" />
            )
          }
          tone={user.status === 'approved' ? 'green' : user.status === 'rejected' ? 'red' : 'amber'}
          hint={user.code}
        />
        <StatCard
          label="Next collection"
          value={
            <span className="text-base">
              {next ? formatDate(next.date, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
            </span>
          }
          hint={next ? formatTime(next.time) : 'No upcoming schedule'}
          icon={<Calendar className="h-5 w-5" />}
          tone="purple"
          to="/resident/schedule"
        />
        <StatCard
          label="My open reports"
          value={myReports.filter((r) => r.status === 'pending' || r.status === 'in_progress').length}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="blue"
          to="/resident/my-reports"
        />
        <StatCard
          label="Unread notifications"
          value={unread}
          icon={<Bell className="h-5 w-5" />}
          tone="amber"
          to="/resident/notifications"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Collection status">
          {active ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    Collection in progress · {routeById(db, active.routeId)?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userName(db, active.collectorId)} · {routeProgress(active).done}/
                    {routeProgress(active).total} Puroks done
                  </p>
                  <p className="text-sm text-gray-600">
                    {active.visited.includes(user.purok)
                      ? `${user.purok} has been collected.`
                      : !approved
                        ? 'Live truck location is available once your residency is verified.'
                        : eta !== null
                          ? `Estimated arrival in ${user.purok}: ~${eta} min (rough estimate)`
                          : 'Live location not available right now.'}
                  </p>
                </div>
              </div>
              <Link to="/resident/tracking">
                <Button variant="secondary" icon={<Navigation className="h-4 w-4" />}>
                  Live tracking
                </Button>
              </Link>
            </div>
          ) : next ? (
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Next pickup: {formatDayDate(next.date)} at {formatTime(next.time)}
                </p>
                <p className="text-sm text-gray-600">
                  {routeById(db, next.routeId)?.name ?? 'Collection'} · Collector:{' '}
                  {userName(db, next.collectorId)}
                </p>
                {next.notes && <p className="mt-1 text-sm text-gray-500">{next.notes}</p>}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No upcoming collection for your Purok"
            />
          )}
        </Card>

        <Card title="Quick actions">
          <div className="flex flex-wrap gap-3">
            <Link
              to="/resident/report"
              tabIndex={-1}
              className={!approved ? 'pointer-events-none' : ''}
              aria-disabled={!approved}
            >
              <Button
                size="lg"
                variant="secondary"
                icon={<FilePlus2 className="h-5 w-5" />}
                disabled={!approved}
              >
                Report a waste problem
              </Button>
            </Link>
            <Link to="/resident/tracking" tabIndex={-1}>
              <Button size="lg" variant="secondary" icon={<Navigation className="h-5 w-5" />}>
                Track collection vehicle
              </Button>
            </Link>
            <Link to="/resident/schedule" tabIndex={-1}>
              <Button size="lg" variant="secondary" icon={<Calendar className="h-5 w-5" />}>
                View schedule
              </Button>
            </Link>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Recent reports"
          action={
            <Link to="/resident/my-reports" className="text-xs font-medium text-green-700 hover:underline">
              View all
            </Link>
          }
          bodyClass="p-0 sm:p-0"
        >
          {myReports.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No reports yet"
              message={approved ? 'Report uncollected garbage or illegal dumping in your area.' : undefined}
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {myReports.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-gray-500">{r.code}</span>
                      <CategoryTag category={r.category} />
                    </p>
                    <p className="truncate text-sm text-gray-700">{r.description}</p>
                    <p className="text-xs text-gray-400">{timeAgo(r.createdAt)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest announcements" bodyClass="p-0 sm:p-0">
          {anns.length === 0 ? (
            <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {anns.map((a) => (
                <li key={a.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                  <p className="mt-0.5 line-clamp-3 text-sm text-gray-600">{a.body}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
/* ---------------- Schedule ---------------- */
export function ResidentSchedule() {
  const user = useCurrentUser();
  const { db } = useStore();
  const [tab, setTab] = useState('upcoming');
  const [allPuroks, setAllPuroks] = useState(false);
  const t = todayISO();
  const source = db.schedules.filter((s) => allPuroks || s.puroks.includes(user.purok));
  const upcoming = source
    .filter((s) => s.date >= t && (s.status === 'scheduled' || s.status === 'in_progress'))
    .sort(scheduleSort);
  const past = source
    .filter((s) => !(s.date >= t && (s.status === 'scheduled' || s.status === 'in_progress')))
    .sort(scheduleSort)
    .reverse();
  const list = tab === 'upcoming' ? upcoming : past;
  return (
    <>
      <PageHeader
        title="Collection Schedule"
        subtitle={(() => {
          const r = db.routes.find((x) => x.stops.includes(user.purok));
          return r
            ? `${user.purok} is collected ${(r.days ?? COLLECTION_DAYS).length}× a week — every ${describeDays(r.days ?? COLLECTION_DAYS)} starting ${formatTime(r.time ?? COLLECTION_TIME)} (${r.name}).`
            : `Regular collection every ${describeDays(COLLECTION_DAYS)}.`;
        })()}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'completed', label: 'Past & completed', count: past.length },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allPuroks}
            onChange={(e) => setAllPuroks(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />{' '}
          Show all Puroks (not only {user.purok})
        </label>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Calendar className="h-6 w-6" />} title="No schedules to show" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s) => (
            <ScheduleCard key={s.id} s={s} highlight={user.purok} />
          ))}
        </div>
      )}
    </>
  );
}
function ScheduleCard({ s, highlight }) {
  const { db } = useStore();
  const route = routeById(db, s.routeId);
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${s.date === todayISO() ? 'border-green-400' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {formatDayDate(s.date)}
            {s.date === todayISO() && (
              <Badge tone="green" className="ml-2">
                Today
              </Badge>
            )}
          </p>
          <p className="text-sm text-gray-500">
            {formatTime(s.time)} · {route?.name ?? 'Collection'}
          </p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {s.puroks.map((p) => (
          <Badge key={p} tone={p === highlight ? 'green' : 'gray'}>
            {s.visited.includes(p) ? '✓ ' : ''}
            {p}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Collector: {userName(db, s.collectorId)}
        {route ? ` · Route stops: ${route.stops.join(' → ')}` : ''}
      </p>
      {s.notes && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {s.notes}
        </p>
      )}
      {s.missedReason && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Missed: {s.missedReason}</p>
      )}
    </div>
  );
}
/* ---------------- Report waste ---------------- */
export function ResidentReport() {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({
    category: '',
    description: '',
    location: DEFAULT_ADDRESS,
    purok: user.purok,
    image: undefined,
  });
  const [e, setE] = useState({});
  const [loading, setLoading] = useState(false);
  if (user.status !== 'approved') {
    return (
      <>
        <PageHeader title="Report Waste" />
        <VerificationBanner />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6" />}
            title="Reporting is available to verified residents only"
            message="Once the barangay approves your proof of residency, you can submit waste reports here."
          />
        </Card>
      </>
    );
  }
  const submit = async (ev) => {
    ev.preventDefault();
    const err = {};
    if (!f.category) err.category = 'Select a waste category.';
    if (f.description.trim().length < 10) err.description = 'Describe the problem (at least 10 characters).';
    if (f.location.trim().length < 3) err.location = 'Location or street address is required.';
    if (!f.purok) err.purok = 'Select a Purok.';
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    if (
      !err.location &&
      db.reports.some(
        (r) =>
          r.residentId === user.id &&
          r.status === 'pending' &&
          r.category === f.category &&
          r.location.trim().toLowerCase() === f.location.trim().toLowerCase() &&
          new Date(r.createdAt).getTime() > dayAgo,
      )
    )
      err.location = 'You already have a pending report of this category at this location (last 24 hours).';
    setE(err);
    if (Object.keys(err).length) {
      toast.error('Please complete the required fields.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const code = nextCode(
      db.reports.map((r) => r.code),
      `WR-${new Date().getFullYear()}-`,
      4,
    );
    commit((d) => {
      const at = nowISO();
      d.reports.push({
        id: uid('wr-'),
        code,
        residentId: user.id,
        category: f.category,
        description: f.description.trim(),
        location: f.location.trim(),
        purok: f.purok,
        image: f.image,
        status: 'pending',
        collectorId: null,
        resolutionNotes: '',
        createdAt: at,
        updatedAt: at,
        history: [{ status: 'pending', at, by: user.name, note: 'Report submitted' }],
      });
      notify(d, adminIds(d), {
        title: 'New waste report',
        message: `${code}: ${f.description.trim().slice(0, 80)} (${f.purok})`,
        type: 'report',
        link: '/admin/reports',
      });
      addLog(
        d,
        actorOf(user),
        'Report submitted',
        `${user.name} submitted ${code} (${f.category}) in ${f.purok}.`,
      );
    });
    setLoading(false);
    toast.success(`Report ${code} submitted. You'll be notified about updates.`);
    navigate('/resident/my-reports');
  };
  return (
    <>
      <PageHeader
        title="Report Waste"
        subtitle="Tell the barangay about uncollected garbage, illegal dumping or hazardous waste."
      />
      <Card className="max-w-3xl">
        <form onSubmit={submit} noValidate className="space-y-5">
          <WasteCategoryPicker
            value={f.category}
            onChange={(v) => setF({ ...f, category: v })}
            error={e.category}
          />
          <Field label="Description of the problem" htmlFor="rp-desc" required error={e.description}>
            <Textarea
              id="rp-desc"
              rows={4}
              value={f.description}
              onChange={(ev) => setF({ ...f, description: ev.target.value })}
              invalid={!!e.description}
              placeholder="What is the problem and how long has it been there?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Location"
              htmlFor="rp-loc"
              hint="Set automatically — choose your Purok below."
              className="sm:col-span-2"
            >
              <Input id="rp-loc" value={f.location} readOnly aria-readonly className="bg-gray-50 text-gray-600" />
            </Field>
            <Field label="Purok" htmlFor="rp-purok" required error={e.purok}>
              <Select id="rp-purok" value={f.purok} onChange={(ev) => setF({ ...f, purok: ev.target.value })}>
                {PUROKS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Photo (optional)</p>
            <ImageUpload
              id="rp-img"
              value={f.image}
              onChange={(v) => setF({ ...f, image: v })}
              label="Attach a photo of the waste"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={loading} icon={<FilePlus2 className="h-4 w-4" />}>
              {loading ? 'Submitting…' : 'Submit report'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
/* ---------------- My reports ---------------- */
export function ResidentMyReports() {
  const user = useCurrentUser();
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const mine = db.reports.filter((r) => r.residentId === user.id);
  const list = mine
    .filter((r) => !status || r.status === status)
    .filter((r) => {
      const s = q.trim().toLowerCase();
      return (
        !s ||
        r.code.toLowerCase().includes(s) ||
        r.description.toLowerCase().includes(s) ||
        r.location.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = mine.find((r) => r.id === openId);
  return (
    <>
      <PageHeader
        title="My Reports"
        subtitle="Track the status of the waste reports you submitted."
        actions={
          user.status === 'approved' ? (
            <Link to="/resident/report">
              <Button icon={<FilePlus2 className="h-4 w-4" />}>New report</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search ID, description, location"
          className="sm:w-72"
        />
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All statuses</option>
          {Object.keys(REPORT_STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {REPORT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={mine.length ? 'No reports match your filters' : 'You have not submitted any reports'}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-700">{r.code}</span>
                  <CategoryTag category={r.category} />
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-700">{r.description}</p>
              <p className="mt-1 text-xs text-gray-500">
                {r.location} · {r.purok}
              </p>
              {r.status === 'rejected' && r.rejectionReason && (
                <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                  Rejected: {r.rejectionReason}
                </p>
              )}
              {r.resolutionNotes && (
                <p className="mt-2 rounded bg-green-50 px-2 py-1 text-xs text-green-800">
                  {r.resolutionNotes}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-400">Submitted {formatDateTime(r.createdAt)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Eye className="h-4 w-4" />}
                  aria-label={`View ${r.code} details`}
                  title="View details"
                  onClick={() => setOpenId(r.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={`Report ${open?.code ?? ''}`} size="lg">
        {open && <ReportDetails db={db} report={open} showResident={false} />}
      </Modal>
    </>
  );
}
/* ---------------- Profile ---------------- */
export function ResidentProfile() {
  const user = useCurrentUser();
  const { changePassword } = useAuth();
  const { commit } = useStore();
  const toast = useToast();
  const pName = splitName(user.name);
  const [f, setF] = useState({
    firstName: pName.first,
    lastName: pName.last,
    phone: user.phone,
    address: user.address,
  });
  const [e, setE] = useState({});
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pe, setPe] = useState({});
  const save = (ev) => {
    ev.preventDefault();
    const err = {};
    if (f.firstName.trim().length < 2) err.firstName = 'First name is required.';
    if (f.lastName.trim().length < 2) err.lastName = 'Last name is required.';
    if (!isPhone(f.phone)) err.phone = 'Enter a valid PH mobile number.';
    if (f.address.trim().length < 5) err.address = 'Address is required.';
    setE(err);
    if (Object.keys(err).length) return;
    commit((d) => {
      const u = d.users.find((x) => x.id === user.id);
      if (!u) return;
      Object.assign(u, {
        name: combineName(f.firstName, f.lastName),
        phone: normalizePhone(f.phone),
        address: f.address.trim(),
        updatedAt: nowISO(),
      });
      addLog(d, actorOf(user), 'Profile updated', `${u.name} updated their profile.`);
    });
    toast.success('Profile saved.');
  };
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
      <PageHeader title="My Profile" subtitle="Update your contact details." />
      <VerificationBanner />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Personal information">
          <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="pf-first" required error={e.firstName}>
              <Input
                id="pf-first"
                value={f.firstName}
                onChange={(ev) => setF({ ...f, firstName: ev.target.value })}
                invalid={!!e.firstName}
              />
            </Field>
            <Field label="Last name" htmlFor="pf-last" required error={e.lastName}>
              <Input
                id="pf-last"
                value={f.lastName}
                onChange={(ev) => setF({ ...f, lastName: ev.target.value })}
                invalid={!!e.lastName}
              />
            </Field>
            <Field label="Phone number" htmlFor="pf-phone" required error={e.phone}>
              <Input
                id="pf-phone"
                value={f.phone}
                onChange={(ev) => setF({ ...f, phone: ev.target.value })}
                invalid={!!e.phone}
              />
            </Field>
            <Field label="Email address" htmlFor="pf-email" hint="Contact the barangay to change your email.">
              <Input id="pf-email" value={user.email} disabled />
            </Field>
            <Field
              label="Complete address"
              htmlFor="pf-addr"
              required
              error={e.address}
              className="sm:col-span-2"
            >
              <Textarea
                id="pf-addr"
                rows={2}
                value={f.address}
                onChange={(ev) => setF({ ...f, address: ev.target.value })}
                invalid={!!e.address}
              />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" icon={<Save className="h-4 w-4" />}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title="Account">
            <dl className="divide-y divide-gray-100">
              <DetailRow label="Resident ID">{user.code}</DetailRow>
              <DetailRow label="Role">
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5" /> Resident
                </span>
              </DetailRow>
              <DetailRow label="Purok">{purokLabel(user.purok)}</DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={user.status ?? 'pending'} />
              </DetailRow>
              <DetailRow label="Registered">{formatDate(user.createdAt)}</DetailRow>
              {user.reviewedAt && <DetailRow label="Reviewed">{formatDate(user.reviewedAt)}</DetailRow>}
            </dl>
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Role, Purok and approval status are managed by the
              barangay.
            </p>
          </Card>
          <Card title="Change password">
            <form onSubmit={changePw} noValidate className="space-y-3">
              <Field label="Current password" htmlFor="pw-cur" error={pe.current}>
                <PasswordInput
                  id="pw-cur"
                  autoComplete="current-password"
                  value={pw.current}
                  onChange={(ev) => setPw({ ...pw, current: ev.target.value })}
                  invalid={!!pe.current}
                />
              </Field>
              <Field label="New password" htmlFor="pw-new" error={pe.next}>
                <PasswordInput
                  id="pw-new"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(ev) => setPw({ ...pw, next: ev.target.value })}
                  invalid={!!pe.next}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-con" error={pe.confirm}>
                <PasswordInput
                  id="pw-con"
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
