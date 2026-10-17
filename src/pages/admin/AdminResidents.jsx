import { useState } from 'react';
import { CheckCircle2, Eye, Power, RotateCcw, Trash2, Users, XCircle } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { edgeFunctionError } from '../../lib/supabaseData';
import { actorOf, addLog, notify, useStore } from '../../lib/store';
import { PUROKS, purokLabel } from '../../lib/geography';
import { formatDate, formatDateTime, nowISO } from '../../lib/time';
import { templates } from '../../lib/email';
import { combineName, isEmail, isPhone, normalizePhone, splitName } from '../../lib/validation';
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
  SearchInput,
  Select,
  StatusBadge,
  TableWrap,
  Tabs,
  Textarea,
  td,
  th,
  useToast,
} from '../../components/ui';
export default function AdminResidents() {
  const admin = useCurrentUser();
  const { db, commit, reload } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [purok, setPurok] = useState('');
  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const all = db.users.filter((u) => u.role === 'resident');
  const list = all
    .filter((u) => tab === 'all' || u.status === tab)
    .filter((u) => !purok || u.purok === purok)
    .filter((u) => {
      const s = q.trim().toLowerCase();
      return (
        !s ||
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.code.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const viewing = all.find((u) => u.id === viewId);
  const count = (s) => all.filter((u) => u.status === s).length;
  const decide = async (action, reason = '') => {
    if (!viewing || decisionSaving) return;
    setDecisionSaving(true);
    try {
      const reviewedAt = nowISO();
      if (action === 'approve') {
        const { error } = await supabase
          .from('users')
          .update({
            status: 'approved',
            reviewed_at: reviewedAt,
            reviewed_by: admin.name,
            updated_at: reviewedAt,
          })
          .eq('id', viewing.id)
          .eq('role', 'resident');
        if (error) throw new Error(`Could not approve the resident application: ${error.message}`);
      }

      commit((d) => {
        const u = d.users.find((x) => x.id === viewing.id);
        if (!u) return;
        u.reviewedAt = reviewedAt;
        u.reviewedBy = admin.name;
        u.updatedAt = reviewedAt;
        if (action === 'approve') {
          u.status = 'approved';
          u.rejectionReason = undefined;
          notify(d, [u.id], {
            ...templates.applicationApproved(u.name.split(' ')[0]),
            type: 'application',
            link: '/resident',
          });
          addLog(
            d,
            actorOf(admin),
            'Resident approved',
            `Approved residency application of ${u.name} (${u.code}).`,
          );
        } else if (action === 'reject') {
          u.status = 'rejected';
          u.rejectionReason = reason;
          notify(d, [u.id], {
            ...templates.applicationRejected(reason),
            type: 'application',
            link: '/resident',
          });
          addLog(
            d,
            actorOf(admin),
            'Resident rejected',
            `Rejected application of ${u.name} (${u.code}): ${reason}`,
          );
        } else {
          u.status = 'pending';
          u.rejectionReason = undefined;
          notify(d, [u.id], { ...templates.applicationReopened(), type: 'application', link: '/resident' });
          addLog(
            d,
            actorOf(admin),
            'Application reopened',
            `Reopened application of ${u.name} (${u.code}) for review.`,
          );
        }
      });
      setConfirm(null);
      toast.success(
        action === 'approve'
          ? 'Application approved. The resident can now sign in.'
          : action === 'reject'
            ? 'Application rejected. Resident notified.'
            : 'Application reopened for review.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the resident application.');
    } finally {
      setDecisionSaving(false);
    }
  };
  const toggleActive = () => {
    if (!viewing) return;
    commit((d) => {
      const u = d.users.find((x) => x.id === viewing.id);
      if (!u) return;
      u.active = !u.active;
      u.updatedAt = nowISO();
      addLog(
        d,
        actorOf(admin),
        u.active ? 'Resident activated' : 'Resident deactivated',
        `${u.active ? 'Activated' : 'Deactivated'} access for ${u.name} (${u.code}).`,
      );
    });
    setConfirm(null);
    toast.success(viewing.active ? 'Resident access deactivated.' : 'Resident access activated.');
  };
  const delTarget = all.find((u) => u.id === delId) ?? (confirm === 'delete' ? viewing : undefined);
  const removeResident = async () => {
    if (!delTarget) return;
    try {
      const { error } = await supabase.functions.invoke('admin-manage-account', {
        body: { action: 'delete-resident', userId: delTarget.id },
      });
      if (error) throw new Error(await edgeFunctionError(error));
      await reload();
      commit((d) =>
        addLog(
          d,
          actorOf(admin),
          'Resident request deleted',
          `Deleted ${delTarget.status} application of ${delTarget.name} (${delTarget.code}).`,
        ),
      );
      setConfirm(null);
      setDelId(null);
      if (viewing?.id === delTarget.id) setViewId(null);
      toast.success('Resident request deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the resident account.');
    }
  };
  return (
    <>
      <PageHeader
        title="Residents"
        subtitle="Review residency applications and manage resident records."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Residents' }]}
      />
      <Card bodyClass="p-0 sm:p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: all.length },
              { id: 'pending', label: 'Pending', count: count('pending') },
              { id: 'approved', label: 'Approved', count: count('approved') },
              { id: 'rejected', label: 'Rejected', count: count('rejected') },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search name, email or ID"
              className="sm:w-64"
            />
            <Select
              aria-label="Filter by Purok"
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              className="sm:w-40"
            >
              <option value="">All Puroks</option>
              {PUROKS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No residents found"
            message="Try changing the search or filters."
          />
        ) : (
          <div className="px-4 sm:px-5">
            <div className="grid gap-3 py-4 sm:grid-cols-2 lg:hidden">
              {list.map((u) => (
                <article key={u.id} className="min-w-0 rounded-xl border border-gray-200 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{u.name}</p>
                        <p className="truncate text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <StatusBadge status={u.status ?? 'pending'} />
                      {!u.active && <StatusBadge status="inactive" />}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-gray-600">{u.code}</span>
                    <span className="text-gray-500">{purokLabel(u.purok)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                    <div className="min-w-0 text-xs text-gray-500">
                      <p>Registered {formatDate(u.createdAt)}</p>
                      {u.reviewedAt && <p className="mt-1">Reviewed {formatDate(u.reviewedAt)}</p>}
                    </div>
                    <div className="flex shrink-0 justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye className="h-4 w-4" />}
                        aria-label={`View ${u.name}`}
                        title="View details"
                        onClick={() => setViewId(u.id)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-8 px-0 text-red-600 hover:bg-red-50"
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label={`Delete ${u.name}`}
                        title="Delete request"
                        onClick={() => setDelId(u.id)}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden lg:block">
              <TableWrap>
                <thead className="bg-gray-50">
                  <tr>
                    <th className={th}>Resident</th>
                    <th className={th}>ID</th>
                    <th className={th}>Purok</th>
                    <th className={th}>Status</th>
                    <th className={th}>Registered</th>
                    <th className={th}>Reviewed</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/60">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} font-mono text-xs`}>{u.code}</td>
                      <td className={td}>{u.purok}</td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={u.status ?? 'pending'} />
                          {!u.active && <StatusBadge status="inactive" />}
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDate(u.createdAt)}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {u.reviewedAt ? formatDate(u.reviewedAt) : '—'}
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<Eye className="h-4 w-4" />}
                            aria-label={`View ${u.name}`}
                            title="View details"
                            onClick={() => setViewId(u.id)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-8 px-0 text-red-600 hover:bg-red-50"
                            icon={<Trash2 className="h-4 w-4" />}
                            aria-label={`Delete ${u.name}`}
                            title="Delete request"
                            onClick={() => setDelId(u.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={!!viewing}
        onClose={() => setViewId(null)}
        title="Resident details"
        size="lg"
        footer={
          viewing && (
            <>
              <EditButton
                variant="outline"
                label={`Edit ${viewing.name}`}
                onClick={() => setEditId(viewing.id)}
              />
              <Button
                variant="outline"
                icon={<Power className="h-4 w-4" />}
                onClick={() => setConfirm('toggle')}
              >
                {viewing.active ? 'Deactivate' : 'Activate'}
              </Button>
              {viewing.status === 'rejected' && (
                <Button
                  variant="warning"
                  icon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => setConfirm('reopen')}
                >
                  Reopen review
                </Button>
              )}
              {viewing.status === 'rejected' && (
                <Button
                  variant="danger"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setConfirm('delete')}
                >
                  Delete request
                </Button>
              )}
              {viewing.status !== 'rejected' && (
                <Button
                  variant="danger"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => setConfirm('reject')}
                >
                  Reject
                </Button>
              )}
              {viewing.status !== 'approved' && (
                <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setConfirm('approve')}>
                  Approve
                </Button>
              )}
            </>
          )
        }
      >
        {viewing && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={viewing.name} className="h-12 w-12 text-sm" />
                <div>
                  <p className="font-semibold text-gray-900">{viewing.name}</p>
                  <div className="flex gap-1">
                    <StatusBadge status={viewing.status ?? 'pending'} />
                    {!viewing.active && <StatusBadge status="inactive" />}
                  </div>
                </div>
              </div>
              <dl className="divide-y divide-gray-100">
                <DetailRow label="Resident ID">{viewing.code}</DetailRow>
                <DetailRow label="Email">{viewing.email}</DetailRow>
                <DetailRow label="Phone">{viewing.phone}</DetailRow>
                <DetailRow label="Address">{viewing.address}</DetailRow>
                <DetailRow label="Purok">{purokLabel(viewing.purok)}</DetailRow>
                <DetailRow label="Registered">{formatDateTime(viewing.createdAt)}</DetailRow>
                <DetailRow label="Reviewed">
                  {viewing.reviewedAt
                    ? `${formatDateTime(viewing.reviewedAt)} by ${viewing.reviewedBy}`
                    : 'Not yet reviewed'}
                </DetailRow>
                <DetailRow label="Reports filed">
                  {db.reports.filter((r) => r.residentId === viewing.id).length}
                </DetailRow>
              </dl>
              {viewing.status === 'rejected' && viewing.rejectionReason && (
                <div className="mt-3">
                  <Alert tone="red" title="Rejection reason">
                    {viewing.rejectionReason}
                  </Alert>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Proof of residency</p>
              {viewing.proofImage ? (
                <a href={viewing.proofImage} target="_blank" rel="noreferrer">
                  <img
                    src={viewing.proofImage}
                    alt={`Proof of residency submitted by ${viewing.name}`}
                    className="w-full rounded-lg border border-gray-200 object-contain"
                  />
                </a>
              ) : (
                <EmptyState title="No image submitted" />
              )}
              <p className="mt-2 text-xs text-gray-500">Click the image to open it in full size.</p>
            </div>
          </div>
        )}
      </Modal>

      {editId && <EditResident id={editId} onClose={() => setEditId(null)} />}

      <ConfirmDialog
        open={confirm === 'approve'}
        tone="primary"
        title="Approve application?"
        message={
          <>
            Approve <b>{viewing?.name}</b> as a verified resident? They can then sign in and submit waste reports.
          </>
        }
        confirmLabel="Approve"
        onConfirm={() => decide('approve')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reject'}
        title="Reject application"
        message={
          <>
            Provide a reason so <b>{viewing?.name}</b> knows what to fix.
          </>
        }
        confirmLabel="Reject"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="e.g. The document is unreadable."
        onConfirm={(r) => decide('reject', r)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        tone="warning"
        title="Reopen application?"
        message="The application will return to Pending status for another review."
        confirmLabel="Reopen"
        onConfirm={() => decide('reopen')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'toggle'}
        tone={viewing?.active ? 'danger' : 'primary'}
        title={viewing?.active ? 'Deactivate resident?' : 'Activate resident?'}
        message={
          viewing?.active
            ? 'The resident will no longer be able to sign in.'
            : 'The resident will be able to sign in again.'
        }
        confirmLabel={viewing?.active ? 'Deactivate' : 'Activate'}
        onConfirm={toggleActive}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete' || !!delId}
        title="Delete resident request?"
        message={
          <>
            This permanently removes <b>{delTarget?.name}</b>'s application and records from the barangay
            list. This cannot be undone.
          </>
        }
        confirmLabel="Delete request"
        onConfirm={removeResident}
        onCancel={() => {
          setConfirm(null);
          setDelId(null);
        }}
      />
    </>
  );
}
function EditResident({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit, reload } = useStore();
  const toast = useToast();
  const u = db.users.find((x) => x.id === id);
  const u0 = splitName(u.name);
  const [f, setF] = useState({
    firstName: u0.first,
    lastName: u0.last,
    email: u.email,
    phone: u.phone,
    address: u.address,
    purok: u.purok,
  });
  const [e, setE] = useState({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const err = {};
    if (f.firstName.trim().length < 2) err.firstName = 'First name is required.';
    if (f.lastName.trim().length < 2) err.lastName = 'Last name is required.';
    if (!isEmail(f.email)) err.email = 'Enter a valid email.';
    else if (db.users.some((x) => x.id !== id && x.email.toLowerCase() === f.email.trim().toLowerCase()))
      err.email = 'Email is already used by another account.';
    if (!isPhone(f.phone)) err.phone = 'Enter a valid PH mobile number.';
    if (f.address.trim().length < 5) err.address = 'Address is required.';
    setE(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    const name = combineName(f.firstName, f.lastName);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-account', {
        body: {
          action: 'update-resident',
          userId: id,
          name,
          email: f.email.trim().toLowerCase(),
          phone: normalizePhone(f.phone),
          address: f.address.trim(),
          purok: f.purok,
        },
      });
      if (error) throw new Error(await edgeFunctionError(error));
      await reload();
      commit((d) => {
        addLog(d, actorOf(admin), 'Resident updated', `Updated information of ${name} (${u.code}).`);
        notify(d, [id], {
          title: 'Profile updated by barangay',
          message: 'An administrator updated your resident information.',
          type: 'system',
          link: '/resident/profile',
        });
      });
      toast.success('Resident information updated.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the resident account.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${u.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="er-first" required error={e.firstName}>
          <Input
            id="er-first"
            value={f.firstName}
            onChange={(ev) => setF({ ...f, firstName: ev.target.value })}
            invalid={!!e.firstName}
          />
        </Field>
        <Field label="Last name" htmlFor="er-last" required error={e.lastName}>
          <Input
            id="er-last"
            value={f.lastName}
            onChange={(ev) => setF({ ...f, lastName: ev.target.value })}
            invalid={!!e.lastName}
          />
        </Field>
        <Field label="Email" htmlFor="er-email" required error={e.email}>
          <Input
            id="er-email"
            type="email"
            value={f.email}
            onChange={(ev) => setF({ ...f, email: ev.target.value })}
            invalid={!!e.email}
          />
        </Field>
        <Field label="Phone" htmlFor="er-phone" required error={e.phone}>
          <Input
            id="er-phone"
            value={f.phone}
            onChange={(ev) => setF({ ...f, phone: ev.target.value })}
            invalid={!!e.phone}
          />
        </Field>
        <Field label="Address" htmlFor="er-addr" required error={e.address} className="sm:col-span-2">
          <Textarea
            id="er-addr"
            rows={2}
            value={f.address}
            onChange={(ev) => setF({ ...f, address: ev.target.value })}
            invalid={!!e.address}
          />
        </Field>
        <Field label="Purok" htmlFor="er-purok" required>
          <Select id="er-purok" value={f.purok} onChange={(ev) => setF({ ...f, purok: ev.target.value })}>
            {PUROKS.map((p) => (
              <option key={p} value={p}>
                {purokLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Badge tone="gray">Status changes are made from the details view.</Badge>
        </div>
      </div>
    </Modal>
  );
}
