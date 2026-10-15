import { useState } from 'react';
import { Download, Eye, FileText, Save, XCircle } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, notify, userName, useStore } from '../../lib/store';
import { PUROKS } from '../../lib/geography';
import { formatDate, formatDateTime, nowISO } from '../../lib/time';
import { REPORT_STATUS_LABEL, templates } from '../../lib/email';
import { downloadCSV, toCSV } from '../../lib/storage';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  TableWrap,
  Textarea,
  td,
  th,
  useToast,
} from '../../components/ui';
import { CATEGORIES, CategoryTag, categoryLabel } from '../../components/WasteCategoryPicker';
import ReportDetails from '../../components/ReportDetails';
export default function AdminReports() {
  const { db } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [purok, setPurok] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const filtered = db.reports
    .filter((r) => !cat || r.category === cat)
    .filter((r) => !purok || r.purok === purok)
    .filter((r) => !status || r.status === status)
    .filter((r) => {
      const s = q.trim().toLowerCase();
      return (
        !s ||
        r.code.toLowerCase().includes(s) ||
        r.location.toLowerCase().includes(s) ||
        userName(db, r.residentId, '').toLowerCase().includes(s)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportCsv = () => {
    if (!filtered.length) {
      toast.error('No reports to export with the current filters.');
      return;
    }
    const csv = toCSV(
      [
        'Report ID',
        'Status',
        'Category',
        'Description',
        'Location',
        'Purok',
        'Resident',
        'Resident ID',
        'Assigned Collector',
        'Resolution Notes',
        'Rejection Reason',
        'Submitted',
        'Last Updated',
      ],
      filtered.map((r) => [
        r.code,
        REPORT_STATUS_LABEL[r.status],
        categoryLabel(r.category),
        r.description,
        r.location,
        r.purok,
        userName(db, r.residentId, 'Unknown'),
        db.users.find((u) => u.id === r.residentId)?.code ?? '',
        userName(db, r.collectorId, ''),
        r.resolutionNotes,
        r.rejectionReason ?? '',
        formatDateTime(r.createdAt),
        formatDateTime(r.updatedAt),
      ]),
    );
    downloadCSV(`ecorescue-waste-reports-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${filtered.length} report(s) to CSV.`);
  };
  const statuses = ['pending', 'in_progress', 'resolved', 'rejected'];
  const total = filtered.length || 1;
  return (
    <>
      <PageHeader
        title="Waste Reports"
        subtitle="Review, assign and resolve resident waste reports."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Waste Reports' }]}
        actions={
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Summary by status (filtered)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(status === s ? '' : s)}
                className={`rounded-lg border p-3 text-left transition hover:border-green-300 ${status === s ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                aria-pressed={status === s}
              >
                <p className="text-2xl font-bold text-gray-900">
                  {filtered.filter((r) => r.status === s).length}
                </p>
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </Card>
        <Card title="Summary by category (filtered)">
          <div className="space-y-2">
            {CATEGORIES.map((c) => {
              const n = filtered.filter((r) => r.category === c.id).length;
              return (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-gray-700">{c.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${(n / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-gray-900">{n}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card bodyClass="p-0 sm:p-0">
        <div className="grid gap-2 border-b border-gray-100 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search ID, resident, address" />
          <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Purok" value={purok} onChange={(e) => setPurok(e.target.value)}>
            <option value="">All Puroks</option>
            {PUROKS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {REPORT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No reports match your filters" />
        ) : (
          <div className="px-4 sm:px-5">
            <TableWrap>
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Report</th>
                  <th className={th}>Category</th>
                  <th className={th}>Location</th>
                  <th className={th}>Resident</th>
                  <th className={th}>Collector</th>
                  <th className={th}>Status</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className={td}>
                      <p className="font-mono text-xs font-semibold text-gray-900">{r.code}</p>
                      <p className="max-w-[220px] truncate text-xs text-gray-500">{r.description}</p>
                    </td>
                    <td className={td}>
                      <CategoryTag category={r.category} />
                    </td>
                    <td className={td}>
                      <p className="max-w-[180px] truncate">{r.location}</p>
                      <p className="text-xs text-gray-500">{r.purok}</p>
                    </td>
                    <td className={td}>{userName(db, r.residentId, 'Unknown')}</td>
                    <td className={td}>{userName(db, r.collectorId, '—')}</td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(r.createdAt)}</td>
                    <td className={`${td} text-right`}>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye className="h-4 w-4" />}
                        aria-label={`Open ${r.code}`}
                        title="Open"
                        onClick={() => setOpenId(r.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </Card>
      {openId && <ManageReport id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
function ManageReport({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const r = db.reports.find((x) => x.id === id);
  const [collectorId, setCollectorId] = useState(r.collectorId ?? '');
  const [status, setStatus] = useState(r.status === 'rejected' ? 'pending' : r.status);
  const [notes, setNotes] = useState(r.resolutionNotes);
  const [err, setErr] = useState();
  const [reject, setReject] = useState(false);
  const collectors = db.users.filter((u) => u.role === 'collector' && u.active);
  const save = () => {
    if (status === 'in_progress' && !collectorId) {
      setErr('Assign a collector before marking the report In Progress.');
      return;
    }
    if (status === 'resolved' && notes.trim().length < 5) {
      setErr('Add resolution notes (at least 5 characters) before resolving.');
      return;
    }
    setErr(undefined);
    const changedStatus = status !== r.status;
    const changedCollector = (collectorId || null) !== r.collectorId;
    if (!changedStatus && !changedCollector && notes === r.resolutionNotes) {
      toast.error('No changes to save.');
      return;
    }
    commit((d) => {
      const x = d.reports.find((y) => y.id === id);
      if (!x) return;
      x.collectorId = collectorId || null;
      x.resolutionNotes = notes.trim();
      x.updatedAt = nowISO();
      if (changedStatus) {
        x.status = status;
        x.rejectionReason = undefined;
        x.history.push({
          status,
          at: nowISO(),
          by: admin.name,
          note:
            status === 'resolved'
              ? notes.trim()
              : changedCollector && collectorId
                ? `Assigned to ${userName(d, collectorId)}`
                : undefined,
        });
        notify(d, [x.residentId], {
          ...templates.reportStatus(x.code, status, status === 'resolved' ? notes.trim() : undefined),
          type: 'report',
          link: '/resident/my-reports',
        });
        addLog(
          d,
          actorOf(admin),
          'Report status changed',
          `${x.code}: ${REPORT_STATUS_LABEL[r.status]} → ${REPORT_STATUS_LABEL[status]}.`,
        );
      }
      if (changedCollector && collectorId) {
        if (!changedStatus)
          x.history.push({
            status: x.status,
            at: nowISO(),
            by: admin.name,
            note: `Assigned to ${userName(d, collectorId)}`,
          });
        notify(d, [collectorId], {
          title: 'New report assigned',
          message: `Report ${x.code} (${categoryLabel(x.category)}) in ${x.purok} was assigned to you.`,
          type: 'report',
          link: '/collector/assigned',
        });
        addLog(d, actorOf(admin), 'Report assigned', `${x.code} assigned to ${userName(d, collectorId)}.`);
      }
      if (!changedStatus && !changedCollector)
        addLog(d, actorOf(admin), 'Report notes updated', `Updated notes for ${x.code}.`);
    });
    toast.success('Report updated.');
    onClose();
  };
  const doReject = (reason) => {
    commit((d) => {
      const x = d.reports.find((y) => y.id === id);
      if (!x) return;
      x.status = 'rejected';
      x.rejectionReason = reason;
      x.updatedAt = nowISO();
      x.history.push({ status: 'rejected', at: nowISO(), by: admin.name, note: reason });
      notify(d, [x.residentId], {
        ...templates.reportStatus(x.code, 'rejected', reason),
        type: 'report',
        link: '/resident/my-reports',
      });
      addLog(d, actorOf(admin), 'Report rejected', `${x.code} rejected: ${reason}`);
    });
    setReject(false);
    toast.success('Report rejected and resident notified.');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Report ${r.code}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {r.status !== 'rejected' && (
            <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setReject(true)}>
              Reject
            </Button>
          )}
          <Button icon={<Save className="h-4 w-4" />} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ReportDetails db={db} report={r} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <p className="text-sm font-semibold text-gray-900">Manage report</p>
          <Field label="Assign collector" htmlFor="mr-col">
            <Select id="mr-col" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
              <option value="">Unassigned</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="mr-status">
            <Select id="mr-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </Select>
          </Field>
          <Field label="Resolution notes" htmlFor="mr-notes" hint="Visible to the resident.">
            <Textarea id="mr-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {err && (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          )}
          {r.status === 'rejected' && (
            <p className="text-xs text-gray-500">
              Saving with a new status will reopen this rejected report.
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={reject}
        title="Reject report"
        message="Use this for duplicate or invalid reports. The resident will see the reason."
        confirmLabel="Reject report"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Duplicate of WR-2026-0001"
        onConfirm={doReject}
        onCancel={() => setReject(false)}
      />
    </Modal>
  );
}
