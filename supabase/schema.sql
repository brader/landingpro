-- LandingPro Supabase schema
-- Run this in Supabase SQL Editor after enabling Email Auth.

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'LandingPro Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table workspace_members
  add column if not exists email text;

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists landing_pages (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  slug text not null,
  status text not null default 'Draft',
  template text,
  seo_title text,
  seo_description text,
  published_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table landing_pages
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists workspace_uuid uuid references workspaces(id) on delete cascade,
  add column if not exists storage_path text;

create index if not exists landing_pages_owner_updated_idx
  on landing_pages (owner_id, updated_at desc);

create index if not exists landing_pages_workspace_uuid_updated_idx
  on landing_pages (workspace_uuid, updated_at desc);

create unique index if not exists landing_pages_workspace_uuid_slug_idx
  on landing_pages (workspace_uuid, slug);

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  landing_page_id text references landing_pages(id) on delete cascade,
  workspace_id text not null default 'default',
  payload jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now()
);

alter table form_submissions
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists workspace_uuid uuid references workspaces(id) on delete cascade;

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  landing_page_id text references landing_pages(id) on delete cascade,
  workspace_id text not null default 'default',
  event_name text not null,
  event_value text,
  visitor_id text,
  session_id text,
  utm jsonb not null default '{}'::jsonb,
  device text,
  referrer text,
  created_at timestamptz not null default now()
);

alter table analytics_events
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists workspace_uuid uuid references workspaces(id) on delete cascade;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workspaces_set_updated_at on workspaces;
create trigger workspaces_set_updated_at
before update on workspaces
for each row execute function set_updated_at();

drop trigger if exists landing_pages_set_updated_at on landing_pages;
create trigger landing_pages_set_updated_at
before update on landing_pages
for each row execute function set_updated_at();

create or replace function add_workspace_owner_member()
returns trigger as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists workspaces_add_owner_member on workspaces;
create trigger workspaces_add_owner_member
after insert on workspaces
for each row execute function add_workspace_owner_member();

create or replace function is_workspace_member(workspace_id_input uuid)
returns boolean as $$
begin
  return exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = workspace_id_input
      and workspace_members.user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

create or replace function is_workspace_owner(workspace_id_input uuid)
returns boolean as $$
begin
  return exists (
    select 1 from workspaces
    where workspaces.id = workspace_id_input
      and workspaces.owner_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table landing_pages enable row level security;
alter table form_submissions enable row level security;
alter table analytics_events enable row level security;

drop policy if exists "workspaces owner select" on workspaces;
create policy "workspaces owner select"
on workspaces for select
to authenticated
using (
  owner_id = auth.uid()
  or is_workspace_member(workspaces.id)
);

drop policy if exists "workspaces owner insert" on workspaces;
create policy "workspaces owner insert"
on workspaces for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "workspaces owner update" on workspaces;
create policy "workspaces owner update"
on workspaces for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "workspace_members self select" on workspace_members;
drop policy if exists "workspace_members workspace select" on workspace_members;
create policy "workspace_members workspace select"
on workspace_members for select
to authenticated
using (
  user_id = auth.uid()
  or is_workspace_member(workspace_members.workspace_id)
);

drop policy if exists "workspace_members owner insert" on workspace_members;
create policy "workspace_members owner insert"
on workspace_members for insert
to authenticated
with check (
  is_workspace_owner(workspace_members.workspace_id)
  or (
    workspace_members.user_id = auth.uid()
    and exists (
      select 1 from workspace_invites
      where workspace_invites.workspace_id = workspace_members.workspace_id
        and lower(workspace_invites.email) = lower(auth.jwt() ->> 'email')
        and workspace_invites.accepted_at is null
    )
  )
);

drop policy if exists "workspace_members owner delete" on workspace_members;
create policy "workspace_members owner delete"
on workspace_members for delete
to authenticated
using (
  is_workspace_owner(workspace_members.workspace_id)
  and workspace_members.user_id <> auth.uid()
);

drop policy if exists "workspace_invites owner and invitee select" on workspace_invites;
create policy "workspace_invites owner and invitee select"
on workspace_invites for select
to authenticated
using (
  is_workspace_owner(workspace_invites.workspace_id)
  or lower(workspace_invites.email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists "workspace_invites owner insert" on workspace_invites;
create policy "workspace_invites owner insert"
on workspace_invites for insert
to authenticated
with check (
  is_workspace_owner(workspace_invites.workspace_id)
);

drop policy if exists "workspace_invites owner delete" on workspace_invites;
create policy "workspace_invites owner delete"
on workspace_invites for delete
to authenticated
using (
  is_workspace_owner(workspace_invites.workspace_id)
  and workspace_invites.accepted_at is null
);

drop policy if exists "workspace_invites accept own invite" on workspace_invites;
create policy "workspace_invites accept own invite"
on workspace_invites for update
to authenticated
using (
  is_workspace_owner(workspace_invites.workspace_id)
  or lower(workspace_invites.email) = lower(auth.jwt() ->> 'email')
)
with check (
  is_workspace_owner(workspace_invites.workspace_id)
  or lower(workspace_invites.email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists "landing_pages anon all" on landing_pages;
drop policy if exists "landing_pages owner all" on landing_pages;
create policy "landing_pages owner all"
on landing_pages for all
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = landing_pages.workspace_uuid
      and workspace_members.user_id = auth.uid()
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = landing_pages.workspace_uuid
      and workspace_members.user_id = auth.uid()
  )
);

drop policy if exists "form_submissions anon insert" on form_submissions;
drop policy if exists "form_submissions owner select" on form_submissions;
create policy "form_submissions owner select"
on form_submissions for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = form_submissions.workspace_uuid
      and workspace_members.user_id = auth.uid()
  )
);

drop policy if exists "form_submissions public insert" on form_submissions;
create policy "form_submissions public insert"
on form_submissions for insert
to anon, authenticated
with check (true);

drop policy if exists "analytics_events anon insert" on analytics_events;
drop policy if exists "analytics_events owner select" on analytics_events;
create policy "analytics_events owner select"
on analytics_events for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = analytics_events.workspace_uuid
      and workspace_members.user_id = auth.uid()
  )
);

drop policy if exists "analytics_events public insert" on analytics_events;
create policy "analytics_events public insert"
on analytics_events for insert
to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing-pages', 'landing-pages', true, 10485760, array['text/html', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "landing pages public read" on storage.objects;
create policy "landing pages public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'landing-pages');

drop policy if exists "landing pages owner write" on storage.objects;
create policy "landing pages owner write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'landing-pages'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'published'
  )
);

drop policy if exists "landing pages owner update" on storage.objects;
create policy "landing pages owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'landing-pages'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'published'
  )
)
with check (
  bucket_id = 'landing-pages'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'published'
  )
);

drop policy if exists "landing pages owner delete" on storage.objects;
create policy "landing pages owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'landing-pages'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'published'
  )
);
