'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),A=require('./core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),box={console,performance,Date,Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float64Array,ArrayBuffer,WebAssembly,atob,TextDecoder,Set,Map,Math,JSON};vm.createContext(box);
for(const id of ['rules-engine','engine-v5','studio-core','studio-data']){const m=html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'));assert.ok(m,id);vm.runInContext(m[1],box)}
const E=vm.runInContext('createV5EngineFactory(createEngine,V5_WASM_BASE64)',box),D=vm.runInContext('createStudioData()',box),rows=[];
const board=(black=[],white=[])=>{const b=Array(225).fill(0);black.forEach(i=>b[i]=1);white.forEach(i=>b[i]=2);return b};
const tactical=[
 {name:'single immediate win',rule:'freestyle',color:1,b:board([105,106,107,108],[104]),ok:r=>r.move===109},
 {name:'single forced block',rule:'freestyle',color:1,b:board([104],[105,106,107,108]),ok:r=>r.move===109},
 {name:'Renju center opening',rule:'renju-practice',color:1,b:board(),ok:r=>r.move===112},
 {name:'Renju forbidden double-three avoided',rule:'renju-practice',color:1,b:board([110,111,82,97]),ok:r=>r.move!==112&&E('renju-practice').legalMove(Int8Array.from(r.__board),r.move,1,4).legal}
];
// R3: metamorphic tactical safety cases (color swap and 180° board rotation).
// These are known one-move threats; no Elo or broad playing-strength inference.
const turn180=b=>{const out=Array(225).fill(0);b.forEach((v,i)=>out[224-i]=v);return out};
const base=[...tactical.slice(0,2),{
  name:'white immediate win',rule:'freestyle',color:2,
  b:board([104],[105,106,107,108]),ok:r=>r.move===109
},{
  name:'white forced block',rule:'freestyle',color:2,
  b:board([105,106,107,108],[104]),ok:r=>r.move===109
}];
const rotated=base.map(x=>({
  ...x,name:'rotated '+x.name,b:turn180(x.b),ok:r=>r.move===115
}));
const tacticalCases=tactical.concat(base.slice(2),rotated);
for(const f of tacticalCases){
  const eng=E(f.rule),cfg=A.tuneSearch('advanced',D.levels.advanced),t=performance.now();
  const r=eng.chooseMove(f.b,f.color,{...cfg,timeMs:Math.min(500,cfg.timeMs),multiPV:3,seed:17});
  const move=Number(r?.move),count=f.b.filter(Boolean).length;
  const legal=Number.isInteger(move)&&move>=0&&move<225&&eng.legalMove(Int8Array.from(f.b),move,f.color,count).legal===true;
  const pass=legal&&!!f.ok(r);
  rows.push({kind:'tactical',name:f.name,rule:f.rule,color:f.color,pass,legal,move:r?.move??null,
    depth:r?.depth||0,nodes:r?.nodes||0,wallMs:Math.round(performance.now()-t),backend:r?.backend||'unknown'});
}
const game=JSON.parse(fs.readFileSync(path.join(__dirname,'../review/fixture.json'),'utf8')),R=require('../review/review.js').createGuidedReviewCore(E,box.createStudioCore),positions=R.positions(game);
for(const pi of [1,4,6,8]){const p=positions[pi];if(!p)continue;const eng=E(game.variant),refCfg=A.tuneSearch('maximum',D.levels.maximum),reference=eng.chooseMove(p.board,p.color,{...refCfg,timeMs:800,maxDepth:Math.min(9,refCfg.maxDepth),multiPV:1,seed:91});
 for(const level of ['mid','advanced','high','expert','maximum']){const cfg=A.tuneSearch(level,D.levels[level]),t=performance.now(),r=eng.chooseMove(p.board,p.color,{...cfg,timeMs:Math.min(420,cfg.timeMs),maxDepth:Math.min(8,cfg.maxDepth),seed:91});rows.push({kind:'quiet',name:'review fixture '+(pi+1),level,move:r.move,reference:reference.move,agree:r.move===reference.move,depth:r.depth||0,nodes:r.nodes||0,wallMs:Math.round(performance.now()-t),backend:r.backend||'unknown'})}}
const summary=A.benchmarkSummary(rows);
const failed=rows.filter(x=>x.kind==='tactical'&&!x.pass);
if(failed.length)console.error('R3 tactical safety failures:',JSON.stringify(failed));
assert.equal(summary.tacticalPass,true,'Tactical safety fixture failed');
const out=path.join(__dirname,'../ai2-test-output');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify({version:A.VERSION,scope:'Fixed deterministic positions. Search budgets are capped for CI repeatability; reference agreement is descriptive, not Elo or solved-play evidence.',summary,rows},null,2));console.log(JSON.stringify(summary));
