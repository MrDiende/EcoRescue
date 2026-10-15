-- ============================================================================
-- EcoRescue — Barangay M.S. Garcia Waste Management System
-- Supabase / PostgreSQL schema
-- ============================================================================
-- This schema backs the app using Supabase Auth and Postgres.
--
-- HOW TO USE
--   1. Create a project at https://supabase.com
--   2. Open the SQL Editor and run this whole file. It does not drop tables.
--   3. Create and confirm the first administrator in Supabase Auth, then run
--      public.bootstrap_initial_admin('admin@example.com') in the SQL Editor.
--
-- NOTES
--   * Column names are snake_case; the app uses camelCase and converts between them.
--   * List / object fields (puroks, stops, history, trail, …) are stored as jsonb.
--   * IDs are stored as TEXT so application records keep their existing IDs;
--     user profiles also link to the corresponding Supabase Auth UUID.
--   * Passwords are managed by Supabase Auth and are never stored in public.users.
--   * Row Level Security limits data access by role and record ownership.
-- ============================================================================

-- Users (admins, residents, collectors) --------------------------------------
create table if not exists users (
  id               text primary key,
  auth_user_id     uuid references auth.users (id) on delete cascade,
  code             text not null,                       -- A-001 / R-0001 / C-001
  role             text not null check (role in ('admin','resident','collector')),
  name             text not null,
  email            text not null unique,
  phone            text not null default '',
  address          text not null default '',
  purok            text not null default '',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  -- resident fields
  status           text check (status in ('pending','approved','rejected')),
  proof_image      text,
  rejection_reason text,
  reviewed_at      timestamptz,
  reviewed_by      text,
  -- collector fields
  puroks           jsonb not null default '[]'::jsonb,  -- string[]
  route_id         text,
  collector_invite_token text
);
alter table users add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;
alter table users add column if not exists collector_invite_token text;
alter table users drop column if exists password;
create unique index if not exists users_auth_user_id_idx on users (auth_user_id);
create unique index if not exists users_resident_tracking_code_idx
  on users (code)
  where role = 'resident' and code ~ '^R-[0-9A-F]{32}$';
create index if not exists users_role_idx   on users (role);
create index if not exists users_status_idx on users (status);
create index if not exists users_email_idx  on users (lower(email));

