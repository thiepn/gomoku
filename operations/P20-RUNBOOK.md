# P20 — Production SLOs, Alerting & Error-Budget Governance

P20 turns the P13 reliability signals into objective production evidence. It deliberately reuses the existing recovery heartbeat, persistence outbox and sanitized runtime events instead of introducing a second monitoring stack.

## SLOs

P20 captures one sanitized sample per minute.

| Indicator | Objective | Good minute |
| --- | ---: | --- |
| Service availability | 99.9% | P13 is not critical and the recovery heartbeat is <150 seconds old |
| Persistence freshness | 99.9% | no pending completed-match persistence item is >=60 seconds old |
| Recovery freshness | 99.9% | the recovery heartbeat succeeded within 150 seconds |
| Runtime clean minutes | 99.0% | no application-runtime error event occurred during the minute |

Control-plane events such as production certification, preview certification, release governance, incident drills and P20's own alert events do not poison the runtime-clean SLI.

The operator view reports rolling **1h / 24h / 7d** windows. Each indicator exposes sample count, good/bad minutes, SLI percentage, burn rate and remaining error budget. Windows explicitly report insufficient evidence until they reach their configured minimum sample count.

## Why P20 is minute-level

P20 does not add a database write to every player request. Doing that would create write amplification and could make the latency being measured worse.

Request-latency percentiles and realistic concurrency limits require a trustworthy external/load-test measurement source. Those belong in **P21**, where latency is measured under controlled load rather than inferred from database side effects.

## Alerts

Each SLO has a durable alert state:

- first bad minute: evidence only;
- 2 consecutive bad minutes: warning;
- 5 consecutive bad minutes: critical;
- first recovered minute: resolved.

Transitions are written to the existing sanitized runtime-event stream. Repeated critical reminders use a **30-minute** cooldown, preventing alert spam while preserving persistent-outage visibility.

No P20 alert automatically deletes rooms, changes ratings, disables matchmaking or mutates player data.

## Error budgets and burn

The SLO snapshot calculates budget consumption independently for each rolling window.

Fast burn uses the 1-hour window:

- burn >= 6x: warning;
- burn >= 14.4x: critical.

A 24-hour SLI below its objective after at least 60 samples is treated as exhausted budget. Minimum evidence thresholds prevent a single initial sample from masquerading as a mature SLO window.

## Production release guard

`gomoku_p20_release_guard()` is the production release guard.

Production certification and rollout progression are frozen when:

1. the current P13 reliability state is critical; or
2. P20 has a critical sustained alert; or
3. the 1-hour fast burn is critical; or
4. a sufficiently populated 24-hour error budget is exhausted.

A warning does not block a release, but is surfaced to operators.

Both P16 production certification paths and the P17 promotion certification path consult the release guard before certifying production. The P15 rollout health check also treats a frozen guard as critical.

## Operator visibility

The existing authenticated operations console receives a P20 summary through `gomoku_p20_admin_summary`.

It shows:

- release-guard state;
- 1-hour fast burn;
- 24-hour budget state;
- 7-day evidence volume;
- current per-indicator SLI and budget state.

The underlying SLO tables remain server-only. Ordinary authenticated users do not receive direct table or RPC access.

## Scheduling

`gomoku-p20-slo-sample` runs every minute through Supabase Cron and executes only the aggregate sampler. The job does not make external network requests.

P20 retains 30 days of minute samples. It does not delete shared `cron.job_run_details` because this Supabase project is shared by other THIEPN applications.

## Incident policy

P20 generates actionable alert state but does not automatically open P14 incidents. Incident creation remains an operator decision because an SLO breach may be understood maintenance, a short external outage or a false positive requiring diagnosis.

## Portability and release admission

The P20 migration is included in the P18 portable migration order. Clean local rebuild/recovery therefore validates it.

The P20 GitHub check is named `p20-slo`. P16 exact-SHA admission requires that check, in addition to the existing P13–P19 gates.

## Security invariants

- all P20 tables have RLS enabled;
- `public`, `anon` and `authenticated` receive no direct table access;
- all P20 database functions use SECURITY INVOKER;
- operator summary authorization reuses the P14 operator allowlist;
- no player identifiers, room payloads, chat content or private room state are stored in SLO samples;
- P20 does not widen any existing RLS policy;
- release blocking is fail-safe for critical SLO state but does not mutate production gameplay data.
