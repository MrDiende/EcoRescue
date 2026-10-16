import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  Gauge,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '../lib/auth';
import {
  actorOf,
  activeScheduleFor,
  addLog,
  adminIds,
  ensureGps,
  gpsFor,
  notify,
  orderedStops,
  pushTrail,
  routeById,
  truckFor,
  useStore,
} from '../lib/store';
import { BASE, purokPoint } from '../lib/geography';
import { haversineKm, nearestPurok } from '../lib/geo';
import { formatDayDate, formatTime, isToday, nowISO, timeAgo } from '../lib/time';
import { Alert, Badge, Button, ConfirmDialog, ProgressBar, StatusBadge, useToast } from './ui';
import { remainingStops, routeProgress } from './LiveTracking';
/** Minimum time / distance between saved GPS updates (keeps storage writes reasonable). */
const GPS_MIN_INTERVAL_MS = 4000;
const GPS_MIN_MOVE_M = 12;
const ARRIVAL_RADIUS_M = 120;
export const geoSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;
export const secureContext = () => typeof window !== 'undefined' && window.isSecureContext;
/**
 * Background location publisher for the signed-in collector (mounted in the collector layout).
 * Uses the device's REAL GPS via navigator.geolocation.watchPosition and saves the true
 * position to the shared store, which the Admin Live Map and verified residents read.
 */
