import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Home, LocateFixed, Map as MapIcon, Shapes, WifiOff } from 'lucide-react';
import { BASE, PUROKS, PUROK_INFO, purokPoint } from '../lib/geography';
import { inBounds, mapBounds, nearestPurok } from '../lib/geo';
import { timeAgo } from '../lib/time';
import { BarangayMap, routeColor } from './LiveTracking';
import { cn } from '../utils/cn';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const esc = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const truckSvg = (color) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;
function truckIconHtml(color, live, label) {
  return `<div class="eco-truck-wrap">${live ? `<span class="eco-pulse" style="background:${color}"></span>` : ''}<span class="eco-truck-chip">${truckSvg(live ? color : '#94a3b8')}</span><span class="eco-truck-label">${esc(label)}${live ? '' : ' · idle'}</span></div>`;
}
function popupHtml(m) {
  const g = m.gps;
  const mode = g.sharing ? (g.mode === 'browser' ? 'Live device GPS' : 'Simulated position') : 'Not sharing';
  const pos = g.lat !== null && g.lng !== null ? { lat: g.lat, lng: g.lng } : null;
  const speed = g.speed != null && g.speed >= 0 ? ` · ${(g.speed * 3.6).toFixed(0)} km/h` : '';
  return `<div style="min-width:180px;font-family:inherit">
    <p style="margin:0;font-weight:700;color:#0f172a">${esc(m.collector.name)}</p>
    <p style="margin:2px 0 0;color:#475569;font-size:12px">${esc(mode)}${g.accuracy ? ` · ±${g.accuracy} m` : ''}${speed}</p>
    ${pos ? `<p style="margin:2px 0 0;color:#475569;font-size:12px">Near: ${esc(nearestPurok(pos))}</p><p style="margin:2px 0 0;color:#94a3b8;font-size:11px;font-family:monospace">${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</p>` : ''}
    <p style="margin:2px 0 0;color:#94a3b8;font-size:11px">Updated ${esc(timeAgo(g.updatedAt))}</p>
  </div>`;
}
function barangayBounds() {
  const b = mapBounds();
  return [
    [b.minLat, b.minLng],
    [b.maxLat, b.maxLng],
  ];
}
export function OsmMap({
  db,
  routes,
  markers,
  highlight = [],
  visited = [],
  showStopNumbers,
  className,
  followId,
  showPuroks = true,
  myLocation,
  onTileError,
}) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const staticRef = useRef(null);
  const liveRef = useRef(null);
  const trucks = useRef(new Map());
  const meRef = useRef(null);
  const errCb = useRef(onTileError);
  errCb.current = onTileError;
  const [follow, setFollow] = useState(followId ?? '');
  // Create the Leaflet map once.
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
    let errors = 0;
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION })
      .on('tileerror', () => {
        errors++;
        if (errors === 3) errCb.current?.();
      })
      .addTo(map);
    map.fitBounds(barangayBounds(), { padding: [16, 16] });
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());
    map.on('dragstart', () => setFollow(''));
    staticRef.current = L.layerGroup().addTo(map);
    liveRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    const truckMap = trucks.current;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      staticRef.current = null;
      liveRef.current = null;
      truckMap.clear();
    };
  }, []);
  // Base, Puroks and routes.
  const staticKey = JSON.stringify([
    routes.map((r) => [r.id, r.stops, routeColor(db, r.id)]),
    highlight,
    visited,
    !!showStopNumbers,
    showPuroks,
  ]);
  useEffect(() => {
    const g = staticRef.current;
    if (!g) return;
    g.clearLayers();
    routes.forEach((r) => {
      const color = routeColor(db, r.id);
      if (showStopNumbers && showPuroks) {
        r.stops.forEach((s, i) => {
          const pt = purokPoint(s);
          L.marker([pt.lat, pt.lng], {
            icon: L.divIcon({
              className: 'eco-stop',
              html: `<span style="background:${color}">${i + 1}</span>`,
              iconSize: [20, 20],
              iconAnchor: [30, 30],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(g);
        });
      }
    });
    if (showPuroks)
      PUROKS.forEach((p) => {
        const info = PUROK_INFO[p];
        const hi = highlight.includes(p);
        const done = visited.includes(p);
        L.circle([info.lat, info.lng], {
          radius: 110,
          color: hi || done ? '#16a34a' : '#64748b',
          weight: hi ? 3 : 1.5,
          fillColor: done ? '#22c55e' : hi ? '#bbf7d0' : '#ffffff',
          fillOpacity: done ? 0.45 : 0.3,
        })
          .bindTooltip(`${p}${info.label ? ` · ${info.label}` : ''}${done ? ' (collected)' : ''}`)
          .addTo(g);
        L.marker([info.lat, info.lng], {
          icon: L.divIcon({
            className: 'eco-purok',
            html: `<span class="${done ? 'is-done' : hi ? 'is-hi' : ''}">${done ? '✓ ' : ''}${esc(p)}</span>`,
            iconSize: [84, 22],
            iconAnchor: [42, 11],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(g);
      });
    L.marker([BASE.lat, BASE.lng], {
      icon: L.divIcon({
        className: 'eco-base',
        html: '<span>HALL</span>',
        iconSize: [46, 24],
        iconAnchor: [23, 12],
      }),
      title: BASE.name,
    })
      .bindTooltip(BASE.name)
      .addTo(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticKey]);
  // Collector markers (updated in place so popups stay open).
  const liveKey = JSON.stringify(
    markers.map((m) => [
      m.collector.id,
      m.collector.name,
      m.color,
      m.gps.lat,
      m.gps.lng,
      m.gps.sharing,
      m.gps.mode,
      m.gps.accuracy,
      m.gps.updatedAt,
      m.gps.state,
      m.gps.trail?.length ?? 0,
    ]),
  );
  useEffect(() => {
    const map = mapRef.current;
    const g = liveRef.current;
    if (!map || !g) return;
    const seen = new Set();
    markers.forEach((m) => {
      const { gps, collector } = m;
      if (gps.lat === null || gps.lng === null) return;
      seen.add(collector.id);
      const ll = [gps.lat, gps.lng];
      const iconKey = `${m.color}|${gps.sharing}|${collector.name}`;
      let t = trucks.current.get(collector.id);
      if (!t) {
        const marker = L.marker(ll, {
          icon: L.divIcon({
            className: 'eco-truck',
            html: truckIconHtml(m.color, gps.sharing, collector.name.split(' ')[0]),
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -20],
          }),
          zIndexOffset: 1000,
          title: collector.name,
        })
          .bindPopup(popupHtml(m))
          .addTo(g);
        t = { marker, iconKey, acc: null, trail: null };
        trucks.current.set(collector.id, t);
      } else {
        t.marker.setLatLng(ll);
        t.marker.setPopupContent(popupHtml(m));
        if (t.iconKey !== iconKey) {
          t.marker.setIcon(
            L.divIcon({
              className: 'eco-truck',
              html: truckIconHtml(m.color, gps.sharing, collector.name.split(' ')[0]),
              iconSize: [36, 36],
              iconAnchor: [18, 18],
              popupAnchor: [0, -20],
            }),
          );
          t.iconKey = iconKey;
        }
      }
      if (gps.sharing && gps.mode === 'browser' && gps.accuracy) {
        if (!t.acc)
          t.acc = L.circle(ll, {
            radius: gps.accuracy,
            color: m.color,
            weight: 1,
            fillOpacity: 0.1,
            interactive: false,
          }).addTo(g);
        else {
          t.acc.setLatLng(ll);
          t.acc.setRadius(gps.accuracy);
        }
      } else if (t.acc) {
        g.removeLayer(t.acc);
        t.acc = null;
      }
      const trail = gps.trail ?? [];
      if (gps.sharing && trail.length > 1) {
        if (!t.trail)
          t.trail = L.polyline(trail, { color: m.color, weight: 3, opacity: 0.55, interactive: false }).addTo(
            g,
          );
        else t.trail.setLatLngs(trail);
      } else if (t.trail) {
        g.removeLayer(t.trail);
        t.trail = null;
      }
    });
    trucks.current.forEach((t, id) => {
      if (seen.has(id)) return;
      g.removeLayer(t.marker);
      if (t.acc) g.removeLayer(t.acc);
      if (t.trail) g.removeLayer(t.trail);
      trucks.current.delete(id);
    });
    if (follow) {
      const t = trucks.current.get(follow);
      if (t) map.panTo(t.marker.getLatLng(), { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, follow]);
  // The viewer's own live GPS position ("You are here").
  useEffect(() => {
    const g = liveRef.current;
    if (!g) return;
    if (!myLocation) {
      if (meRef.current) {
        g.removeLayer(meRef.current.marker);
        g.removeLayer(meRef.current.acc);
        meRef.current = null;
      }
      return;
    }
    const ll = [myLocation.lat, myLocation.lng];
    if (!meRef.current) {
      const marker = L.marker(ll, {
        icon: L.divIcon({
          className: 'eco-me',
          html: '<span class="eco-me-dot"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          popupAnchor: [0, -12],
        }),
        zIndexOffset: 1500,
      }).bindTooltip('You are here');
      const acc = L.circle(ll, {
        radius: myLocation.accuracy ?? 30,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      });
      marker.addTo(g);
      acc.addTo(g);
      meRef.current = { marker, acc };
    } else {
      meRef.current.marker.setLatLng(ll);
      meRef.current.acc.setLatLng(ll).setRadius(myLocation.accuracy ?? 30);
    }
  }, [myLocation?.lat, myLocation?.lng, myLocation?.accuracy, myLocation]);
  const sharing = markers.filter((m) => m.gps.sharing && m.gps.lat !== null && m.gps.lng !== null);
  const outside = sharing.filter((m) => !inBounds({ lat: m.gps.lat, lng: m.gps.lng }, mapBounds()));
  const flyTo = (id) => {
    const t = trucks.current.get(id);
    if (t && mapRef.current) mapRef.current.flyTo(t.marker.getLatLng(), 17);
  };
  return (
    <div
      className={cn(
        'relative isolate z-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100',
        className,
      )}
    >
      <div
        ref={el}
        className="h-[380px] w-full sm:h-[480px]"
        role="region"
        aria-label="OpenStreetMap showing Puroks, routes and collection trucks"
      />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-[1000] flex flex-wrap items-start justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setFollow('');
            mapRef.current?.flyToBounds(barangayBounds(), { padding: [16, 16] });
          }}
          title="Show whole barangay"
          aria-label="Show whole barangay"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md bg-white text-gray-700 shadow ring-1 ring-gray-200 hover:bg-gray-50 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        >
          <Home className="h-4 w-4" aria-hidden />
        </button>
        {sharing.length > 0 && (
          <label className="pointer-events-auto flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow ring-1 ring-gray-200">
            <LocateFixed className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Follow truck</span>
            <select
              value={follow}
              onChange={(e) => {
                setFollow(e.target.value);
                if (e.target.value) flyTo(e.target.value);
              }}
              className="bg-transparent text-xs focus:outline-none"
            >
              <option value="">Free view</option>
              {sharing.map((m) => (
                <option key={m.collector.id} value={m.collector.id}>
                  Follow {m.collector.name.split(' ')[0]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {outside.length > 0 && (
        <div className="absolute bottom-6 left-2 right-2 z-[1000] flex flex-wrap items-center gap-2 rounded-md bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow ring-1 ring-amber-200 sm:right-auto sm:max-w-md">
          <span>
            {outside.map((m) => m.collector.name).join(', ')} {outside.length > 1 ? 'are' : 'is'} sharing a
            location outside the barangay area.
          </span>
          {outside.map((m) => (
            <button
              key={m.collector.id}
              type="button"
              onClick={() => flyTo(m.collector.id)}
              className="rounded bg-white px-2 py-0.5 font-medium ring-1 ring-amber-300 hover:bg-amber-100"
            >
              Show {m.collector.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
/** Map with a toggle between the OpenStreetMap street view and the offline schematic view. */
export function MapView(props) {
  const [view, setView] = useState('street');
  const [tileErr, setTileErr] = useState(false);
  const btn = (active) =>
    cn(
      'flex h-8 w-9 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
      active ? 'bg-white text-green-800 shadow-sm' : 'text-gray-600 hover:text-gray-900',
    );
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Map view" className="inline-flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            className={btn(view === 'street')}
            aria-pressed={view === 'street'}
            onClick={() => setView('street')}
            title="Street map (OpenStreetMap)"
            aria-label="Street map"
          >
            <MapIcon className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className={btn(view === 'schematic')}
            aria-pressed={view === 'schematic'}
            onClick={() => setView('schematic')}
            title="Schematic map (works offline)"
            aria-label="Schematic map"
          >
            <Shapes className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {tileErr && view === 'street' && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
          <WifiOff className="h-3.5 w-3.5" /> Some OpenStreetMap tiles could not load (no internet?).
          Positions still update — or switch to the schematic view.
        </p>
      )}
      {view === 'street' ? (
        <OsmMap {...props} onTileError={() => setTileErr(true)} />
      ) : (
        <BarangayMap {...props} />
      )}
    </div>
  );
}
