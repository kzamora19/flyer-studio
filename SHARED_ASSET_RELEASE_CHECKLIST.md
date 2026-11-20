# MegaFlyer Studio — Shared Asset Library release acceptance

**Status: acceptance testing in progress. The Shared Asset Library application code is already present on live `main` from separately approved releases. This draft PR contains additional QA tests and release documentation only; do not merge it without reviewing the current branch diff.**

This checklist tracks acceptance on `feature/shared-asset-library`. GitHub Pages `main` is the live application, with some functionality published separately from other development chats. The Shared Asset Library is guarded by **PTG session + PTG role**, not Flyer Cloud Workspace accounts. Do not enter passwords or tokens into test logs.

## Preflight

- [ ] Preview the **latest development branch** (not the public GitHub Pages app) at an allowed local origin, preferably `http://127.0.0.1:3000/`, or an approved test environment.
- [ ] Export/backup any existing local flyer before attempting import/restore tests.
- [ ] Use disposable non-sensitive test artwork and a test campaign; do not overwrite an actual sale in progress.
- [ ] Use real accounts only with authorization from their owners: Team Leader, Branch Admin, ordinary Branch User, and a disabled/revoked test account.

## Authentication and security

| Account / condition | Expected Shared Asset result | Actual | Pass |
| --- | --- | --- | --- |
| PTG Team Leader, active session | Can list, add, preview, use, rename, replace, delete, export and restore | — | [ ] |
| PTG Branch Admin, active session | Same permitted operations | — | [ ] |
| PTG ordinary Branch User | Denied; no asset names/images exposed | — | [ ] |
| Revoked/disabled account or expired application session | Denied after next authorized request; asset list and preview cleared on refresh | — | [ ] |
| No PTG token / no PTG app session | Denied before data request | — | [ ] |
| Switch accounts in one browser | Previous account's preview/selection cleared | — | [ ] |

**Note:** Already-downloaded files cannot be retroactively unread. Backend-generated private Storage signed URLs are configured to expire after 60 seconds; do not claim that all client/CDN copies are instantly revoked. The existing backend independently checks the PTG application session for each new request.

## Shared asset and print workflow

- [ ] Upload one PNG, one JPEG, and one WebP, including at least one near-10-MB file if practical.
- [ ] Search by name, filter by category, preview, rename, replace and delete a disposable asset.
- [ ] Apply a shared asset to a **filled product-card slot**. Reopen the slot and verify the right product photo is stored.
- [ ] Apply a shared asset to the **campaign logo** and verify the custom header is visible.
- [ ] Apply assets to both **front** and **back** headline artwork using the existing editors.
- [ ] Test an extremely wide front artwork; confirm the blurred background fills empty space while the unblurred original remains entirely visible.
- [ ] Export and inspect the actual front PNG and **two-page PDF** from the latest branch. Check photos, text legibility, price positioning, banner boundaries, page count and print margins.
- [ ] Reload the editor and confirm that the saved flyer, image positions and local/cloud behavior match expectations.

## Multi-device and backup

- [ ] Upload an asset as an authorized user on Device A; sign in with a **different authorized PTG account** on Device B and verify it appears.
- [ ] Replace/rename that disposable asset on A; refresh B and verify the change propagates.
- [ ] Export a Shared Asset Library JSON backup (maximum 25 assets and 40 MB raw images).
- [ ] **Manually** upload the JSON backup to Google Drive; download it to a second device and restore as an authorized TL+ account.
- [ ] Verify restored images, categories and image previews. Restore currently **adds** assets; it is not deduplicated or transactional, so use a disposable library and do not blindly retry a partially completed restore.
- [ ] Corrupt a **later** item in a backup and confirm the entire preflight is rejected **before any asset is created**.
- [ ] Simulate a network failure after the first successful import and confirm the UI clearly reports the partial count.

## Account-switch race acceptance

- [ ] Sign out of PTG while the Shared Asset Library is open. Verify its list, selection and preview clear immediately, without refreshing the page.
- [ ] Switch from a Team Leader to an ordinary Branch User while a shared-asset **list** or **preview** is loading. Confirm that the old response never repopulates the library or applies an asset.
- [ ] After a new authorized PTG session, explicitly refresh and verify that only current permissions are used.

## Regression and release decision

- [x] Run existing identity, image placement, banner/PDF, menu, and icon regression tests on the **latest checkout**. *(Native Node CI, latest synchronized branch.)*
- [x] Run `node tests/shared-assets-backup.test.cjs`. *(GitHub Actions.)*
- [x] Run `node tests/shared-assets-session-cleanup.test.cjs`. *(GitHub Actions.)*
- [x] Run `node tests/shared-assets-session-race.test.cjs`. *(GitHub Actions.)*
- [ ] Verify existing Cloud Workspace, PTG lookups, flyer card editing, and installed app branding still work.
- [x] Check privacy and RLS with no new direct public table grants or public Storage access. *(Read-only Supabase metadata; private bucket, RLS enabled, no direct grants for asset table.)*
- [ ] Record tester, device/browser, date, actual PDF/PNG evidence, and any failures. Obtain explicit release approval before changing `main`.

