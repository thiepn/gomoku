import {spawnSync} from 'node:child_process';
import process from 'node:process';

const file=String(process.argv[2]||'').trim();
const attempts=Math.max(1,Math.min(8,Number(process.env.P18_CONTRACT_RETRIES)||5));
if(!/^online\/test-[a-z0-9-]+\.mjs$/.test(file)){
  throw new Error('Usage: node operations/p18-retry-contract.mjs online/test-*.mjs');
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=1;attempt<=attempts;attempt++){
  const run=spawnSync(process.execPath,[file],{
    encoding:'utf8',
    env:process.env,
    maxBuffer:16*1024*1024
  });
  if(run.stdout)process.stdout.write(run.stdout);
  if(run.status===0)process.exit(0);
  const output=String(run.stderr||'')+String(run.stdout||'');
  if(run.stderr)process.stderr.write(run.stderr);
  const transient=/->\s*(502|503)\b|invalid response was received from the upstream server/i.test(output);
  if(!transient||attempt===attempts){
    process.exit(run.status||1);
  }
  console.warn('P18 transient local gateway failure; retrying '+file+' ('+attempt+'/'+attempts+').');
  await wait(1500*attempt);
}
process.exit(1);
