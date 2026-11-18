# First Megasaver — Flyer Studio (GitHub Pages + Supabase)

Static UI: `site/index.html`  |  Backend: separate Flyer Studio Supabase project `tzklsscoiwnmeantcefw`.

**Designed GitHub Pages URL:** https://kzamora19.github.io/flyer-studio/

## Publish

1. In GitHub, create a **new public repository named `flyer-studio`** under `kzamora19` (do not rename an existing app repository). GitHub Pages on GitHub Free requires a public repository.
2. Upload the contents of this package preserving the `.github/workflows/pages.yml` path and `site/index.html`, or push the entire folder using Git.
3. Go to repository **Settings → Pages → Build and deployment → Source → GitHub Actions**. Enable Actions if prompted.
4. Under **Actions**, verify the `Deploy Flyer Studio to GitHub Pages` workflow succeeds.
5. Open the new site and verify cloud sign-in, PTG sign-in, catalog photo search, print export and section controls.
6. In Supabase, open **Flyer Studio** project → **Authentication → URL Configuration**, set Site URL and allowed redirect URL to `https://kzamora19.github.io/flyer-studio/` (with trailing slash). Do this **before** inviting users to sign up.
7. Before using a different device or browser, **export your existing browser-stored flyers** from the old Vercel address and import them into the GitHub Pages address. Local browser storage does NOT automatically follow a domain migration. Existing cloud projects in Supabase remain available after login.

## Backend services

- Flyer Studio Supabase project: `tzklsscoiwnmeantcefw` (cloud authentication, projects, templates, photos, versions).
- Public (product-catalog only) Supabase Edge Function: `/functions/v1/flyer-catalog`, deployed, with a fixed upstream and allowed browser origins.
- PTG login and product lookup: original `agknxlowackphvwyvxge` project, accessed directly on the GitHub Pages site. **PTG itself is unchanged.**

## Security and publishing

- The published `site/index.html` includes only **publishable** Supabase browser keys. No service-role or database secrets belong in this repository.
- User flyers, cloud accounts, private storage and PTG access are controlled by Supabase Auth and RLS; **GitHub Pages itself is publicly readable**.
- Edge Function `verify_jwt=false` is intentional for public official product catalog metadata and product images only. It does not perform authenticated PTG actions.
- No shared branch editing or role-based cloud approvals have been enabled yet. Test branch permissions separately before rollout.

## Limitation

GitHub Pages is static hosting: no Node server, no server-side `api/` endpoints. The app now uses Supabase Edge Functions for public catalog media, and PTG directly for authenticated lookup. Keep Vercel running until migration checks pass.