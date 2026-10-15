import { useState } from 'react';
import { Ban, Calendar, CalendarPlus } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import {
  actorOf,
  addLog,
  approvedResidentIds,
  ensureGps,
  notify,
  residentIdsInPuroks,
  routeById,
  scheduleSort,
  userName,
  useStore,
} from '../../lib/store';
import { sortPuroks } from '../../lib/geography';
import {
  addDays,
  formatDayDate,
  formatTime,
  isPast,
  isValidISODate,
  isValidTime,
  nowISO,
  todayISO,
} from '../../lib/time';
import { SCHEDULE_STATUS_LABEL, templates } from '../../lib/email';
import { uid } from '../../lib/storage';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EditButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PurokPicker,
  Select,
  StatusBadge,
  TableWrap,
  Textarea,
  td,
  th,
  useToast,
} from '../../components/ui';
function resetGpsIfActive(d, s) {
  if (!s.collectorId) return;
  const g = ensureGps(d, s.collectorId);
  if (g.scheduleId === s.id)
    Object.assign(g, { state: 'available', sharing: false, scheduleId: null, updatedAt: nowISO() });
}
export default function AdminSchedules() {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [statusF, setStatusF] = useState('');
  const [routeF, setRouteF] = useState('');
  const [form, setForm] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [missedId, setMissedId] = useState(null);
  const today = todayISO();
  const isUpcoming = (s) => s.date >= today && (s.status === 'scheduled' || s.status === 'in_progress');
  // Upcoming/active schedules first (soonest first), then past & closed ones (most recent first).
  const list = db.schedules
    .filter((s) => !statusF || s.status === statusF)
    .filter((s) => !routeF || s.routeId === routeF)
    .sort((a, b) => {
      const ua = isUpcoming(a),
        ub = isUpcoming(b);
      if (ua !== ub) return ua ? -1 : 1;
      return ua ? scheduleSort(a, b) : scheduleSort(b, a);
    });
  const cancel = (reason) => {
    const s = db.schedules.find((x) => x.id === cancelId);
    if (!s) return;
    commit((d) => {
      const x = d.schedules.find((y) => y.id === s.id);
      x.status = 'cancelled';
      x.notes = `${x.notes ? x.notes + '\n' : ''}Cancelled: ${reason}`;
      x.updatedAt = nowISO();
      resetGpsIfActive(d, x);
      const when = `${formatDayDate(x.date)} ${formatTime(x.time)}`;
      notify(d, [...residentIdsInPuroks(d, x.puroks), ...(x.collectorId ? [x.collectorId] : [])], {
        ...templates.scheduleChange('cancelled', `${when} — ${reason}`),
        type: 'schedule',
      });
      addLog(
        d,
        actorOf(admin),
        'Schedule cancelled',
        `Cancelled collection on ${when} (${x.puroks.join(', ')}): ${reason}`,
      );
    });
    setCancelId(null);
    toast.success('Schedule cancelled. Affected users were notified.');
  };
  const setStatus = (s, status, reason = '') => {
    commit((d) => {
      const x = d.schedules.find((y) => y.id === s.id);
      x.status = status;
      x.updatedAt = nowISO();
      if (status === 'completed') {
        x.completedAt = nowISO();
        x.visited = [...x.puroks];
      }
      if (status === 'missed') x.missedReason = reason;
      if (status !== 'in_progress') resetGpsIfActive(d, x);
      addLog(
        d,
        actorOf(admin),
        'Schedule status changed',
        `${formatDayDate(x.date)} ${routeById(d, x.routeId)?.name ?? ''}: ${SCHEDULE_STATUS_LABEL[s.status]} → ${SCHEDULE_STATUS_LABEL[status]}${reason ? ` (${reason})` : ''}.`,
      );
      if (status === 'missed')
        notify(d, residentIdsInPuroks(d, x.puroks), {
          title: 'Collection missed in your area',
          message: `The collection on ${formatDayDate(x.date)} was missed. Reason: ${reason}`,
          type: 'schedule',
          link: '/resident/schedule',
        });
    });
    setMissedId(null);
    toast.success(`Schedule marked as ${SCHEDULE_STATUS_LABEL[status].toLowerCase()}.`);
  };
  const missedSched = db.schedules.find((s) => s.id === missedId);
  return (
    <>
      <PageHeader
        title="Collection Schedules"
        subtitle="Regular collection: every Monday & Thursday at 7:30 AM."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Schedules' }]}
        actions={
          <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setForm({ id: null })}>
            New schedule
          </Button>
        }
      />
      <Card bodyClass="p-0 sm:p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm text-gray-500">
            {list.length} schedule{list.length === 1 ? '' : 's'}
            {statusF || routeF ? ' (filtered)' : ''}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              aria-label="Filter status"
              value={statusF}
              onChange={(e) => setStatusF(e.target.value)}
              className="sm:w-44"
            >
              <option value="">All statuses</option>
              {Object.keys(SCHEDULE_STATUS_LABEL).map((s) => (
                <option key={s} value={s}>
                  {SCHEDULE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter route"
              value={routeF}
              onChange={(e) => setRouteF(e.target.value)}
              className="sm:w-44"
            >
              <option value="">All routes</option>
              {db.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No schedules"
            message="Create a schedule or generate the default Monday & Thursday collections."
          />
        ) : (
          <div className="px-4 sm:px-5">
            <TableWrap>
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Date &amp; time</th>
                  <th className={th}>Route</th>
                  <th className={th}>Collector</th>
                  <th className={th}>Puroks</th>
                  <th className={th}>Status</th>
                  <th className={th}>Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => {
                  const closed = s.status === 'cancelled' || s.status === 'completed';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60">
                      <td className={td}>
                        <p className="whitespace-nowrap font-medium text-gray-900">{formatDayDate(s.date)}</p>
                        <p className="text-xs text-gray-500">
                          {formatTime(s.time)}
                          {s.date === today && (
                            <Badge tone="green" className="ml-1">
                              Today
                            </Badge>
                          )}
                        </p>
                      </td>
                      <td className={td}>
                        {routeById(db, s.routeId)?.name ?? <span className="text-gray-400">None</span>}
                      </td>
                      <td className={td}>{userName(db, s.collectorId)}</td>
                      <td className={td}>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {s.puroks.map((p) => (
                            <Badge key={p} tone={s.visited.includes(p) ? 'green' : 'gray'}>
                              {p.replace('Purok ', 'P')}
                            </Badge>
                          ))}
                        </div>
                        {s.notes && (
                          <p className="mt-1 max-w-[240px] truncate text-xs text-gray-500" title={s.notes}>
                            {s.notes}
                          </p>
                        )}
                      </td>
                      <td className={td}>
                        <StatusBadge status={s.status} />
                        {s.missedReason && (
                          <p
                            className="mt-1 max-w-[180px] truncate text-xs text-red-600"
                            title={s.missedReason}
                          >
                            {s.missedReason}
                          </p>
                        )}
                      </td>
                      <td className={td}>
                        {closed ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Select
                              aria-label="Change status"
                              className="h-9 w-36 text-xs"
                              value=""
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'missed') setMissedId(s.id);
                                else if (v) setStatus(s, v);
                              }}
                            >
                              <option value="">Set status…</option>
                              {s.status !== 'scheduled' && <option value="scheduled">Scheduled</option>}
                              {s.status !== 'in_progress' && <option value="in_progress">In Progress</option>}
                              <option value="completed">Completed</option>
                              {s.status !== 'missed' && <option value="missed">Missed</option>}
                            </Select>
                            <EditButton
                              label={`Edit schedule on ${formatDayDate(s.date)}`}
                              onClick={() => setForm({ id: s.id })}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-9 px-0 text-red-600 hover:bg-red-50"
                              icon={<Ban className="h-4 w-4" />}
                              onClick={() => setCancelId(s.id)}
                              aria-label="Cancel collection"
                              title="Cancel collection"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </div>
        )}
      </Card>
      {form && <ScheduleForm id={form.id} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel this collection?"
        message="Residents in the affected Puroks and the assigned collector will be notified."
        confirmLabel="Cancel collection"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Holiday / road closure"
        onConfirm={cancel}
        onCancel={() => setCancelId(null)}
      />
      <ConfirmDialog
        open={!!missedId}
        title="Mark as missed"
        message="Affected residents will be notified."
        confirmLabel="Mark missed"
        reasonLabel="Reason"
        onConfirm={(r) => missedSched && setStatus(missedSched, 'missed', r)}
        onCancel={() => setMissedId(null)}
      />
    </>
  );
}
function ScheduleForm({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const ex = id ? db.schedules.find((s) => s.id === id) : undefined;
  const nextDay = addDays(new Date(), 1);
  const [f, setF] = useState({
    date:
      ex?.date ??
      `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`,
    time: ex?.time ?? '07:30',
    routeId: ex?.routeId ?? '',
    collectorId: ex?.collectorId ?? '',
    puroks: ex?.puroks ?? [],
    notes: ex?.notes ?? '',
  });
  const [e, setE] = useState({});
  const collectors = db.users.filter((u) => u.role === 'collector' && u.active);
  const pickRoute = (routeId) => {
    const r = routeById(db, routeId);
    setF((s) => ({
      ...s,
      routeId,
      collectorId: r?.collectorId ?? s.collectorId,
      puroks: r ? [...r.stops] : s.puroks,
      time: r?.time ?? s.time,
    }));
  };
  const save = () => {
    const err = {};
    if (!isValidISODate(f.date)) err.date = 'Select a valid date.';
    if (!isValidTime(f.time)) err.time = 'Select a valid time.';
    if (!err.date && !err.time && isPast(f.date, f.time) && (!ex || ex.date !== f.date || ex.time !== f.time))
      err.date = 'Date and time must be in the future.';
    if (!f.puroks.length) err.puroks = 'Select at least one Purok.';
    if (!f.collectorId) err.collectorId = 'Assign a collector.';
    const others = db.schedules.filter((s) => s.id !== id && s.status !== 'cancelled' && s.date === f.date);
    if (!err.date) {
      if (f.routeId && others.some((s) => s.routeId === f.routeId))
        err.routeId = 'This route already has a collection on this date.';
      if (f.collectorId && others.some((s) => s.collectorId === f.collectorId && s.time === f.time))
        err.collectorId = 'This collector already has a collection at this time.';
      const overlap = others
        .filter((s) => s.time === f.time)
        .flatMap((s) => s.puroks.filter((p) => f.puroks.includes(p)));
      if (overlap.length)
        err.puroks = `Conflicts with another schedule at the same time for ${Array.from(new Set(overlap)).join(', ')}.`;
    }
    setE(err);
    if (Object.keys(err).length) return;
    commit((d) => {
      const when = `${formatDayDate(f.date)} ${formatTime(f.time)}`;
      let s = ex ? d.schedules.find((x) => x.id === ex.id) : undefined;
      if (!s) {
        s = {
          id: uid('sc-'),
          date: f.date,
          time: f.time,
          routeId: null,
          collectorId: null,
          puroks: [],
          notes: '',
          status: 'scheduled',
          visited: [],
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        d.schedules.push(s);
      }
      const affected = Array.from(new Set([...(ex?.puroks ?? []), ...f.puroks]));
      Object.assign(s, {
        date: f.date,
        time: f.time,
        routeId: f.routeId || null,
        collectorId: f.collectorId || null,
        puroks: sortPuroks(f.puroks),
        notes: f.notes.trim(),
        updatedAt: nowISO(),
      });
      // A new schedule is announced to every approved resident; an edit notifies only the affected Puroks.
      const residentRecipients = ex ? residentIdsInPuroks(d, affected) : approvedResidentIds(d);
      const recipients = [
        ...residentRecipients,
        f.collectorId,
        ...(ex?.collectorId && ex.collectorId !== f.collectorId ? [ex.collectorId] : []),
      ].filter(Boolean);
      notify(d, recipients, {
        ...templates.scheduleChange(ex ? 'updated' : 'created', `${when} (${f.puroks.join(', ')})`),
        type: 'schedule',
        link: '/resident/schedule',
      });
      addLog(
        d,
        actorOf(admin),
        ex ? 'Schedule updated' : 'Schedule created',
        `${ex ? 'Updated' : 'Created'} collection on ${when} for ${f.puroks.join(', ')} · ${userName(d, f.collectorId)}.`,
      );
    });
    toast.success(
      ex ? 'Schedule updated. Affected users notified.' : 'Schedule created. All residents notified.',
    );
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={ex ? 'Edit schedule' : 'New collection schedule'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{ex ? 'Save changes' : 'Create schedule'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="s-date" required error={e.date}>
          <Input
            id="s-date"
            type="date"
            min={todayISO()}
            value={f.date}
            onChange={(ev) => setF({ ...f, date: ev.target.value })}
            invalid={!!e.date}
          />
        </Field>
        <Field label="Time" htmlFor="s-time" required error={e.time}>
          <Input
            id="s-time"
            type="time"
            value={f.time}
            onChange={(ev) => setF({ ...f, time: ev.target.value })}
            invalid={!!e.time}
          />
        </Field>
        <Field label="Route" htmlFor="s-route" error={e.routeId}>
          <Select
            id="s-route"
            value={f.routeId}
            onChange={(ev) => pickRoute(ev.target.value)}
            invalid={!!e.routeId}
          >
            <option value="">No route (custom)</option>
            {db.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Collector" htmlFor="s-col" required error={e.collectorId}>
          <Select
            id="s-col"
            value={f.collectorId}
            onChange={(ev) => setF({ ...f, collectorId: ev.target.value })}
            invalid={!!e.collectorId}
          >
            <option value="">Select collector</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium text-gray-700">
            Puroks <span className="text-red-600">*</span>
          </p>
          <PurokPicker
            allOption
            value={f.puroks}
            onChange={(v) => setF({ ...f, puroks: v })}
            invalid={!!e.puroks}
          />
          {e.puroks && <p className="mt-1 text-xs text-red-600">{e.puroks}</p>}
        </div>
        <Field label="Notes (optional)" htmlFor="s-notes" className="sm:col-span-2">
          <Textarea
            id="s-notes"
            value={f.notes}
            onChange={(ev) => setF({ ...f, notes: ev.target.value })}
            placeholder="e.g. Recyclables only"
          />
        </Field>
      </div>
    </Modal>
  );
}
