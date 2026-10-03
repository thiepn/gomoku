# P21 — Load, Concurrency, Chaos & Capacity Certification

P21 converts the performance gap left by P20 into a repeatable release gate. It measures the actual candidate Edge Function and reconstructed Gomoku database on a disposable local Supabase stack, then makes the result an exact-SHA requirement for P16 admission.

## Safety boundary

P21 generates **zero production traffic**.

The workflow has no production URL fallback, no production database secret, no OIDC write permission and no hosted Supabase project identifier. `GOMOKU_ROOM_API` and the publishable key must come from the disposable local stack created inside the GitHub runner.

This is a CI regression and minimum-capacity certification. It is **not a hosted-production capacity claim** and does not attempt to infer the Free-plan service's maximum throughput from a GitHub runner.

## Measurement profile

The portable profile records p50 / p95 / p99 latency, maximum latency, success rate, status distribution, total duration and achieved requests per second.

The v1 profile performs:

| Scenario | Load | Minimum / ceiling |
| --- | --- | --- |
| Lobby read | **300 room-list requests**, concurrency 20 | 100% success, p95 <= 1500 ms, p99 <= 3000 ms, >=12 req/s |
| Authorized room poll | 120 requests, concurrency 12 | >=99.5% success, p95 <= 1800 ms, p99 <= 3500 ms, >=6 req/s |
| Full health snapshot | 40 requests, concurrency 8 | 100% success, p95 <= 2200 ms, p99 <= 4500 ms, >=3 req/s |

These ceilings are intentionally conservative because GitHub-hosted runner CPU and Docker scheduling are noisy. The gate is designed to catch large regressions, deadlocks, serialization failures and accidental write amplification—not benchmark marketing numbers.

## Concurrency correctness

Latency without correctness is not capacity.

P21 therefore adds two deterministic contention tests:

1. **12 simultaneous seat claims** against one one-player room. Exactly one request may claim the open player seat; the other 11 must become spectators. No 5xx response is allowed.
2. **8 simultaneous move commands** using the same valid revision. Exactly one command may commit; the other seven must resolve as revision/turn conflicts. No double-commit and no 5xx response is allowed.

This exercises the optimistic-concurrency boundary used by real rooms under races.

## Worker-restart chaos

After load and contention pass, P21 creates a two-player room and commits one move. The workflow then deliberately terminates the local `gomoku-room` Edge worker process group.

The test must prove the worker became unavailable before restart. It then starts a new worker against the same database and requires:

- health recovery within 30 seconds;
- the pre-crash room to remain readable with its original player token;
- the committed move and revision to survive the worker restart.

P18 already proves full environment destroy/rebuild/restore. P21's chaos scope is intentionally different: transient compute-worker loss while durable database state remains available.

## Evidence

`operations/p21-load-capacity.mjs` writes `/tmp/p21-capacity-evidence.json` containing:

- exact source Git SHA;
- runner/runtime metadata;
- threshold profile;
- latency and throughput measurements;
- join-race result;
- action-race result;
- worker-restart recovery evidence;
- final pass/fail state.

The workflow also writes the concise metrics to the GitHub job summary and uploads the machine-readable evidence for 14 days.

## Release admission

The authoritative GitHub check is named `p21-capacity`.

`operations/p16-await-checks.mjs` waits for it on the exact candidate SHA. The P21 migration also updates `gomoku_p16_required_checks()` so the database admission ledger now durably requires:

- P18 portability/recovery;
- P19 supply-chain integrity;
- P20 SLO governance;
- P21 capacity certification.

This corrects the prior mismatch where P19/P20 were enforced by the waiter but were not part of the database-side required-check list.

P16's qualification timeout is expanded because P18 and P21 both reconstruct disposable Supabase environments before admission can complete.

## Failure policy

Any of the following blocks P16 admission:

- latency/throughput threshold failure;
- unexpected non-2xx responses in read profiles;
- any 5xx during contention;
- multiple seat winners;
- multiple move commits;
- worker restart that cannot be proven;
- recovery beyond 30 seconds;
- room state loss after restart;
- missing P21 check on the exact candidate SHA.

P21 never disables matchmaking, changes ratings, mutates production rooms or opens a production incident.
