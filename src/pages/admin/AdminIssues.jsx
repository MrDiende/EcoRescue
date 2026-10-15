import { useState } from 'react';
import { AlertOctagon, CheckCircle2, Eye, ThumbsUp } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, notify, userName, useStore } from '../../lib/store';
import { formatDateTime, nowISO, timeAgo } from '../../lib/time';
import {
  Badge,
  Button,
  Card,
  DetailRow,
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
export const ISSUE_TYPES = {
  breakdown: 'Vehicle breakdown',
  obstruction: 'Road obstruction',
  missed: 'Missed collection',
  full: 'Full vehicle capacity',
  other: 'Other problem',
};
export default function AdminIssues() {
  const { db } = useStore();
  const [tab, setTab] = useState('open');
  const [type, setType] = useState('');
  const [openId, setOpenId] = useState(null);
  const count = (s) => db.issues.filter((i) => i.status === s).length;
  const list = db.issues
    .filter((i) => tab === 'all' || i.status === tab)
    .filter((i) => !type || i.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeader
        title="Collector Reports"
        subtitle="Operational issues submitted by collectors in the field."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Collector Reports' }]}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'open', label: 'Open', count: count('open') },
            { id: 'acknowledged', label: 'Acknowledged', count: count('acknowledged') },
            { id: 'closed', label: 'Closed', count: count('closed') },
            { id: 'all', label: 'All', count: db.issues.length },
          ]}
        />
        <Select
          aria-label="Filter type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="sm:w-52"
        >
          <option value="">All issue types</option>
          {Object.keys(ISSUE_TYPES).map((t) => (
            <option key={t} value={t}>
              {ISSUE_TYPES[t]}
            </option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<AlertOctagon className="h-6 w-6" />} title="No issues in this view" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((i) => (
            <div key={i.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-gray-500">{i.code}</p>
                  <p className="font-semibold text-gray-900">{ISSUE_TYPES[i.type]}</p>
                </div>
                <StatusBadge status={i.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{i.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge>{i.purok}</Badge>
                <Badge>{i.location}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400">
                  {userName(db, i.collectorId, 'Unknown')} · {timeAgo(i.createdAt)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Eye className="h-4 w-4" />}
                  aria-label={`Open ${i.code}`}
                  title="Open"
                  onClick={() => setOpenId(i.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {openId && <IssueModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
function IssueModal({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const i = db.issues.find((x) => x.id === id);
  const [notes, setNotes] = useState(i.adminNotes);
  const [err, setErr] = useState();
  const update = (status) => {
    if (status === 'closed' && notes.trim().length < 3) {
      setErr('Add a note describing how the issue was resolved.');
      return;
    }
    commit((d) => {
      const x = d.issues.find((y) => y.id === id);
      const prev = x.status;
      x.status = status;
      x.adminNotes = notes.trim();
      x.updatedAt = nowISO();
      notify(d, [x.collectorId], {
        title: `Issue ${x.code} ${status === 'closed' ? 'closed' : status === 'acknowledged' ? 'acknowledged' : 'updated'}`,
        message: notes.trim() || `Your ${ISSUE_TYPES[x.type].toLowerCase()} report is now ${status}.`,
        type: 'issue',
        link: '/collector/add-report',
      });
      addLog(
        d,
        actorOf(admin),
        status === 'acknowledged'
          ? 'Issue acknowledged'
          : status === 'closed'
            ? 'Issue closed'
            : 'Issue updated',
        `${x.code} (${ISSUE_TYPES[x.type]}): ${prev} → ${status}.`,
      );
    });
    toast.success(
      `Issue ${status === 'closed' ? 'closed' : status === 'acknowledged' ? 'acknowledged' : 'updated'}.`,
    );
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${i.code} · ${ISSUE_TYPES[i.type]}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {i.status !== 'open' && i.status !== 'closed' && (
            <Button variant="outline" onClick={() => update(i.status)}>
              Save notes
            </Button>
          )}
          {i.status === 'closed' && (
            <Button variant="outline" onClick={() => update('acknowledged')}>
              Reopen
            </Button>
          )}
          {i.status === 'open' && (
            <Button
              variant="warning"
              icon={<ThumbsUp className="h-4 w-4" />}
              onClick={() => update('acknowledged')}
            >
              Acknowledge
            </Button>
          )}
          {i.status !== 'closed' && (
            <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => update('closed')}>
              Close as resolved
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <StatusBadge status={i.status} />
        <p className="text-sm text-gray-800">{i.description}</p>
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 px-3">
          <DetailRow label="Collector">{userName(db, i.collectorId, 'Unknown')}</DetailRow>
          <DetailRow label="Location">
            {i.location} · {i.purok}
          </DetailRow>
          <DetailRow label="Submitted">{formatDateTime(i.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDateTime(i.updatedAt)}</DetailRow>
        </dl>
        {i.image && (
          <img
            src={i.image}
            alt={`Photo for ${i.code}`}
            className="max-h-64 w-full rounded-lg border border-gray-200 object-contain"
          />
        )}
        <Field label="Administrative notes" htmlFor="is-notes" error={err}>
          <Textarea
            id="is-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            invalid={!!err}
          />
        </Field>
      </div>
    </Modal>
  );
}
