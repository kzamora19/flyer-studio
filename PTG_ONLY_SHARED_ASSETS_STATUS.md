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

## Front banner fit improvement (2026-11-20; not deployed)
- Diagnosed wide campaign artwork letterboxing: the classic and modern split front layouts use a tall hero panel (330 layout units) while extremely wide artwork is fitted without cropping, producing excessive plain-color bands.
- Fixed the **shared `banner()` renderer** on the development branch only. When more than 18% of the hero panel would be empty, a softly blurred, cropped copy of the *same* artwork fills the background, while the **unblurred original image** is still contained in full at its natural aspect ratio. This does not change the TechZone area, product-card positions, page size or PDF/PNG rendering paths.
- Updated action label `Use on card` to `Use asset` to match product-card, logo and banner destinations.
- Added `tests/shared-banner-fit.test.cjs` and executed its exact source against the current development `site/index.html`: **20/20 assertions passed** for dimensions, threshold behavior, background clipping, original foreground preservation, canvas state reset and shared PNG/PDF renderer references. These are **code-level and mock-canvas tests**, not a visual print sign-off.
- Outstanding: update the user's downloaded local development ZIP (it does not auto-sync with GitHub), inspect the revised front banner in Chrome, obtain the actual exported PDF and inspect both rendered pages; test card/logo/back-banner uses and unauthorized/revoked account access. Public Flyer Studio GitHub Pages `main` remains untouched.

## November 20, 2026 — Continued acceptance / quality verification (development branch only)
- User-supplied Chrome screenshots from the local port-3000 preview establish **real authorized PTG sign-in**, `Authorized asset manager` UI, shared image upload/list/preview, front-headline placement and generation of a **two-page PDF visible in Acrobat**. This is evidence of an actual authorized-account flow, *not* a full Admin/ordinary-user/revocation acceptance.
- Read-only Supabase checks confirm **one shared asset record** in the existing project, private `flyer-shared-assets` Storage bucket, RLS on `flyer_shared_assets`, and no direct SELECT grants to `anon` or `authenticated`. The PTG-only gateway remains ACTIVE version 2. No new Supabase migration, credentials or changes were made in this round.
- Improved `site/shared-asset-ui.js` on the feature branch:
  - **Product-card target** now uses `targetedOffer()` and `attachUploadedPhoto()` for the current filled flyer position, avoiding stale card-modal photo targets.
  - **Campaign-logo target** uses `readPhoto()`, switches `brandHeader` to `custom`, and calls `edited()` so a custom logo actually becomes visible. Decode failures do not change the header.
  - **Front/back target** reuses the existing artwork upload controls and correctly differentiates its asynchronous 'sent to editor' message from a completed saved change.
  - **PTG sign-in shortcut** now opens the actual card lookup/login interface, indicates already-connected status, and advises using local port 3000 instead of 5500 when required.
- Added repeatable tests: `tests/shared-assets-placement.test.cjs` (**23 passing assertions**) and `tests/shared-flyer-pdf.test.cjs` (**15 passing assertions**). Re-ran the existing `tests/shared-banner-fit.test.cjs` (**20 passing assertions**). **Total 58/58 passed** by executing the current exact feature-branch JavaScript with simulated DOM/canvas/Blob inputs.
- The PDF tests assert embedded JPEG streams, two page objects, xref and media-box structure; they are **structural tests**, not a human review of the actual flyer artwork. No actual `megasaver-flyer-draft (2).pdf` was attached in the conversation or located in the user's available Library.
- **Still pending before release:** visually inspect the updated soft-backdrop front banner, upload/review a *fresh actual PDF* from the latest development branch, manually test real product photo / campaign logo / back-banner destinations in browser, verify role denials with real ordinary/inactive/revoked PTG sessions, test a second authorized account/device, and test Google Drive backup export/restore. Avoid changing production data for these tests unless separately approved.
- Public GitHub Pages `main` remains unchanged: **do not merge or deploy without explicit approval**. User's earlier local ZIP does **not** update automatically when the remote branch changes.

## Repeatable no-Work-credit checks
In the updated development ZIP, where Node.js is available:
```powershell
node tests/shared-assets-placement.test.cjs
node tests/shared-flyer-pdf.test.cjs
node tests/shared-banner-fit.test.cjs
```
These are test-only commands; they do not write to Supabase or publish GitHub Pages.

