-- REVIEWED MIGRATION CANDIDATE ONLY. Generate/apply migration in the approved environment after acceptance.
begin;
create table if not exists public.flyer_review_audit (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 actor_ptg uuid not null,
 actor_role text not null check(actor_role in ('SYSTEM_ADMIN','BRANCH_ADMIN','BRANCH_USER')),
 action text not null check(action in ('approve','final','override')),
 project_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 scope text not null check(scope in ('front','back','both')),
 format text not null check(format in ('approval','png','pdf')),
 reason text,
 warnings jsonb not null default '[]'::jsonb check(jsonb_typeof(warnings)='array'),
 blocking jsonb not null default '[]'::jsonb check(jsonb_typeof(blocking)='array'),
 approval_id uuid references public.flyer_review_audit(id),
 check(action <> 'override' or (actor_role='SYSTEM_ADMIN' and reason is not null and length(trim(reason)) between 10 and 1000 and format in ('png','pdf'))),
 check(action <> 'approve' or (actor_role in ('SYSTEM_ADMIN','BRANCH_ADMIN') and format='approval' and jsonb_array_length(blocking)=0)),
 check(action <> 'final' or (approval_id is not null and format in ('png','pdf') and jsonb_array_length(blocking)=0))
);
alter table public.flyer_review_audit enable row level security;
revoke all on table public.flyer_review_audit from public,anon,authenticated;
grant select,insert on table public.flyer_review_audit to service_role;
revoke update,delete,truncate on table public.flyer_review_audit from service_role;
create index if not exists flyer_review_audit_project_idx on public.flyer_review_audit(project_id,created_at desc);
commit;
