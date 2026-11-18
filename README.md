# First Megasaver — Flyer Studio

**Hosting:** GitHub Pages (static site) + Supabase (cloud projects, authentication, photos, templates and catalog proxy).

- Repository: https://github.com/kzamora19/flyer-studio
- Intended site: https://kzamora19.github.io/flyer-studio/
- Flyer Studio Supabase project: `tzklsscoiwnmeantcefw`
- PTG Supabase project (existing, unchanged): `agknxlowackphvwyvxge`

## First-time GitHub Pages setup

1. Open **Settings → Pages**: https://github.com/kzamora19/flyer-studio/settings/pages
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Deploy Flyer Studio to GitHub Pages** and run/rerun the workflow if needed: https://github.com/kzamora19/flyer-studio/actions/workflows/pages.yml
4. Confirm the workflow is successful before using the new Pages URL.

The workflow deploys `site/index.html` and `site/.nojekyll` after pushes to `main`. There is no server-side build on GitHub Pages.

## Configure Supabase authentication

Flyer Studio project → **Authentication → URL Configuration**:
https://supabase.com/dashboard/project/tzklsscoiwnmeantcefw/auth/url-configuration

- Site URL: `https://kzamora19.github.io/flyer-studio/`
- Allowed Redirect URLs: `https://kzamora19.github.io/flyer-studio/`

This is essential for signup confirmation and password reset. Only Supabase **publishable** keys may appear in the public site. No service-role keys belong in the GitHub repo.

## Preserve existing flyers

Browser-local projects from `flyer-studio-ken-s-project5.vercel.app` do **not** move to the `github.io` domain automatically. Export a backup on the old app and import it into the new app (or save a cloud copy on the old domain first). Test both flyer sides, card/section content, photos, PTG login, and print export before designating GitHub Pages as primary.

## Backend services

- `supabase/functions/flyer-catalog/index.ts` is deployed to Flyer Studio Supabase, serving only allowed public catalog photos.
- PTG sign-in and product lookup call the existing PTG Supabase functions directly from GitHub Pages.
- Private flyer documents, history, templates and photos are stored with Supabase Auth and RLS.
- Shared branch workspaces and formal approval permissions are **not** enabled yet.

See [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) for detailed QA. Keep Vercel running as a rollback until live GitHub Pages tests pass.
