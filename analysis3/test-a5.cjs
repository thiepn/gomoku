'use strict';
const assert=require('node:assert/strict');
const P=require('./practice-core.js');
const board=Array(225).fill(0),point={board:board.slice(),color:1,ply:7,played:110,context:{}};
function evidence(extra={}){return {played:110,best:111,label:'Mistake',basis:'selective-estimate',
  search:{sameRootComparison:true},facts:{win:false,replies:[],ownWins:[]},
  candidates:[{i:110,score:-12,bound:'exact',depth:8,comparison:{scoreComparable:true}},
     {i:111,score:31,bound:'exact',depth:8,comparison:{scoreComparable:true}}],...extra};}
let passes=0;function test(name,run){run();passes++;console.log('PASS '+name)}
const card=(id,due,extra={})=>({id,board:board.slice(),color:1,rule:'freestyle',played:110,
 source:{ply:7},reference:evidence(),stats:{due,attempts:0,lapses:0,streak:0,assisted:0},...extra});
const engine={trainable:r=>r.basis!=='insufficient-search'&&r.best!==r.played,
 makeCard:(r,p,g)=>card('card-'+p.ply,0,{board:p.board.slice(),color:p.color,rule:g.variant,source:{ply:p.ply},reference:r})};
const game={mode:'ai',humanColor:1,variant:'freestyle',gameId:'x'};
test('rule-factual missing win is a finish exercise',()=>{
 const r=evidence({facts:{win:false,ownWins:[111],replies:[]}});assert.equal(P.theme(r,point,'freestyle'),'finish');
 assert.equal(P.qualification(r,point,'freestyle').evidence,'rules');
});
test('prior lost position excluded from new mistake drill',()=>{
 assert.equal(P.qualification(evidence({facts:{alreadyLost:true}}),point,'freestyle').eligible,false);
});
test('incomplete depth bound cannot generate a confidence-backed card',()=>{
 const r=evidence();r.candidates[1].depth=3;assert.equal(P.sameRoot(r),false);
 assert.equal(P.qualification(r,point,'freestyle').eligible,false);
});
test('no compared best alternative leaves move unresolved',()=>{
 assert.equal(P.qualification(evidence({best:110}),point,'freestyle').eligible,false);
});
test('normal provisional mistakes get provisional not verified lessons',()=>{
 const q=P.qualification(evidence(),point,'freestyle');assert.equal(q.evidence,'provisional');
});
test('genuinely rule-based block is prioritized over raw positional estimate',()=>{
 const r=evidence({facts:{win:false,replies:[90],ownWins:[]}});assert.equal(P.theme(r,point),'forced-defense');
});
test('double finishing points are recognized without claiming guaranteed win',()=>{
 const r=evidence({facts:{win:false,finishes:[90,91]}});assert.equal(P.theme(r,point),'double-threat');
});
test('cards from a real game ignore opponent and unknown positions',()=>{
 const r=evidence(),positions=[point,{...point,color:2,ply:8},{...point,ply:9}],rs=[r,r,null];
 const out=P.gamePlan(positions,rs,game,{analysis:engine});assert.equal(out.eligible,1);
 assert.equal(out.issues[0].ply,7);assert.equal(out.skipped.length,1);
});
test('no matching training schema results in no generated card',()=>{
 const out=P.gamePlan([point],[evidence()],game,{analysis:{trainable:()=>false}});
 assert.equal(out.issues.length,0);assert.equal(out.skipped.length,1);
});
test('existing due dates are consulted and untouched',()=>{
 const now=100*P.DAY,cards=[card('a',now-P.DAY),card('b',now+P.DAY)];
 const old=JSON.stringify(cards),out=P.cardPlan(cards,{now});assert.equal(out.due,1);
 assert.equal(out.items[0].id,'a');assert.equal(JSON.stringify(cards),old);
});
test('existing streak and lapse counters can prioritize without mutation',()=>{
 const now=100*P.DAY,cards=[card('a',now,{stats:{due:now,lapses:0,streak:4}}),
  card('b',now,{stats:{due:now,lapses:2,streak:0}})];
 const out=P.cardPlan(cards,{now});assert.equal(out.items[0].id,'b');
});
test('due focus filters future scheduled cards',()=>{
 const now=100*P.DAY,cards=[card('a',now-1),card('b',now+100)];
 assert.deepEqual(P.cardPlan(cards,{now,focus:'due'}).items.map(x=>x.id),['a']);
});
test('unknown attempt never updates schedule',()=>{
 const v=P.answerPolicy(null,evidence());assert.equal(v.status,'unresolved');assert.equal(v.advance,false);
});
test('a verified winning exercise cannot be cleared with Good heuristic move',()=>{
 const r=evidence({played:110,best:110,label:'Good'}),v=P.answerPolicy(r,evidence(),{verifiedTarget:true});
 assert.equal(v.status,'unresolved');
});
test('winning target accepts actual rule-completed five',()=>{
 const r=evidence({played:111,best:111,label:'Winning move',facts:{win:true}}),
 v=P.answerPolicy(r,evidence(),{verifiedTarget:true});assert.equal(v.status,'correct');assert.equal(v.advance,true);
});
test('a hinted winning solution is assisted and never unassisted mastery',()=>{
 const r=evidence({played:111,best:111,facts:{win:true}}),v=P.answerPolicy(r,evidence(),{verifiedTarget:true,assisted:true});
 assert.equal(v.status,'correct');assert.equal(v.advance,false);assert.equal(v.assisted,true);
});
test('evidence-bounded positional answer requires completed same-root and rank',()=>{
 const r=evidence({played:111,best:111,label:'Best found',
 candidates:[{i:111,bound:'exact',score:20,depth:8,comparison:{scoreComparable:true}},
 {i:110,bound:'exact',score:1,depth:8,comparison:{scoreComparable:true}}]});
 assert.equal(P.answerPolicy(r,evidence()).status,'correct');
});
test('a dangerous answer is scored incorrect not silently mastered',()=>{
 const r=evidence({refutation:{format:'GomokuStudioProof',proof:{}}});
 assert.equal(P.answerPolicy(r,evidence()).status,'incorrect');
});
test('unscored uncertain wrong answer does not trigger lapse',()=>{
 const r=evidence({label:'Unscored'});assert.equal(P.answerPolicy(r,evidence()).status,'unresolved');
});
test('no AI/user fabricated card stats or event identifiers',()=>{
 const c=card('stable-id',500),before=JSON.stringify(c);
 P.cardPlan([c],{now:600});assert.equal(c.id,'stable-id');assert.equal(JSON.stringify(c),before);
});
console.log(passes+' A5 practice contracts passed');
