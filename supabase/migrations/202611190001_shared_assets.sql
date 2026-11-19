-- Shared Asset Library (staging only)
-- Deploy only after PTG identity mapping is completed and reviewed.
create extension if not exists pgcrypto;

create table if not exists public.flyer_asset_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_view boolean not null default true,
  can_manage boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.flyer_asset_memberships enable row level security;
revoke all on public.flyer_asset_memberships from anon, authenticated;
-- No client grants; effective permission comes from verified PTG session.

create or replace function public.flyer_asset_can_view()
returns boolean language sql stable security definer
set search_path = '' as $$
 select exists (
  select 1 from public.flyer_asset_memberships m
  where m.user_id = (select auth.uid()) and m.can_view
 );
$$;
create or replace function public.flyer_asset_can_manage()
returns boolean language sql stable security definer
set search_path = '' as $$
 select exists (
  select 1 from public.flyer_asset_memberships m
  where m.user_id = (select auth.uid()) and m.can_manage
 );
$$;
revoke all on function public.flyer_asset_can_view() from public;
revoke all on function public.flyer_asset_can_manage() from public;
grant execute on function public.flyer_asset_can_view() to authenticated;
grant execute on function public.flyer_asset_can_manage() to authenticated;

create table if not exists public.flyer_shared_assets (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 category text not null check (category in ('logos','banners','backgrounds','templates','decorations','other')),
 storage_path text not null unique,
 mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
 byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists flyer_shared_assets_category_name_idx
on public.flyer_shared_assets(category, name);
alter table public.flyer_shared_assets enable row level security;
revoke all on public.flyer_shared_assets from anon, authenticated;
-- No direct client writes. All mutations require an endpoint that validates
-- the current PTG account, role, active session, and linked Flyer user.
create table if not exists public.flyer_ptg_identity_links (
 flyer_user_id uuid primary key references auth.users(id) on delete cascade,
 ptg_username text not null,
 ptg_branch_code text not null default '',
 created_at timestamptz not null default now(),
 unique (ptg_username, ptg_branch_code)
);
alter table public.flyer_ptg_identity_links enable row level security;
revoke all on public.flyer_ptg_identity_links from anon, authenticated;
-- Only the trusted service role can access these mappings.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyer-shared-assets', 'flyer-shared-assets', false, 10485760,
 array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Assets always use a UUID-prefixed object name. Reads require membership;
-- writes require manager privileges and a user-owned first path segment.
-- Do not grant clients storage read or write access.
-- Backend validates current PTG session before producing a signed URL.

-- TODO before rollout: provision memberships securely from verified PTG roles,
-- prohibit self-provisioning, integrate UI, test RLS with multiple accounts.
