# Shared Assets — PTG identity / permissions / device acceptance

**STATUS: STAGING ONLY. NOT DEPLOYED. NOT RELEASE READY.**
No changes applied to the live Flyer Studio or PTG Supabase database.
GitHub Pages production publishes from `main`; this branch is `feature/shared-asset-library`.

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
- [ ] Provision verified Flyer Auth UUID ↔ PTG Auth UUID mappings through a protected admin mechanism. Never link identities by display name, username, or email alone.
- [ ] Configure `FLYER_PTG_PUBLISHABLE_KEY` in test backend secrets; do not expose any service role key in browser.
- [ ] Create a **separate staging Supabase project** in the user-selected organization, after cost approval if quoted. Deploy schema and function only there, not in the live project.
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
- The original `site/shared-assets.js` proof-of-concept is no longer used by the UI. Do not import it; remove during cleanup.
- No release or production deployment until all security and browser tests pass.

## Staging setup discovery (read-only, 2026-11-19)
- Connected Flyer Studio organization: `yqsswksbxyuvjkpwadjq`; existing projects: Flyer Studio and MegaFrame Studio, neither is a staging project.
- Connected Primary organization: `jcrpcsenxiqffqemehhl`; existing projects: First Megasaver PTG and Ken's Project, neither is designated staging.
- New Supabase project creation requires user selection of organization and platform cost approval if nonzero.
- No test identity link records have been created and no live schema was altered.
- No browser or device tests can be claimed without a configured isolated test backend and two authenticated test accounts.
