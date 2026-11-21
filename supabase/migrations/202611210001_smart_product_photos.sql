-- Additive, TL+-gated private product photo library; no existing project rows altered.
-- PTG users are in a DIFFERENT Supabase project; store their UUID as an audit
-- identifier and do not reference flyer.auth.users.
create extension if not exists pgcrypto;

create table if not exists public.flyer_product_photo_blobs (
 id uuid primary key default gen_random_uuid(),
 sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 thumbnail_path text not null,
 mime_type text not null check (mime_type in ('image/webp','image/jpeg','image/png')),
 byte_size integer not null check (byte_size between 1 and 2097152),
 thumbnail_bytes integer not null check (thumbnail_bytes between 1 and 262144),
 uploaded_by_ptg uuid not null,
 uploaded_at timestamptz not null default now()
);
create table if not exists public.flyer_product_photos (
 id uuid primary key default gen_random_uuid(),
 product_key text not null check (length(product_key) between 3 and 230),
 barcode_norm text not null default '',
 brand_norm text not null default '',
 model_norm text not null default '',
 description text not null default '',
 blob_id uuid not null references public.flyer_product_photo_blobs(id),
 is_primary boolean not null default false,
 uploaded_by_ptg uuid not null,
 updated_by_ptg uuid not null,
 uploaded_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique(product_key,blob_id),
 check (barcode_norm<>'' or (brand_norm<>'' and model_norm<>''))
);
create unique index if not exists flyer_product_photo_primary_unique
 on public.flyer_product_photos(product_key) where is_primary and deleted_at is null;
create index if not exists flyer_product_photo_barcode_idx
 on public.flyer_product_photos(barcode_norm) where deleted_at is null;
create index if not exists flyer_product_photo_model_idx
 on public.flyer_product_photos(brand_norm,model_norm) where deleted_at is null;
create index if not exists flyer_product_photo_desc_idx
 on public.flyer_product_photos(lower(description)) where deleted_at is null;
create table if not exists public.flyer_product_photo_audit (
 id bigint generated always as identity primary key,
 photo_id uuid,
 action text not null check(action in ('upload','reuse','set_primary','replace','remove')),
 actor_ptg uuid not null,
 before_state jsonb,
 after_state jsonb,
 recorded_at timestamptz not null default now()
);

-- Database is accessible only to the service-role Edge gateway, which checks
-- a CURRENT PTG Auth subject AND app-session/role on every operation.
alter table public.flyer_product_photo_blobs enable row level security;
alter table public.flyer_product_photos enable row level security;
alter table public.flyer_product_photo_audit enable row level security;
revoke all on public.flyer_product_photo_blobs,public.flyer_product_photos,public.flyer_product_photo_audit from public,anon,authenticated;
grant all on public.flyer_product_photo_blobs,public.flyer_product_photos,public.flyer_product_photo_audit to service_role;
grant usage,select on sequence public.flyer_product_photo_audit_id_seq to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('flyer-product-photos','flyer-product-photos',false,2097152,
 array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;
-- Never add public SELECT, UPDATE or INSERT policies on this bucket.
-- Short-lived browser signed URLs are intentionally NOT used because they
-- cannot be immediately revoked. Images are delivered after each PTG check.

create or replace function public.flyer_product_photo_set_primary(p_product_key text,p_photo_id uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext(p_product_key)::bigint);
 if not exists(select 1 from public.flyer_product_photos
    where id=p_photo_id and product_key=p_product_key and deleted_at is null)
 then return false; end if;
 update public.flyer_product_photos set is_primary=false
   where product_key=p_product_key and is_primary and deleted_at is null;
 update public.flyer_product_photos set is_primary=true,updated_at=now()
   where id=p_photo_id and product_key=p_product_key and deleted_at is null;
 return true;
end
$$;
revoke all on function public.flyer_product_photo_set_primary(text,uuid) from public,anon,authenticated;
grant execute on function public.flyer_product_photo_set_primary(text,uuid) to service_role;