## Evidence and limitations

The development branch has isolated, no-network regression tests for backup validation and session preview cleanup. These are not substitutes for real signed-in PTG role tests, second-device synchronization, Google Drive file restore, or visual inspection of physical flyer exports. The backend and the live site must remain unchanged while these acceptance checks are outstanding.


## Automated acceptance evidence — November 20, 2026

**PASS (mocked and code-level only):** [MegaFlyer development acceptance run 44701946885](https://github.com/kzamora19/flyer-studio/actions/runs/44701946885) at commit `45787ecae9afbd3608d8cf443e444628f9f181ce`.

- All nine native Node regression suites passed on GitHub Actions (PTG gateway identity, asset placement, banner fit, PDF structure, menus, icons/floating panels, backup preflight, preview cleanup, and session races).
- Real headless Chromium passed simulated authorized/denied/signed-out PTG states without contacting live PTG/Supabase; it loaded a signed-image mock, applied it to the campaign logo and front/back artwork, and downloaded one PNG and a real two-page PDF.
- [Chromium evidence artifact](https://github.com/kzamora19/flyer-studio/actions/runs/44701946885/artifacts/14613106869): front browser screenshot, `megaflyer-front-print.png` (2480 × 3507 pixels), and `megaflyer-two-page-draft.pdf` (2 A4 pages; each embedded JPEG is 300-ppi-sized). The PDF was rendered into both pages and visually inspected; no obvious text clipping appeared in the **demo card fixture**.
- Test artwork intentionally uses a tiny white placeholder and demo product values, so large blank images/white branding squares in these files are **fixture limitations**, not approved flyer artwork or evidence of a bug.
- The newer live UI toolbar on `main` was updated separately while development testing was in progress. The release branch incorporated those changes for its successful smoke test. `main` may change again; reconcile it before any future merge.
- No real PTG credentials, production asset mutations, backup restore to Supabase, or Google Drive write were used in these checks.

**Still NOT verified (must not silently mark complete):** real active Team Leader/Branch Admin/ordinary/revoked account permission behavior, second-device synchronization, manual Google Drive backup/restore, real customer/product images, and physical print approval. Leave this PR in draft until those acceptance gates are satisfied.


## November 20, 2026 — Re-synchronization and dual-browser QA

- Updated the development branch to the latest `main` commit `3aab032532`, keeping the approved desktop/mobile centered Shared Asset Library dialog, horizontal action tabs and Arrange Sections fixes. **Production was not changed by this synchronization.**
- Re-ran the entire [GitHub Actions development acceptance workflow](https://github.com/kzamora19/flyer-studio/actions/runs/44704485864): native Node regressions **passed** and the existing 300-ppi A4 browser PDF/PNG export smoke **passed** against the synchronized branch.
- Added `tests/megaflyer-two-device-smoke.mjs`, run inside the same accepted workflow. **Passed:** two isolated Chromium contexts with mocked Team Leader and Admin PTG sessions saw the same central mock assets, exported JSON on browser A, imported it through the real UI on B, then propagated a rename back from A to B after refresh.
- This **does not** prove genuine Supabase cross-device behavior, role enforcement with real PTG identities, nor real Google Drive upload/download/restore. The JSON was transferred entirely within the test runner (no Google account or production data touched).
- Read-only security snapshot: Flyer Studio Supabase project ACTIVE_HEALTHY, one metadata record, one object, private `flyer-shared-assets` bucket, RLS enabled, and no direct table privileges for `anon` or `authenticated` on `flyer_shared_assets`. The PTG-gated Edge Function is ACTIVE version 2.
- Outstanding live acceptance: authorized Team Leader **and** Admin, ordinary/disabled/revoked roles on real PTG; cross-device synchronization with distinct real accounts; one non-destructive test file exported to and restored from real Google Drive; and a printed **real** promotional flyer. Do not claim release completion from mock acceptance alone.


## November 20, 2026 — latest approved production UI synchronization

- The feature branch was brought up to live `main` commit `68417ef8d7` (centered MegaFlyer editor popups) after earlier sync to `3aab032532` (centered Shared Asset Library), without changing `main`.
- The shared asset frontend, PTG authorization wiring, icon, horizontal toolbar, and popup fixes are **already in the live `main` source**. PR #5 is now only a draft acceptance/testing/documentation contribution, not a new deployment of the existing library.
- The acceptance workflow now contains the isolated two-context asset sync, JSON offline transfer/restore and full-resolution flyer export tests. These are safe mocks and do not attest to live real-user behavior.
- Real account permissions, actual cross-device sync, real Google Drive file transfer/restore, and physical print approval remain open. The live service must not be mutated for test purposes without a controlled authorized fixture.
