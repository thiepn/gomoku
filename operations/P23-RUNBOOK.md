# P23 — Security Assurance, Attack-Surface Audit & Abuse Resistance

P23 treats `gomoku-room` as the application's security perimeter. The Edge Function runs with a Supabase secret/service-role key and intentionally bypasses RLS internally, so the correctness of its route authorization is more important than adding client-side database policies.

## Production audit baseline

Before implementation, the live THIEPN Account Supabase project was queried directly.

For all production `public.gomoku_*` objects:

- every base/partitioned table had RLS enabled;
- `anon` had no direct SELECT/INSERT/UPDATE/DELETE privilege;
- `authenticated` had no direct SELECT/INSERT/UPDATE/DELETE privilege;
- no Gomoku RPC was executable by `anon`;
- no Gomoku RPC was executable by ordinary `authenticated`;
- all Gomoku RPCs used SECURITY INVOKER;
- no broad anon/authenticated Gomoku RLS policy was present.

That means the primary attack surface is the service-role Edge Function, not direct PostgREST access.

## Machine-readable attack surface

`operations/p23-attack-surface.json` enumerates all **67 routed handlers** with:

- HTTP method;
- path template;
- handler;
- authorization class;
- mutation flag.

Authorization classes are public, optional account, THIEPN Account, admin/operator, GitHub OIDC, room-session capability, history capability and spectator capability.

The static P23 test extracts every `return await handler(...)` from the actual router and compares it to the manifest. Adding a new routed handler without classifying it fails CI.

Protected handlers are also checked for their expected authorization primitive:

- account → `verifiedAccount(req,true)`;
- admin → `adminOperator(req,...)`;
- automation → `verifiedGithubAutomation(req,...)`;
- room capability → `viewer(row,req)`;
- history capability → hashed `historyHash(...)`.

## Oversized-body repair

The pre-P23 body guard checked only the `Content-Length` header and then called `req.json()`. A streamed/chunked request can omit Content-Length, bypassing the 32 KiB application bound.

P23 replaces this with an incremental stream reader. It counts received bytes and cancels/rejects the request with HTTP 413 once the actual body exceeds 32 KiB, regardless of headers.

The adversarial suite sends an oversized `ReadableStream` with no Content-Length and requires HTTP 413.

## Portable adversarial suite

P23 reconstructs Gomoku in a disposable P18 Supabase project and creates two disposable local Auth users. They receive only the shared contracts needed by Gomoku; no production identity is used.

The suite proves:

- account-only endpoints reject anonymous and malformed sessions;
- a normal connected account cannot become an admin;
- forged GitHub OIDC is rejected;
- account B cannot IDOR account A's room before joining;
- random room capabilities cannot read or mutate a room;
- a valid capability for room A cannot access room B;
- duplicate command IDs remain idempotent;
- stale revisions lose the race with HTTP 409;
- public spectator state does not disclose private player chat;
- history capability A can read its saved match;
- unrelated history capability cannot read that exact match;
- malformed JSON fails with 400;
- chunked oversized JSON fails with 413;
- unknown routes and wrong methods fail closed.

## Database boundary audit

`operations/p23-db-audit.sql` fails the build if any Gomoku table loses RLS, any Gomoku table or RPC becomes directly callable by `anon`/ordinary authenticated users, any Gomoku function becomes SECURITY DEFINER, or Gomoku authorization begins using deprecated `auth.role()` or user-editable metadata.

This deliberately does not alter shared THIEPN Account policies owned by other applications.

## Release admission

The authoritative check is `p23-security`.

P16 waits for it on the exact candidate SHA, and `gomoku_p16_required_checks()` now records `p23_security` as durable admission evidence. P18 includes the P23 migration in clean reconstruction, while P19 asserts that P16 cannot silently stop requiring P23.

P22 remains outside this database admission list because it protects the separately deployed GitHub Pages/PWA boundary. P23 is backend security assurance and therefore belongs in P16.

## Scope and limitations

P23 is an automated adversarial security baseline, not a claim of formal penetration testing. It does not attempt denial-of-service against production, brute-force real users, exfiltrate secrets, or attack Supabase infrastructure. Higher-volume abuse behavior is tested only against disposable local infrastructure.
