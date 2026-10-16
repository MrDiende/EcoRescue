import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { emptyDatabase } from './db';
import { supabase, withTimeout } from './supabase';
import { loadDatabase, syncDatabase, TABLE_NAMES } from './supabaseData';
import { uid } from './storage';
import { nowISO, todayISO } from './time';
import { haversineKm } from './geo';
const StoreContext = createContext(null);
export function StoreProvider({ children }) {
  const [db, setDb] = useState(emptyDatabase);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const authId = useRef(null);
  const generation = useRef(0);
  const loadedRef = useRef(false);
  const persistedDb = useRef(emptyDatabase());
  const latestDb = useRef(db);
  const syncQueue = useRef(Promise.resolve());

  useEffect(() => {
    latestDb.current = db;
  }, [db]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async (session) => {
      const id = session?.user?.id ?? null;
      if (id === authId.current && loadedRef.current) return;
      authId.current = id;
      const request = ++generation.current;
      loadedRef.current = false;
      setLoaded(false);
      try {
        const next = id
          ? await withTimeout(loadDatabase(), 'Loading your EcoRescue account data')
          : emptyDatabase();
        if (!mounted || request !== generation.current) return;
        persistedDb.current = structuredClone(next);
        latestDb.current = next;
        setDb(next);
        setSyncError(null);
        setLoadError(null);
      } catch (error) {
        if (!mounted || request !== generation.current) return;
        const message = error instanceof Error ? error.message : 'Could not load data from Supabase.';
        setSyncError(message);
        setLoadError(message);
        const empty = emptyDatabase();
        persistedDb.current = structuredClone(empty);
        latestDb.current = empty;
        setDb(empty);
      } finally {
        if (mounted && request === generation.current) {
          loadedRef.current = true;
          setLoaded(true);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void hydrate(session), 0);
    });
    void withTimeout(supabase.auth.getSession(), 'Checking your EcoRescue session').then(({ data, error }) => {
      if (error) {
        const message = `Supabase session check failed: ${error.message}`;
        setSyncError(message);
        setLoadError(message);
        loadedRef.current = true;
        setLoaded(true);
        return;
      }
      void hydrate(data.session);
    }).catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Could not verify the Supabase session.';
      setSyncError(message);
      setLoadError(message);
      loadedRef.current = true;
      setLoaded(true);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loaded || !authId.current) return;
    syncQueue.current = syncQueue.current
      .catch(() => {})
      .then(async () => {
        const next = latestDb.current;
        await syncDatabase(persistedDb.current, next);
        persistedDb.current = structuredClone(next);
        setSyncError(null);
      })
      .catch((error) => {
        setSyncError(error instanceof Error ? error.message : 'Could not save changes to Supabase.');
      });
  }, [db, loaded]);

  const commit = useCallback((fn) => {
    setDb((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);
  const reload = useCallback(async () => {
    if (!authId.current) throw new Error('Sign in before refreshing Supabase data.');
    try {
      await syncQueue.current;
      const next = await loadDatabase();
      persistedDb.current = structuredClone(next);
      latestDb.current = next;
      setDb(next);
      setSyncError(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not refresh data from Supabase.');
      throw error;
    }
  }, []);
  useEffect(() => {
    if (!loaded || !authId.current) return;
    let timer;
    const channel = supabase.channel(`ecorescue-data-${authId.current}`);
    for (const table of TABLE_NAMES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void reload().catch(() => {}), 250);
      });
    }
    channel.subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loaded, reload]);
  return (
    <StoreContext.Provider
      value={{ db, commit, loaded, loadError, syncError, offlineNotice: null, reload }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
export const actorOf = (u) => ({ id: u.id, name: u.name, role: u.role });
export function addLog(d, actor, action, details) {
  d.activity.unshift({
    id: uid('ac-'),
    actorId: actor.id,
    actorName: actor.name,
    role: actor.role,
    action,
    details,
    createdAt: nowISO(),
  });
  if (d.activity.length > 500) d.activity.length = 500;
}
export function notify(d, userIds, n) {
  const unique = Array.from(new Set(userIds));
  const at = nowISO();
  const items = unique.map((userId) => ({ id: uid('n-'), userId, read: false, createdAt: at, ...n }));
  d.notifications.unshift(...items);
  if (d.notifications.length > 1500) d.notifications.length = 1500;
}
export const adminIds = (d) => d.users.filter((u) => u.role === 'admin' && u.active).map((u) => u.id);
export const approvedResidentIds = (d) =>
  d.users.filter((u) => u.role === 'resident' && u.active && u.status === 'approved').map((u) => u.id);
/** Live collector locations are shared only with administrators and verified (approved) residents. */
export function canViewLiveLocation(u) {
  if (!u.active) return false;
  if (u.role === 'admin') return true;
  if (u.role === 'resident') return u.status === 'approved';
  return false;
}
export function pushTrail(g, lat, lng, minMeters = 10, max = 150) {
  const tr = g.trail ?? [];
  const last = tr[tr.length - 1];
  const dist = last ? haversineKm({ lat: last[0], lng: last[1] }, { lat, lng }) * 1000 : Infinity;
  if (dist >= minMeters) {
    tr.push([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6]);
    if (tr.length > max) tr.splice(0, tr.length - max);
  }
  g.trail = tr;
}
export const residentIdsInPuroks = (d, puroks) =>
  d.users
    .filter((u) => u.role === 'resident' && u.active && u.status === 'approved' && puroks.includes(u.purok))
    .map((u) => u.id);
export function announcementVisibleTo(a, u) {
  if (u.role === 'admin') return true;
  if (a.audience === 'residents' && u.role !== 'resident') return false;
  if (a.audience === 'collectors' && u.role !== 'collector') return false;
  if (a.puroks.length === 0) return true;
  if (u.role === 'resident') return a.puroks.includes(u.purok);
  return (u.puroks ?? []).some((p) => a.puroks.includes(p));
}
export function announcementRecipients(d, a) {
  return d.users
    .filter(
      (u) =>
        u.active &&
        u.role !== 'admin' &&
        (u.role !== 'resident' || u.status === 'approved') &&
        announcementVisibleTo(a, u),
    )
    .map((u) => u.id);
}
export function nextCode(codes, prefix, width) {
  let max = 0;
  for (const c of codes) {
    const m = c.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}
export function ensureGps(d, collectorId) {
  let g = d.gps.find((x) => x.collectorId === collectorId);
  if (!g) {
    g = {
      collectorId,
      state: 'offline',
      sharing: false,
      mode: null,
      lat: null,
      lng: null,
      accuracy: null,
      updatedAt: null,
      scheduleId: null,
    };
    d.gps.push(g);
  }
  return g;
}
/* ---------------- Selectors ---------------- */
export const userById = (db, id) => (id ? db.users.find((u) => u.id === id) : undefined);
export const userName = (db, id, fallback = 'Unassigned') => userById(db, id)?.name ?? fallback;
export const routeById = (db, id) => (id ? db.routes.find((r) => r.id === id) : undefined);
export const gpsFor = (db, collectorId) => db.gps.find((g) => g.collectorId === collectorId);
export const truckFor = (db, collectorId) => db.trucks.find((t) => t.collectorId === collectorId);
export const unreadCount = (db, userId) =>
  db.notifications.filter((n) => n.userId === userId && !n.read).length;
export const collectors = (db) => db.users.filter((u) => u.role === 'collector');
export const residents = (db) => db.users.filter((u) => u.role === 'resident');
export function scheduleSort(a, b) {
  return (a.date + a.time).localeCompare(b.date + b.time);
}
export function upcomingSchedules(db) {
  const t = todayISO();
  return db.schedules
    .filter((s) => s.date >= t && (s.status === 'scheduled' || s.status === 'in_progress'))
    .sort(scheduleSort);
}
/** Ordered stops of a schedule (following the route order when available). */
export function orderedStops(db, s) {
  const route = routeById(db, s.routeId);
  if (!route) return s.puroks;
  const inRoute = route.stops.filter((p) => s.puroks.includes(p));
  const extra = s.puroks.filter((p) => !route.stops.includes(p));
  return [...inRoute, ...extra];
}
export function activeScheduleFor(db, collectorId) {
  const g = gpsFor(db, collectorId);
  if (g?.scheduleId) {
    const s = db.schedules.find((x) => x.id === g.scheduleId && x.status === 'in_progress');
    if (s) return s;
  }
  return db.schedules.find((s) => s.collectorId === collectorId && s.status === 'in_progress');
}
