import { BASE, purokPoint, PUROK_INFO } from './geography';
const R = 6371; // km
export function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Path from the collection base through all stops in order. */
export function routePoints(stops) {
  return [BASE, ...stops.map(purokPoint)];
}
/**
 * Order Puroks starting from the Barangay Hall, always moving to the nearest
 * not-yet-visited Purok (greedy nearest-neighbour). Produces a sensible
 * "nearest → far" collection sequence from the base.
 */
export function orderByNearestFromBase(puroks) {
  const remaining = [...puroks];
  const ordered = [];
  let current = BASE;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, purokPoint(remaining[i]));
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    current = purokPoint(next);
  }
  return ordered;
}
export function routeDistanceKm(stops) {
  const pts = routePoints(stops);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1], pts[i]);
  return total;
}
/** Move `from` toward `to` by at most `stepKm`. */
export function moveToward(from, to, stepKm) {
  const d = haversineKm(from, to);
  if (d <= stepKm || d === 0) return { lat: to.lat, lng: to.lng };
  const t = stepKm / d;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}
export const AVG_TRUCK_SPEED_KMH = 12;
export const MINUTES_PER_STOP = 8;
/**
 * Estimate minutes until the truck reaches `target`, using the simulated position,
 * the ordered list of remaining stops, an assumed average speed and a fixed time per stop.
 * Returns null if the target is not among the remaining stops.
 */
export function estimateArrivalMinutes(position, remainingStops, target) {
  const idx = remainingStops.indexOf(target);
  if (idx < 0) return null;
  let km = 0;
  let prev = position;
  for (let i = 0; i <= idx; i++) {
    const p = purokPoint(remainingStops[i]);
    km += haversineKm(prev, p);
    prev = p;
  }
  return Math.round((km / AVG_TRUCK_SPEED_KMH) * 60 + idx * MINUTES_PER_STOP);
}
export function nearestPurok(p) {
  let best = '';
  let bestD = Infinity;
  for (const [name, info] of Object.entries(PUROK_INFO)) {
    const d = haversineKm(p, info);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  if (bestD < 0.35) return best;
  return bestD < 1.5 ? 'Between Puroks' : 'Outside barangay area';
}
export function mapBounds() {
  const pts = [BASE, ...Object.values(PUROK_INFO)];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const padLat = 0.0022;
  const padLng = 0.0026;
  return {
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
    minLng: Math.min(...lngs) - padLng,
    maxLng: Math.max(...lngs) + padLng,
  };
}
export function inBounds(p, b) {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}
export function project(p, b, w, h) {
  return {
    x: ((p.lng - b.minLng) / (b.maxLng - b.minLng)) * w,
    y: ((b.maxLat - p.lat) / (b.maxLat - b.minLat)) * h,
  };
}
