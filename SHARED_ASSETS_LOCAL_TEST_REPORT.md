> **HISTORICAL DOCUMENT — SUPERSEDED BY [PTG_ONLY_SHARED_ASSETS_STATUS.md](PTG_ONLY_SHARED_ASSETS_STATUS.md).** The current ADD ASSET design uses PTG as the only login; no Flyer Cloud sign-in or account pairing is required. Backend version 2 and the PTG-only ownership migration are active. Public frontend is NOT deployed.\n\n# Shared Asset Library — Local simulated test report

Date: 2026-11-19
Scope: `feature/shared-asset-library` (NOT production)
Execution: JavaScript isolated harness invoking actual extracted `identity()` and `run()` gateway function bodies with mocked Supabase, PTG fetch responses, storage, and PostgREST query chains. No credentials or production writes.

## Simulated identity authorization: 14/14 passed

1. Active BRANCH_USER / TEAM LEADER — allowed
2. Active BRANCH_ADMIN — allowed
3. Active SYSTEM_ADMIN — allowed
4. Ordinary BRANCH_USER — denied
5. Unrecognized role — denied
6. PTG session rejection representing inactive account — denied
7. PTG session rejection representing revoked account — denied
8. PTG session rejection representing expired account — denied
9. Forced password change — denied
10. Missing trusted Flyer/PTG mapping — denied
11. Invalid Flyer session — denied
12. Missing PTG bearer — denied
13. Missing PTG app session ID — denied
14. Rejected PTG Auth user lookup — denied

**Note:** inactive, revoked and expired cases were simulated as a 401 PTG session response. PTG's underlying database/auth behavior was inspected in prior review but not exercised with real test users.

## Simulated asset gateway operations: 15/15 passed

1. Valid PNG upload and metadata creation
2. List saved assets
3. Generate private preview URL
4. Rename
5. Delete metadata and file
6. Replace file and metadata
7. Ordinary user cannot upload
8. Ordinary user cannot delete
9. Invalid category denied
10. MIME mismatch denied
11. SVG denied
12. Blank name denied
13. Invalid base64 denied
14. Nonexistent asset rename denied
15. Database insert error cleans up uploaded storage file

All 29 checks passed after correcting deficiencies in the test mocks (not defects in the app).

## Additional code review
- Production site remains on `main`; shared-asset UI is wired only in the feature branch.
- The unused old client-direct-storage prototype was deleted from the feature branch.
- No direct authenticated client storage or metadata policies exist in the proposed schema.
- Immutable PTG Auth UUIDs, not usernames, are used for identity links.
- The gateway revalidates the PTG session on each operation; sign-in cannot be considered a permanent grant.

## NOT verified (release gates)
- Real database migration, storage RLS tests, and Edge Function deployment on isolated staging
- Actual browser/DOM interactivity, UI upload-to-card workflow and PDF/PNG export
- Multi-device syncing with independent PTG/Flyer accounts
- Real revoked / disabled / branch-off PTG test user verification
- Actual large-file handling and quota/performance under repeated requests
- CORS/preflight and real token refresh behavior
- Audit log, rate limiting and hardened integration with production PTG service

Separate staging Supabase project creation was blocked by the Free-plan two-active-project limit. No paid upgrade, production mutation, or deployment occurred.

**Release status: NOT READY.** These are local simulated tests; do not equate them with full browser/security acceptance.
