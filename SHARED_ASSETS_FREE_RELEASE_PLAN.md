> **HISTORICAL DOCUMENT — SUPERSEDED BY [PTG_ONLY_SHARED_ASSETS_STATUS.md](PTG_ONLY_SHARED_ASSETS_STATUS.md).** The current ADD ASSET design uses PTG as the only login; no Flyer Cloud sign-in or account pairing is required. Backend version 2 and the PTG-only ownership migration are active. Public frontend is NOT deployed.\n\n# Shared Asset Library — Free-plan release runbook

**Backend migration and Edge gateway were authorized and activated on 2026-11-19. Public GitHub Pages frontend deployment remains NOT authorized/completed.**

## Preflight (read-only)
1. Reconfirm `tzklsscoiwnmeantcefw` is the intended Flyer Studio project and record a rollback snapshot of the current schema, Storage bucket configuration and Edge Function list.
2. Verify `storage.objects` policies in the existing project remain scoped to `bucket_id='flyer-studio-private'` (as inspected on 2026-11-19). If broader policies have been added, do not proceed until reviewed.
3. Confirm existing Studio projects, private photos and templates can still be opened with a test account.
4. Request explicit approval for **backend migration** separately from approval for **public site deployment**.

## Backend launch (completed for schema and Edge gateway; account pairing outstanding)
1. **Completed:** Applied `supabase/migrations/202611190001_shared_assets.sql` to `tzklsscoiwnmeantcefw`. The migration adds `flyer_ptg_identity_links`, `flyer_shared_assets`, and private `flyer-shared-assets` bucket. No current flyer tables are changed.
2. **Completed using public fallback:** Gateway uses the verified PTG **publishable** key, preferring `FLYER_PTG_PUBLISHABLE_KEY` if configured. Never expose the Supabase service-role or `sb_secret_` key to a client or GitHub.
3. **Completed:** Deployed `supabase/functions/flyer-shared-assets/index.ts` (version 1, `ACTIVE`, JWT verification on) to the existing Flyer Studio Supabase project. Edge function must validate both logged-in identities and live PTG app session.
4. **Pending real-user action:** The Edge gateway offers explicit **Link verified accounts** via a dedicated `pair` action, requiring both live Auth tokens and an active PTG Team Leader-or-above session. It links immutable Flyer/PTG UUIDs with a one-to-one constraint, without exposing IDs in the UI. No account links exist yet. No passwords or tokens are stored in the link.
5. **Partially confirmed:** SQL privileges/RLS show direct anonymous/authenticated access denied; 29 simulated gateway tests passed. Real disabled/revoked user tests remain pending.
6. Verify asset upload/preview/replace/delete and that two linked authorized accounts see the same assets. Verify cross-device login and cache reload.

## Frontend launch (separate approval after backend acceptance)
1. Set `window.FLYER_SHARED_ASSET_CONFIG = { supabaseUrl: 'https://tzklsscoiwnmeantcefw.supabase.co', publishableKey: '<current publishable key>' }` in a **release-only** script loaded before `site/shared-asset-ui.js`. The publishable key is public by design.
2. Do not put secret/service-role keys in GitHub Pages.
3. The UI has ADD, category/search, preview, edit/delete management and placement into product photo, logo, front and back headline artwork.
4. Run flyer autosave, PDF/PNG export, and legacy cloud project regression checks before deploying the Pages frontend. **Not yet run with real accounts.**
5. Merge `feature/shared-asset-library` into `main` only after explicit deploy approval. No automatic release is implied by code completion.

## Rollback
- If frontend fails, disable the release-only config and roll back only its `main` commit. Existing flyers remain unchanged.
- If backend fails, disable/remove the new Edge function. Keep new tables/bucket intact until exports and cleanup are approved; do not drop tables or delete assets without separate authorization.

## Current test evidence
- 14 simulated identity scenarios passed; 15 simulated asset scenarios passed (29/29).
- Additional 14 static checks passed on this branch for UI syntax, asset targets, server security controls and additive schema.
- Real RLS, Edge deployment, browser use, cross-device and printed output remain **unverified**. Do not call the feature production-ready until these pass.

## Actual production status (2026-11-19)
- Shared bucket: private, 10 MB; no direct client Storage policies.
- Shared tables: RLS enabled, with no direct grants for anon/authenticated.
- Backend Edge gateway: ACTIVE version 1, JWT verification enabled.
- No verified account links and no shared assets at verification time. Public Flyer Studio app still uses unchanged `main`.
- Real two-account and flyer output acceptance cannot be called passed until a valid dual-login test and actual browser PDF export are performed.
