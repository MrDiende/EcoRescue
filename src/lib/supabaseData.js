import { emptyDatabase } from './db';
import { supabase } from './supabase';

const TABLES = [
  ['users', 'id'],
  ['routes', 'id'],
  ['schedules', 'id'],
  ['trucks', 'id'],
  ['reports', 'id'],
  ['notifications', 'id'],
  ['announcements', 'id'],
  ['gps', 'collectorId'],
  ['issues', 'id'],
  ['activity', 'id'],
];
export const TABLE_NAMES = TABLES.map(([table]) => table);

const toColumn = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const toProperty = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

function toRow(record) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== 'password')
      .map(([key, value]) => [toColumn(key), value === undefined ? null : value]),
  );
}

export function toRecord(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toProperty(key), value]));
}

function fail(error, table, action) {
  if (error) throw new Error(`Supabase ${action} failed for ${table}: ${error.message}`);
}

export async function edgeFunctionError(error) {
  if (error.name === 'FunctionsFetchError') {
    return 'Could not reach the admin-manage-account Edge Function. Check your connection and make sure it is deployed to the Supabase project configured for this app.';
  }
  try {
    const body = await error.context?.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    return error.message || 'The Supabase Edge Function request failed.';
  }
  return error.message || 'The Supabase Edge Function request failed.';
}

export async function loadDatabase() {
  const database = emptyDatabase();
  const [results, summaryResult] = await Promise.all([
    Promise.all(
      TABLES.map(async ([table]) => {
        const { data, error } = await supabase.from(table).select('*');
        fail(error, table, 'read');
        return [table, data.map(toRecord)];
      }),
    ),
    supabase.rpc('visible_user_summaries'),
  ]);

  for (const [table, records] of results) database[table] = records;
  fail(summaryResult.error, 'visible_user_summaries', 'read');
  const userIds = new Set(database.users.map((user) => user.id));
  for (const row of summaryResult.data) {
    const summary = toRecord(row);
    if (!userIds.has(summary.id)) database.users.push(summary);
  }
  return database;
}

export async function syncDatabase(previous, next) {
  const collectionEvents = [];
  for (const schedule of next.schedules) {
    const before = previous.schedules.find((item) => item.id === schedule.id);
    if (!before) continue;

    if (before.status === 'scheduled' && schedule.status === 'in_progress') {
      collectionEvents.push({ scheduleId: schedule.id, event: 'started' });
    }

    if (
      (before.status === 'scheduled' || before.status === 'in_progress') &&
      schedule.status === 'in_progress'
    ) {
      for (const purok of schedule.visited.filter((item) => !before.visited.includes(item))) {
        collectionEvents.push({ scheduleId: schedule.id, event: 'visited', purok });
      }
    }

    if (before.status === 'in_progress' && schedule.status === 'completed') {
      collectionEvents.push({ scheduleId: schedule.id, event: 'completed' });
    } else if (before.status === 'in_progress' && schedule.status === 'missed') {
      collectionEvents.push({ scheduleId: schedule.id, event: 'missed' });
    }
  }

  for (const [table, keyProperty] of TABLES) {
    const before = new Map(previous[table].map((record) => [record[keyProperty], JSON.stringify(record)]));
    const changed = next[table].filter(
      (record) => before.get(record[keyProperty]) !== JSON.stringify(record),
    );
    const inserts = changed.filter((record) => !before.has(record[keyProperty])).map(toRow);
    if (inserts.length) {
      const { error } = await supabase.from(table).insert(inserts);
      fail(error, table, 'insert');
    }
    for (const record of changed.filter((item) => before.has(item[keyProperty]))) {
      const conflict = toColumn(keyProperty);
      const { error } = await supabase.from(table).update(toRow(record)).eq(conflict, record[keyProperty]);
      fail(error, table, 'update');
    }
  }

  for (const event of collectionEvents) {
    const { error } = await supabase.rpc('notify_collection_residents', {
      p_schedule_id: event.scheduleId,
      p_event: event.event,
      p_purok: event.purok ?? null,
    });
    fail(error, 'notify_collection_residents', event.event);
  }

  for (const [table, keyProperty] of [...TABLES].reverse()) {
    const after = new Set(next[table].map((record) => record[keyProperty]));
    const removed = previous[table]
      .map((record) => record[keyProperty])
      .filter((key) => !after.has(key));
    if (removed.length) {
      const { error } = await supabase.from(table).delete().in(toColumn(keyProperty), removed);
      fail(error, table, 'delete');
    }
  }
}
