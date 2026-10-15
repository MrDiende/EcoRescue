import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { activeScheduleFor, approvedResidentIds, gpsFor, routeById, useStore } from '../../lib/store';
import { Alert, Card, EmptyState, PageHeader, Tabs } from '../../components/ui';
import { CollectorTrackingCard, collectorMarkers } from '../../components/LiveTracking';
import { MapView } from '../../components/OsmMap';
import { useMyLocation } from '../../components/RouteSharing';
export default function AdminGps() {
  const { db } = useStore();
  const [filter, setFilter] = useState('active');
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const { pos: myPos } = useMyLocation(true);
  const all = db.users.filter((u) => u.role === 'collector' && u.active);
  const active = all.filter((c) => gpsFor(db, c.id)?.state === 'on_route');
  const list = filter === 'active' ? active : all;
  const activeRoutes = active
    .map((c) => routeById(db, activeScheduleFor(db, c.id)?.routeId))
    .filter((r) => !!r);
  const routes = filter === 'active' ? activeRoutes : db.routes;
  const visited = active.flatMap((c) => activeScheduleFor(db, c.id)?.visited ?? []);
  const live = active.filter((c) => gpsFor(db, c.id)?.sharing);
  return (
    <>
      <PageHeader
        title="Live Map"
        subtitle={`${live.length} collector(s) sharing live location · visible to admins and ${approvedResidentIds(db).length} verified residents`}
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Live Map' }]}
      />
      <div className="mb-4">
        <Alert tone="blue" icon={<Radio className="h-4 w-4" />}>
          The green <b>HALL</b> marker is the Barangay Hall. Collectors share their real device GPS when they
          press <b>Start Route · Share GPS</b>; the blue dot is your own location. Map data © OpenStreetMap
          contributors.
        </Alert>
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Barangay map"
          action={
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { id: 'active', label: 'On route', count: active.length },
                { id: 'all', label: 'All', count: all.length },
              ]}
            />
          }
        >
          <MapView
            db={db}
            routes={routes}
            markers={collectorMarkers(db, list)}
            visited={visited}
            showPuroks={false}
            myLocation={myPos}
          />
        </Card>
        <div className="space-y-3 xl:col-span-2">
          {list.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Radio className="h-6 w-6" />}
                title={filter === 'active' ? 'No collectors on route' : 'No active collectors'}
                message="Collectors appear here when they start a route."
              />
            </Card>
          ) : (
            list.map((c) => <CollectorTrackingCard key={c.id} db={db} collector={c} />)
          )}
        </div>
      </div>
    </>
  );
}
