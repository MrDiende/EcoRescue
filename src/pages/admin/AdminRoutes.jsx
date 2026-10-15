import { useState } from 'react';
import { ArrowDown, ArrowUp, MapPin, Plus, Route as RouteIcon, Trash2, X } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, notify, routeById, userName, useStore } from '../../lib/store';
import {
  BASE,
  COLLECTION_DAYS,
  COLLECTION_TIME,
  PUROKS,
  PUROK_INFO,
  WEEKDAY_SHORT,
  describeDays,
  purokLabel,
  purokSuffix,
  sortPuroks,
} from '../../lib/geography';
import { formatTime, isValidTime } from '../../lib/time';
import { Calendar } from 'lucide-react';
import { orderByNearestFromBase, routeDistanceKm } from '../../lib/geo';
import { nowISO, todayISO } from '../../lib/time';
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
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
import { routeColor } from '../../components/LiveTracking';
import { MapView } from '../../components/OsmMap';
export default function AdminRoutes() {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [focus, setFocus] = useState(null);
  const today = todayISO();
  const shown = focus ? db.routes.filter((r) => r.id === focus) : db.routes;
  const delRoute = routeById(db, del);
  const delUpcoming = db.schedules.filter(
    (s) => s.routeId === del && s.date >= today && s.status === 'scheduled',
  ).length;
  const remove = () => {
    if (!delRoute) return;
    commit((d) => {
      d.routes = d.routes.filter((r) => r.id !== delRoute.id);
      d.users.forEach((u) => {
        if (u.routeId === delRoute.id) u.routeId = null;
      });
      d.schedules.forEach((s) => {
        if (s.routeId === delRoute.id) s.routeId = null;
      });
      addLog(d, actorOf(admin), 'Route deleted', `Deleted route ${delRoute.name}.`);
    });
    if (focus === delRoute.id) setFocus(null);
    setDel(null);
    toast.success('Route deleted.');
  };
  const covered = new Set(db.routes.flatMap((r) => r.stops));
  const uncovered = PUROKS.filter((p) => !covered.has(p));
  return (
    <>
      <PageHeader
        title="Routes"
        subtitle={`All routes start at the ${BASE.name}.`}
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Routes' }]}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ id: null })}>
            Add route
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          {uncovered.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/20">
              Not covered by any route: {uncovered.join(', ')}
            </div>
          )}
          {db.routes.length === 0 ? (
            <Card>
              <EmptyState
                icon={<RouteIcon className="h-6 w-6" />}
                title="No routes yet"
                message="Use the Add route button above to create one."
              />
            </Card>
          ) : (
            db.routes.map((r) => {
              const upcoming = db.schedules.filter(
                (s) =>
                  s.routeId === r.id &&
                  s.date >= today &&
                  (s.status === 'scheduled' || s.status === 'in_progress'),
              ).length;
              return (
                <div
                  key={r.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm transition ${focus === r.id ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="text-left"
                      onClick={() => setFocus(focus === r.id ? null : r.id)}
                      aria-pressed={focus === r.id}
                    >
                      <p className="flex items-center gap-2 font-semibold text-gray-900">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: routeColor(db, r.id) }}
                        />
                        {r.name}
                      </p>
                      {r.description && <p className="mt-0.5 text-sm text-gray-500">{r.description}</p>}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <EditButton label={`Edit ${r.name}`} onClick={() => setForm({ id: r.id })} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-8 px-0 text-red-600 hover:bg-red-50"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setDel(r.id)}
                        aria-label={`Delete ${r.name}`}
                        title="Delete"
                      />
                    </div>
                  </div>
                  <ol className="mt-3 flex flex-wrap items-center gap-1 text-xs">
                    <li>
                      <Badge tone="green">Base</Badge>
                    </li>
                    {r.stops.map((s) => (
                      <li key={s} className="flex items-center gap-1">
                        <span className="text-gray-300">→</span>
                        <Badge tone="gray">{s}</Badge>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-semibold">{(r.days ?? COLLECTION_DAYS).length}× a week</span>
                    <span>
                      · every {describeDays(r.days ?? COLLECTION_DAYS)} at{' '}
                      {formatTime(r.time ?? COLLECTION_TIME)}
                    </span>
                    {r.stops.length === PUROKS.length && <Badge tone="green">All Puroks 1–8</Badge>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <p>
                      <span className="block text-gray-400">Collector</span>
                      {userName(db, r.collectorId)}
                    </p>
                    <p>
                      <span className="block text-gray-400">Distance</span>
                      {routeDistanceKm(r.stops).toFixed(2)} km
                    </p>
                    <p>
                      <span className="block text-gray-400">Upcoming</span>
                      {upcoming} schedule(s)
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <Card
          className="xl:col-span-3"
          title={focus ? `Map · ${routeById(db, focus)?.name}` : 'Map · all routes'}
          action={
            focus && (
              <Button size="sm" variant="ghost" onClick={() => setFocus(null)}>
                Show all
              </Button>
            )
          }
        >
          <MapView db={db} routes={shown} markers={[]} highlight={shown.flatMap((r) => r.stops)} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
            {PUROKS.map((p) => (
              <p key={p} className="flex items-start gap-1">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                <span>
                  <b>{p}</b>
                  {purokSuffix(p)}
                  <br />
                  <span className="font-mono text-[10px] text-gray-400">
                    {PUROK_INFO[p].lat.toFixed(4)}, {PUROK_INFO[p].lng.toFixed(4)}
                  </span>
                </span>
              </p>
            ))}
          </div>
        </Card>
      </div>
      {form && <RouteForm id={form.id} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!del}
        title={`Delete ${delRoute?.name}?`}
        message={
          <>
            This removes the route and unassigns its collector.
            {delUpcoming > 0 && (
              <>
                {' '}
                <b>{delUpcoming}</b> upcoming schedule(s) will keep their Puroks but lose the route link.
              </>
            )}
          </>
        }
        confirmLabel="Delete route"
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </>
  );
}
function RouteForm({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const ex = routeById(db, id);
  const [f, setF] = useState({
    name: ex?.name ?? '',
    description: ex?.description ?? '',
    collectorId: ex?.collectorId ?? '',
    stops: ex?.stops ?? [],
    days: ex?.days ?? [...COLLECTION_DAYS],
    time: ex?.time ?? COLLECTION_TIME,
  });
  const toggleDay = (d) =>
    setF((s) => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort((a, b) => a - b),
    }));
  const [e, setE] = useState({});
  const [add, setAdd] = useState('');
  const collectors = db.users.filter((u) => u.role === 'collector' && u.active);
  const move = (i, dir) =>
    setF((s) => {
      const st = [...s.stops];
      const j = i + dir;
      if (j < 0 || j >= st.length) return s;
      [st[i], st[j]] = [st[j], st[i]];
      return { ...s, stops: st };
    });
  const save = () => {
    const err = {};
    if (f.name.trim().length < 3) err.name = 'Route name is required (3+ characters).';
    else if (db.routes.some((r) => r.id !== id && r.name.toLowerCase() === f.name.trim().toLowerCase()))
      err.name = 'A route with this name already exists.';
    if (!f.stops.length) err.stops = 'Add at least one Purok stop.';
    if (!f.days.length) err.days = 'Select at least one collection day.';
    if (!isValidTime(f.time)) err.time = 'Select a valid start time.';
    setE(err);
    if (Object.keys(err).length) return;
    const rid = id ?? uid('rt-');
    commit((d) => {
      let r = d.routes.find((x) => x.id === rid);
      const prevCollector = r?.collectorId ?? null;
      if (!r) {
        r = {
          id: rid,
          name: '',
          description: '',
          collectorId: null,
          stops: [],
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        d.routes.push(r);
      }
      Object.assign(r, {
        name: f.name.trim(),
        description: f.description.trim(),
        collectorId: f.collectorId || null,
        stops: f.stops,
        days: f.days,
        time: f.time,
        updatedAt: nowISO(),
      });
      if (prevCollector && prevCollector !== f.collectorId) {
        const u = d.users.find((x) => x.id === prevCollector);
        if (u && u.routeId === rid) u.routeId = null;
      }
      if (f.collectorId) {
        const u = d.users.find((x) => x.id === f.collectorId);
        if (u.routeId && u.routeId !== rid) {
          const other = d.routes.find((x) => x.id === u.routeId);
          if (other) other.collectorId = null;
        }
        u.routeId = rid;
        u.puroks = sortPuroks(Array.from(new Set([...(u.puroks ?? []), ...f.stops])));
        const t = todayISO();
        d.schedules.forEach((s) => {
          if (s.routeId === rid && s.status === 'scheduled' && s.date >= t) s.collectorId = f.collectorId;
        });
        if (prevCollector !== f.collectorId)
          notify(d, [u.id], {
            title: 'Route assignment',
            message: `You were assigned to ${r.name}.`,
            type: 'schedule',
            link: '/collector/collections',
          });
      }
      addLog(
        d,
        actorOf(admin),
        id ? 'Route updated' : 'Route created',
        `${id ? 'Updated' : 'Created'} route ${r.name}: ${f.stops.join(' → ')} · every ${describeDays(f.days)} at ${formatTime(f.time)}.`,
      );
    });
    toast.success(
      `${id ? 'Route updated' : 'Route created'}. Use “Generate defaults” on the Schedules page to create upcoming ${describeDays(f.days, true)} collections.`,
    );
    onClose();
  };
  const available = PUROKS.filter((p) => !f.stops.includes(p));
  return (
    <Modal
      open
      onClose={onClose}
      title={id ? `Edit ${ex?.name}` : 'Add route'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{id ? 'Save changes' : 'Create route'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Route name" htmlFor="rt-name" required error={e.name}>
          <Input
            id="rt-name"
            value={f.name}
            onChange={(ev) => setF({ ...f, name: ev.target.value })}
            invalid={!!e.name}
          />
        </Field>
        <Field label="Assigned collector" htmlFor="rt-col">
          <Select
            id="rt-col"
            value={f.collectorId}
            onChange={(ev) => setF({ ...f, collectorId: ev.target.value })}
          >
            <option value="">Unassigned</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.routeId && c.routeId !== id ? ` (on ${routeById(db, c.routeId)?.name})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description (optional)" htmlFor="rt-desc" className="sm:col-span-2">
          <Textarea
            id="rt-desc"
            rows={2}
            value={f.description}
            onChange={(ev) => setF({ ...f, description: ev.target.value })}
            placeholder="e.g. Covers the market area and main road."
          />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium text-gray-700">
            Weekly collection days <span className="text-red-600">*</span>{' '}
            <span className="font-normal text-gray-500">· {f.days.length}× a week</span>
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Collection days">
            {WEEKDAY_SHORT.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={f.days.includes(i)}
                onClick={() => toggleDay(i)}
                className={`w-12 rounded-lg border py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${f.days.includes(i) ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-green-400'}`}
              >
                {d}
              </button>
            ))}
          </div>
          {e.days && <p className="mt-1 text-xs text-red-600">{e.days}</p>}
        </div>
        <Field label="Start time" htmlFor="rt-time" required error={e.time}>
          <Input
            id="rt-time"
            type="time"
            value={f.time}
            onChange={(ev) => setF({ ...f, time: ev.target.value })}
            invalid={!!e.time}
          />
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">
              Stops (in order) <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-1">
              {f.stops.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setF({ ...f, stops: orderByNearestFromBase(f.stops) })}
                >
                  Order nearest first
                </Button>
              )}
              {f.stops.length < PUROKS.length && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setF({
                      ...f,
                      stops: orderByNearestFromBase([
                        ...f.stops,
                        ...PUROKS.filter((p) => !f.stops.includes(p)),
                      ]),
                    })
                  }
                >
                  Add all Puroks 1–8
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="px-2 py-1 text-xs text-gray-500">Start: {BASE.name}</p>
            {f.stops.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">No stops added yet.</p>}
            <ol className="space-y-1">
              {f.stops.map((s, i) => (
                <li key={s} className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-600" aria-hidden />
                  <span className="flex-1">
                    {s}
                    <span className="text-gray-400">{purokSuffix(s)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                    aria-label={`Move ${s} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === f.stops.length - 1}
                    className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                    aria-label={`Move ${s} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setF({ ...f, stops: f.stops.filter((x) => x !== s) })}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
            {available.length > 0 && (
              <div className="mt-2 flex gap-2">
                <Select aria-label="Add stop" value={add} onChange={(ev) => setAdd(ev.target.value)}>
                  <option value="">Add a Purok stop…</option>
                  {available.map((p) => (
                    <option key={p} value={p}>
                      {purokLabel(p)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  disabled={!add}
                  onClick={() => {
                    setF({ ...f, stops: [...f.stops, add] });
                    setAdd('');
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
          {e.stops && <p className="mt-1 text-xs text-red-600">{e.stops}</p>}
          {f.stops.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Estimated distance: {routeDistanceKm(f.stops).toFixed(2)} km
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
