# Flyer Studio ADD ASSET — PTG-only redesign (2026-11-19)

## Agreed architecture
- **Only PTG sign-in is required for ADD ASSET** (no separate Flyer Cloud sign-in or link action).
- Existing Flyer Studio Supabase project `tzklsscoiwnmeantcefw` stores shared images and metadata. No new Supabase project, paid plan, or database connection is needed.
- The secure `flyer-shared-assets` Edge Function validates PTG Auth bearer token, immutable PTG user ID, **current PTG application session**, account active/revocation state (via `ptg-auth`), and role on EVERY operation.
- Authorized roles: PTG `SYSTEM_ADMIN`, `BRANCH_ADMIN`, and `BRANCH_USER` with legacy role `TEAM LEADER`. Ordinary users denied.
- The private `flyer-shared-assets` bucket and `flyer_shared_assets` table remain accessible only via the backend's service key, never from the browser. RLS enabled; no direct anon/authenticated grants or storage policies.
- ADD ASSET supports PNG/JPG/WebP up to 10 MB, list/search/category, preview, rename, replace, delete and application to a product card, campaign logo, front or back headline artwork.
- **Optional Google Drive backup is manual**: export a JSON image backup (max 25 assets/40 MB in one file), then save it to Drive yourself. Restore from the backup file using a TL+ PTG account. No Google OAuth or automatic Drive synchronization is implied.
- The existing Cloud Workspace account feature elsewhere in Flyer Studio is left unchanged; it is **not required for ADD ASSET**.

## Backend applied, public frontend NOT deployed
- Migration `flyer_shared_asset_secure_storage` was applied earlier to the existing Flyer Studio project.
- Migration `flyer_shared_assets_ptg_only_ownership` was applied successfully. It refuses to run if shared-asset rows exist, then removes two Flyer Auth foreign keys from metadata creator/updater UUID columns. All existing Flyer Cloud tables/records are unaffected. The legacy unused `flyer_ptg_identity_links` table remains empty and inaccessible to clients.
- The PTG-only `flyer-shared-assets` Edge Function is `ACTIVE` version 2. `verify_jwt=false` is intentional because the token issuer is the *separate PTG Supabase project*; the handler independently validates the PTG bearer against PTG Auth and the current PTG application session on each call. Denies requests with no active PTG session.
- Existing Shared Asset records: 0 at verification time.
- The new interface and its public publishable-key configuration are committed only to `feature/shared-asset-library`. GitHub Pages `main` is unchanged.

## Simulated tests run against actual gateway function bodies
- Identity permission scenarios: **10/10 passed** (TL/admin/system allowed; ordinary/unknown denied; simulated revoked, must-change-password, missing token, missing PTG session, invalid identity denied).
- Asset operation scenarios: **15/15 passed** (upload/list/preview/rename/delete/replace; unauthorized operations; bad category/MIME/SVG/name/base64; missing asset; rollback on failed insert).
- UI JavaScript source parsed successfully; static checks confirmed Cloud login and account pairing were removed from ADD ASSET; four existing image upload targets connected.
- These are mock-based function tests, **not** real authenticated browser acceptance or physical-device checks.

## Remaining acceptance before frontend release
- [ ] Browser sign-in with real TL and Admin PTG accounts and successful asset upload.
- [ ] Browser login as ordinary Branch User, revoked/inactive account and branch-off session; verify fail-closed behavior.
- [ ] Verify shared assets propagate to two distinct authenticated users and devices.
- [ ] Apply assets into campaign logo, product cards, front/back banners and review actual PDF/PNG output and autosave.
- [ ] Verify export and restore backup using genuine images, including optional manual save to Google Drive.
- [ ] Verify no UI regression to Cloud Workspace, existing saved flyers and print workflow.
- [ ] Obtain explicit approval before merging to `main` or deploying the public GitHub Pages site.

**Do not interpret completed backend or simulated tests as full production acceptance.**
