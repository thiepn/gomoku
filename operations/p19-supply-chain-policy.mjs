import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const workflowDir=path.join(root,'.github','workflows');
const failures=[];
const allowed=new Map([
  ['actions/checkout','11d5960a326750d5838078e36cf38b85af677262'],
  ['actions/setup-node','49933ea5288caeca8642d1e84afbd3f7d6820020'],
  ['actions/setup-python','a26af69be951a213d495a4c3e4e4022e16d87065'],
  ['actions/upload-artifact','ea165f8d65b6e75b540449e92b4886f43607fa02'],
  ['actions/download-artifact','d3f86a106a0bac45b974a628896c90dbdf5c8093'],
  ['supabase/setup-cli','1dedf2c611547ede7232d26866dd3c56ab903bbb']
]);
const fail=message=>failures.push(message);
const names=fs.readdirSync(workflowDir).filter(name=>/\.ya?ml$/i.test(name)).sort();

for(const name of names){
  const rel='.github/workflows/'+name;
  const source=fs.readFileSync(path.join(workflowDir,name),'utf8');
  if(/(^|\n)\s*pull_request_target\s*:/m.test(source))fail(rel+': pull_request_target is forbidden.');
  if(/(^|\n)\s*permissions\s*:\s*write-all\s*$/m.test(source))fail(rel+': permissions: write-all is forbidden.');
  for(const dangerous of [
    /supabase\s+db\s+reset\s+--linked/i,
    /supabase\s+db\s+push\b/i,
    /curl[^\n|]*\|\s*(?:ba)?sh/i,
    /wget[^\n|]*\|\s*(?:ba)?sh/i
  ])if(dangerous.test(source))fail(rel+': forbidden high-risk pattern '+dangerous);

  for(const line of source.split(/\r?\n/)){
    const m=line.match(/^\s*-\s+uses:\s+([^#\s]+)(?:\s+#.*)?$/);
    if(!m)continue;
    const spec=m[1];
    if(spec.startsWith('./'))continue;
    const parsed=spec.match(/^([^@]+)@([0-9a-f]{40})$/i);
    if(!parsed){fail(rel+': action is not commit-pinned: '+spec);continue;}
    const action=parsed[1],sha=parsed[2].toLowerCase(),expected=allowed.get(action);
    if(!expected){fail(rel+': unreviewed external action '+action);continue;}
    if(sha!==expected)fail(rel+': '+action+' expected '+expected+' but found '+sha);
  }
}

const p13=fs.readFileSync(path.join(workflowDir,'verify-p8-competition.yml'),'utf8');
if(!/permissions:\s*\n\s{2}contents:\s*read\b/.test(p13))fail('P13 workflow must be read-only at workflow scope.');
const parts=p13.split(/\n {2}publish-generated:\s*\n/);
if(parts.length!==2){
  fail('P13 publishing must be isolated in publish-generated.');
}else{
  if(/git\s+push\s+origin/.test(parts[0]))fail('P13 verification job must not push.');
  const publisher=parts[1];
  for(const marker of [
    "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
    'needs: p13',
    'permissions:\n      contents: write',
    'git push origin HEAD:main'
  ])if(!publisher.includes(marker))fail('publish-generated missing '+marker.replace(/\n/g,' / '));
}
const waiter=fs.readFileSync(path.join(root,'operations','p16-await-checks.mjs'),'utf8');
if(!waiter.includes("p19_supply_chain:'p19-supply-chain'"))fail('P16 exact-SHA admission waiter does not require P19.');
if(!waiter.includes("p21_capacity:'p21-capacity'"))fail('P16 exact-SHA admission waiter does not require P21 capacity certification.');
if(!waiter.includes("p23_security:'p23-security'"))fail('P16 exact-SHA admission waiter does not require P23 security assurance.');

const dependabotPath=path.join(root,'.github','dependabot.yml');
if(!fs.existsSync(dependabotPath))fail('Dependabot github-actions maintenance is missing.');
else if(!/package-ecosystem:\s*["']?github-actions["']?/.test(fs.readFileSync(dependabotPath,'utf8')))fail('Dependabot must monitor github-actions.');

if(failures.length){
  console.error('P19 supply-chain policy FAILED:\n- '+failures.join('\n- '));
  process.exit(1);
}
console.log('PASS P19 supply-chain policy: '+names.length+' workflows are immutable and least-privilege.');
