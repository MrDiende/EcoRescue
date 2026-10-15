import { useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useCurrentUser } from '../../lib/auth';
import { actorOf, addLog, announcementRecipients, notify, useStore } from '../../lib/store';
import { PUROKS } from '../../lib/geography';
import { formatDateTime, nowISO } from '../../lib/time';
import { uid } from '../../lib/storage';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EditButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PurokPicker,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
const AUD = { everyone: 'Everyone', residents: 'Residents', collectors: 'Collectors' };
export default function AdminAnnouncements() {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const [aud, setAud] = useState('');
  const [purok, setPurok] = useState('');
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const list = db.announcements
    .filter((a) => !aud || a.audience === aud)
    .filter((a) => !purok || a.puroks.length === 0 || a.puroks.includes(purok))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const remove = () => {
    if (!del) return;
    commit((d) => {
      d.announcements = d.announcements.filter((a) => a.id !== del.id);
      addLog(d, actorOf(admin), 'Announcement deleted', `Deleted announcement "${del.title}".`);
    });
    setDel(null);
    toast.success('Announcement deleted.');
  };
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Share updates with residents and collectors."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Announcements' }]}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ id: null })}>
            New announcement
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label="Filter audience"
          value={aud}
          onChange={(e) => setAud(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All audiences</option>
          {Object.keys(AUD).map((a) => (
            <option key={a} value={a}>
              {AUD[a]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter Purok"
          value={purok}
          onChange={(e) => setPurok(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All Puroks</option>
          {PUROKS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No announcements"
            message="Use the New announcement button above to post one."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((a) => (
            <article
              key={a.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <div className="flex shrink-0 gap-1">
                  <EditButton label={`Edit ${a.title}`} onClick={() => setForm({ id: a.id })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-8 px-0 text-red-600 hover:bg-red-50"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setDel(a)}
                    aria-label={`Delete ${a.title}`}
                    title="Delete"
                  />
                </div>
              </div>
              <p className="mt-2 flex-1 whitespace-pre-line text-sm text-gray-600">{a.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <Badge tone="green">{AUD[a.audience]}</Badge>
                {a.puroks.length ? (
                  a.puroks.map((p) => <Badge key={p}>{p}</Badge>)
                ) : (
                  <Badge>All Puroks</Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                By {a.createdBy} · {formatDateTime(a.createdAt)}
                {a.updatedAt ? ` · edited ${formatDateTime(a.updatedAt)}` : ''}
              </p>
            </article>
          ))}
        </div>
      )}
      {form && <AnnouncementForm id={form.id} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!del}
        title="Delete announcement?"
        message={<>“{del?.title}” will be removed from all dashboards.</>}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </>
  );
}
function AnnouncementForm({ id, onClose }) {
  const admin = useCurrentUser();
  const { db, commit } = useStore();
  const toast = useToast();
  const ex = id ? db.announcements.find((a) => a.id === id) : undefined;
  const [f, setF] = useState({
    title: ex?.title ?? '',
    body: ex?.body ?? '',
    audience: ex?.audience ?? 'everyone',
    puroks: ex?.puroks ?? [],
  });
  const [e, setE] = useState({});
  const save = () => {
    const err = {};
    if (f.title.trim().length < 4) err.title = 'Title must be at least 4 characters.';
    if (f.body.trim().length < 10) err.body = 'Message must be at least 10 characters.';
    setE(err);
    if (Object.keys(err).length) return;
    let recipients = 0;
    commit((d) => {
      let a = ex ? d.announcements.find((x) => x.id === ex.id) : undefined;
      if (!a) {
        a = {
          id: uid('an-'),
          title: '',
          body: '',
          audience: 'everyone',
          puroks: [],
          createdAt: nowISO(),
          createdBy: admin.name,
        };
        d.announcements.unshift(a);
      } else a.updatedAt = nowISO();
      Object.assign(a, {
        title: f.title.trim(),
        body: f.body.trim(),
        audience: f.audience,
        puroks: f.puroks,
      });
      const ids = announcementRecipients(d, a);
      recipients = ids.length;
      notify(d, ids, {
        title: ex ? 'Announcement updated' : 'New announcement',
        message: a.title,
        type: 'announcement',
      });
      addLog(
        d,
        actorOf(admin),
        ex ? 'Announcement updated' : 'Announcement created',
        `${ex ? 'Updated' : 'Created'} "${a.title}" for ${AUD[a.audience]}${a.puroks.length ? ` (${a.puroks.join(', ')})` : ''}.`,
      );
    });
    toast.success(
      ex
        ? 'Announcement updated.'
        : `Announcement published${recipients ? ` to ${recipients} user(s)` : ''}.`,
    );
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={ex ? 'Edit announcement' : 'New announcement'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{ex ? 'Save changes' : 'Publish'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor="an-title" required error={e.title}>
          <Input
            id="an-title"
            value={f.title}
            onChange={(ev) => setF({ ...f, title: ev.target.value })}
            invalid={!!e.title}
          />
        </Field>
        <Field label="Message" htmlFor="an-body" required error={e.body}>
          <Textarea
            id="an-body"
            rows={5}
            value={f.body}
            onChange={(ev) => setF({ ...f, body: ev.target.value })}
            invalid={!!e.body}
          />
        </Field>
        <Field label="Audience" htmlFor="an-aud" required>
          <Select id="an-aud" value={f.audience} onChange={(ev) => setF({ ...f, audience: ev.target.value })}>
            <option value="everyone">Everyone</option>
            <option value="residents">Residents only</option>
            <option value="collectors">Collectors only</option>
          </Select>
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Target Puroks (optional)</p>
          <PurokPicker allOption value={f.puroks} onChange={(v) => setF({ ...f, puroks: v })} />
          <p className="mt-1 text-xs text-gray-500">Leave empty to send to all Puroks.</p>
        </div>
      </div>
    </Modal>
  );
}