## Final code-check continuation — November 20, 2026
- Added `tests/shared-assets-authorization.test.cjs` and executed its actual PTG-only gateway `identity()` function through a mocked network adapter: **20/20 assertions passed**, covering 17 active/unauthorized/revoked/expired/missing-credential scenarios, including early rejection before network calls. **These do not substitute for real revoked-account acceptance.**
- **Cumulative repeatable regression result: 78/78 assertions passed** (20 PTG auth; 23 image placement; 20 banner-fit; 15 two-page PDF structure).
- GitHub feature branch includes product-card placement repair, custom logo visibility fix, PTG sign-in shortcut correction and more accurate asynchronous banner-import messaging. Public `main` is unchanged.
- Private Supabase shared library currently has **1 actual uploaded test asset**; RLS and storage privacy were checked read-only. No Supabase writes or Edge deployments occurred in this continuation.
- Still cannot verify updated actual PDF print sharpness/alignment without the exported PDF file. Browser screenshots establish earlier PDF generation and front-banner placement, but **not** the appearance after the latest banner-fit update. Real Admin/Branch User/revoked login, second-device sync, image use on each alternate destination and Google Drive restore remain manual acceptance gates.
- For repeatability, run the four no-dependency test files on the current development ZIP with Node.js; no paid service or Work mode is required.

## November 20 — Editor navigation, branding icon and floating panels (STAGED; not public yet)
- Removed duplicated pinned **Front Side / Back Side** submenus; retained the original live Front / Back preview controls.
- Main editor navigation now stays in **one column on all widths**. Added an accessible **Show menu / Hide menu** collapse toggle and persisted its state using localStorage; section-specific submenus now appear in the scrollable editor region, not the pinned area; Layout & Appearance is a regular menu entry.
- Branded icon concept for First Megasaver Flyer Studio: blue square with a white folded flyer, red promotion stripe and gold accent. Added `site/icons/flyer-studio.svg`, PNG fallback `site/icons/flyer-studio-192.png`, `site/manifest.webmanifest`, browser favicon, touch icon and header symbol. Official First Megasaver text branding is retained. Installed operating-system shortcuts may need uninstall/reinstall to refresh a formerly generic `F` icon.
- Converted normal editor, Layout & Appearance, section/header and Studio+ panels to **non-blocking floating dialogs**. Root overlays are transparent and pointer-events:none; panels remain interactive, can be dragged by headings using `site/floating-panels.js`, and mobile panels are constrained to a bottom-sheet height. Shared Asset Library follows the same non-blocking pattern. `aria-modal=false` reflects actual behavior. Existing confirmation dialogs remain blocking when a destructive action needs explicit approval.
- Regression checks against current branch: **78/78 existing identity/placement/banner/PDF assertions**, **22/22 menu assertions**, **25/25 icon and floating-dialog assertions** = **125/125 assertions pass**. Checks use mocked DOM, browser events, image data and PDF internals, not a physical browser screen or deployed acceptance.
- **Release status:** These changes are on `feature/shared-asset-library`, not `main`. Do not describe them as live until a deployment is requested/performed and checked. Supabase remains unchanged.

## November 20, 2026 — Shared Asset Library release hardening (development branch only)

- Verified **read-only**: Flyer Studio Supabase project is active; private `flyer-shared-assets` bucket contains 1 Storage object; `flyer_shared_assets` has 1 metadata row with RLS enabled; `flyer-shared-assets` Edge Function is ACTIVE version 2. No database, storage, Auth, or Edge Function writes were made.
- Fixed shared-asset **backup restore preflight** in `site/shared-asset-ui.js`: validates all files, categories, names, MIME signatures, encoded lengths, per-asset 10 MB and aggregate 40 MB limits before any `add` request. If a later network request fails after successful imports, the UI reports the partial count and warns against blind retry. Restore is still a series of non-transactional server calls; it is not deduplicated.
- Fixed cached **shared preview visibility** on PTG account switch or authorization failure: revokes the browser object URL, hides the previous preview, clears selection and reverts the manager hint. New server requests still depend on PTG authorization.
- Added `tests/shared-assets-backup.test.cjs` and `tests/shared-assets-session-cleanup.test.cjs`. **18 backup checks + 4 session-cleanup checks passed in isolated JavaScript runs against the exact newly committed source**, without network or Supabase writes. The native Node command-line suite and real UI acceptance still need running in the development checkout.
- Added `SHARED_ASSET_RELEASE_CHECKLIST.md`: explicit real-account authorization matrix, multi-device tests, all image-placement destinations, actual front PNG / two-page PDF inspection, manual Google Drive JSON backup/restore and regression sign-off.
- Supabase Security Advisor still reports informational `rls_enabled_no_policy` for the two backend-only tables (deliberately no direct browser policies), plus the pre-existing `auth_leaked_password_protection` warning; no security settings were changed.
- Live `main` has only previously approved icon/name/PWA updates. **The Shared Asset Library frontend hardening is not deployed.** Keep the live application, PTG production and Supabase data unchanged until acceptance and explicit release approval.
