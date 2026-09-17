'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),box={console,performance,Date,Int8Array,Uint8Array,Int32Array,Uint32Array,Set,Map,Math,JSON};vm.createContext(box);
for(const id of ['rules-engine','studio-core'])vm.runInContext(html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))[1],box);
const E=box.createEngine,C=box.createStudioCore(E),A=require('./core.js').createAnalysis2(E,box.createStudioCore,require('../review/review.js').createGuidedReviewCore);
const b=Array(225).fill(0);for(const i of [110,111,82,97])b[i]=1;for(const i of [0,14,210])b[i]=2;
const res=C.solve(b,1,'freestyle',{kind:'vct',timeMs:12000,depth:7,nodeLimit:180000,orderWithSearch:false});console.log('VCT',res.status,res.nodes,res.elapsedMs,JSON.stringify(res.proof||{}).length);
assert.equal(res.status,'proven','The cross-shaped test position has a forcing VCT strategy');assert.equal(res.verified,true);
const cert=C.certificate(b,1,'freestyle',res),steps=A.proofSteps(cert),def=steps.find(x=>x.choices?.length>1);assert.ok(def,'Proof must contain a branching defense node');let passed=0;const names=[];const test=(name,f)=>{f();passed++;names.push(name);console.log('PASS '+name);};
test('VCT certificate covers a branching defense tree',()=>assert.ok(def.choices.length>200));
test('full branching certificate passes independent verification',()=>assert.equal(A.verify(cert),true));
const findBranch=n=>n.type==='all-defenses'?n:n.replies?.map(r=>findBranch(r.proof)).find(Boolean);
test('deleting a required defense invalidates the proof',()=>{const c=structuredClone(cert);findBranch(c.proof).replies.pop();assert.equal(A.verify(c),false);});
test('duplicating a defense cannot substitute for the missing one',()=>{const c=structuredClone(cert),n=findBranch(c.proof);n.replies[0]=structuredClone(n.replies[1]);assert.equal(A.verify(c),false);});
test('a defense choice changes the explored branch without changing the certificate',()=>{const old=JSON.stringify(cert),choices=[];choices[def.choiceIndex]=def.choices.find(i=>i!==def.i&&i>=0);const line=A.proofSteps(cert,choices);assert.equal(line.find(x=>x.choiceIndex===def.choiceIndex).i,choices[def.choiceIndex]);assert.equal(A.terminal(line.at(-1).board,'freestyle'),1);assert.equal(JSON.stringify(cert),old);});
test('passing is explicitly covered where it is a legal non-forced defense',()=>{const n=findBranch(cert.proof);assert.ok(n.replies.some(x=>x.move===-1));});
for(let transform=0;transform<8;transform++){
 const map=i=>{if(i<0)return i;let x=i%15,y=Math.floor(i/15);if(transform>=4)x=14-x;for(let k=0;k<transform%4;k++)[x,y]=[14-y,x];return y*15+x;};
 const convert=n=>({...n,move:map(n.move),...(n.ends?{ends:n.ends.map(map)}:{}),replies:n.replies.map(r=>({move:map(r.move),proof:convert(r.proof)}))});
 test('proof remains valid under board symmetry '+transform,()=>{const c=structuredClone(cert),next=Array(225).fill(0);c.position.forEach((v,i)=>next[map(i)]=v);c.position=next;c.proof=convert(c.proof);assert.equal(A.verify(c),true);});
}
test('color-swapped unrestricted proof remains valid',()=>{const c=structuredClone(cert);c.attacker=2;c.position=c.position.map(x=>x?3-x:0);assert.equal(A.verify(c),true);});
test('a shallow unsuccessful threat search reports unknown, not no win',()=>{const r=C.solve(b,1,'freestyle',{kind:'vct',timeMs:50,depth:1,nodeLimit:50});assert.equal(r.status,'unknown');assert.equal(r.proof,null);});
const out=path.join(__dirname,'../analysis-test-output');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'branching-proof.json'),JSON.stringify(cert));fs.writeFileSync(path.join(out,'proof-coverage-report.json'),JSON.stringify({passed,tests:names,defensiveBranches:def.choices.length,certificateBytes:JSON.stringify(cert).length},null,2));console.log(passed+' proof coverage checks passed');
