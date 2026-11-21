# MegaFlyer Smart Product Photo Library — development integration

**Status: DRAFT / HOLD. This branch is NOT deployed and must not be merged alone.**
Part of the Branchline / PTG / MegaFrame / MegaFlyer coordinated four-app release.

## Current implementation in development

- Added `site/product-photo-match.js`: preserves barcode leading zeroes, uses barcode first, exact normalized brand + model second, and treats description as a **suggestion only**.
- Added a private-only `Product Photos` panel, injected into the PTG-protected MegaFlyer editor by `scripts/build-private-flyer.mjs`. It does not appear in the existing public `site/index.html`, GitHub Pages release, or generic Shared Asset Library.
- Panel includes Use Saved Photo, Upload New Photo, View All Photos, Set as Primary, and admin-only Replace Photo / Remove Photo. The new upload path applies the original image to the flyer, then (unless the user unchecks sharing) stores an optimized 1600-pixel WebP and a 360-pixel thumbnail. Cloud save failures **do not undo** the image already applied to the flyer.
- Product selections are observed asynchronously, without waiting on a photo lookup before PTG pricing. Previously saved photos are offered, never auto-inserted. Uncertain description matches require the user to select and confirm.
- New `flyer-product-photos` Edge service checks a **current** PTG app session and PTG Auth identity on every request. Normal TL+ accounts may view, upload and set the primary image. Branch Admin and System Admin additionally may replace or remove. No browser service key is permitted.
- New, unapplied schema creates distinct `flyer-product-photos` PRIVATE Storage, content-addressed image blobs (SHA-256 deduplication), product-to-photo links, one primary image per product and an audit table. Deletion is a soft-delete of the shared reference; old immutable blob bytes are not removed or overwritten. No public or normal-authenticated table policies.
- Library fetches thumbnail/full image **through the validated Edge gateway**, not with long-lived public or signed URLs, to avoid post-revocation image URL reuse. Already downloaded/saved images cannot technically be recalled from someone's device.
- File limits: original import maximum 12 MB; stored optimized image maximum 2 MB, thumbnail 256 KB; 20 associations per product.

## Important boundaries

- Supabase project remains existing Flyer Studio (`tzklsscoiwnmeantcefw`); PTG is the existing separate `agknxlowackphvwyvxge` project. **No new project, subscription, or paid hosting.**
- This code assumes the existing PTG account is available through the editor's PTG connection. Cross-app login/OAuth and true hosted account testing still need acceptance. Do not imply the new library is active merely because its source exists.
- Do **not** backfill images from photos in old saved flyers or from generic Shared Asset uploads. Those may be customer/private media. The new `Upload New Photo` flow and native `cardPhotoUpload` product-card input are both eligible for auto-saving after the existing importer succeeds, with separate visible opt-out controls. No other editor photo inputs are intercepted. The native upload path still needs real authenticated upload/opt-out acceptance.
- The same origin `kzamora19.github.io` is only a browser origin; it does not imply same Supabase login or database. Continue using the protected opaque-origin frame.
- A shared image's use in a flyer is a copy, not a reference into live Storage; replacing/removing the library entry must not mutate past saved project snapshots.
- Private Storage bucket grants must be reviewed on the live project **before** migration. A broad pre-existing Storage policy, if any, could unintentionally expose the new bucket. Validate anonymous GET/list denial. No blanket Storage policy added.
- The hosted function requires `FLYER_PRODUCT_PHOTO_ALLOWED_ORIGIN=https://kzamora19.github.io` and a secure server-side `FLYER_PTG_PUBLISHABLE_KEY`. It uses the existing Flyer project's server secret and PTG's current Auth+session gateway. Do not put service or gateway keys in public Pages code.
- `verify_jwt=false` is intentional for this cross-project Edge function: a token from PTG is not a Flyer Auth JWT, so the function verifies that bearer *against PTG Auth and session state* every time. Function must fail closed when env is missing.

## Testing and acceptance

Automated source, packaging, Deno and browser tests are run in the draft MegaFlyer protected-bundle workflow, with no deployment.

**Must still pass before coordinated release:**
1. Actual PTG TL, Branch Admin, System Admin, ordinary, disabled/revoked, reset-required and forced-out accounts, including active editor revocation.
2. Real Supabase private Storage access, CRUD and concurrent duplicate uploads, audit log and SQL/RLS review without production data.
3. Native product-card photo import automatic save and opt-out behavior with real PTG users, including proof private customer/non-product inputs never share.
4. Real barcode/model/description search, several images, primary switching, replacement isolation against pre-existing cloud projects, and second-device authorized account retrieval.
5. Cloud Save/Retrieve, Google OAuth/Drive and PDF/PNG/physical printing through the opaque frame.
6. Old public editor/PWA retirement, backups, rollback, all four PRs tested on the exact release SHAs, and explicit owner deployment approval.

**NO production database migration, Supabase Edge deployment, GitHub Pages publishing, or PR merge is authorized by this document.**
