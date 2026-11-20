# MegaFlyer Studio — Shared Asset Library release acceptance

**Status: development-only. Do not merge or publish until the actual browser and print checks are signed off.**

This checklist applies to `feature/shared-asset-library`. GitHub Pages `main` is the separate live application. The Shared Asset Library is guarded by **PTG session + PTG role**, not Flyer Cloud Workspace accounts. Do not enter passwords or tokens into test logs.

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

## Regression and release decision

- [ ] Run existing identity, image placement, banner/PDF, menu, and icon regression tests on the **latest checkout**.
- [ ] Run `node tests/shared-assets-backup.test.cjs`.
- [ ] Run `node tests/shared-assets-session-cleanup.test.cjs`.
- [ ] Verify existing Cloud Workspace, PTG lookups, flyer card editing, and installed app branding still work.
- [ ] Check privacy and RLS with no new direct public table grants or public Storage access.
- [ ] Record tester, device/browser, date, actual PDF/PNG evidence, and any failures. Obtain explicit release approval before changing `main`.

## Evidence and limitations

The development branch has isolated, no-network regression tests for backup validation and session preview cleanup. These are not substitutes for real signed-in PTG role tests, second-device synchronization, Google Drive file restore, or visual inspection of physical flyer exports. The backend and the live site must remain unchanged while these acceptance checks are outstanding.
