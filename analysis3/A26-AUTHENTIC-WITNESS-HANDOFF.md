# A26 — Original Evidence Acceptance UX & Authentic Human Witness Handoff

**Status:** Source-only nondeploying draft stacked on A25 PR #85 at exact head 10670c85fbd18077069ad69dc8a8079e0214127f. **Release: NO_GO.** A26 checks genuine user-provided file bytes but does NOT independently authenticate origin, identity, consent, legal rights, hosted source or owner authorization. Synthetic CI media never counts as physical acceptance.

## Offline operator workflow

1. Open analysis3/a26-acceptance-desk.html locally on a private authorized workstation. No network requests or browser storage. Import the A25 NO_GO original handoff JSON. Its internally recomputable SHA verifies JSON consistency, NOT provenance.
2. Choose a real physical-device or accessibility case. Supply the same untouched original media and independent original rights/intake document previously preserved under private A25 custody. A26 compares both original SHA-256 values against the imported case and rights receipts, without uploading the bytes.
3. Supply a separately preserved original witness document/capture. Enter a claimed witness alias and a factual observation. This stages an UNAUTHENTICATED CANDIDATE. No checkbox, hash, alias or file upload proves human identity, device pass, source rights or consent; an independently authorized reviewer must establish all of these.
4. Save the exact witness original and place it under witness/<platform>/<case-id>.bin in a private original-custody root. Each case may be staged once per export session. Conflicting originals require independent adjudication; there is no automatic winner.
5. Export pending witness candidate JSON. Run the A26 offline CLI against the real A25/A24 manifests and the ORIGINAL byte roots:

    node analysis3/a26-witness-intake.cjs \
      --a25 /private/a25-handoff.json \
      --field-manifest /private/a24-field.json \
      --field-root /private/originals \
      --rights-root /private/originals \
      --witness-manifest /private/a26-pending-candidate.json \
      --witness-root /private/originals \
      --out /private/NEW-a26-unverified-review.json

When A25 contained original host or rollback receipts, additionally provide the same complete original groups: --host-manifest / --host-root / --a9-root and/or --rollback-manifest / --rollback-root. The A26 CLI re-runs the actual A24/A25 byte importers and insists that their rebuilt A25 evidence matches the supplied handoff. Tampering, reused/duplicate witnesses, missing or changed rights/media, unsafe relative paths, future claimed observation dates, unknown approval flags and attempted output overwrite are blocked.

The output is a new permission-0600 no-overwrite NO_GO JSON containing hashes and pending case counts. It never copies private binary originals or detailed observations; witness alias is hashed and never treated as a digital signature.

## Authentic independent human witness protocol — outside A26 software

The actual separately authorized custodian must independently establish signer identity, consent/source rights, device and accessibility observations on actual physical devices, original isolated hosted HTTPS provenance, trusted keys/revocation/replay protection and the owner's A11 release decision. An independently governed external approval and audit service is required. A26 neither acquires external credentials nor provisions real signing roots; offline local file hashes cannot prove these facts.

Do not place private source files, user data, identities, witness documents, passwords or owner signing keys into GitHub branches, Issues, CI artifacts or public sites. Consent to locally select a file is not proof of ownership or authority to capture a host.

## Outstanding genuine release gates

- A10 eight owner-authorized dedicated isolated HTTPS original response captures and independent provider provenance: not authenticated.
- A11 physical Android Chrome **0/7**, Samsung Internet **0/6**, installed Android PWA **0/5**; assistive/accessibility **0/7** independently human accepted.
- Real installed same-origin PWA SW update/reversal, distinct previously deployed original backup, saved player-state restore: not executed.
- Human signers, legally sufficient rights/consent, owner A11 release approval, independent global replay and genuine revocation/rotation authority: missing.
- Separately authorized executed A12 production cutover: not performed.
- Authentic A13/P20 24–72h production monitoring and final postrelease human signoff: not performed.

## Test scope and next step

A26 CI checks public ORIGINAL A9 archived candidate bytes, inherited A24/A25 source-file import tests, A26 adversarial offline intake and real isolated Chromium desktop/mobile-emulated browser-file-to-CLI tests. Its test witness files are explicitly synthetic. None of these results can change production NO_GO.

After passing A26, prioritize genuine owner-approved physical hardware and isolated-host evidence, fix demonstrated defects and prepare controlled release. Avoid mechanically adding governance-only phases. An A27 phase is not automatically defined or begun.
