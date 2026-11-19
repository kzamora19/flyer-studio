# Shared Asset Library — staging acceptance / release gate

Status: **NOT DEPLOYED**. Work on `feature/shared-asset-library` only.
The live GitHub Pages site is deployed exclusively from `main`.

## Implemented in staging source
- [x] Shared-library launcher / modal, search, category filter, preview
- [x] Add PNG/JPEG/WebP (10 MB limit); rename, replace, delete
- [x] Select asset and apply image to existing product-card photo uploader
- [x] Authenticated Flyer Studio Cloud bearer token; refresh token handling
- [x] Supabase SQL proposal for RLS and private storage (not applied)
- [x] Client write affordances hidden when no `can_manage`
- [x] Server policies specify protected SELECT/INSERT/UPDATE/DELETE and storage access

## Release blockers
- [ ] **Server verified PTG-to-Flyer identity mapping.** PTG and Flyer Cloud live in different Supabase projects and PTG role cannot be trusted from UI or user-editable claims. Provision `flyer_asset_memberships` ONLY from trusted backend validation of PTG active user, role and current session. Roles observed in the PTG schema: BRANCH_USER, BRANCH_ADMIN, SYSTEM_ADMIN; confirm how Team Leader is represented before enabling edit rights.
- [ ] **Inactive account / revoked session denial.** Recheck PTG activity and session validity for every sensitive asset write, not just once at sign-in; do not rely on stale membership rows.
- [ ] Apply migration only to an isolated TEST environment before production. Current live Flyer Studio project does **not** have shared asset tables; leave unchanged pending approval.
- [ ] Run SQL/RLS checks as authenticated test users and anonymous user.
- [ ] Browser tests (at least two distinct users and two devices or isolated browser profiles).
- [ ] Check add, duplicate names, different MIME types, images >10MB, empty name, unauthorized upload, replace, delete, signed URL expiry, cross-user visibility and actual apply-to-card output.
- [ ] Confirm no unauthorized action through REST directly even with hidden management buttons.
- [ ] Check CSP, offline experience, cloud session expiry/refresh, mobile viewport.
- [ ] Check all existing flyer editing, cloud autosave and PDF/PNG exports for regressions.
- [ ] Review current Supabase security advisor warning: leaked password protection disabled; this was pre-existing.

## Expected permission matrix
| Account | List/preview/select | Add/rename/replace/delete |
|---|---|---|
| Verified active Team Leader and above | yes | yes |
| Active ordinary branch user | business decision: yes when shared-view authorized | no |
| Inactive/suspended/revoked | no | no |
| Anonymous/unsigned cloud user | no | no |

## Important
No live account permission validation, multi-device verification, SQL migration execution, or end-to-end test has been completed. Do not merge, deploy, or claim release-ready status until the blockers are resolved.