-- Collection routes -----------------------------------------------------------
create table if not exists routes (
  id           text primary key,
  name         text not null,
  description  text not null default '',
  collector_id text references users (id) on delete set null,
  stops        jsonb not null default '[]'::jsonb,      -- ordered purok names
  days         jsonb not null default '[]'::jsonb,      -- weekday numbers, 0=Sun
  time         text,                                    -- HH:mm
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Collection schedules --------------------------------------------------------
create table if not exists schedules (
  id            text primary key,
  date          date not null,
  time          text not null,                          -- HH:mm
  route_id      text references routes (id) on delete set null,
  collector_id  text references users (id) on delete set null,
  puroks        jsonb not null default '[]'::jsonb,
  notes         text not null default '',
  status        text not null default 'scheduled'
                 check (status in ('scheduled','in_progress','completed','missed','cancelled')),
  visited       jsonb not null default '[]'::jsonb,
  missed_reason text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists schedules_date_idx      on schedules (date);
create index if not exists schedules_collector_idx on schedules (collector_id);

-- Trucks / vehicles -----------------------------------------------------------
create table if not exists trucks (
  id           text primary key,
  vehicle_id   text not null,
  plate        text not null,
  model        text not null default '',
  type         text not null default '',
  capacity_kg  integer not null default 0,
  collector_id text references users (id) on delete set null,
  status       text not null default 'available' check (status in ('active','available','maintenance')),
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

-- Waste reports ---------------------------------------------------------------
create table if not exists reports (
  id               text primary key,
  code             text not null,
  resident_id      text references users (id) on delete cascade,
  category         text not null check (category in ('biodegradable','recyclable','residual','special')),
  description      text not null default '',
  location         text not null default '',
  purok            text not null default '',
  image            text,
  status           text not null default 'pending' check (status in ('pending','in_progress','resolved','rejected')),
  collector_id     text references users (id) on delete set null,
  resolution_notes text not null default '',
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  history          jsonb not null default '[]'::jsonb   -- ReportHistory[]
);
create index if not exists reports_status_idx    on reports (status);
create index if not exists reports_resident_idx  on reports (resident_id);
create index if not exists reports_collector_idx on reports (collector_id);

-- In-app notifications --------------------------------------------------------
create table if not exists notifications (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  title      text not null,
  message    text not null default '',
  type       text not null default 'system'
              check (type in ('application','report','schedule','announcement','issue','system')),
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  link       text
);
create index if not exists notifications_user_idx on notifications (user_id);

-- Announcements ---------------------------------------------------------------
create table if not exists announcements (
  id         text primary key,
  title      text not null,
  body       text not null default '',
  audience   text not null default 'everyone' check (audience in ('everyone','residents','collectors')),
  puroks     jsonb not null default '[]'::jsonb,        -- empty = all puroks
  created_at timestamptz not null default now(),
  created_by text not null default '',
  updated_at timestamptz
);

-- Live GPS status (one row per collector) ------------------------------------
create table if not exists gps (
  collector_id text primary key references users (id) on delete cascade,
  state        text not null default 'offline' check (state in ('offline','available','on_route')),
  sharing      boolean not null default false,
  mode         text check (mode in ('browser','simulated')),
  lat          double precision,
  lng          double precision,
  accuracy     double precision,
  updated_at   timestamptz,
  schedule_id  text references schedules (id) on delete set null,
  trail        jsonb not null default '[]'::jsonb,      -- [[lat,lng], …]
  speed        double precision,
  heading      double precision,
  load_pct     integer not null default 0               -- truck capacity used, 0–100
);

-- Collector operational issue reports ----------------------------------------
create table if not exists issues (
  id           text primary key,
  code         text not null,
  collector_id text references users (id) on delete set null,
  type         text not null check (type in ('breakdown','obstruction','missed','full','other')),
  description  text not null default '',
  location     text not null default '',
  purok        text not null default '',
  image        text,
  status       text not null default 'open' check (status in ('open','acknowledged','closed')),
  admin_notes  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Activity log (audit trail) --------------------------------------------------
create table if not exists activity (
  id         text primary key,
  actor_id   text not null default '',
  actor_name text not null default '',
  role       text not null default 'system',
  action     text not null,
  details    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on activity (created_at desc);

-- ============================================================================
-- Realtime: broadcast changes so every signed-in device stays in sync
-- (powers the live map / tracking). Idempotent — skips tables already added.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','routes','schedules','trucks','reports',
    'notifications','announcements','gps','issues','activity'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- Supabase Auth profiles ------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users
   where auth_user_id = auth.uid() and active
     and (role <> 'resident' or status = 'approved')
   limit 1
$$;

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users
   where auth_user_id = auth.uid() and active
     and (role <> 'resident' or status = 'approved')
   limit 1
$$;

create or replace function public.is_active_admin_id(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = p_user_id and role = 'admin' and active
  )
$$;

-- Create route notifications server-side so collectors need not read resident profiles.
create or replace function public.notify_collection_residents(
  p_schedule_id text,
  p_event text,
  p_purok text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.schedules%rowtype;
  v_collector_name text;
  v_route_name text;
  v_purok_list text;
  v_ordered text[];
  v_next_purok text;
  v_count integer := 0;
begin
  if public.current_app_role() <> 'collector' then
    return 0;
  end if;

  select s.*
    into v_schedule
    from public.schedules s
   where s.id = p_schedule_id
     and s.collector_id = public.current_app_user_id();
  if not found then
    return 0;
  end if;

  select coalesce(array_agg(r.stop order by r.ordinality), array[]::text[])
    into v_ordered
    from jsonb_array_elements_text(
      coalesce(
        (select rt.stops from public.routes rt where rt.id = v_schedule.route_id),
        '[]'::jsonb
      )
    ) with ordinality as r(stop, ordinality)
   where v_schedule.puroks ? r.stop;

  v_ordered := v_ordered || array(
    select s.purok
      from jsonb_array_elements_text(v_schedule.puroks) with ordinality as s(purok, ordinality)
     where not (s.purok = any(v_ordered))
     order by s.ordinality
  );

  select s.purok
    into v_next_purok
    from unnest(v_ordered) as s(purok)
   where not exists (
     select 1
       from jsonb_array_elements_text(v_schedule.visited) as v(purok)
      where v.purok = s.purok
   )
   limit 1;

  v_collector_name := coalesce(
    (select u.name from public.users u where u.id = v_schedule.collector_id),
    'The collector'
  );
  v_route_name := coalesce(
    (select r.name from public.routes r where r.id = v_schedule.route_id),
    'collection route'
  );
  select array_to_string(array_agg(p.purok), ', ')
    into v_purok_list
    from jsonb_array_elements_text(v_schedule.puroks) as p(purok);

  if p_event = 'started' then
    if v_schedule.status <> 'in_progress'
       or v_schedule.visited <> '[]'::jsonb
       or v_next_purok is null
       or not exists (
         select 1
           from public.gps g
          where g.collector_id = v_schedule.collector_id
            and g.schedule_id = v_schedule.id
            and g.sharing
       ) then
      return 0;
    end if;

    insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
    select
      'n-route-' || md5(v_schedule.id || ':started:' || v_next_purok || ':' || u.id),
      u.id,
      'Truck heading to ' || v_next_purok || ' first',
      v_collector_name || ' started ' || v_route_name || ' and is coming to ' || v_next_purok ||
        ' first. Please bring out your segregated waste.',
      'schedule',
      false,
      now(),
      '/resident/tracking'
    from public.users u
    where u.role = 'resident'
      and u.active
      and u.status = 'approved'
      and u.purok = v_next_purok
    on conflict (id) do nothing;
    get diagnostics v_count = row_count;

  elsif p_event = 'visited' then
    if v_schedule.status <> 'in_progress'
       or p_purok is null
       or not (v_schedule.puroks ? p_purok)
       or not (v_schedule.visited ? p_purok)
       or not exists (
         select 1
           from public.gps g
          where g.collector_id = v_schedule.collector_id
            and g.schedule_id = v_schedule.id
            and g.sharing
       ) then
      return 0;
    end if;

    insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
    select
      'n-route-' || md5(v_schedule.id || ':visited:' || p_purok || ':done:' || u.id),
      u.id,
      'Collection done in ' || p_purok,
      v_collector_name || ' has collected waste in ' || p_purok || '. Thank you for segregating!',
      'schedule',
      false,
      now(),
      '/resident/tracking'
    from public.users u
    where u.role = 'resident'
      and u.active
      and u.status = 'approved'
      and u.purok = p_purok
    on conflict (id) do nothing;
    get diagnostics v_count = row_count;

    if v_next_purok is not null then
      insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
      select
        'n-route-' || md5(v_schedule.id || ':visited:' || p_purok || ':next:' || v_next_purok || ':' || u.id),
        u.id,
        'Collection truck heading to ' || v_next_purok,
        v_collector_name || ' finished ' || p_purok || ' and is on the way to ' || v_next_purok ||
          '. Please bring out your segregated waste.',
        'schedule',
        false,
        now(),
        '/resident/tracking'
      from public.users u
      where u.role = 'resident'
        and u.active
        and u.status = 'approved'
        and u.purok = v_next_purok
      on conflict (id) do nothing;
      get diagnostics v_count = row_count;
    end if;

  elsif p_event = 'completed' then
    if v_schedule.status <> 'completed' then
      return 0;
    end if;

    insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
    select
      'n-route-' || md5(v_schedule.id || ':completed:' || u.id),
      u.id,
      'Collection completed',
      'Today''s collection for ' || coalesce(v_purok_list, 'your area') ||
        ' is complete. Thank you for segregating your waste!',
      'schedule',
      false,
      now(),
      '/resident/schedule'
    from public.users u
    where u.role = 'resident'
      and u.active
      and u.status = 'approved'
      and exists (
        select 1
          from jsonb_array_elements_text(v_schedule.puroks) as p(purok)
         where p.purok = u.purok
      )
    on conflict (id) do nothing;
    get diagnostics v_count = row_count;

  elsif p_event = 'missed' then
    if v_schedule.status <> 'missed' then
      return 0;
    end if;

    insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
    select
      'n-route-' || md5(v_schedule.id || ':missed:' || u.id),
      u.id,
      'Collection missed in your area',
      'Today''s collection could not be completed. Reason: ' ||
        coalesce(nullif(v_schedule.missed_reason, ''), 'not provided') ||
        '. The barangay will announce a new schedule.',
      'schedule',
      false,
      now(),
      '/resident/schedule'
    from public.users u
    where u.role = 'resident'
      and u.active
      and u.status = 'approved'
      and exists (
        select 1
          from jsonb_array_elements_text(v_schedule.puroks) as p(purok)
         where p.purok = u.purok
      )
      and not exists (
        select 1
          from jsonb_array_elements_text(v_schedule.visited) as v(purok)
         where v.purok = u.purok
      )
    on conflict (id) do nothing;
    get diagnostics v_count = row_count;
  else
    return 0;
  end if;

  return v_count;
end;
$$;
revoke all on function public.notify_collection_residents(text, text, text) from public, anon;
grant execute on function public.notify_collection_residents(text, text, text) to authenticated;

create or replace function public.bootstrap_initial_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_auth_email text;
  v_user_metadata jsonb;
  v_profile_id text;
  v_profile_name text;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'Provide the email address of the confirmed Auth user';
  end if;

  lock table public.users in exclusive mode;

  select u.id, u.email, u.raw_user_meta_data
    into v_auth_user_id, v_auth_email, v_user_metadata
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.email_confirmed_at is not null
   for update;

  if v_auth_user_id is null then
    raise exception 'No Auth user with a confirmed email was found for %', trim(p_email);
  end if;

  if exists (
    select 1 from public.users
     where role = 'admin' and auth_user_id is distinct from v_auth_user_id
  ) then
    raise exception 'A different administrator profile already exists';
  end if;

  select u.id
    into v_profile_id
    from public.users u
   where u.auth_user_id = v_auth_user_id;

  v_profile_name := trim(coalesce(v_user_metadata ->> 'name', ''));
  if v_profile_name = '' then
    v_profile_name := split_part(v_auth_email, '@', 1);
  end if;

  if v_profile_id is null then
    insert into public.users (
      id, auth_user_id, code, role, name, email, phone, address, purok,
      active, status
    ) values (
      v_auth_user_id::text, v_auth_user_id, 'A-001', 'admin', v_profile_name,
      lower(v_auth_email), coalesce(v_user_metadata ->> 'phone', ''),
      coalesce(v_user_metadata ->> 'address', ''), coalesce(v_user_metadata ->> 'purok', ''),
      true, 'approved'
    );
  else
    update public.users
       set role = 'admin',
           code = 'A-001',
           status = 'approved',
           active = true
     where id = v_profile_id;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where id = v_auth_user_id;
end;
$$;
revoke all on function public.bootstrap_initial_admin(text) from public, anon, authenticated, service_role;

create or replace function public.visible_user_summaries()
returns table(id text, code text, role text, name text, purok text, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.code, u.role, u.name, u.purok, u.active
    from public.users u
   where public.current_app_role() in ('resident', 'collector')
     and (
       (u.role = 'admin' and u.active)
       or (u.role = 'collector' and u.active and public.current_app_role() = 'resident')
       or (
         u.role = 'resident'
         and public.current_app_role() = 'collector'
         and exists (
           select 1 from public.reports r
            where r.resident_id = u.id
              and r.collector_id = public.current_app_user_id()
         )
       )
     )
$$;

create or replace function public.create_resident_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code integer;
  profile_name text;
  account_role text;
  role_prefix text;
  invited_collector_id text;
begin
  profile_name := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  if profile_name = '' then
    profile_name := split_part(new.email, '@', 1);
  end if;

  select id into invited_collector_id
    from public.users
   where lower(email) = lower(new.email)
     and role = 'collector'
     and auth_user_id is null
     and (
       collector_invite_token = new.raw_user_meta_data ->> 'collector_invite_token'
       or (
         tg_op = 'UPDATE'
         and new.email_confirmed_at is not null
         and collector_invite_token is null
       )
     )
   limit 1
   for update;

  if invited_collector_id is not null then
    if new.email_confirmed_at is null then
      return new;
    end if;

    update public.users
       set auth_user_id = new.id,
           name = profile_name,
           email = lower(new.email),
           phone = coalesce(new.raw_user_meta_data ->> 'phone', ''),
           address = coalesce(new.raw_user_meta_data ->> 'address', ''),
           collector_invite_token = null,
           updated_at = now()
     where id = invited_collector_id
       and auth_user_id is null;

    insert into public.activity (id, actor_id, actor_name, role, action, details, created_at)
    values (
      'ac-' || gen_random_uuid()::text, invited_collector_id, profile_name, 'collector',
      'Collector account created', 'Collector account registered and linked to its invitation.', now()
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  account_role := case
    when new.raw_app_meta_data ->> 'role' in ('admin', 'collector')
      then new.raw_app_meta_data ->> 'role'
    else 'resident'
  end;
  role_prefix := case account_role when 'admin' then 'A-' when 'collector' then 'C-' else 'R-' end;

  if account_role = 'resident' then
    next_code := 0;
  else
    select coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::integer), 0) + 1
      into next_code
      from public.users where role = account_role;
  end if;

  insert into public.users (
    id, auth_user_id, code, role, name, email, phone, address, purok,
    active, created_at, status, proof_image
  ) values (
    new.id::text, new.id,
    case when account_role = 'resident'
      then 'R-' || upper(replace(new.id::text, '-', ''))
      else role_prefix || lpad(next_code::text, 3, '0')
    end,
    account_role,
    profile_name, lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    coalesce(new.raw_user_meta_data ->> 'purok', ''),
    true, coalesce(new.created_at, now()),
    case when account_role = 'resident' then 'pending' else 'approved' end,
    new.raw_user_meta_data ->> 'proof_image'
  );
  if account_role = 'resident' then
    insert into public.notifications (id, user_id, title, message, type, read, created_at, link)
    select
      'n-' || gen_random_uuid()::text, id, 'New residency application',
      profile_name || ' (' || coalesce(new.raw_user_meta_data ->> 'purok', '') || ') submitted a residency application.',
      'application', false, now(), '/admin/residents'
    from public.users where role = 'admin' and active;

    insert into public.activity (id, actor_id, actor_name, role, action, details, created_at)
    values (
      'ac-' || gen_random_uuid()::text, new.id::text, profile_name, 'resident',
      'Resident registered', 'New residency application submitted.', now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_resident on auth.users;
create trigger on_auth_user_created_resident
after insert on auth.users
for each row execute function public.create_resident_profile();
drop trigger if exists on_auth_user_confirmed_collector on auth.users;
create trigger on_auth_user_confirmed_collector
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.create_resident_profile();
revoke all on function public.create_resident_profile() from public, anon, authenticated;

drop function if exists public.track_resident_application(text);
create function public.track_resident_application(p_code text)
returns table(name text, code text, status text, created_at timestamptz, reviewed_at timestamptz, rejection_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select u.name, u.code, u.status, u.created_at, u.reviewed_at, u.rejection_reason
    from public.users u
   where u.role = 'resident' and upper(u.code) = upper(trim(p_code))
   limit 1
$$;
grant execute on function public.track_resident_application(text) to anon, authenticated;

create or replace function public.protect_user_account_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1
    and old.role = 'collector'
    and old.auth_user_id is null
    and new.auth_user_id is not null
    and new.collector_invite_token is null
    and exists (
      select 1 from auth.users a
       where a.id = new.auth_user_id
         and lower(a.email) = lower(new.email)
         and a.email_confirmed_at is not null
    ) then
    return new;
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
    and public.current_app_role() <> 'admin' and (
    new.id is distinct from old.id
    or new.auth_user_id is distinct from old.auth_user_id
    or new.code is distinct from old.code
    or new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.active is distinct from old.active
    or new.created_at is distinct from old.created_at
    or new.status is distinct from old.status
    or new.proof_image is distinct from old.proof_image
    or new.rejection_reason is distinct from old.rejection_reason
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.puroks is distinct from old.puroks
    or new.route_id is distinct from old.route_id
    or new.collector_invite_token is distinct from old.collector_invite_token
  ) then
    raise exception 'Only administrators can change account approval and role fields';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_account_fields_trigger on users;
create trigger protect_user_account_fields_trigger
before update on users
for each row execute function public.protect_user_account_fields();
revoke all on function public.protect_user_account_fields() from public, anon, authenticated;
revoke all on function public.is_active_admin_id(text) from public, anon;
grant execute on function public.is_active_admin_id(text) to authenticated;
revoke all on function public.visible_user_summaries() from public, anon;
grant execute on function public.visible_user_summaries() to authenticated;

-- Role-aware row policies -----------------------------------------------------
alter table users enable row level security;
alter table routes enable row level security;
alter table schedules enable row level security;
alter table trucks enable row level security;
alter table reports enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;
alter table gps enable row level security;
alter table issues enable row level security;
alter table activity enable row level security;

-- SQL privileges are required in addition to RLS policies. These grants let
-- signed-in clients perform requests that the policies below authorize.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.users,
  public.routes,
  public.schedules,
  public.trucks,
  public.reports,
  public.notifications,
  public.announcements,
  public.gps,
  public.issues,
  public.activity
to authenticated;

drop policy if exists "demo_all" on users;
drop policy if exists "users_select" on users;
create policy "users_select" on users for select to authenticated
  using (public.current_app_role() = 'admin' or auth_user_id = auth.uid());
drop policy if exists "users_admin_update" on users;
create policy "users_admin_update" on users for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
drop policy if exists "users_admin_insert" on users;
create policy "users_admin_insert" on users for insert to authenticated
  with check (public.current_app_role() = 'admin');
drop policy if exists "users_self_update" on users;
create policy "users_self_update" on users for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
drop policy if exists "users_admin_delete" on users;
create policy "users_admin_delete" on users for delete to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on routes;
drop policy if exists "routes_read" on routes;
create policy "routes_read" on routes for select to authenticated
  using (public.current_app_role() in ('admin', 'resident', 'collector'));
drop policy if exists "routes_admin_write" on routes;
create policy "routes_admin_write" on routes for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on schedules;
drop policy if exists "schedules_read" on schedules;
create policy "schedules_read" on schedules for select to authenticated
  using (public.current_app_role() in ('admin', 'resident', 'collector'));
drop policy if exists "schedules_admin_write" on schedules;
create policy "schedules_admin_write" on schedules for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
drop policy if exists "schedules_collector_update" on schedules;
create policy "schedules_collector_update" on schedules for update to authenticated
  using (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id())
  with check (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id());

drop policy if exists "demo_all" on trucks;
drop policy if exists "trucks_read" on trucks;
create policy "trucks_read" on trucks for select to authenticated
  using (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id());
drop policy if exists "trucks_admin_write" on trucks;
create policy "trucks_admin_write" on trucks for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on reports;
drop policy if exists "reports_read" on reports;
create policy "reports_read" on reports for select to authenticated
  using (
    public.current_app_role() = 'admin'
    or resident_id = public.current_app_user_id()
    or collector_id = public.current_app_user_id()
  );
drop policy if exists "reports_insert" on reports;
create policy "reports_insert" on reports for insert to authenticated
  with check (
    public.current_app_role() = 'admin'
    or (public.current_app_role() = 'resident' and resident_id = public.current_app_user_id()
        and exists (select 1 from users u where u.id = resident_id and u.status = 'approved'))
    or (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id())
  );
drop policy if exists "reports_update" on reports;
create policy "reports_update" on reports for update to authenticated
  using (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id())
  with check (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id());
drop policy if exists "reports_admin_delete" on reports;
create policy "reports_admin_delete" on reports for delete to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on notifications;
drop policy if exists "notifications_read" on notifications;
create policy "notifications_read" on notifications for select to authenticated
  using (public.current_app_role() = 'admin' or user_id = public.current_app_user_id());
drop policy if exists "notifications_owner_update" on notifications;
create policy "notifications_owner_update" on notifications for update to authenticated
  using (user_id = public.current_app_user_id() or public.current_app_role() = 'admin')
  with check (user_id = public.current_app_user_id() or public.current_app_role() = 'admin');
drop policy if exists "notifications_admin_insert" on notifications;
create policy "notifications_admin_insert" on notifications for insert to authenticated
  with check (
    public.current_app_role() = 'admin'
    or user_id = public.current_app_user_id()
    or public.is_active_admin_id(user_id)
  );
drop policy if exists "notifications_admin_delete" on notifications;
create policy "notifications_admin_delete" on notifications for delete to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on announcements;
drop policy if exists "announcements_read" on announcements;
create policy "announcements_read" on announcements for select to authenticated
  using (public.current_app_role() in ('admin', 'resident', 'collector'));
drop policy if exists "announcements_admin_write" on announcements;
create policy "announcements_admin_write" on announcements for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on gps;
drop policy if exists "gps_read" on gps;
create policy "gps_read" on gps for select to authenticated
  using (public.current_app_role() in ('admin', 'resident', 'collector'));
drop policy if exists "gps_admin_write" on gps;
create policy "gps_admin_write" on gps for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
drop policy if exists "gps_collector_write" on gps;
create policy "gps_collector_write" on gps for all to authenticated
  using (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id())
  with check (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id());

drop policy if exists "demo_all" on issues;
drop policy if exists "issues_read" on issues;
create policy "issues_read" on issues for select to authenticated
  using (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id());
drop policy if exists "issues_collector_insert" on issues;
create policy "issues_collector_insert" on issues for insert to authenticated
  with check (public.current_app_role() = 'collector' and collector_id = public.current_app_user_id());
drop policy if exists "issues_update" on issues;
create policy "issues_update" on issues for update to authenticated
  using (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id())
  with check (public.current_app_role() = 'admin' or collector_id = public.current_app_user_id());
drop policy if exists "issues_admin_delete" on issues;
create policy "issues_admin_delete" on issues for delete to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "demo_all" on activity;
drop policy if exists "activity_admin_read" on activity;
create policy "activity_admin_read" on activity for select to authenticated
  using (public.current_app_role() = 'admin');
drop policy if exists "activity_insert_own" on activity;
create policy "activity_insert_own" on activity for insert to authenticated
  with check (actor_id = public.current_app_user_id() or public.current_app_role() = 'admin');
