import { useState } from 'react';
import { Activity, Download } from 'lucide-react';
import { useStore } from '../../lib/store';
import { formatDateTime, toISODate } from '../../lib/time';
import { downloadCSV, toCSV } from '../../lib/storage';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SearchInput,
  Select,
  TableWrap,
  td,
  th,
  useToast,
} from '../../components/ui';
export default function AdminActivity() {
  const { db } = useStore();
  const toast = useToast();
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const actions = Array.from(new Set(db.activity.map((a) => a.action))).sort();
  const list = db.activity
    .filter((a) => !role || a.role === role)
    .filter((a) => !action || a.action === action)
    .filter((a) => {
      const s = q.trim().toLowerCase();
      return !s || a.details.toLowerCase().includes(s) || a.actorName.toLowerCase().includes(s);
    })
    .filter((a) => {
      const d = toISODate(new Date(a.createdAt));
      return (!from || d >= from) && (!to || d <= to);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportCsv = () => {
    if (!list.length) {
      toast.error('Nothing to export.');
      return;
    }
    downloadCSV(
      `ecorescue-activity-${toISODate(new Date())}.csv`,
      toCSV(
        ['Timestamp', 'Actor', 'Role', 'Action', 'Details'],
        list.map((a) => [formatDateTime(a.createdAt), a.actorName, a.role, a.action, a.details]),
      ),
    );
    toast.success(`Exported ${list.length} entries.`);
  };
  const tone = (r) =>
    r === 'admin' ? 'purple' : r === 'collector' ? 'blue' : r === 'resident' ? 'green' : 'gray';
  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle="Audit trail of important actions across the system."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Activity Log' }]}
        actions={
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <Card bodyClass="p-0 sm:p-0">
        <div className="grid gap-2 border-b border-gray-100 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-6">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search details or actor"
            className="min-w-0 xl:col-span-2"
          />
          <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="resident">Resident</option>
            <option value="collector">Collector</option>
          </Select>
          <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <div className="flex min-w-0 items-center gap-1.5 xl:col-span-2">
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              title="From date"
              className="min-w-0 flex-1 px-2 sm:px-3.5"
            />
            <span className="shrink-0 text-xs text-gray-400">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              title="To date"
              className="min-w-0 flex-1 px-2 sm:px-3.5"
            />
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<Activity className="h-6 w-6" />} title="No activity matches your filters" />
        ) : (
          <div className="px-4 sm:px-5">
            <TableWrap>
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Timestamp</th>
                  <th className={th}>Actor</th>
                  <th className={th}>Role</th>
                  <th className={th}>Action</th>
                  <th className={th}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.slice(0, 300).map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} whitespace-nowrap text-xs`}>{formatDateTime(a.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap font-medium text-gray-900`}>{a.actorName}</td>
                    <td className={td}>
                      <Badge tone={tone(a.role)}>{a.role}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{a.action}</td>
                    <td className={`${td} min-w-[260px]`}>{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {list.length > 300 && (
              <p className="py-3 text-center text-xs text-gray-500">
                Showing the latest 300 of {list.length} entries. Use filters or export to see more.
              </p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
