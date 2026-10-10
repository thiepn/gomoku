# A14 — Signed evidence custody and operational lifecycle assurance

**Scope:** actual read-only preparation on `phase/a14-custody-lifecycle-assurance`, stacked only from A13 draft PR #73 at head `0801c96d9317c625646eb20bf69ffecbd4f731f9`. A13's exact-head six mandatory automated jobs were verified green. **No production publication or human/physical acceptance occurred.**

## Objective and construction

A13 correctly labels a fully populated JSON evidence packet as documentary only: it is not cryptographically authenticated. A14 strengthens that boundary by requiring detached **Ed25519** signatures over canonical JSON at three distinct custody stages:
- **Release operator** — original cutover receipt.
- **Independent reviewer** — the 24–72-hour A13 stability observation packet and externally reviewed provenance.
- **Owner** — handoff and separately considered closure evidence.

The signed record binds exact A9 original source SHA `fca45816ed7d3a95bae550b9aa644e29053875f6`, A12 head `e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07`, A13 head `0801c96d9317c625646eb20bf69ffecbd4f731f9`, production commit, deployment ID and allowed HTTPS origin, SHA-256 of each original documentary evidence stage, a nonce and common challenge, issue and expiry timestamps, sequence number, and the signed previous-event digest. Key reuse across human roles, revoked keys, expired attestations, manipulated original receipts, stage gaps and in-packet nonce replay are rejected.

## Current trust and release state

`a14-trust-roots.json` intentionally contains **ZERO** trusted human keys. It is source-controlled. No human signing key, signature, trust pin, revocation approval, PWA screenshot, physical test, or release evidence has been invented.

Any genuine future production trust-key registration requires separate explicit owner authorization, independently verified fingerprints, peer review, and a new qualified commit. Do **not** generate human private keys in CI, publish private keys, put fabricated keys in the pinned registry, let the packet itself declare its trust roots, or trust signature-shaped strings. Production CLI loads **only** its baked-in reviewed trust policy.

`test-a14-custody.cjs` generates short-lived **synthetic** Ed25519 keypairs entirely inside isolated tests; nothing is exported as actual custody evidence.

## Threat model and honest limits

- Signature validation proves only that the given *reviewed* key signed the canonical payload, **not** that a physical test or deployment actually took place. Original live GitHub, HTTPS, device, recovery and owner evidence must still be independently inspected.
- A packet's embedded challenge and supplied `usedChallenges` list only reject intra-packet/reported replay. A durable, authoritative and externally witnessed **replay ledger**, trusted challenge issuance and key-revocation refresh are still required; the tool never claims global or durable replay protection.
- Out-of-band original artifact verification and change approval remain required before any live cutover. Replay-ledger input must be independently authenticated and access-controlled.
- Fail-closed CLI default reports `blocked-trust-root`, even without a packet. A synthetic fully signed test packet can reach `ready-for-independent-ledger-and-originals-review` **only when the verifier is called with synthetic test trust roots**; this never confers publication or closure rights.
- No release tags, merges, deployments, production Supabase access, private player data, privileged GitHub token, golden edits, production probes, cache purges or infrastructure modification are performed.

## Usage and independent review

```sh
node analysis3/a14-custody.cjs CUSTODY-PACKET.json INDEPENDENTLY-REVIEWED-USED-CHALLENGES.json
```

Exit **2** for unprovisioned trust roots or malformed, expired, revoked, replayed or unbound evidence. Exit **0** only if documentary signatures and local constraints pass (not a verified physical-world fact, global replay protection, release approval or a stable-release closure). Every outcome has `canMerge=false`, `canTag=false`, `canDeploy=false`, `canCertifyStable=false`, `canCloseRelease=false`, `canModifyProductionData=false`.

## Hard prerequisites and handoff

A10 isolated HTTPS preview and genuine asset byte checks remain absent; A11 physical Android Chrome **0/7**, Samsung Internet **0/6**, installed PWA **0/5**; independent same-origin service-worker update/rollback, restored previous stable release, independent witness and owner A11 acceptance remain open. A12 cutover requires separate production owner authorization and has **not** been conducted, so real A13 observation, alerts, accessibility, player-data recovery and post-release signoff cannot yet be claimed.

**A15 — Independent Source Authentication & Operator Evidence Closure** (not started): add authoritative read-only exact-head GitHub and digest reconcilers, durable independently controlled replay challenge ledger integration, independently reviewed Ed25519 trust-key rotation, and owner-directed operational closeout. Still no production action without explicit approval.
