import { useState } from 'react';
import { Plus, Trash2, Truck as TruckIcon, Wrench, CheckCircle2 } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, nextCode, notify, userName, useStore } from '../../lib/store';
import { isPlate } from '../../lib/validation';
import { nowISO } from '../../lib/time';
import { uid } from '../../lib/storage';
import {
  Alert,
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
  StatCard,
  StatusBadge,
  TableWrap,
  Textarea,
  td,
  th,
  useToast,
} from '../../components/ui';
const TYPES = ['Compactor Truck', 'Dump Truck', 'Mini Dump Truck', 'Tricycle (Garbage)', 'Pickup Truck'];
export default function AdminTrucks() {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const count = (s) => db.trucks.filter((t) => t.status === s).length;
  const remove = () => {
    if (!del) return;
    commit((d) => {
      d.trucks = d.trucks.filter((t) => t.id !== del.id);
      addLog(d, actorOf(admin), 'Truck removed', `Removed vehicle ${del.vehicleId} (${del.plate}).`);
    });
    setDel(null);
    toast.success('Vehicle removed.');
  };
  return (
    <>
      <PageHeader
        title="Trucks & Vehicles"
        subtitle="Manage collection vehicles and assignments."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Trucks' }]}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ id: null })}>
            Add vehicle
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active" value={count('active')} icon={<TruckIcon className="h-5 w-5" />} />
        <StatCard
          label="Available"
          value={count('available')}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Maintenance"
          value={count('maintenance')}
          icon={<Wrench className="h-5 w-5" />}
          tone="amber"
        />
      </div>
      <Card bodyClass="p-0 sm:p-0">
        {db.trucks.length === 0 ? (
          <EmptyState
            icon={<TruckIcon className="h-6 w-6" />}
            title="No vehicles yet"
            message="Use the Add vehicle button above to register a truck."
          />
        ) : (
          <div className="px-4 sm:px-5">
            <TableWrap>
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Vehicle</th>
                  <th className={th}>Plate</th>
                  <th className={th}>Type</th>
                  <th className={th}>Capacity</th>
                  <th className={th}>Collector</th>
                  <th className={th}>Status</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {db.trucks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60">
                    <td className={td}>
                      <p className="font-medium text-gray-900">{t.vehicleId}</p>
                      <p className="text-xs text-gray-500">{t.model}</p>
                      {t.notes && (
                        <p className="max-w-[200px] truncate text-xs text-gray-400" title={t.notes}>
                          {t.notes}
                        </p>
                      )}
                    </td>
                    <td className={`${td} font-mono text-xs`}>{t.plate}</td>
                    <td className={td}>{t.type}</td>
                    <td className={`${td} whitespace-nowrap`}>{t.capacityKg.toLocaleString()} kg</td>
                    <td className={td}>{userName(db, t.collectorId)}</td>
                    <td className={td}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <div className="flex justify-end gap-1">
                        <EditButton label={`Edit ${t.vehicleId}`} onClick={() => setForm({ id: t.id })} />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-8 px-0 text-red-600 hover:bg-red-50"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => setDel(t)}
                          aria-label={`Remove ${t.vehicleId}`}
                          title="Remove"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </Card>
      {form && <TruckForm id={form.id} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!del}
        title={`Remove ${del?.vehicleId}?`}
        message="The vehicle record will be deleted permanently."
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </>
  );
}
function TruckForm({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const ex = id ? db.trucks.find((t) => t.id === id) : undefined;
  const [f, setF] = useState({
    plate: ex?.plate ?? '',
    model: ex?.model ?? '',
    type: ex?.type ?? TYPES[0],
    capacityKg: ex ? String(ex.capacityKg) : '',
    collectorId: ex?.collectorId ?? '',
    status: ex?.status ?? 'available',
    notes: ex?.notes ?? '',
  });
  const [e, setE] = useState({});
  const collectors = db.users.filter((u) => u.role === 'collector' && u.active);
  const holder = f.collectorId
    ? db.trucks.find((t) => t.collectorId === f.collectorId && t.id !== id)
    : undefined;
  const save = () => {
    const err = {};
    const plate = f.plate.trim().toUpperCase();
    // Keep the existing ID when editing; auto-generate the next TRK-NN for a new vehicle.
    const vid =
      ex?.vehicleId ??
      nextCode(
        db.trucks.map((t) => t.vehicleId),
        'TRK-',
        2,
      );
    if (!isPlate(plate)) err.plate = 'Use a PH plate format, e.g. NBC 1234.';
    else if (
      db.trucks.some((t) => t.id !== id && t.plate.replace(/[\s-]/g, '') === plate.replace(/[\s-]/g, ''))
    )
      err.plate = 'Plate number already registered.';
    if (f.model.trim().length < 2) err.model = 'Vehicle model is required.';
    const cap = Number(f.capacityKg);
    if (!f.capacityKg || !Number.isFinite(cap) || cap < 100 || cap > 30000)
      err.capacityKg = 'Capacity must be between 100 and 30,000 kg.';
    if (f.status === 'maintenance' && f.collectorId)
      err.collectorId = 'Vehicles under maintenance cannot be assigned to a collector.';
    setE(err);
    if (Object.keys(err).length) return;
    const tid = id ?? uid('tr-');
    commit((d) => {
      if (f.collectorId)
        d.trucks.forEach((t) => {
          if (t.id !== tid && t.collectorId === f.collectorId) {
            t.collectorId = null;
            if (t.status === 'active') t.status = 'available';
          }
        });
      let t = d.trucks.find((x) => x.id === tid);
      if (!t) {
        t = {
          id: tid,
          vehicleId: '',
          plate: '',
          model: '',
          type: '',
          capacityKg: 0,
          collectorId: null,
          status: 'available',
          notes: '',
          createdAt: nowISO(),
        };
        d.trucks.push(t);
      }
      const prevCol = t.collectorId;
      Object.assign(t, {
        vehicleId: vid,
        plate,
        model: f.model.trim(),
        type: f.type,
        capacityKg: Math.round(cap),
        collectorId: f.collectorId || null,
        status: f.collectorId && f.status === 'available' ? 'active' : f.status,
        notes: f.notes.trim(),
      });
      if (f.collectorId && prevCol !== f.collectorId)
        notify(d, [f.collectorId], {
          title: 'Vehicle assigned',
          message: `You were assigned vehicle ${vid} (${plate}).`,
          type: 'system',
          link: '/collector',
        });
      addLog(
        d,
        actorOf(admin),
        id ? 'Truck updated' : 'Truck added',
        `${id ? 'Updated' : 'Added'} vehicle ${vid} (${plate})${f.collectorId ? ` assigned to ${userName(d, f.collectorId)}` : ''}.`,
      );
    });
    toast.success(id ? 'Vehicle updated.' : 'Vehicle added.');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={id ? `Edit ${ex?.vehicleId}` : 'Add vehicle'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{id ? 'Save changes' : 'Add vehicle'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {id ? (
          <Field label="Vehicle ID" htmlFor="t-id">
            <Input
              id="t-id"
              value={ex?.vehicleId ?? ''}
              readOnly
              aria-readonly
              className="bg-gray-50 text-gray-600"
            />
          </Field>
        ) : (
          <Field label="Vehicle ID" htmlFor="t-id" hint="Generated automatically.">
            <Input
              id="t-id"
              value={nextCode(
                db.trucks.map((t) => t.vehicleId),
                'TRK-',
                2,
              )}
              readOnly
              aria-readonly
              className="bg-gray-50 text-gray-600"
            />
          </Field>
        )}
        <Field label="Plate number" htmlFor="t-plate" required error={e.plate}>
          <Input
            id="t-plate"
            value={f.plate}
            onChange={(ev) => setF({ ...f, plate: ev.target.value })}
            invalid={!!e.plate}
            placeholder="NBC 1234"
          />
        </Field>
        <Field label="Model" htmlFor="t-model" required error={e.model}>
          <Input
            id="t-model"
            value={f.model}
            onChange={(ev) => setF({ ...f, model: ev.target.value })}
            invalid={!!e.model}
            placeholder="Isuzu Elf"
          />
        </Field>
        <Field label="Vehicle type" htmlFor="t-type" required>
          <Select id="t-type" value={f.type} onChange={(ev) => setF({ ...f, type: ev.target.value })}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Carrying capacity (kg)" htmlFor="t-cap" required error={e.capacityKg}>
          <Input
            id="t-cap"
            type="number"
            inputMode="numeric"
            min={100}
            max={30000}
            value={f.capacityKg}
            onChange={(ev) => setF({ ...f, capacityKg: ev.target.value })}
            invalid={!!e.capacityKg}
          />
        </Field>
        <Field label="Status" htmlFor="t-status" required>
          <Select id="t-status" value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value })}>
            <option value="active">Active</option>
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
          </Select>
        </Field>
        <Field label="Assigned collector" htmlFor="t-col" error={e.collectorId} className="sm:col-span-2">
          <Select
            id="t-col"
            value={f.collectorId}
            onChange={(ev) => setF({ ...f, collectorId: ev.target.value })}
            invalid={!!e.collectorId}
          >
            <option value="">Unassigned</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {holder && (
          <div className="sm:col-span-2">
            <Alert tone="amber">
              {userName(db, f.collectorId)} currently uses {holder.vehicleId}. Saving will reassign them to
              this vehicle.
            </Alert>
          </div>
        )}
        <Field label="Notes (optional)" htmlFor="t-notes" className="sm:col-span-2">
          <Textarea id="t-notes" value={f.notes} onChange={(ev) => setF({ ...f, notes: ev.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
