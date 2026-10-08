/* Analysis 3.0 A0 regression baseline, not an Elo or solved-play benchmark. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const box={console,performance,Date,Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float64Array,ArrayBuffer,WebAssembly,atob,TextDecoder,Set,Map,Math,JSON};
vm.createContext(box);
for(const id of ['rules-engine','engine-v5','studio-core']){
  const match=html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'));
  assert.ok(match,'Missing embedded engine module '+id);vm.runInContext(match[1],box);
}
const E=vm.runInContext('createV5EngineFactory(createEngine,V5_WASM_BASE64)',box);
const {createAnalysis2}=require('../analysis/core.js');
const {createGuidedReviewCore}=require('../review/review.js');
const A=createAnalysis2(E,box.createStudioCore,createGuidedReviewCore);
const fixture=require('../analysis/fixtures/renju-move40.json');
const ix=s=>(15-Number(s.slice(1)))*15+'ABCDEFGHJKLMNOP'.indexOf(s[0]);
const defensive=new Set(fixture.localDefenses.map(ix)),bad=ix(fixture.badRecommendation);
const observed=[];
for(const preset of ['quick','standard']){
  const started=performance.now();
  const result=A.analyze(fixture.board,fixture.color,fixture.rule,bad,{preset,context:{moveCount:39}});
  const row={preset,wallMs:Math.round(performance.now()-started),best:result.best,
    bestCoord:result.best===null?null:fixture.localDefenses.find(s=>ix(s)===result.best)||result.best,
    played:bad,label:result.label,basis:result.basis,
    refutationValid:!!result.refutation&&A.verify(result.refutation),
    defense:result.defense,search:result.search};
  observed.push(row);
  assert.notEqual(result.best,bad,preset+' must not recommend known losing move');
  assert.ok(defensive.has(result.best),preset+' best move must interrupt checked B11 attack');
  assert.equal(row.refutationValid,true,preset+' must independently verify the after-move refutation');
  assert.equal(result.candidates.find(c=>c.i===bad)?.bound,'verified-loss');
  console.log('BASELINE',JSON.stringify({preset,wallMs:row.wallMs,best:row.bestCoord,label:row.label,backend:row.search.backend}));
}
const output=path.join(root,'analysis-test-output');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'analysis3-a0-baseline.json'),JSON.stringify({
  scope:'Renju move 40 known verified five-ply counterattack; no general playing-strength claim',
  engineGeneration:A.VERSION,
  fixture:fixture.id,
  testedPresets:observed.length,
  rows:observed
},null,2));
console.log('PASS R4 forcing-defense baseline: '+observed.length+' presets');
