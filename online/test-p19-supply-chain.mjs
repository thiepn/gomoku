import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const run=spawnSync(process.execPath,['operations/p19-supply-chain-policy.mjs'],{encoding:'utf8',env:process.env,maxBuffer:4*1024*1024});
if(run.stdout)process.stdout.write(run.stdout);
if(run.stderr)process.stderr.write(run.stderr);
assert(run.status===0,'P19 supply-chain policy failed');

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(waiter.includes("p19_supply_chain:'p19-supply-chain'"),'P16 admission does not require P19');
const workflow=fs.readFileSync('.github/workflows/verify-p19-supply-chain.yml','utf8');
for(const marker of ['name: p19-supply-chain','contents: read','operations/p19-supply-chain-policy.mjs'])assert(workflow.includes(marker),'P19 workflow missing '+marker);
const runbook=fs.readFileSync('operations/P19-RUNBOOK.md','utf8');
for(const marker of ['immutable commit SHA','pull-request code','Dependabot','P16 admission'])assert(runbook.includes(marker),'P19 runbook missing '+marker);
console.log('PASS P19: immutable actions, least-privilege PR checks, isolated main publishing, maintenance automation and admission gating.');
