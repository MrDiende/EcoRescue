import { useEffect, useState } from 'react';
import { Calendar, Lock, Navigation } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { canViewLiveLocation, routeById, scheduleSort, userById, userName, useStore } from '../../lib/store';
import { formatDayDate, formatTime, todayISO } from '../../lib/time';
import { Alert, Badge, Card, EmptyState, PageHeader } from '../../components/ui';
import { CollectorTrackingCard, collectorMarkers } from '../../components/LiveTracking';
import { MapView } from '../../components/OsmMap';
import { useMyLocation } from '../../components/RouteSharing';
import { VerificationBanner } from './ResidentPages';
export default function ResidentTracking() {
  const user = useCurrentUser();
  const { db } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const approved = canViewLiveLocation(user);
  const { pos: myPos, error: myLocError } = useMyLocation(approved);
  const t = todayISO();
  const next = db.schedules
    .filter((s) => s.status === 'scheduled' && s.date >= t && s.puroks.includes(user.purok))
    .sort(scheduleSort)[0];
  if (!approved) {
    return (
      <>
        <PageHeader title="Live Tracking" subtitle="Follow collection trucks in real time." />
        <VerificationBanner />
        <Card>
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="Live truck locations are shared with verified residents only"
            message={`Once the barangay approves your proof of residency, you can see collectors' live GPS positions here.${next ? ` Your next collection: ${formatDayDate(next.date)} at ${formatTime(next.time)}.` : ''}`}
          />
        </Card>
      </>
    );
  }
  // Verified residents see every active collection; those serving their Purok come first.
  const active = db.schedules
    .filter((s) => s.status === 'in_progress')
    .sort(
      (a, b) =>
        Number(b.puroks.includes(user.purok)) - Number(a.puroks.includes(user.purok)) || scheduleSort(a, b),
    );
  const collectors = active.map((s) => userById(db, s.collectorId)).filter((u) => !!u);
  const routes = active.map((s) => routeById(db, s.routeId)).filter((r) => !!r);
  const servingMe = active.some((s) => s.puroks.includes(user.purok));
  return (
    <>
      <PageHeader
        title="Live Tracking"
        subtitle={`Live collection trucks in the barangay · your area: ${user.purok}`}
      />
      <div className="mb-4">
        <Alert tone="blue" icon={<Navigation className="h-4 w-4" />}>
          Collectors share their live GPS location from their phones while on a route. The blue dot is your
          own location. Arrival times are estimates. Map data © OpenStreetMap contributors.
        </Alert>
      </div>
      {myLocError && (
        <div className="mb-4">
          <Alert tone="amber">
            Your location isn't shown: {myLocError} Allow location access to see where you are on the map.
          </Alert>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Map">
          <MapView
            db={db}
            routes={routes}
            markers={collectorMarkers(db, collectors)}
            visited={active.flatMap((s) => s.visited)}
            showPuroks={false}
            myLocation={myPos}
            followId={collectors.length === 1 ? collectors[0].id : null}
          />
        </Card>
        <div className="space-y-3 xl:col-span-2">
          {active.length > 0 && !servingMe && (
            <Alert tone="gray">
              No truck is serving {user.purok} right now. Other live trucks are shown below.
            </Alert>
          )}
          {active.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="No collection truck is live right now"
                message={
                  next
                    ? `Next collection for ${user.purok}: ${formatDayDate(next.date)} at ${formatTime(next.time)} · ${routeById(db, next.routeId)?.name ?? ''} · ${userName(db, next.collectorId)}`
                    : 'There is no upcoming collection scheduled for your Purok.'
                }
              />
            </Card>
          ) : (
            active.map((s) => {
              const c = userById(db, s.collectorId);
              const mine = s.puroks.includes(user.purok);
              return (
                <div key={s.id} className="space-y-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-700">
                    {formatTime(s.time)} · {routeById(db, s.routeId)?.name ?? 'Collection'}{' '}
                    {mine && <Badge tone="green">Serves your Purok</Badge>}
                  </p>
                  {c ? (
                    <CollectorTrackingCard
                      db={db}
                      collector={c}
                      targetPurok={mine ? user.purok : undefined}
                    />
                  ) : (
                    <Card>
                      <p className="text-sm text-gray-500">No collector assigned.</p>
                    </Card>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
