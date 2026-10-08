'use strict';
/* A1 orchestration tests. The fake proof verifier isolates scheduling and
 * evidence semantics; analysis/test-proof-coverage.cjs exercises real rules. */
const assert=require('node:assert/strict');
const {createAnalysis2}=require('../analysis/core.js');
const base=Array(225).fill(0);base[100]=1;base[101]=2;
const same=a=>a.every((v,i)=>v===base[i]);
const mk=(kind,move,huge=false)=>({status:'proven',verified:true,kind,move,nodes:7,maxDepth:5,
  proof:{move,marker:kind,plies:3,replies:[],...(huge?{payload:'x'.repeat(161000)}:{})}});
function harness({unknown=false,invalid=false,oversize=false,winMove=null}={}){
 const calls=[],factory=()=>({
   legalMove:(b,i,c)=>({legal:i===-1||i>=0&&i<225&&!b[i],win:i===winMove,reason:'occupied'}),
 });
 const studio=()=>({
   solve:(b,c,r,opt)=>{calls.push({kind:opt.kind,after:!same(Array.from(b))});
     if(unknown||!same(Array.from(b)))return {status:'unknown',verified:false,nodes:1,timedOut:true};
     return mk(opt.kind,opt.kind==='vcf'?110:120,oversize);},
   verifyCertificate:cert=>!invalid&&cert?.proof?.marker&&cert?.position[cert.proof.move]===0,
   verifyProof:(b,c,r,p)=>!invalid&&b[p.move]===0,
   proofLine:p=>[p.move]
 });
 const A=createAnalysis2(factory,studio,()=>({}));
 return {A,calls,screen:(opts={})=>A.defenseScreen(base,1,'freestyle',{moveCount:2},115,{timeMs:600,depth:7,...opts})};
}
let passed=0;function test(name,f){f();passed++;console.log('PASS '+name);}
test('dual-stage VCF and VCT are actually requested',()=>{
 const h=harness(),s=h.screen(),r=s.report();
 assert.ok(h.calls.some(c=>c.kind==='vcf'&&!c.after));
 assert.ok(h.calls.some(c=>c.kind==='vct'&&!c.after));
 assert.deepEqual(r.rootThreats.map(t=>t.kind),['vcf','vct']);
 assert.equal(r.proofCount,2);
});
test('blocking one of two known threats does not imply safety',()=>{
 const s=harness().screen();
 assert.equal(s.inspect(110).status,'proven-loss');
 assert.equal(s.inspect(120).status,'proven-loss');
 assert.equal(s.inspect(115).status,'proven-loss');
 assert.equal(s.inspect(110).proofKind,'vct');
 assert.equal(s.inspect(120).proofKind,'vcf');
});
test('evidence certificates cover the exact after-position and color',()=>{
 const h=harness(),s=h.screen(),c=s.evidence(115);
 assert.ok(c);assert.equal(c.attacker,2);assert.equal(c.position[115],1);
 assert.equal(h.A.verify(c),true);
 const forged={...c,position:c.position.slice()};forged.position[110]=1;
 assert.equal(h.A.verify(forged),false);
});
test('all-refuted requires enumerating the complete legal board',()=>{
 const s=harness().screen(),r=s.report();assert.equal(r.enumerationComplete,true);
 assert.equal(r.allRefuted,true);assert.ok(r.checked>=200);
});
test('a valid immediate counter-win overrides forcing threat replay',()=>{
 const s=harness({winMove:117}).screen();assert.equal(s.inspect(117).status,'winning-move');
 assert.equal(s.evidence(117),null);assert.equal(s.report().allRefuted,false);
});
test('an unsuccessful or timed-out search remains unresolved',()=>{
 const s=harness({unknown:true}).screen();const r=s.report();
 assert.equal(r.rootThreats.length,0);assert.equal(r.proofCount,0);
 assert.equal(s.inspect(115).status,'unresolved');
 assert.equal(r.allRefuted,false);
});
test('a forged certificate is never promoted to tactical proof',()=>{
 const s=harness({invalid:true}).screen();assert.equal(s.report().proofCount,0);
 assert.equal(s.inspect(115).status,'unresolved');
});
test('oversized proofs are not silently truncated into verified claims',()=>{
 const s=harness({oversize:true}).screen();assert.equal(s.report().proofCount,0);
 assert.equal(s.evidence(115),null);
});
test('candidate probes retain VCF/VCT uncertainty and telemetry',()=>{
 const h=harness({unknown:true}),s=h.screen();s.refine([115],200);
 const r=s.inspect(115);
 assert.ok(r.probes.some(p=>p.kind==='vcf'));
 assert.ok(r.probes.some(p=>p.kind==='vct'));
 assert.equal(r.status,'unresolved');
 assert.ok(s.report().kinds.vct.probes>=1);
});
console.log(passed+' A1 tactical orchestration checks passed');
