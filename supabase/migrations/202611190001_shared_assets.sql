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
grant select on public.flyer_asset_memberships to authenticated;

create policy "members read own membership"
on public.flyer_asset_memberships for select to authenticated
using (user_id = (select auth.uid()));

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
grant select, insert, update, delete on public.flyer_shared_assets to authenticated;
create policy "authorized users view shared assets" on public.flyer_shared_assets
 for select to authenticated using ((select public.flyer_asset_can_view()));
create policy "asset managers insert assets" on public.flyer_shared_assets
 for insert to authenticated with check (
  (select public.flyer_asset_can_manage()) and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
 );
create policy "asset managers edit assets" on public.flyer_shared_assets
 for update to authenticated using ((select public.flyer_asset_can_manage()))
 with check ((select public.flyer_asset_can_manage()) and updated_by = (select auth.uid()));
create policy "asset managers delete assets" on public.flyer_shared_assets
 for delete to authenticated using ((select public.flyer_asset_can_manage()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyer-shared-assets', 'flyer-shared-assets', false, 10485760,
 array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Assets always use a UUID-prefixed object name. Reads require membership;
-- writes require manager privileges and a user-owned first path segment.
create policy "asset members read files" on storage.objects
for select to authenticated using (
 bucket_id = 'flyer-shared-assets' and (select public.flyer_asset_can_view())
);
create policy "asset managers upload files" on storage.objects
for insert to authenticated with check (
 bucket_id = 'flyer-shared-assets'
 and (select public.flyer_asset_can_manage())
 and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "asset managers replace files" on storage.objects
for update to authenticated using (
 bucket_id = 'flyer-shared-assets' and (select public.flyer_asset_can_manage())
) with check (
 bucket_id = 'flyer-shared-assets' and (select public.flyer_asset_can_manage())
);
create policy "asset managers remove files" on storage.objects
for delete to authenticated using (
 bucket_id = 'flyer-shared-assets' and (select public.flyer_asset_can_manage())
);
-- TODO before rollout: provision memberships securely from verified PTG roles,
-- prohibit self-provisioning, integrate UI, test RLS with multiple accounts.
