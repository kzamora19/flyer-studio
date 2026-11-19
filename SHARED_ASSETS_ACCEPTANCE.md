> **HISTORICAL DOCUMENT — SUPERSEDED BY [PTG_ONLY_SHARED_ASSETS_STATUS.md](PTG_ONLY_SHARED_ASSETS_STATUS.md).** The current ADD ASSET design uses PTG as the only login; no Flyer Cloud sign-in or account pairing is required. Backend version 2 and the PTG-only ownership migration are active. Public frontend is NOT deployed.\n\n# Shared Assets — PTG identity / permissions / device acceptance

**STATUS: BACKEND APPLIED TO EXISTING FLYER SUPABASE; FRONTEND NOT DEPLOYED; NOT RELEASE READY.**
Only new shared-asset tables, the private bucket, and the gated `flyer-shared-assets` Edge Function were activated. Existing Flyer Cloud tables and PTG database were not modified. GitHub Pages production remains on `main`; frontend changes are still only in `feature/shared-asset-library`.

## Architecture now staged
1. Browser requires valid Flyer Cloud login and a currently connected PTG app session.
2. Browser calls `flyer-shared-assets` gateway with both bearer tokens and PTG session ID.
3. Gateway checks Flyer Supabase `auth.getUser()` and invokes live PTG `ptg-auth` with `action=session` on EVERY operation. PTG checks inactive accounts, revocations, expiration, branch state, and session version.
4. Trusted administrator links Flyer user UUID to immutable PTG Auth user UUID in private `flyer_ptg_identity_links`. The gateway independently verifies the PTG Auth user record after PTG confirms the current app session. No user may self-register links.
5. Role verified from PTG response. Manager: `SYSTEM_ADMIN`, `BRANCH_ADMIN`, or `BRANCH_USER` with `legacyRole=TEAM LEADER`. Ordinary `BRANCH_USER` accounts and all other roles are denied, consistent with the TL-and-above access rule.
6. Database metadata and Storage are service-only with RLS enabled and private bucket. Clients cannot bypass the gateway with REST.
7. Image files limited to PNG/JPEG/WebP, 10 MB; signatures checked server side. Signed previews expire after 60 seconds. Existing issued signed URLs may remain usable until expiry even after access is revoked.

## Verification completed
- [x] Inspected actual PTG profile role schema and PTG auth session handling (read-only).
- [x] Confirmed PTG Team Leaders are BRANCH_USER with legacyRole TEAM LEADER.
- [x] Confirmed Flyer and PTG use separate Supabase projects / identities.
- [x] Confirmed shared-assets tables are NOT installed in live Flyer project.
- [x] Inspected current Flyer site and routed staged ADD panel through the dual-auth gateway.
- [x] Confirmed new code is only on feature branch (not production).

## Release blockers / tests to complete
- [ ] Complete the **explicit dual-login pairing step** with a real Team Leader-or-above user, which validates both Auth tokens and live PTG app session before inserting a unique Flyer UUID ↔ PTG UUID link. Account linking endpoint is deployed but no accounts are paired yet. Never pair based on display name, username or email.
- [x] Gateway uses an active PTG **publishable** key (environment variable preferred, public fallback configured). No service-role secret is sent to browser. Verify backend environment has Supabase service secret.
- [x] Used existing Flyer Studio project at no additional subscription cost. Applied only additive schema and private bucket; did not alter existing Flyer Cloud tables or `flyer-studio-private` bucket.
- [ ] Ensure `ptg-auth` allows the gateway's trusted allowlisted origin for server-to-server validation without introducing a bypass.
- [ ] Verify Team Leader write access (two users), Branch Admin/System Admin, ordinary Branch User denied.
- [ ] Verify disabled PTG user, expired PTG session, revoked session, branch OFF, wrong PTG+Flyer pairing, signed-out user: all denied.
- [ ] Attempt direct REST and Storage access with Cloud token and with anon key: denied.
- [ ] Check asset upload, rename, replace, delete, search, categories, preview, duplicate names, invalid MIME, invalid signatures, max upload size.
- [ ] On different devices/profiles, verify assets added by authorized user A are visible for authorized user B and updates synchronize after refresh.
- [ ] Validate card photo application, flyer autosave and print/export unaffected.
- [ ] Verify server endpoint request limits/rate limiting, error handling, audit logging and other Supabase security advisories.

