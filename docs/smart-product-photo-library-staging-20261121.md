# MegaFlyer Smart Product Photo Library — development integration

**Split status: standalone product-photo library RELEASED; PTG-protected unified editor remains DRAFT / HOLD. Do not merge this protected-delivery PR alone.**
Part of the Branchline / PTG / MegaFrame / MegaFlyer coordinated four-app release.

## Product photo implementation (released standalone; protected frame staged)

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


## Opaque-frame photo gateway (staged security design)

The protected MegaFlyer editor deliberately uses an **opaque-origin** sandbox. It cannot call the Supabase photo Edge endpoint directly using a GitHub Pages origin, and the backend **does not accept `Origin: null`**. A new narrow `window.__MEGAFLYER_PHOTO_RPC__` interface in `staging/editor-storage-bridge.js` relays only allowlisted photo operations over its existing in-memory MessagePort to the protected `staging/studio-access/launch.js` parent. The parent sends requests exclusively to the existing Flyer Supabase Edge photo endpoint, forwarding the *current* PTG bearer/app-session in HTTP headers. The server independently confirms both PTG Auth identity and active PTG app-session on **every** operation, including preview/full-size image reads.

No PTG bearer is written to parent localStorage, sessionStorage, IndexedDB or Public Pages. No arbitrary remote URL or action can be requested through this photo bridge. When the protected Studio expires or is revoked, the parent closes the MessagePort and unmounts the iframe. Real hosted OAuth and revocation acceptance are still required before activation.

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


## Standalone live release checkpoint — 2026-11-21

The approved standalone [MegaFlyer PR #16](https://github.com/kzamora19/flyer-studio/pull/16) was released to `main` (commit `6fd07c46fcb83c978b2a5ba19096b2a26f3fab3b`) and [GitHub Pages deployment #44888006747](https://github.com/kzamora19/flyer-studio/actions/runs/44888006747) succeeded. The existing public editor remains available; only shared product-photo content requires the active PTG TL+ session. The previously staged `flyer-product-photos` Supabase SQL schema and private bucket are now applied to the existing **Flyer Studio** project, and the Edge function is deployed. Anonymous photo requests were rejected with HTTP 401 and foreign origins with HTTP 403 in [live negative test #44887913830](https://github.com/kzamora19/flyer-studio/actions/runs/44887913830).

The standalone editor loads `site/product-photo-standalone.js`. This script explicitly skips the future private editor (`window.__MEGAFLYER_PRIVATE_DB__`), which continues using the isolated MessagePort bridge. This draft branch has synchronized the released matcher, library, Edge backend, schema and toolbar adapter to avoid future integration regression.

**Remaining HOLD applies to the private PTG-delivery migration only:** protected ticket flow, OAuth/Drive/Save/Retrieve, remote revoked-user checks, photo retrieval on a second real PTG device, original PWA/public JS removal, migration backups, and coordinated release with Branchline/PTG/MegaFrame. The existing photo schema must be treated as applied to the Flyer production project; do not use this project for synthetic staging tests.


## Signed PTG Studio photo authorization — November 21 integration hardening

The standalone public MegaFlyer photo library remains live on the original **bearer + app-session** PTG verification path. The **unreleased protected Studio** now uses a distinct, private proof mode:

1. PTG launcher exchanges a one-time ticket for a private **non-extractable P-256 signing key** and rotating challenge; user bearer/app-session tokens remain outside the isolated editor.
2. The isolated editor requests only a named photo operation over its private MessagePort; its `currentSession()` is a local proof-mode marker, never a real PTG token.
3. The trusted GitHub Pages launcher serializes photo operations with periodic session rechecks, signs the current one-time challenge, and sends a `studioProof` to the Flyer Edge photo gateway. It does not forward a PTG user bearer, session ID, or browser role claim.
4. The Flyer photo gateway calls PTG `ptg-studio-access` **server-to-server** using the restricted Studio gateway secret. PTG verifies the P-256 signature, current source account, branch, role, session version, expiration, revocation and one-time challenge replay. Only then does PTG return the canonical actor ID and `canManage` scope **to the trusted service**.
5. The photo operation uses the verified actor and permissions. Each response, even a storage error after a valid proof, returns the **next one-time challenge** to the launcher. A missing/invalid proof shuts down the protected iframe; no fallback to standalone bearer auth or permissive `Origin: null`.
6. The private Studio delivery service strips PTG's internal actor/scope fields from browser responses; MegaFrame's private delivery continues its existing sanitization.

The staged photo gateway requires `FLYER_PTG_STUDIO_GATEWAY_SECRET`, `PTG_STUDIO_GATEWAY_URL` and `PTG_STUDIO_DEPLOYMENT_MODE` to enable the protected proof path. It fails closed without them. Never overwrite the currently live `flyer-product-photos` function with this draft until the **entire four-app** release and hosted tests are approved.

**Isolated test evidence:** [MegaFlyer private Chromium, 2 jobs passed](https://github.com/kzamora19/flyer-studio/actions/runs/44889656108) includes proof-only photo recall/upload without PTG bearer, parallel lookups, Save/Retrieve and 300-DPI exports, encrypted local account isolation, and active-photo-proof revocation forcibly unmounting the editor. PTG authorization regression tests validate actor ID and TL/admin distinction. These are mocks and disposable local Supabase fixtures, **not** hosted role-account acceptance.

**Still blocked:** actual PTG login in the isolated editor for non-photo workflows; production-safe cloud project and template authorization without a second account, Google OAuth/Drive, hosted revocation, real devices/printing, private source and PWA cutover, backups and conflict-free four-PR merging. No staging project is provisioned; existing live accounts must not be used for destructive acceptance tests.
