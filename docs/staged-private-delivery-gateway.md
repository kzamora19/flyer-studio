# Staged Supabase private editor delivery — NOT DEPLOYED

This proof demonstrates the **server-side** part of an alternative to the obsolete Vercel Studio proxy. It does not yet make the public MegaFlyer website Team Leader-only.

## Proposed request boundary

- The PTG `/studios` launcher (separate PTG PR #38) issues an opaque, ten-minute ticket to an active PTG Team Leader, Branch Admin or System Admin.
- The future lightweight GitHub Pages launcher immediately removes the ticket fragment from browser history and sends it by **POST JSON** to this server-side `flyer-editor-delivery` Edge Function; no PTG password or Supabase secret is present in the public page.
- The Edge Function verifies the ticket **server-to-server** through PTG, which independently rechecks the PTG user's role and live session. It then reads an immutable, SHA-256-checked `studio.html` bundle from a **new private Storage bucket** and returns it as JSON to the designated GitHub Pages origin.
- A `check` request re-verifies the PTG source session without transmitting the bundle again. No private Storage signed URL is exposed to the browser, and all responses disable caching.
- This avoids the default Supabase Edge domain limitation on directly serving HTML with `GET text/html`. It does **not** solve how the editor HTML is mounted, renewed, unmounted on revocation, or how its cloud/drive routing works inside an iframe.

## Required server configuration (do not configure in production yet)

`FLYER_STUDIO_ALLOWED_ORIGIN`: exact HTTPS launcher origin (no path/wildcard)
`FLYER_PTG_STUDIO_GATEWAY_SECRET`: same server-only secret used by PTG Studio verify function
`FLYER_PRIVATE_BUNDLE_PATH`: immutable `releases/<digest-prefix>/studio.html`
`FLYER_PRIVATE_BUNDLE_SHA256`: exact SHA-256 hex from packaging manifest
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`/service-role key: injected server-side only
Storage bucket: `flyer-editor-release` (private, created only after approval)

The PTG gateway must actually be deployed and share the secret, and the function must be configured to allow unauthenticated gateway requests **only** after it independently verifies each ticket. Front-end CORS is not authorization.

## Unresolved release blockers

1. Secure browser-side launcher, session continuation/renewal, replay protection and expired-session behavior, including saving unfinished work.
2. Actual iframe/srcdoc behavior of 1.37 MB editor: its catalog paths, Google OAuth redirect URLs, source image import, PWA caches and print/download flows.
3. Existing public `site/index.html` would remain a bypass until GitHub Pages publishes **only** the public entry. Previously cached copies cannot be remotely erased.
4. Security review for common `kzamora19.github.io` origins and its access to all localStorage across application paths.
5. End-to-end tests with real authorized and disabled PTG accounts, real cross-device asset sync, Google Drive restore and printed flyer.
6. Production Storage, Edge Function, secrets and PTG migration must stay unchanged until explicit release approval.

This source is a **non-deployed technical prototype**, not a finished app-wide access guarantee.


## November 21, 2026 — Browser proof (no production services)

GitHub Actions [run 44860294219](https://github.com/kzamora19/flyer-studio/actions/runs/44860294219) passed both the Node/Deno checks and the isolated Chromium launcher tests:

- An opaque, syntactically valid mock PTG ticket is removed from the URL before making the mocked backend request.
- A mock protected editor document is mounted only after a simulated successful response, and removed on a simulated revoked PTG session.
- **The actual full MegaFlyer editor bundle** generated from the approved live source (over 1 MB) successfully mounts in the protected iframe in headless Chromium. Its PDF/PNG toolbar controls are present, and the Shared Asset Library modal opens/closes.
- All network calls in this test are mocked; no real PTG account, Supabase Storage, database, Google Drive or production printer was used.
- **Not yet covered:** actual PNG/PDF downloads from the protected iframe, cloud OAuth callback and project save/restore inside it, image catalog endpoints, renewal beyond the PTG ten-minute ticket lifetime, direct-URL/PWA-cache cutover, and real account revocation. Do not interpret basic editor mounting as completion of these workflows.

The current public GitHub Pages editor is unchanged; these changes remain in a draft, non-deployed pull request.


## November 21, 2026 — Step 1/2 protected-flow acceptance progress

**Automated results (mock services only):**

- The latest approved MegaFlyer Save Project, Retrieve Project, backup/export controls and sticky-tab version were merged into this **development** branch without altering `main`.
- The complete editor inside the protected iframe successfully performs named cloud project Save, Save Changes, Save As New, search, retrieval, image round-trip and revision conflict protection using mocked Supabase services. It also generates actual full-resolution A4 PNG and two-page PDF downloads inside the authorized frame. See `tests/staged-protected-project-workflow.mjs` and `tests/staged-full-editor-frame.mjs`.
- The private bundle now explicitly chooses the Supabase flyer-catalog route and permits the separate PTG connection workflow instead of relying on the `about:srcdoc` location to identify GitHub Pages. CI covers these routes.
- The launcher now has a hard local cutoff for the PTG ticket's server-provided expiry, a two-minute warning, revalidation after returning to a suspended browser tab, and a best-effort local draft save before locking. It **does not** silently auto-renew the 10-minute bearer ticket.
- The Chromium expiry-recovery test uses actual editor IndexedDB storage, simulates a ticket expiring, and verifies that a previously saved unfinished campaign can be loaded with a **fresh PTG authorization**. Passing fixture results are in GitHub Actions for the staged branch, not live account acceptance.
- The user-facing release therefore still requires **manual PTG re-entry** before each new short-lived ticket. Automatic renewal with a reusable bearer token would increase replay risk; implement a properly bound renewable session only after explicit architecture/security review.

**Mandatory non-mock acceptance before coordinated cutover:**

1. Real active Team Leader, Branch Admin, System Admin, ordinary Branch User and revoked/disabled/forced-logout PTG accounts, including direct-URL attempts and idle timeout.
2. Google Drive OAuth sign-in, actual backup export/restore, photo catalog import and remote cloud save across distinct devices, tested against disposable fixtures. The signed-in cloud-project mocks **are not** proof of real Google OAuth callback handling in `srcdoc`.
3. Confirm safe behavior of OAuth redirect and email confirmation URLs from the framed editor. `location.href='about:srcdoc'` means top-level redirect behavior needs explicit adaptation and real browser tests; do not enable this release without them.
4. Physical 300-ppi flyer print check, installed PWA behavior, public-editor redirect-only cutover and stale service-worker/cached-copy disclosures.
5. Server-side PTG↔Studio token exchange, HTTPS origin isolation (all `kzamora19.github.io` project paths currently share a browser origin), and secure ticket replay/renewal policy. No private bucket or Edge Function should be created or deployed until these are approved.

**Release boundary:** the private editor and gateway are still staged in draft PR #10. The existing GitHub Pages application, PTG production data and Supabase projects were not modified by these tests.


## November 21 — signed PTG session continuation (staged only)

- The PTG launcher still issues a 10-minute opaque ticket, but the staged MegaFlyer delivery gateway exchanges it **once** with the PTG server. The editor retains **no bearer ticket** after that initial exchange.
- The staging launcher generates an in-memory, **non-extractable ECDSA P-256 private key** and exports only the public key. Every later `check` request signs a server-provided challenge. PTG verifies the signature, atomically consumes the challenge, and rechecks the source account/session before returning the next challenge.
- Revalidation runs every 30 seconds, when the browser tab returns to the foreground, and before the local expiry deadline. A failed or delayed check removes the protected iframe, with best-effort IndexedDB recovery after a fresh PTG launch.
- The proof session has a two-hour absolute cap but expires earlier if the PTG session expires, times out or is revoked. It **does not extend PTG's existing idle timeout**. A suspended tab that misses its 120-second proof challenge cannot resume silently.
- Current tests use a mock proof backend with real WebCrypto signing and verification. The full protected editor workflows, PDF/PNG generation, local draft recovery, and revocation lock remain covered by offline Chromium tests; **live PTG, SQL transaction replay, real Google OAuth, Drive, printers and cloud synchronization remain untested**.
- Old public GH Pages editor and caches remain publicly accessible. Signed continuation improves the staged launch flow, but **it is not a production authorization wall** until the coordinated cutover, host/origin audit and real-account tests. Do not merge/deploy PR #10.


## Hosted MegaFlyer protected photo-proof mismatch corrected — 22 Nov 2026

After deploying the additive protected `/flyer-studio/studio/` launcher for controlled real-account testing, the protected editor displayed "PTG photo authorization expired or was revoked" when its initial photo-permission bridge called the **previous live** `flyer-product-photos` v3 service. That v3 function only understood the standalone PTG bearer + app-session headers and did not recognize the new `studioProof` signed continuation. This error was a **service protocol mismatch**, not evidence that the user's account was revoked.

The backwards-compatible staged `supabase/functions/flyer-product-photos/index.ts` and matching `_shared/studio-private-policy.mjs` were installed as **version 4** of the existing Flyer Supabase function. The standalone auth pathway remains, while the protected photo path requires PTG service-to-service proof revalidation and a rotated one-use challenge. No database migration, photo deletion, standalone editor release, or broad CORS relaxation occurred.

[Live HTTP security check](https://github.com/kzamora19/flyer-studio/actions/runs/44981614878) **passed**: unsigned standalone denied 401, forged protected proof denied 403 with no challenge rotation, alien origin denied 403, allowed origin preflight 200. Positive signed user proof requires reopening the editor from PTG with a fresh one-time ticket; old failed tickets cannot be revived by refreshing the Studio URL.

**The full four-app cutover remains on HOLD** until real-account access, photo-library permissions, Save/Retrieve, output/printing and existing local/PWA project migration are confirmed.
