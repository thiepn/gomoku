# P19 — CI Supply-Chain Integrity, Privilege Isolation & Maintenance Automation

P19 hardens the release machinery itself. It changes no Gomoku gameplay, rating, account, room, or production database behavior.

## Threat model

Release qualification is meaningful only if its jobs are reproducible and minimally privileged. Before P19, workflows referenced moving GitHub Action tags such as `@v4` and the Supabase setup action's mutable `v1` branch. The P13 generated-shell workflow also granted `contents: write` at workflow scope even though pull-request code never needed repository write access.

## Immutable action policy

Every external GitHub Action is pinned to a reviewed immutable commit SHA:

- `actions/checkout` — `11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node` — `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/setup-python` — `a26af69be951a213d495a4c3e4e4022e16d87065`
- `actions/upload-artifact` — `ea165f8d65b6e75b540449e92b4886f43607fa02`
- `supabase/setup-cli` — `1dedf2c611547ede7232d26866dd3c56ab903bbb`

The major version remains only as a comment; the executable trust anchor is the immutable commit SHA.

`operations/p19-supply-chain-policy.mjs` scans every workflow and fails closed on mutable or unreviewed action refs, `pull_request_target`, `permissions: write-all`, blind linked database reset/push commands, and shell-pipe installers.

## Pull-request privilege boundary

The P13 reliability workflow is read-only at workflow scope. Pull-request code can rebuild and test the app but cannot push repository content.

Generated-shell publishing lives in a separate `publish-generated` job that runs only on a trusted push to `main`, waits for P13, receives `contents: write` only at job scope, and confirms that `origin/main` still equals the triggering SHA before pushing.

Thus pull-request code never executes with the repository write token.

## P16 admission

The exact-SHA P16 check collector now requires `p19-supply-chain` in addition to P18 portability and the established gameplay/reliability checks. P19 is intentionally CI-only; it does not create a production schema migration merely to represent a GitHub trust policy.

## Dependabot maintenance

`.github/dependabot.yml` requests monthly GitHub Actions updates. Updates remain ordinary pull requests and are never auto-merged.

For an action update: review the upstream change, update both the workflow SHA and P19 allowlist SHA, run the full P19/P18/P16 qualification path, then merge only after the exact candidate SHA passes.

## Safety invariants

P19 never widens database grants, changes production data, enables `pull_request_target`, grants write access to pull-request verification, or makes dependency updates self-merging.
