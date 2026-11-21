# MegaFlyer Studio — private-bundle staging proof (NOT DEPLOYED)

The current `site/` folder is the **live publicly served application**. Do not publish this branch or mistake the output of this proof for complete authorization.

## What this code does

Run `node scripts/build-private-flyer.mjs /tmp/flyer-check` to create two deliberately separated outputs:

- `private/studio.html` — standalone 1MB+ editor document with its local JavaScript, CSS, and current logo/icon images embedded, meant to be staged into a **private** delivery channel after PTG authorization is available.
- `public/index.html` — tiny, editor-free PTG entry/holding page suitable as the **future** public GitHub Pages artifact once the secure delivery system has been approved.
- `manifest.json` — byte count and SHA-256 checksums for release integrity.

CI tests confirm the app package contains its source and the public entry does not. Neither output is added to Git nor uploaded as an Actions artifact. No production deployment workflow was changed.

## Why the proof is NOT a release candidate yet

1. A separate Supabase protected-delivery Edge Function must verify PTG grant on **every sensitive request** before returning private editor and asset bytes. The existing PTG draft (PR #38) issues 10-minute tickets but still needs renewal/replay controls, rate limits and real server-to-server tests.
2. Supabase's default Edge Function domain rewrites GET `text/html` to plain text. One possible approach is an **authenticated JSON bundle** loaded by a small public launcher; this needs browser compatibility tests and does not grant users a completely revocable offline application.
3. The current editor assumes a top-level GitHub Pages path in catalog routing, cloud OAuth redirects, dialogs and PWA install behavior. Loading it via `iframe srcdoc` or a blob URL must be investigated and fixed before release.
4. The old GitHub Pages app and its cached/PWA copies would remain an access bypass unless the public deployment switches to the editor-free entry and previous caches are handled. Even then, previously downloaded source cannot be remotely erased.
5. Multiple applications under `kzamora19.github.io` share the same browser origin. Review token storage and origin isolation; URL paths are not account boundaries.
6. Shared Asset Library permissions and old cloud-login assets must still use server-side authorization; private-source delivery must not leak server role/secret keys or PTG bearer tokens.
7. Printing/real accounts, synchronized assets, Google Drive backup and installed application upgrade all require controlled acceptance evidence.

Do **not** change production `main`, the GitHub Pages deployment workflow, Supabase Storage, Edge Functions, database migrations or the PTG session system for this experiment.


## November 21, 2026 — Browser proof (no production services)

GitHub Actions [run 44860294219](https://github.com/kzamora19/flyer-studio/actions/runs/44860294219) passed both the Node/Deno checks and the isolated Chromium launcher tests:

- An opaque, syntactically valid mock PTG ticket is removed from the URL before making the mocked backend request.
- A mock protected editor document is mounted only after a simulated successful response, and removed on a simulated revoked PTG session.
- **The actual full MegaFlyer editor bundle** generated from the approved live source (over 1 MB) successfully mounts in the protected iframe in headless Chromium. Its PDF/PNG toolbar controls are present, and the Shared Asset Library modal opens/closes.
- All network calls in this test are mocked; no real PTG account, Supabase Storage, database, Google Drive or production printer was used.
- **Not yet covered:** actual PNG/PDF downloads from the protected iframe, cloud OAuth callback and project save/restore inside it, image catalog endpoints, renewal beyond the PTG ten-minute ticket lifetime, direct-URL/PWA-cache cutover, and real account revocation. Do not interpret basic editor mounting as completion of these workflows.

The current public GitHub Pages editor is unchanged; these changes remain in a draft, non-deployed pull request.
