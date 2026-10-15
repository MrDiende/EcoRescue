import { useState } from 'react';
import { ClipboardList, Eye, Save } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, adminIds, notify, useStore } from '../../lib/store';
import { formatDateTime, nowISO } from '../../lib/time';
import { REPORT_STATUS_LABEL, templates } from '../../lib/email';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '../../components/ui';
import { CategoryTag } from '../../components/WasteCategoryPicker';
import ReportDetails from '../../components/ReportDetails';
export default function AssignedReports() {
  const user = useCurrentUser();
  const { db } = useStore();
  const [tab, setTab] = useState('open');
  const [openId, setOpenId] = useState(null);
  const mine = db.reports.filter((r) => r.collectorId === user.id);
  const isOpen = (r) => r.status === 'pending' || r.status === 'in_progress';
  const list = mine
    .filter((r) => (tab === 'open' ? isOpen(r) : !isOpen(r)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <PageHeader title="Assigned Reports" subtitle="Waste reports assigned to you by the administrator." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'open', label: 'Open', count: mine.filter(isOpen).length },
          { id: 'closed', label: 'Closed', count: mine.filter((r) => !isOpen(r)).length },
        ]}
      />
      <div className="mt-4">
        {list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title={tab === 'open' ? 'No open reports assigned' : 'No closed reports'}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-700">{r.code}</span>
                    <CategoryTag category={r.category} />
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-700">{r.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {r.location} · {r.purok}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Updated {formatDateTime(r.updatedAt)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Eye className="h-4 w-4" />}
                    aria-label={`Open ${r.code}`}
                    title="Open"
                    onClick={() => setOpenId(r.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {openId && <UpdateReport id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
function UpdateReport({ id, onClose }) {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const r = db.reports.find((x) => x.id === id);
  const editable = r.collectorId === user.id && (r.status === 'pending' || r.status === 'in_progress');
  const [status, setStatus] = useState(r.status === 'pending' ? 'in_progress' : r.status);
  const [notes, setNotes] = useState(r.resolutionNotes);
  const [err, setErr] = useState();
  const save = () => {
    if (!editable) return;
    if (status === 'resolved' && notes.trim().length < 5) {
      setErr('Add resolution notes (at least 5 characters).');
      return;
    }
    if (status === r.status && notes.trim() === r.resolutionNotes) {
      setErr('No changes to save.');
      return;
    }
    commit((d) => {
      const x = d.reports.find((y) => y.id === id);
      if (!x || x.collectorId !== user.id) return;
      const prev = x.status;
      x.resolutionNotes = notes.trim();
      x.updatedAt = nowISO();
      if (prev !== status) {
        x.status = status;
        x.history.push({ status, at: nowISO(), by: user.name, note: notes.trim() || undefined });
        notify(d, [x.residentId], {
          ...templates.reportStatus(x.code, status, status === 'resolved' ? notes.trim() : undefined),
          type: 'report',
          link: '/resident/my-reports',
        });
        notify(d, adminIds(d), {
          title: `Report ${x.code}: ${REPORT_STATUS_LABEL[status]}`,
          message: `${user.name} updated the report.`,
          type: 'report',
          link: '/admin/reports',
        });
      }
      addLog(
        d,
        actorOf(user),
        prev !== status ? 'Report status changed' : 'Report notes updated',
        `${x.code}: ${REPORT_STATUS_LABEL[prev]}${prev !== status ? ` → ${REPORT_STATUS_LABEL[status]}` : ''}${notes.trim() ? ` · "${notes.trim()}"` : ''}`,
      );
    });
    toast.success('Report updated.');
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
          {editable && (
            <Button icon={<Save className="h-4 w-4" />} onClick={save}>
              Save update
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ReportDetails db={db} report={r} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          {editable ? (
            <>
              <p className="text-sm font-semibold text-gray-900">Update progress</p>
              <Field label="Status" htmlFor="ar-status">
                <Select id="ar-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </Select>
              </Field>
              <Field
                label="Resolution notes"
                htmlFor="ar-notes"
                error={err}
                hint="Visible to the resident and administrator."
              >
                <Textarea
                  id="ar-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  invalid={!!err}
                />
              </Field>
            </>
          ) : (
            <p className="text-sm text-gray-500">This report is closed and can no longer be updated.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
