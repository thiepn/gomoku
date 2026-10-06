'use strict';
const assert=require('node:assert/strict'),A=require('./core.js');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name)}
const cfg={first:{timeMs:120,maxDepth:2,width:10},beg:{timeMs:200,maxDepth:3,width:10},club:{timeMs:330,maxDepth:4,width:11},mid:{timeMs:540,maxDepth:5,width:12},advanced:{timeMs:850,maxDepth:6,width:14},high:{timeMs:1350,maxDepth:7,width:16},expert:{timeMs:2150,maxDepth:8,width:18},maximum:{timeMs:3400,maxDepth:10,width:22}};
test('eight-level order stays explicit',()=>assert.deepEqual(A.LEVELS,['first','beg','club','mid','advanced','high','expert','maximum']));
test('AI2 tuning does not mutate base config',()=>{const b={...cfg.high};const x=A.tuneSearch('high',b);assert.deepEqual(b,cfg.high);assert.equal(x.multiPV,3);assert.ok(x.timeMs>b.timeMs)});
test('strong levels focus MultiPV while increasing compute monotonically',()=>{const r=A.calibrationAudit(cfg);assert.equal(r.pass,true);assert.equal(r.rows.at(-1).multiPV,1);assert.ok(r.rows.at(-1).maxDepth>cfg.maximum.maxDepth)});
const games=(level,outcomes,assisted=false)=>outcomes.map((outcome,i)=>({id:level+i,at:1000+i,outcome,effectiveLevel:level,selectedLevel:level,assisted}));
test('adaptive mode waits for evidence',()=>{const r=A.resolveAdaptive('mid',games('mid',['win','win','win']),A.freshAdaptive('mid',0));assert.equal(r.level,'mid');assert.equal(r.reason,'need-more-games')});
test('four clean wins can raise exactly one level',()=>{const h=games('mid',['win','win','win','win']);const r=A.resolveAdaptive('mid',h,A.freshAdaptive('mid',0));assert.equal(r.level,'advanced');assert.equal(r.changed,true)});
test('four clean losses can ease exactly one level',()=>{const h=games('mid',['loss','loss','loss','loss']);const r=A.resolveAdaptive('mid',h,A.freshAdaptive('mid',0));assert.equal(r.level,'club')});
test('assisted games do not drive adaptation',()=>{const h=games('mid',['win','win','win','win'],true);const r=A.resolveAdaptive('mid',h,A.freshAdaptive('mid',0));assert.equal(r.level,'mid');assert.equal(r.performance.games,0)});
test('new strength needs its own evidence before another change',()=>{let h=games('mid',['win','win','win','win']);let r=A.resolveAdaptive('mid',h,A.freshAdaptive('mid',0));assert.equal(r.level,'advanced');h=h.concat(games('advanced',['win','win'],false).map((g,i)=>({...g,id:'a'+i,at:2000+i})));r=A.resolveAdaptive('mid',h,r.state);assert.equal(r.level,'advanced');assert.equal(r.reason,'need-more-games')});
test('explicit user difficulty change resets adaptive baseline',()=>{const h=games('mid',['win','win','win','win']);const old=A.resolveAdaptive('mid',h,A.freshAdaptive('mid',0));const r=A.resolveAdaptive('expert',h,old.state);assert.equal(r.level,'expert');assert.equal(r.state.selected,'expert')});
test('benchmark summary never presents reference agreement as rating',()=>{const s=A.benchmarkSummary([{kind:'tactical',pass:true},{kind:'quiet',agree:true}]);assert.equal(s.tacticalPass,true);assert.match(s.scope,/not Elo/)});
console.log(n+' AI 2.0 core checks passed');
