# Flyer Studio Migration Checklist

## Hosting

- [ ] Create an empty **public** GitHub repository called `kzamora19/flyer-studio`.
- [ ] Upload all files from this package to the new repository, retaining `.github/workflows/pages.yml`.
- [ ] Under Settings → Pages, choose **GitHub Actions** as the publishing source.
- [ ] Confirm that the workflow succeeds and visit `https://kzamora19.github.io/flyer-studio/`.
- [ ] Confirm no new dependency on Vercel: catalog image endpoint should be `https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-catalog` and PTG should call `https://agknxlowackphvwyvxge.supabase.co/functions/v1/ptg-auth` and `ptg-products`.

## Supabase Auth

- [ ] In the **Flyer Studio** Supabase project, set Site URL to `https://kzamora19.github.io/flyer-studio/`.
- [ ] Add that exact URL to **Redirect URLs**.
- [ ] Test account signup and confirmation email on the actual GitHub Pages site.
- [ ] Test signing in, saving a cloud copy, reopening on a second device, and resolving revision conflicts.

## Existing projects and flyers

- [ ] From the old Vercel URL, export a backup of local-only flyers and templates.
- [ ] From the GitHub Pages URL, import the backup and compare card count, prices, section/header styles, and photos.
- [ ] Check print output (front/back pages, US Letter or A4 as used, PDF/PNG exports).
- [ ] Verify PTG login and barcode search using a real authorized account. PTG source project has not been modified.
- [ ] Verify product-image search and actual image selection on the live site.
- [ ] After verification on two devices, designate GitHub Pages as the primary address. Leave Vercel online temporarily as a rollback option.

## Known scope boundary

- No live test of GitHub Pages is possible until its repository exists and Pages has been enabled.
- Browser-local data is scoped to the original domain. It does **not** automatically move to github.io.
- The cloud workspace is currently account-private. Shared branch permissions and formal approvals are still separate future work.
- GitHub Pages and Supabase have fair-use/plan limits; this approach removes the specific Vercel daily API-deployment limit, not every possible platform limit.