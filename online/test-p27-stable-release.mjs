import fs from 'node:fs';
const assert=(v,m)=>{if(!v)throw new Error(m);};

const config=JSON.parse(fs.readFileSync('operations/p27-stable-release.json','utf8'));
assert(config.version==='p27.stable-release.v1','P27 contract version missing');
assert(config.release_version==='1.0.0','P27 release version must be 1.0.0');
assert(config.release_tag==='v1.0.0','P27 release tag must be v1.0.0');
assert(/^[0-9a-f]{40}$/.test(config.product_candidate_sha),'P27 candidate must be immutable');
assert(config.policy?.require_p26_release_ready===true,'P27 must require P26 release-ready');
assert(config.policy?.require_exact_public_candidate===true,'P27 must require exact public candidate');
assert(config.policy?.allow_automatic_release===false,'P27 release must require explicit dispatch');
assert(config.policy?.maintenance_mode_after_release===true,'P27 must hand off to maintenance');

const script=fs.readFileSync('operations/p27-stable-release.mjs','utf8');
for(const marker of ['runP26Strict','release-ready','deployed','requireCurrentReleaseChecks','P16 release control','P24 browser device and network qualification','P25 product UX accessibility and final quality','P26 release candidate burn-in and real-device qualification','Stable tag already exists','Release workspace must be clean','P27 is prepared but blocked'])
  assert(script.includes(marker),'P27 preflight missing '+marker);

const workflow=fs.readFileSync('.github/workflows/p27-stable-release.yml','utf8');
for(const marker of [
  'workflow_dispatch:',
  'release-v1.0.0',
  'node operations/p26-release-candidate.mjs release-ready',
  'node operations/p26-release-candidate.mjs deployed',
  'node operations/p27-stable-release.mjs preflight',
  'P27_CHECK_SHA: ${{ github.sha }}',
  'git tag -a v1.0.0',
  'gh release create v1.0.0',
  'git rev-parse origin/main'
]) assert(workflow.includes(marker),'P27 workflow missing '+marker);
assert(workflow.includes('contents: write'),'P27 release job needs contents write');
assert(workflow.includes('contents: read'),'P27 default permissions must remain read-only');

const runbook=fs.readFileSync('operations/P27-RUNBOOK.md','utf8').toLowerCase();
for(const marker of ['stable release','maintenance mode','p26','physical','v1.0.0','explicit dispatch','no stable tag'])
  assert(runbook.includes(marker),'P27 runbook missing '+marker);

const notes=fs.readFileSync('operations/P27-RELEASE-NOTES.md','utf8');
for(const marker of ['Gomoku 1.0.0','Play','Improve','Guided Review','offline','Renju'])
  assert(notes.includes(marker),'P27 release notes missing '+marker);

console.log('PASS P27 stable-release and maintenance-handoff contracts.');
