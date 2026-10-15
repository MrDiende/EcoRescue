import { Truck as TruckIcon, Clock, Gauge, MapPin, Navigation, Radio } from 'lucide-react';
import { BASE, PUROK_INFO, PUROKS, purokPoint } from '../lib/geography';
import { estimateArrivalMinutes, inBounds, mapBounds, nearestPurok, project } from '../lib/geo';
import { activeScheduleFor, gpsFor, orderedStops, routeById, truckFor } from '../lib/store';
import { formatTime, timeAgo } from '../lib/time';
import { Badge, ProgressBar, StatusBadge } from './ui';
import { cn } from '../utils/cn';
export const ROUTE_COLORS = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2'];
export const routeColor = (db, routeId) => {
  const i = db.routes.findIndex((r) => r.id === routeId);
  return i < 0 ? '#6b7280' : ROUTE_COLORS[i % ROUTE_COLORS.length];
};
export function routeProgress(s) {
  if (!s) return { done: 0, total: 0, pct: 0 };
  const total = s.puroks.length;
  const done = s.visited.filter((p) => s.puroks.includes(p)).length;
  return { done, total, pct: total ? (done / total) * 100 : 0 };
}
export function remainingStops(db, s) {
  return orderedStops(db, s).filter((p) => !s.visited.includes(p));
}
/** ETA in minutes, only when computable from simulated / shared position data. */
export function collectorEta(db, collectorId, purok) {
  const g = gpsFor(db, collectorId);
  const s = activeScheduleFor(db, collectorId);
  if (!g || !s || !g.sharing || g.lat === null || g.lng === null) return null;
  const pos = { lat: g.lat, lng: g.lng };
  if (!inBounds(pos, mapBounds())) return null;
  return estimateArrivalMinutes(pos, remainingStops(db, s), purok);
}
const W = 800;
const H = 520;
export function BarangayMap({
  db,
  routes,
  markers,
  highlight = [],
  visited = [],
  showStopNumbers = false,
  showPuroks = true,
  className,
}) {
  const b = mapBounds();
  const P = (lat, lng) => project({ lat, lng }, b, W, H);
  const base = P(BASE.lat, BASE.lng);
  const ring = [...PUROKS, PUROKS[0]].map((p) => P(PUROK_INFO[p].lat, PUROK_INFO[p].lng));
  const outside = markers.filter(
    (m) => m.gps.lat !== null && m.gps.lng !== null && !inBounds({ lat: m.gps.lat, lng: m.gps.lng }, b),
  );
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-gray-200 bg-[#f3f8f1]', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Simulated barangay map showing Puroks, routes and collector positions"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#e3ecdf" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {/* streets (decorative) */}
        <polyline
          points={ring.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#dfe5dc"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        {PUROKS.map((p) => {
          const q = P(PUROK_INFO[p].lat, PUROK_INFO[p].lng);
          return <line key={p} x1={base.x} y1={base.y} x2={q.x} y2={q.y} stroke="#e6ebe3" strokeWidth="9" />;
        })}
        {/* puroks */}
        {showPuroks &&
          PUROKS.map((p) => {
            const info = PUROK_INFO[p];
            const q = P(info.lat, info.lng);
            const isHi = highlight.includes(p);
            const isVisited = visited.includes(p);
            return (
              <g key={p}>
                <circle
                  cx={q.x}
                  cy={q.y}
                  r="30"
                  fill={isVisited ? '#bbf7d0' : isHi ? '#dcfce7' : '#ffffff'}
                  stroke={isHi || isVisited ? '#16a34a' : '#cbd5e1'}
                  strokeWidth={isHi ? 3 : 2}
                />
                <text x={q.x} y={q.y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#166534">
                  {p.replace('Purok ', 'P')}
                </text>
                <text x={q.x} y={q.y + 48} textAnchor="middle" fontSize="12" fill="#475569">
                  {info.label || p}
                </text>
                {isVisited && (
                  <text x={q.x + 22} y={q.y - 18} fontSize="14" fill="#16a34a">
                    ✓
                  </text>
                )}
              </g>
            );
          })}
        {showStopNumbers &&
          showPuroks &&
          routes.map((r) =>
            r.stops.map((s, i) => {
              const q = P(purokPoint(s).lat, purokPoint(s).lng);
              return (
                <g key={`${r.id}-${s}`}>
                  <circle cx={q.x - 24} cy={q.y - 24} r="11" fill={routeColor(db, r.id)} />
                  <text
                    x={q.x - 24}
                    y={q.y - 20}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            }),
          )}
        {/* base */}
        <g>
          <rect x={base.x - 22} y={base.y - 18} width="44" height="36" rx="6" fill="#166534" />
          <text x={base.x} y={base.y + 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
            HALL
          </text>
          <text x={base.x} y={base.y + 34} textAnchor="middle" fontSize="11" fill="#166534">
            Collection base
          </text>
        </g>
        {/* collectors */}
        {markers.map((m) => {
          if (m.gps.lat === null || m.gps.lng === null || !inBounds({ lat: m.gps.lat, lng: m.gps.lng }, b))
            return null;
          const q = P(m.gps.lat, m.gps.lng);
          const live = m.gps.sharing;
          return (
            <g key={m.collector.id}>
              {live && (
                <circle cx={q.x} cy={q.y} r="18" fill={m.color} opacity="0.25">
                  <animate attributeName="r" values="16;30;16" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <rect
                x={q.x - 16}
                y={q.y - 16}
                width="32"
                height="32"
                rx="9"
                fill="#fff"
                stroke="#e2e8f0"
                strokeWidth="2"
              />
              <TruckIcon
                x={q.x - 10}
                y={q.y - 10}
                width={20}
                height={20}
                color={live ? m.color : '#94a3b8'}
              />
              <rect x={q.x - 55} y={q.y - 44} width="110" height="20" rx="10" fill="#fff" stroke="#e2e8f0" />
              <text x={q.x} y={q.y - 30} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f172a">
                {m.collector.name.split(' ')[0]}
                {live ? '' : ' (idle)'}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm">
        Schematic map · not to scale
      </div>
      {outside.length > 0 && (
        <div className="absolute right-2 top-2 max-w-[60%] rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 shadow-sm">
          {outside.map((m) => m.collector.name).join(', ')}: device location is outside the barangay map area.
        </div>
      )}
    </div>
  );
}
export function collectorMarkers(db, list) {
  return list
    .map((c) => {
      const g = gpsFor(db, c.id);
      if (!g) return null;
      const s = activeScheduleFor(db, c.id);
      return { collector: c, gps: g, color: routeColor(db, s?.routeId ?? c.routeId) };
    })
    .filter((x) => !!x);
}
/** Summary card for a collector's tracking state. */
export function CollectorTrackingCard({ db, collector, targetPurok, compact }) {
  const g = gpsFor(db, collector.id);
  const s = activeScheduleFor(db, collector.id);
  const route = routeById(db, s?.routeId ?? collector.routeId);
  const truck = truckFor(db, collector.id);
  const prog = routeProgress(s);
  const remaining = s ? remainingStops(db, s) : [];
  const pos = g && g.lat !== null && g.lng !== null ? { lat: g.lat, lng: g.lng } : null;
  const eta = targetPurok ? collectorEta(db, collector.id, targetPurok) : null;
  const state = g?.state ?? 'offline';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: g?.sharing ? routeColor(db, route?.id) : '#94a3b8' }}
          >
            <TruckIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{collector.name}</p>
            <p className="text-xs text-gray-500">
              {route ? route.name : 'No route assigned'}
              {truck ? ` · ${truck.vehicleId} (${truck.plate})` : ''}
            </p>
          </div>
        </div>
        <StatusBadge status={state} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2">
        <p className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" /> GPS:{' '}
          {g?.sharing ? (
            <span className="font-medium text-green-700">
              {g.mode === 'browser'
                ? `Live GPS${g.accuracy ? ` ±${g.accuracy} m` : ''}`
                : 'Simulated position'}
              {g.speed != null && g.speed >= 0 ? ` · ${(g.speed * 3.6).toFixed(0)} km/h` : ''}
            </span>
          ) : (
            'Not sharing'
          )}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Last update: {timeAgo(g?.updatedAt)}
        </p>
        {pos && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Near: {nearestPurok(pos)}
          </p>
        )}
        {s && (
          <p className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" /> Next stop: {remaining[0] ?? 'Returning to base'}
          </p>
        )}
        {truck && !compact && (
          <p className="flex items-center gap-1.5">
            <TruckIcon className="h-3.5 w-3.5" /> Capacity: {truck.capacityKg.toLocaleString()} kg ·{' '}
            {truck.type}
          </p>
        )}
        {s && !compact && (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Schedule: {formatTime(s.time)} today
          </p>
        )}
      </div>
      {s && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span>Route progress</span>
            <span>
              {prog.done}/{prog.total} stops
            </span>
          </div>
          <ProgressBar value={prog.pct} />
          <div className="mt-2 flex flex-wrap gap-1">
            {orderedStops(db, s).map((p) => (
              <Badge key={p} tone={s.visited.includes(p) ? 'green' : p === remaining[0] ? 'blue' : 'gray'}>
                {s.visited.includes(p) ? '✓ ' : ''}
                {p}
              </Badge>
            ))}
          </div>
          {g?.state === 'on_route' && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" /> Truck capacity used
                </span>
                <span
                  className={
                    (g.loadPct ?? 0) >= 90
                      ? 'font-semibold text-red-600'
                      : (g.loadPct ?? 0) >= 70
                        ? 'font-semibold text-amber-600'
                        : 'font-medium text-gray-700'
                  }
                >
                  {g.loadPct ?? 0}%
                  {truck
                    ? ` · ~${Math.round((truck.capacityKg * (g.loadPct ?? 0)) / 100).toLocaleString()} / ${truck.capacityKg.toLocaleString()} kg`
                    : ''}
                </span>
              </div>
              <ProgressBar
                value={g.loadPct ?? 0}
                className={
                  (g.loadPct ?? 0) >= 90
                    ? '[&>div]:bg-red-500'
                    : (g.loadPct ?? 0) >= 70
                      ? '[&>div]:bg-amber-500'
                      : ''
                }
              />
              {(g.loadPct ?? 0) >= 90 && <p className="mt-1 text-xs text-red-600">Truck nearly full.</p>}
            </div>
          )}
        </div>
      )}
      {targetPurok && s && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
          {s.visited.includes(targetPurok)
            ? `${targetPurok} has already been collected for this route.`
            : eta !== null
              ? `Estimated arrival in ${targetPurok}: about ${eta} min (rough estimate from the shared ${g?.mode === 'browser' ? 'GPS' : 'simulated'} position, assuming 12 km/h average speed).`
              : g?.sharing
                ? 'Estimated arrival unavailable — the truck is outside the barangay area.'
                : 'Estimated arrival unavailable — location is not being shared.'}
        </p>
      )}
    </div>
  );
}
