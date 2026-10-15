import { PageHeader } from '../../components/ui';
import { NotificationList } from '../shared/NotificationsPage';
export default function AdminNotifications() {
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates related to your account."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Notifications' }]}
      />
      <NotificationList />
    </>
  );
}
