-- Staged schema. NEVER apply to production before acceptance.
-- Shared Asset operations run only via flyer-shared-assets Edge Function.
-- It verifies a live PTG session and a Flyer Supabase identity on EVERY request.
create extension if not exists pgcrypto;

create table if not exists public.flyer_ptg_identity_links (
 flyer_user_id uuid primary key references auth.users(id) on delete cascade,
 ptg_user_id uuid not null unique,
 created_at timestamptz not null default now()
);
alter table public.flyer_ptg_identity_links enable row level security;
revoke all on public.flyer_ptg_identity_links from anon, authenticated;
-- Populate links only by trusted administrative provisioning, never by users.
-- No direct read or write policies: service role only.

create table if not exists public.flyer_shared_assets (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 category text not null check(category in ('logos','banners','backgrounds','templates','decorations','other')),
 storage_path text not null unique,
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 byte_size bigint not null check(byte_size>0 and byte_size<=10485760),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists flyer_shared_assets_category_name_idx
 on public.flyer_shared_assets(category,name);
alter table public.flyer_shared_assets enable row level security;
revoke all on public.flyer_shared_assets from anon, authenticated;
-- No client read or mutation policies. Server gateway uses service role.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('flyer-shared-assets','flyer-shared-assets',false,10485760,
 array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- No storage.objects RLS policies are added for this bucket:
-- browser clients cannot read/write directly.
-- Gateway generates short-lived private URLs after fresh PTG validation.
