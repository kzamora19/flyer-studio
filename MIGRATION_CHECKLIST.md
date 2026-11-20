# Flyer Studio — Release and QA Checklist

**Updated:** November 19, 2026
**Production URL:** https://kzamora19.github.io/flyer-studio/
**Repository:** https://github.com/kzamora19/flyer-studio
**Development branch:** `fix/supabase-google-session-recovery`
**Release pull request:** https://github.com/kzamora19/flyer-studio/pull/1 (DRAFT; do not merge without live verification)
**Flyer Studio Supabase project:** `tzklsscoiwnmeantcefw`

## Verified — code and service configuration

- [x] Existing GitHub repository, `site/index.html`, `main` and GitHub Pages production URL were verified.
- [x] Current GitHub Pages production deployment is isolated from the repair branch; the `main` application is unchanged by PR #1.
- [x] Supabase project is `ACTIVE_HEALTHY`. Four private `flyer_cloud_*` tables and private photo bucket use owner-scoped RLS.
- [x] Removed unnecessary `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` privileges from `authenticated`/`anon` on Flyer Studio cloud tables while retaining authenticated CRUD.
- [x] Added tracked Supabase migrations `archive_saved_flyer_cloud_revisions_atomically` and `restrict_flyer_cloud_table_permissions`.
- [x] Applied and tested database-side atomic cloud revision archiving using a transaction rolled back afterwards; owner sees archived revision, another user cannot read it.
- [x] Fixed OAuth URL fragment scrubbing, including native `window.history` shadowing by the former Flyer Studio `history()` helper. That helper is now `recordFlyerHistory()`.
- [x] Serialized refresh-token rotation, coordinated between tabs with Web Locks where supported, and preserved sessions during temporary service failures.
- [x] Improved cloud save conflict handling, offline retries, and protection against replacing unsaved drafts.
- [x] Google Drive `drive.file` backup uses only a committed Supabase revision; deferred backup queue, pagination and detached local restore included.
- [x] GitHub Actions unit and syntax tests: **23 passed, 0 failed** in run 44490703273.
- [x] Headless Chromium browser regression passed in run 44490703273 for OAuth callback cleanup, expired-token recovery, two independent browser contexts, cloud save/open, template and photo upload/download, cloud history restore, front/back PDF export, Drive backup/restore and sign-out.

The Chromium browser tests use **mock Supabase, Google OAuth and Google Drive responses** with synthetic data. They are meaningful UI regressions but are not proof of successful live service authorization or real cross-device persistence.

## Live release gates — pending

- [ ] Use a safe browser test environment with valid OAuth redirects to verify a **real** Google Sign-In, authenticated Cloud Workspace, refresh persistence, sign-out and re-sign-in.
- [ ] Create a **real** Supabase cloud copy; edit and autosave it; open it from another authorized device. Verify concurrent edits, version history and restoration without replacing unrelated projects.
- [ ] Synchronize real private templates and a test product photo using signed-in accounts, verifying Supabase RLS and Storage permissions.
- [ ] In Flyer Studio, configure the existing public Google OAuth Web Client ID for Google Drive, if the browser has not already saved it. Never paste the client secret.
- [ ] Grant the restricted Google Drive `drive.file` scope, then verify manual and automatic backup, folder and revision naming, browse, reauthorization and restore using real Drive files.
- [ ] Check flyer print previews (front and back), actual PDF files and printer output; verify a real authorized PTG lookup and product images.
- [ ] Confirm local flyers / browser drafts, current production projects and other applications are unaffected.
- [ ] Only after these pass, mark PR #1 ready, review and merge into `main`, confirm GitHub Pages deployment, and smoke-test production.

## Important limitations and protections

- Existing Google Cloud and Supabase projects must be reused; do not create replacements.
- No real customer photos, Google tokens or credential-bearing callback URLs belong in GitHub tests or logs.
- Drive OAuth access tokens are held in browser memory, not persistent storage. Browser-session backups require a running browser and active authorization; **unattended server-side backups are not implemented**.
- Personal cloud projects are private per account; branch sharing and formal approvals are outside this release.
- Local browser drafts are scoped to the origin and are not automatically migrated from the older Vercel app to GitHub Pages.
- Keep the Vercel application as rollback until the production release is verified.
- At the time of this checklist, Supabase contained one Auth account but no actual saved Flyer Studio cloud project, version, template or photo. Mocked browser tests alone do not establish real cross-device availability.

## Release rule

**Do not merge or deploy PR #1 until live OAuth, Supabase save/reopen, Google Drive backup/restore, PTG and print regression tests succeed.** Keep production and existing user data intact.
