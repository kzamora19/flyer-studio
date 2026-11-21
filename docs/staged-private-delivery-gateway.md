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
