# Shared Asset Library — Free-plan release runbook

**Use existing Flyer Studio Supabase project only. No new project, plan upgrade, or production deployment is authorized by this document.**

## Preflight (read-only)
1. Reconfirm `tzklsscoiwnmeantcefw` is the intended Flyer Studio project and record a rollback snapshot of the current schema, Storage bucket configuration and Edge Function list.
2. Verify `storage.objects` policies in the existing project remain scoped to `bucket_id='flyer-studio-private'` (as inspected on 2026-11-19). If broader policies have been added, do not proceed until reviewed.
3. Confirm existing Studio projects, private photos and templates can still be opened with a test account.
4. Request explicit approval for **backend migration** separately from approval for **public site deployment**.

## Backend launch (requires separate approval)
1. Apply only `supabase/migrations/202611190001_shared_assets.sql` to `tzklsscoiwnmeantcefw`. The migration adds `flyer_ptg_identity_links`, `flyer_shared_assets`, and private `flyer-shared-assets` bucket. No current flyer tables are changed.
2. Set Edge secret `FLYER_PTG_PUBLISHABLE_KEY` to the PTG **publishable** key. Never expose the Supabase service-role or `sb_secret_` key to a client or GitHub.
3. Deploy `supabase/functions/flyer-shared-assets/index.ts` to the same existing Flyer Studio Supabase project. Edge function must validate both logged-in identities and live PTG app session.
4. Provision `flyer_ptg_identity_links` using a trusted administrator only, matching **immutable Flyer Auth user UUID** to **immutable PTG Auth user UUID** after validating each account owner. No self-linking, no email-only matching. Do not store passwords or user tokens in mapping records.
5. Confirm that ordinary Branch Users and disabled/revoked accounts receive 401/403 for list/preview/add/rename/replace/delete. Confirm direct REST and Storage access is denied.
6. Verify asset upload/preview/replace/delete and that two linked authorized accounts see the same assets. Verify cross-device login and cache reload.

## Frontend launch (separate approval after backend acceptance)
1. Set `window.FLYER_SHARED_ASSET_CONFIG = { supabaseUrl: 'https://tzklsscoiwnmeantcefw.supabase.co', publishableKey: '<current publishable key>' }` in a **release-only** script loaded before `site/shared-asset-ui.js`. The publishable key is public by design.
2. Do not put secret/service-role keys in GitHub Pages.
3. The UI has ADD, category/search, preview, edit/delete management and placement into product photo, logo, front and back headline artwork.
4. Run flyer autosave, PDF/PNG export, and legacy cloud project regression checks before deploying the Pages frontend.
5. Merge `feature/shared-asset-library` into `main` only after explicit deploy approval. No automatic release is implied by code completion.

## Rollback
- If frontend fails, disable the release-only config and roll back only its `main` commit. Existing flyers remain unchanged.
- If backend fails, disable/remove the new Edge function. Keep new tables/bucket intact until exports and cleanup are approved; do not drop tables or delete assets without separate authorization.

## Current test evidence
- 14 simulated identity scenarios passed; 15 simulated asset scenarios passed (29/29).
- Additional 14 static checks passed on this branch for UI syntax, asset targets, server security controls and additive schema.
- Real RLS, Edge deployment, browser use, cross-device and printed output remain **unverified**. Do not call the feature production-ready until these pass.