## Known limitations
- This is a code-level integration. No real authenticated browser acceptance, isolated database migration, or cross-device test has run yet.
- The unused `site/shared-assets.js` prototype has been deleted on this branch; the UI uses only the verified Edge gateway.
- No release or production deployment until all security and browser tests pass.

## Staging setup discovery (read-only, 2026-11-19)
- Connected Flyer Studio organization: `yqsswksbxyuvjkpwadjq`; existing projects: Flyer Studio and MegaFrame Studio, neither is a staging project.
- Connected Primary organization: `jcrpcsenxiqffqemehhl`; existing projects: First Megasaver PTG and Ken's Project, neither is designated staging.
- New Supabase project creation requires user selection of organization and platform cost approval if nonzero.
- No test identity link records have been created and no live schema was altered.
- No browser or device tests can be claimed without a configured isolated test backend and two authenticated test accounts.

## 2026-11-19 staging provisioning attempt
- User selected Flyer Studio organization `yqsswksbxyuvjkpwadjq`.
- Supabase quoted **$0/month** additional project cost and returned a valid $0 cost confirmation.
- Creating `Flyer Studio Shared Assets Staging` failed: the organization's owner has reached the limit of **2 active free projects**.
- No project was created. Existing Flyer Studio and MegaFrame Studio projects remain unchanged.
- Do NOT pause or delete existing projects without explicit user choice. A plan upgrade or freeing a slot is required before separate staging setup can continue.
- As a result, live security checks, cross-account/device sharing, and flyer-output acceptance are still **NOT TESTED**.

## Zero-cost release plan (added 2026-11-19)
- User does not want a paid plan or an additional Supabase project. This is compatible with the feature: stage code in GitHub and use the existing Flyer Studio project only once rollout is separately approved.
- Existing private Storage bucket policies were inspected read-only. Their rules are explicitly restricted to `flyer-studio-private`, so the proposed new `flyer-shared-assets` bucket does not match those pre-existing grants.
- The new migration is additive (new identity links, shared asset metadata, private Storage bucket) and does not update existing Flyer tables or existing buckets. Verify against live schema again before applying.
- Configure runtime for the existing Flyer Studio Supabase URL and its publishable key when release is approved; do not enable premature live calls on the development branch.
- Configure `FLYER_PTG_PUBLISHABLE_KEY` only in Edge secrets. Both cloud and PTG accounts must be linked using immutable auth UUIDs through trusted administration.
- Local tests have passed 29/29 simulated identity and asset scenarios; these are not live acceptance. Browser, PDF and cross-device integration tests still must be completed before final release declaration.
- New UI target choices: product card, campaign logo, front and back sale artwork. All reuse existing image-upload handlers, preserving the original editing/export implementation.

## Backend activation verification — 2026-11-19
- Applied migration `flyer_shared_asset_secure_storage` successfully to existing Flyer Studio project `tzklsscoiwnmeantcefw`.
- Verified `flyer_shared_assets` and `flyer_ptg_identity_links` have RLS enabled. Neither anon nor authenticated has SELECT on shared metadata or INSERT on identity links.
- Verified private `flyer-shared-assets` bucket with 10 MB size limit and **zero** direct client storage policies targeting the bucket.
- Deployed `flyer-shared-assets` Edge Function version 1, `ACTIVE`, `verify_jwt=true`.
- Account counts at verification: **1** Flyer Cloud Auth user, **0** verified identity links, **0** shared assets. No actual user was linked without a validated dual-login.
- New explicit `pair` action is supported by the gateway; it requires valid PTG and Flyer Cloud sessions, verified immutable Auth UUIDs and TL-or-higher role; uses unique one-to-one mapping and cannot overwrite links. Frontend pairing button is only on feature branch.
- Supabase security advisor additionally shows an expected `rls_enabled_no_policy` info notice for server-only tables, and a pre-existing leaked-password-protection warning. No user data was copied into the new tables.
- Live browser acceptance (two independent authenticated accounts, revoked account, card rendering, real PDF output) remains **unverified** because the frontend is not released and no test credentials were available.
- **Do not deploy GitHub Pages frontend or claim feature complete until account pairing and print/output acceptance are verified.**
