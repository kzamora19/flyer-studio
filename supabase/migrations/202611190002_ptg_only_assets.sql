-- PTG-only Shared Asset access. Apply only after authorization review.
-- Existing Flyer Cloud projects/photos/tables remain unchanged.
-- Metadata creator/editor UUIDs now reference users in the separate PTG Auth project,
-- so they cannot have foreign keys to Flyer Studio's auth.users table.
-- The gateway is the sole accessor, and verifies PTG's active app session + role.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.flyer_shared_assets LIMIT 1) THEN
  RAISE EXCEPTION 'Shared asset table is not empty: review and back up before PTG-only migration';
 END IF;
END $$;
ALTER TABLE public.flyer_shared_assets
 DROP CONSTRAINT IF EXISTS flyer_shared_assets_created_by_fkey,
 DROP CONSTRAINT IF EXISTS flyer_shared_assets_updated_by_fkey;
COMMENT ON COLUMN public.flyer_shared_assets.created_by IS 'Immutable PTG Auth user UUID; verified by server on every write';
COMMENT ON COLUMN public.flyer_shared_assets.updated_by IS 'Immutable PTG Auth user UUID; verified by server on every write';
-- Legacy flyer_ptg_identity_links remains intact (empty) for non-destructive migration.
-- It is not used by the PTG-only feature and must not be written by browser clients.
REVOKE ALL ON public.flyer_shared_assets FROM anon, authenticated;
ALTER TABLE public.flyer_shared_assets ENABLE ROW LEVEL SECURITY;
