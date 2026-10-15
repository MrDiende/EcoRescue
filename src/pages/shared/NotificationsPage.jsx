import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  Bell,
  Calendar,
  CheckCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { useStore } from '../../lib/store';
import { formatDateTime, timeAgo } from '../../lib/time';
import { Button, Card, EmptyState, PageHeader, Tabs, useToast } from '../../components/ui';
import { cn } from '../../utils/cn';
const ICONS = {
  application: ShieldCheck,
  report: FileText,
  schedule: Calendar,
  announcement: Megaphone,
  issue: AlertOctagon,
  system: Info,
};
export function NotificationList({ embedded }) {
  const user = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const mine = db.notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = mine.filter((n) => !n.read).length;
  const list = tab === 'unread' ? mine.filter((n) => !n.read) : mine;
  const markRead = (id) =>
    commit((d) => {
      const n = d.notifications.find((x) => x.id === id && x.userId === user.id);
      if (n) n.read = true;
    });
  const markAll = () => {
    commit((d) =>
      d.notifications.forEach((n) => {
        if (n.userId === user.id) n.read = true;
      }),
    );
    toast.success('All notifications marked as read.');
  };
  return (
    <Card
      title={embedded ? 'My notifications' : undefined}
      bodyClass="p-0 sm:p-0"
      action={embedded ? undefined : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'all', label: 'All', count: mine.length },
            { id: 'unread', label: 'Unread', count: unread },
          ]}
        />
        <Button
          size="sm"
          variant="outline"
          icon={<CheckCheck className="h-4 w-4" />}
          disabled={!unread}
          onClick={markAll}
        >
          Mark all as read
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={tab === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          message={
            tab === 'unread'
              ? 'There are no unread notifications.'
              : 'Updates about applications, reports and schedules will appear here.'
          }
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id} className={cn('flex gap-3 px-4 py-3 sm:px-5', !n.read && 'bg-green-50/40')}>
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    n.read ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm', n.read ? 'text-gray-700' : 'font-semibold text-gray-900')}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="rounded-full bg-green-600 px-1.5 text-[10px] font-semibold text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400" title={formatDateTime(n.createdAt)}>
                    {timeAgo(n.createdAt)} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {n.link && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        markRead(n.id);
                        navigate(n.link);
                      }}
                    >
                      Open
                    </Button>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates related to your account." />
      <NotificationList />
    </>
  );
}
