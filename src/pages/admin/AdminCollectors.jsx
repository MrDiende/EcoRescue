import { useState } from 'react';
import { Eye, Plus, Power, UserCog } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { createAuthSignupClient, supabase } from '../../lib/supabase';
import { edgeFunctionError } from '../../lib/supabaseData';
import {
  actorOf,
  addLog,
  ensureGps,
  gpsFor,
  notify,
  routeById,
  scheduleSort,
  truckFor,
  useStore,
} from '../../lib/store';
import { DEFAULT_ADDRESS, PUROKS, sortPuroks } from '../../lib/geography';
import { formatDate, formatDayDate, formatTime, nowISO, timeAgo, todayISO } from '../../lib/time';
import { uid } from '../../lib/storage';
import {
  combineName,
  isEmail,
  isPhone,
  normalizePhone,
  passwordProblem,
  splitName,
} from '../../lib/validation';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DetailRow,
  EditButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  PurokPicker,
  SearchInput,
  Select,
  StatusBadge,
  TableWrap,
  td,
  th,
  useToast,
} from '../../components/ui';
export default function AdminCollectors() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [viewId, setViewId] = useState(null);
  const list = db.users
    .filter((u) => u.role === 'collector')
    .filter((u) => {
      const s = q.toLowerCase().trim();
      return (
        !s ||
        u.name.toLowerCase().includes(s) ||
        u.code.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s)
      );
    });
  return (
    <>
      <PageHeader
        title="Collectors"
        subtitle="Manage collector accounts, route and Purok assignments."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Collectors' }]}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ id: null })}>
            Add collector
          </Button>
        }
      />
      <Card bodyClass="p-0 sm:p-0">
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search name, email or ID"
            className="sm:max-w-xs"
          />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<UserCog className="h-6 w-6" />} title="No collectors found" />
        ) : (
          <div className="px-4 sm:px-5">
            <TableWrap>
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Collector</th>
                  <th className={th}>Route</th>
                  <th className={th}>Puroks</th>
                  <th className={th}>Vehicle</th>
                  <th className={th}>GPS</th>
                  <th className={th}>Account</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c) => {
                  const g = gpsFor(db, c.id);
                  const t = truckFor(db, c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/60">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div>
                            <p className="font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-500">
                              {c.code} · {c.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={td}>
                        {routeById(db, c.routeId)?.name ?? <span className="text-gray-400">None</span>}
                      </td>
                      <td className={td}>
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {(c.puroks ?? []).length ? (
                            sortPuroks(c.puroks ?? []).map((p) => (
                              <Badge key={p}>{p.replace('Purok ', 'P')}</Badge>
                            ))
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className={td}>
                        {t ? (
                          <span className="whitespace-nowrap">
                            {t.vehicleId} · {t.plate}
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className={td}>
                        <StatusBadge status={g?.state ?? 'offline'} />
                        <p className="mt-1 text-xs text-gray-500">{g?.sharing ? 'Sharing' : 'Not sharing'}</p>
                      </td>
                      <td className={td}>
                        <StatusBadge status={c.active ? 'active' : 'inactive'} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<Eye className="h-4 w-4" />}
                            aria-label={`View ${c.name}`}
                            title="View details"
                            onClick={() => setViewId(c.id)}
                          />
                          <EditButton label={`Edit ${c.name}`} onClick={() => setForm({ id: c.id })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </div>
        )}
      </Card>
      {form && <CollectorForm id={form.id} onClose={() => setForm(null)} />}
      {viewId && (
        <CollectorDetails
          id={viewId}
          onClose={() => setViewId(null)}
          onEdit={() => {
            setForm({ id: viewId });
            setViewId(null);
          }}
        />
      )}
    </>
  );
}
function CollectorForm({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit, reload } = useStore();
  const toast = useToast();
  const existing = id ? db.users.find((u) => u.id === id) : undefined;
  const ex0 = splitName(existing?.name ?? '');
  const [f, setF] = useState({
    firstName: ex0.first,
    lastName: ex0.last,
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    address: existing?.address || DEFAULT_ADDRESS,
    purok: existing?.purok ?? PUROKS[0],
    password: '',
  });
  const [e, setE] = useState({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const err = {};
    if (f.firstName.trim().length < 2) err.firstName = 'First name is required.';
    if (f.lastName.trim().length < 2) err.lastName = 'Last name is required.';
    if (!isEmail(f.email)) err.email = 'Enter a valid email.';
    else if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === f.email.trim().toLowerCase()))
      err.email = 'Email is already in use.';
    if (!isPhone(f.phone)) err.phone = 'Enter a valid PH mobile number.';
    if (f.address.trim().length < 5) err.address = 'Address is required.';
    if (!id || f.password) {
      const p = passwordProblem(f.password);
      if (p) err.password = p;
    }
    setE(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    const payload = {
      email: f.email.trim().toLowerCase(),
      name: combineName(f.firstName, f.lastName),
      phone: normalizePhone(f.phone),
      address: f.address.trim(),
      purok: f.purok,
      password: f.password,
    };
    try {
      let collectorId;
      let collectorCode;
      let needsEmailConfirmation = false;
      if (id) {
        const { data, error } = await supabase.functions.invoke('admin-manage-account', {
          body: { action: 'update', userId: id, ...payload },
        });
        if (error) throw new Error(await edgeFunctionError(error));
        if (!data?.userId) throw new Error('Supabase did not return a collector account ID.');
        collectorId = data.userId;
        collectorCode = existing?.code;
      } else {
        collectorId = uid('u-');
        const inviteToken = crypto.randomUUID();
        const highestCode = db.users
          .filter((user) => user.role === 'collector')
          .reduce((highest, user) => {
            const match = /^C-(\d+)$/.exec(user.code);
            return match ? Math.max(highest, Number(match[1])) : highest;
          }, 0);
        collectorCode = `C-${String(highestCode + 1).padStart(3, '0')}`;
        const { error: inviteError } = await supabase.from('users').insert({
          id: collectorId,
          auth_user_id: null,
          code: collectorCode,
          role: 'collector',
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          purok: payload.purok,
          active: true,
          created_at: nowISO(),
          puroks: [],
          route_id: null,
          collector_invite_token: inviteToken,
        });
        if (inviteError) throw new Error(`Could not save the collector invitation: ${inviteError.message}`);

        const signupClient = createAuthSignupClient();
        const { data, error } = await signupClient.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              name: payload.name,
              phone: payload.phone,
              address: payload.address,
              purok: payload.purok,
              collector_invite_token: inviteToken,
            },
          },
        });
        needsEmailConfirmation = Boolean(data?.user && !data.session);
        if (error || !data.user || !data.user.identities?.length) {
          const { error: cleanupError } = await supabase
            .from('users')
            .delete()
            .eq('id', collectorId)
            .is('auth_user_id', null);
          if (cleanupError) {
            throw new Error(
              `Collector signup failed${error ? `: ${error.message}` : ''}. The unused invitation could not be removed: ${cleanupError.message}`,
            );
          }
          throw new Error(
            error?.message ??
              'An account with this email may already exist. Use a different email address.',
          );
        }
      }
      await reload();
      commit((d) => {
        const collector = d.users.find((u) => u.id === collectorId);
        if (!collector) return;
        ensureGps(d, collectorId);
        addLog(
          d,
          actorOf(admin),
          id ? 'Collector updated' : 'Collector created',
          `${id ? 'Updated' : 'Created'} collector ${collector.name} (${collector.code}).`,
        );
      });
      toast.success(
        id
          ? 'Collector updated.'
          : `Collector ${collectorCode} created. They can sign in with the email and password you set.${
              needsEmailConfirmation
                ? ' Turn off Confirm email in Supabase Auth settings before they sign in.'
                : ''
            }`,
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the collector account.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={id ? `Edit ${existing?.name}` : 'Add collector'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>{id ? 'Save changes' : 'Create collector'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="c-first" required error={e.firstName}>
          <Input
            id="c-first"
            autoComplete="given-name"
            value={f.firstName}
            onChange={(ev) => setF({ ...f, firstName: ev.target.value })}
            invalid={!!e.firstName}
          />
        </Field>
        <Field label="Last name" htmlFor="c-last" required error={e.lastName}>
          <Input
            id="c-last"
            autoComplete="family-name"
            value={f.lastName}
            onChange={(ev) => setF({ ...f, lastName: ev.target.value })}
            invalid={!!e.lastName}
          />
        </Field>
        <Field label="Email (used to sign in)" htmlFor="c-email" required error={e.email}>
          <Input
            id="c-email"
            type="email"
            value={f.email}
            onChange={(ev) => setF({ ...f, email: ev.target.value })}
            invalid={!!e.email}
          />
        </Field>
        <Field label="Phone" htmlFor="c-phone" required error={e.phone}>
          <Input
            id="c-phone"
            value={f.phone}
            onChange={(ev) => setF({ ...f, phone: ev.target.value })}
            invalid={!!e.phone}
            placeholder="09171234567"
          />
        </Field>
        <Field
          label={id ? 'New password (optional)' : 'Password'}
          htmlFor="c-pw"
          required={!id}
          error={e.password}
          hint={
            id
              ? 'Leave blank to keep the current password.'
              : '8+ chars, upper & lower case, number.'
          }
        >
          <PasswordInput
            id="c-pw"
            autoComplete="new-password"
            value={f.password}
            onChange={(ev) => setF({ ...f, password: ev.target.value })}
            invalid={!!e.password}
          />
        </Field>
        <Field
          label="Address"
          htmlFor="c-addr"
          hint="Set automatically for this barangay."
          className="sm:col-span-2"
        >
          <Input id="c-addr" value={f.address} readOnly aria-readonly className="bg-gray-50 text-gray-600" />
        </Field>
      </div>
    </Modal>
  );
}
function CollectorDetails({ id, onClose, onEdit }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const c = db.users.find((u) => u.id === id);
  const g = gpsFor(db, id);
  const t = truckFor(db, id);
  const today = todayISO();
  const mine = db.schedules.filter((s) => s.collectorId === id).sort(scheduleSort);
  const upcoming = mine.filter(
    (s) => s.date >= today && (s.status === 'scheduled' || s.status === 'in_progress'),
  );
  const history = mine.filter((s) => s.status === 'completed' || s.status === 'missed').reverse();
  const issues = db.issues.filter((i) => i.collectorId === id);
  const toggle = () => {
    if (c.active && g?.state === 'on_route') {
      toast.error('Collector is currently on route. End the route first.');
      setConfirm(false);
      return;
    }
    commit((d) => {
      const u = d.users.find((x) => x.id === id);
      u.active = !u.active;
      if (!u.active) {
        const gs = ensureGps(d, id);
        gs.state = 'offline';
        gs.sharing = false;
      } else {
        const gs = ensureGps(d, id);
        gs.state = 'available';
      }
      addLog(
        d,
        actorOf(admin),
        u.active ? 'Collector activated' : 'Collector deactivated',
        `${u.active ? 'Activated' : 'Deactivated'} ${u.name} (${u.code}).`,
      );
    });
    setConfirm(false);
    toast.success(c.active ? 'Collector deactivated.' : 'Collector activated.');
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Collector details"
      size="xl"
      footer={
        <>
          <Button variant="outline" icon={<Power className="h-4 w-4" />} onClick={() => setConfirm(true)}>
            {c.active ? 'Deactivate' : 'Activate'}
          </Button>
          <EditButton variant="outline" label={`Edit ${c.name} / assign route`} onClick={onEdit} />
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={c.name} className="h-12 w-12" />
            <div>
              <p className="font-semibold text-gray-900">{c.name}</p>
              <div className="flex gap-1">
                <StatusBadge status={c.active ? 'active' : 'inactive'} />
                <StatusBadge status={g?.state ?? 'offline'} />
              </div>
            </div>
          </div>
          <dl className="divide-y divide-gray-100">
            <DetailRow label="Collector ID">{c.code}</DetailRow>
            <DetailRow label="Email">{c.email}</DetailRow>
            <DetailRow label="Phone">{c.phone}</DetailRow>
            <DetailRow label="Route">{routeById(db, c.routeId)?.name ?? 'None'}</DetailRow>
            <DetailRow label="Puroks">{(c.puroks ?? []).join(', ') || 'None'}</DetailRow>
            <DetailRow label="Vehicle">
              {t ? `${t.vehicleId} · ${t.plate} · ${t.model} (${t.capacityKg.toLocaleString()} kg)` : 'None'}
            </DetailRow>
            <DetailRow label="GPS sharing">
              {g?.sharing ? `Sharing (${g.mode === 'browser' ? 'device GPS' : 'simulated'})` : 'Not sharing'}{' '}
              · last update {timeAgo(g?.updatedAt)}
            </DetailRow>
            <DetailRow label="Member since">{formatDate(c.createdAt)}</DetailRow>
          </dl>
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Assigned schedules ({upcoming.length})</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming schedules.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {upcoming.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                    <span>
                      {formatDayDate(s.date)} · {formatTime(s.time)}
                    </span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Collection history ({history.length})</p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No completed collections yet.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {history.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                    <span>
                      {formatDayDate(s.date)} · {routeById(db, s.routeId)?.name ?? '—'}
                    </span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Operational reports ({issues.length})</p>
            {issues.length === 0 ? (
              <p className="text-sm text-gray-500">No operational reports.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {issues.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                    <span className="truncate">
                      {i.code} · {i.description}
                    </span>
                    <StatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        tone={c.active ? 'danger' : 'primary'}
        title={c.active ? 'Deactivate collector?' : 'Activate collector?'}
        message={
          c.active
            ? 'The collector will not be able to sign in and will be set offline.'
            : 'The collector will be able to sign in again.'
        }
        confirmLabel={c.active ? 'Deactivate' : 'Activate'}
        onConfirm={toggle}
        onCancel={() => setConfirm(false)}
      />
    </Modal>
  );
}