export function GpsPublisher() {
  const { user } = useAuth();
  const { db, commit } = useStore();
  const toast = useToast();
  const g = user ? gpsFor(db, user.id) : undefined;
  const sharing = !!g?.sharing;
  const uidv = user?.id;
  const last = useRef(null);
  // Keep the screen awake while sharing so mobile browsers don't suspend GPS.
  useEffect(() => {
    if (!sharing) return;
    const nav = navigator;
    if (!nav.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible' || !nav.wakeLock) return;
      nav.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [sharing]);
  useEffect(() => {
    if (!uidv || !sharing || !geoSupported()) return;
    let warned = false;
    last.current = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
        const now = Date.now();
        const prev = last.current;
        const moved = prev ? haversineKm(prev, { lat, lng }) * 1000 : Infinity;
        if (prev && (now - prev.t < 1500 || (now - prev.t < GPS_MIN_INTERVAL_MS && moved < GPS_MIN_MOVE_M)))
          return;
        last.current = { t: now, lat, lng };
        commit((d) => {
          const gs = ensureGps(d, uidv);
          if (!gs.sharing) return;
          gs.lat = lat;
          gs.lng = lng;
          gs.accuracy = Math.round(accuracy);
          gs.speed = speed ?? null;
          gs.heading = heading ?? null;
          gs.mode = 'browser';
          gs.updatedAt = nowISO();
          pushTrail(gs, lat, lng);
        });
      },
      (err) => {
        if (!warned) {
          warned = true;
          toast.error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied — your live location is not being shared.'
              : 'Waiting for a GPS signal… Move to an open area if this continues.',
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [uidv, sharing, commit, toast]);
  return null;
}
/** Shared device-geolocation hook: returns the live position of the person viewing. */
export function useMyLocation(enabled) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    if (!geoSupported()) {
      setError('This device does not support GPS.');
      return;
    }
    if (!secureContext()) {
      setError('Location needs HTTPS (or localhost).');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not get your location.',
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return { pos, error };
}
/** Collector controls for starting, progressing and finishing a collection route. */
export function RouteSharingPanel({ schedule }) {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const g = gpsFor(db, user.id);
  const route = routeById(db, schedule.routeId);
  const truck = truckFor(db, user.id);
  const stops = orderedStops(db, schedule);
  const remaining = remainingStops(db, schedule);
  const prog = routeProgress(schedule);
  const active = activeScheduleFor(db, user.id);
  const isMine = schedule.collectorId === user.id;
  const canStart = isMine && schedule.status === 'scheduled' && isToday(schedule.date) && !active;
  const running = schedule.status === 'in_progress';
  const pos = g && g.lat !== null && g.lng !== null ? { lat: g.lat, lng: g.lng } : null;
  const nextStop = remaining[0];
  const distToNext = pos && nextStop ? haversineKm(pos, purokPoint(nextStop)) * 1000 : null;
  const atNext = running && distToNext !== null && distToNext <= ARRIVAL_RADIUS_M;
  const doStart = (coords) => {
    commit((d) => {
      const s = d.schedules.find((x) => x.id === schedule.id);
      if (!s || s.status !== 'scheduled' || s.collectorId !== user.id) return;
      s.status = 'in_progress';
      s.startedAt = nowISO();
      s.updatedAt = nowISO();
      const gs = ensureGps(d, user.id);
      const { lat, lng } = coords;
      Object.assign(gs, {
        state: 'on_route',
        sharing: true,
        mode: 'browser',
        lat,
        lng,
        accuracy: coords.accuracy,
        speed: null,
        heading: null,
        updatedAt: nowISO(),
        scheduleId: s.id,
        trail: [[lat, lng]],
        loadPct: 0,
      });
      const routeName = route?.name ?? 'the collection route';
      notify(d, adminIds(d), {
        title: 'Collector started route',
        message: `${user.name} started ${routeName} and is sharing live GPS.`,
        type: 'schedule',
        link: '/admin/map',
      });
      addLog(
        d,
        actorOf(user),
        'Route started',
        `Started ${routeName} for ${formatDayDate(s.date)} with live GPS; residents in the next Purok are notified.`,
      );
    });
    toast.success(
      'Route started. Your live GPS location is now visible to the admin and verified residents.',
    );
  };
  const start = () => {
    if (!canStart) return;
    if (!geoSupported()) {
      toast.error('This device does not support GPS, so you cannot share your location.');
      return;
    }
    if (!secureContext()) {
      toast.error('GPS requires a secure connection (HTTPS or localhost).');
      return;
    }
    setStarting(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStarting(false);
        doStart({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
      },
      (err) => {
        setStarting(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access to start the route.'
            : 'Could not get a GPS fix. Move to an open area and try again.',
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const markVisited = (p) => {
    commit((d) => {
      const s = d.schedules.find((x) => x.id === schedule.id);
      if (!s || s.status !== 'in_progress' || s.collectorId !== user.id || s.visited.includes(p)) return;
      s.visited.push(p);
      s.updatedAt = nowISO();
      const gs = ensureGps(d, user.id);
      gs.updatedAt = nowISO();
      addLog(d, actorOf(user), 'Purok visited', `Marked ${p} as collected on ${route?.name ?? 'route'}.`);
    });
    const upcomingNow = remainingStops(db, { ...schedule, visited: [...schedule.visited, p] });
    toast.success(
      upcomingNow[0]
        ? `${p} collected. Next Purok (${upcomingNow[0]}) residents notified.`
        : `${p} collected. That was the last Purok — tap Done assignment.`,
    );
  };
  const finish = (status, reason = '') => {
    commit((d) => {
      const s = d.schedules.find((x) => x.id === schedule.id);
      if (!s || s.collectorId !== user.id) return;
      s.status = status;
      s.updatedAt = nowISO();
      if (status === 'completed') s.completedAt = nowISO();
      else s.missedReason = reason;
      const gs = ensureGps(d, user.id);
      Object.assign(gs, {
        state: 'available',
        sharing: false,
        scheduleId: null,
        updatedAt: nowISO(),
        trail: [],
        speed: null,
        heading: null,
        loadPct: 0,
      });
      if (status === 'completed') {
        addLog(
          d,
          actorOf(user),
          'Collection completed',
          `Completed ${route?.name ?? 'collection'} (${s.puroks.join(', ')}). Location sharing stopped.`,
        );
        notify(d, adminIds(d), {
          title: 'Collection completed',
          message: `${user.name} completed ${route?.name ?? 'a collection'} for ${formatDayDate(s.date)}.`,
          type: 'schedule',
          link: '/admin/schedules',
        });
      } else {
        const missedPuroks = s.puroks.filter((p) => !s.visited.includes(p));
        addLog(
          d,
          actorOf(user),
          'Collection missed',
          `Reported missed collection for ${missedPuroks.join(', ')}: ${reason}`,
        );
        notify(d, adminIds(d), {
          title: 'Missed collection reported',
          message: `${user.name}: ${reason}`,
          type: 'schedule',
          link: '/admin/schedules',
        });
      }
    });
    setConfirm(null);
    toast.success(
      status === 'completed'
        ? 'Collection completed. Location sharing stopped.'
        : 'Missed collection reported. Location sharing stopped.',
    );
  };
  const setLoad = (pct) => {
    commit((d) => {
      const gs = ensureGps(d, user.id);
      gs.loadPct = pct;
      gs.updatedAt = nowISO();
      if (pct >= 90) {
        addLog(
          d,
          actorOf(user),
          'Truck almost full',
          `${user.name}'s truck reached ${pct}% capacity on ${route?.name ?? 'route'}.`,
        );
        notify(d, adminIds(d), {
          title: 'Truck nearly full',
          message: `${user.name}'s truck is at ${pct}% capacity on ${route?.name ?? 'the route'}.`,
          type: 'schedule',
          link: '/admin/map',
        });
      }
    });
  };
  const load = g?.loadPct ?? 0;
  const loadTone = load >= 90 ? 'red' : load >= 70 ? 'amber' : 'green';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">
            {route?.name ?? 'Collection'} · {formatTime(schedule.time)}
          </p>
          <p className="text-xs text-gray-500">
            {formatDayDate(schedule.date)} · starts at {BASE.name}
          </p>
        </div>
        <StatusBadge status={schedule.status} />
      </div>

      {running && g && (
        <div className="space-y-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5 text-gray-700">
              <Radio className={g.sharing ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-gray-400'} />
              {g.sharing ? (
                <>
                  Sharing location{' '}
                  <Badge tone={g.mode === 'browser' ? 'green' : 'amber'}>
                    {g.mode === 'browser' ? 'Live GPS' : 'Simulated'}
                  </Badge>
                </>
              ) : (
                'Location sharing paused'
              )}
              {g.mode === 'browser' && g.accuracy ? <span>±{g.accuracy} m</span> : null}
              {g.speed != null && g.speed >= 0 ? <span>· {(g.speed * 3.6).toFixed(0)} km/h</span> : null}
            </span>
            <span className="text-gray-500">Last update: {timeAgo(g.updatedAt)}</span>
          </div>
          {pos && (
            <p className="text-gray-500">
              Near {nearestPurok(pos)} ·{' '}
              <span className="font-mono">
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </span>
              {distToNext !== null && nextStop
                ? ` · ${distToNext < 1000 ? `${Math.round(distToNext)} m` : `${(distToNext / 1000).toFixed(1)} km`} to ${nextStop}`
                : ''}
            </p>
          )}
          {g.sharing && (
            <p className="flex items-center gap-1 text-green-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Visible to barangay admins and verified residents.
            </p>
          )}
        </div>
      )}

      {running && isMine && (
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-gray-800">
              <Gauge className="h-4 w-4 text-gray-500" /> Truck capacity used
            </span>
            <Badge tone={loadTone}>
              {load}%
              {truck
                ? ` · ~${Math.round((truck.capacityKg * load) / 100).toLocaleString()} / ${truck.capacityKg.toLocaleString()} kg`
                : ''}
            </Badge>
          </div>
          <ProgressBar
            value={load}
            className={load >= 90 ? '[&>div]:bg-red-500' : load >= 70 ? '[&>div]:bg-amber-500' : ''}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 25, 50, 75, 90, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLoad(v)}
                aria-pressed={load === v}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${load === v ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-green-400'}`}
              >
                {v === 0 ? 'Empty' : v === 100 ? 'Full' : `${v}%`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            aria-label="Truck capacity used (%)"
            className="mt-2 w-full accent-green-600"
          />
          {load >= 90 && (
            <p className="mt-1 text-xs text-red-600">
              Truck is nearly full — the admin has been alerted. Consider unloading before continuing.
            </p>
          )}
        </div>
      )}

      {atNext && isMine && nextStop && (
        <Alert tone="green" icon={<MapPin className="h-4 w-4" />} title={`You've reached ${nextStop}`}>
          <Button size="sm" className="mt-1" onClick={() => markVisited(nextStop)}>
            Mark {nextStop} as collected
          </Button>
        </Alert>
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-600">
          <span>Progress</span>
          <span>
            {prog.done}/{prog.total} Puroks collected
          </span>
        </div>
        <ProgressBar value={prog.pct} />
      </div>

      <ol className="space-y-2">
        {stops.map((p) => {
          const done = schedule.visited.includes(p);
          const isNext = running && remaining[0] === p;
          return (
            <li
              key={p}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isNext ? 'border-green-300 bg-green-50/50' : 'border-gray-200'}`}
            >
              <span className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
                <span className={done ? 'text-gray-500 line-through' : 'text-gray-900'}>{p}</span>
                {isNext && <Badge tone="blue">Next</Badge>}
              </span>
              {running && isMine && isNext && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  onClick={() => markVisited(p)}
                >
                  Mark visited
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      {schedule.status === 'scheduled' && isMine && (
        <div className="space-y-2">
          {!isToday(schedule.date) && (
            <Alert tone="gray">This route can be started on {formatDayDate(schedule.date)}.</Alert>
          )}
          {isToday(schedule.date) && active && active.id !== schedule.id && (
            <Alert tone="amber">Finish your current active route before starting another one.</Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Navigation className="h-4 w-4" />}
              disabled={!canStart}
              loading={starting}
              onClick={start}
            >
              {starting ? 'Getting GPS fix…' : 'Start Route · Share GPS'}
            </Button>
          </div>
          {canStart && (
            <p className="text-xs text-gray-500">
              Your browser will ask for location permission. Your real GPS location will be shared with the
              admin and verified residents until you finish the route. Keep this page open while collecting.
            </p>
          )}
        </div>
      )}

      {running && isMine && (
        <div className="flex flex-wrap gap-2">
          {remaining.length === 0 ? (
            <Button icon={<Flag className="h-4 w-4" />} onClick={() => setConfirm('complete')}>
              Done assignment
            </Button>
          ) : (
            <Button
              variant="danger"
              icon={<XCircle className="h-4 w-4" />}
              onClick={() => setConfirm('missed')}
            >
              Report missed
            </Button>
          )}
        </div>
      )}
      {running && remaining.length > 0 && isMine && (
        <p className="text-xs text-gray-500">
          Collect the next Purok ({nextStop}) and tap <b>Mark visited</b>. When all Puroks are done, the{' '}
          <b>Done assignment</b> button will appear.
        </p>
      )}
      {schedule.status === 'missed' && schedule.missedReason && (
        <Alert tone="red" title="Missed collection">
          {schedule.missedReason}
        </Alert>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        tone="primary"
        title="Done with this assignment?"
        message="All Puroks have been collected. This marks the assignment as completed, stops location sharing and sets you back to Available."
        confirmLabel="Done assignment"
        onConfirm={() => finish('completed')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'missed'}
        tone="danger"
        title="Report missed collection"
        message={`Unvisited Puroks (${remaining.join(', ') || 'none'}) will be marked as missed, location sharing will stop and affected residents will be notified.`}
        confirmLabel="Report missed"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Truck breakdown on Luna St."
        onConfirm={(r) => finish('missed', r)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
