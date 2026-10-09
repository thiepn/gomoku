# A12 — Production cutover preflight and monitoring contracts

Status: **nondeploying implementation**, not a completed production release. Branch phase/a12-cutover-preflight-monitoring, stacked on draft A11 PR #71. The original qualified A9 source is fca45816ed7d3a95bae550b9aa644e29053875f6, not the workflow branch head.

## Implemented
- analysis3/a12-cutover-preflight.cjs: read-only fail-closed documentary reconciler for original A11 admission, distinct independent original-evidence review, SHA-bound A10/A11 and thirteen P16 check receipts, separate production owner authorization, production backup and original eight-asset baseline, rollback rehearsal, monitored cutover plan.
- analysis3/test-a12-cutover-preflight.cjs: synthetic adversarial tests; fixtures are NOT approvals, physical devices, or proof of production safety.
- .github/workflows/verify-analysis3-a12.yml: read-only qualification; no publication, environment, Vercel token, merge, tag, or database write.

## Independent gates before any actual cutover
A10 public preview-only permission and dedicated unlinked HTTPS host are missing. Android Chrome 0/7, Samsung Internet 0/6, installed PWA 0/5; live same-origin update and rollback rehearsal, original asset probes and owner acceptance not shown. A11 cannot be certified from passing tests alone.

After real A11 approval: independently recheck latest PR heads, P16 thirteen authoritative GitHub check runs (never trust a user-authored JSON success field), obtain a separate written production authorization for an exact source SHA, owner/operator, production URL and window. Capture fresh production hashes, demonstrate restores in isolation, plan record integrity and service-worker/offline validation, and stage alerting and reversible recovery. The script always returns canMerge=false, canTag=false, canDeployProduction=false and canModifyProductionData=false; a fully filled packet reaches only manual-review-only.

CLI: node analysis3/a12-cutover-preflight.cjs A11.json REVIEW.json CI.json AUTH.json BASELINE.json MONITOR.json. Exit 2 blocks missing documentary requirements; exit 0 only marks documentary completeness, never authenticity or deploy permission.

## A13 — Post-release stability certification and operational handoff
Objectives: inspect actual deployed production commit and all asset hashes; 24-72 hour SLO, error-budget and incident trends; physical PWA update and player data retention; backup/restore verification; signed owner acceptance and final release runbook. Status: not started and cannot certify anything before A12 cutover is independently authorized and performed.
