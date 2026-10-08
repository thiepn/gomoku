'use strict';
/* A2 deterministic orchestration tests. Does not claim stronger game play. */
const assert=require('node:assert/strict');
const {createAnalysis2}=require('../analysis/core.js');
const board=Array(225).fill(0);board[100]=1;board[101]=2;
const fact={win:false,alreadyLost:false,replies:[],finishes:[],ownWins:[],threats:[]};
function harness({focussedDepth=18,primaryDepth=12,provedFirst=false,timeout=false,candidateDepth=null}={}){
  const calls=[];
  const e=()=>({legalMove:(b,i)=>({legal:i===-1||Number.isInteger(i)&&i>=0&&i<225&&!b[i],win:false,fours:[],threes:[]}),winningMoves:()=>[],classify:()=>({fours:[],threes:[]})});
  const C=()=>({
    solve:()=>({status:'unknown',verified:false,nodes:1}),
    analyze:(b,color,rule,o)=>{
      calls.push(o);const focus=calls.length===2,d=focus?focussedDepth:primaryDepth;
      return {rule,color,move:112,pv:[112],depth:d,backend:'mock-wasm',
        nodes:100*d,ttHits:5,parameters:{engine:'mock-6'},
        tactical:provedFirst&&!focus?{verified:true,status:'proven',kind:'vcf',move:112,pv:[112],proof:{move:112,plies:1}}:{status:'unknown'},
        timedOut:!!timeout,
        candidates:[{i:112,score:30,bound:'exact',depth:candidateDepth??d,pv:[112]},
          {i:113,score:12,bound:'exact',depth:d,pv:[113]},
          {i:114,score:300000,bound:'lower',depth:d,pv:[114]},
          {i:100,score:999999,bound:'exact',depth:d,pv:[100]}]};},
    verifyProof:()=>false,
    verifyCertificate:cert=>cert?.proof?.move===112,
    proofLine:p=>[p.move]
  });
  const R=()=>({
    pack:(raw,b,c,played)=>({played,color:c,rule:'freestyle',label:'Inaccuracy',basis:'selective-estimate',
      loss:5,best:raw.move,score:12,facts:{...fact},explanation:{why:'Selective estimate.',lesson:'Inspect.',highlights:[]},
      candidates:raw.candidates.map(q=>({...q,label:'Good',basis:'selective-estimate',loss:2,explanation:{why:'Compare.',lesson:'Inspect.',highlights:[]}})),
      pv:raw.pv,depth:raw.depth,engine:'mock',quality:'selective',key:'mock'}),
    line:(b,c,r,m)=>({moves:m.filter(i=>i!==100)})
  });
  const A=createAnalysis2(e,C,R);
  return {A,calls,run:(settings={})=>A.analyze(board,1,'freestyle',113,{preset:'deep',timeMs:3000,multiPV:8,...settings})};
}
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('clamp line choices to 1–8, reject fractional values',()=>{
 const {A}=harness(),p=A.PRESETS.deep;
 assert.equal(A.searchPlan(p,3000,0).requested,1);
 assert.equal(A.searchPlan(p,3000,99).requested,8);
 assert.equal(A.searchPlan(p,3000,4.5).requested,5);
});
test('deep search requests up to eight root lines',()=>{
 const h=harness(),r=h.run();assert.equal(h.calls[0].multiPV,8);
 assert.equal(r.multiPV,8);assert.equal(r.search.requestedLines,8);
});
test('recorded move is explicitly covered by initial and focused search',()=>{
 const h=harness();h.run();
 assert.ok(h.calls[0].includeMoves.includes(113));
 assert.ok(h.calls[1].includeMoves.includes(113));
});
test('second pass is chosen only if it deepens or maintains search quality',()=>{
 const h=harness(),r=h.run();assert.equal(h.calls.length,2);
 assert.equal(r.search.completedDepth,18);
 assert.equal(r.search.searchPasses[1].phase,'focused');
 const j=harness({focussedDepth:2}),q=j.run();assert.equal(q.search.completedDepth,12);
});
test('quick analysis avoids extra root search',()=>{
 const h=harness();h.run({preset:'quick',timeMs:350});
 assert.equal(h.calls.length,1);
});
test('never discard first-pass verified tactical win for deeper heuristic output',()=>{
 const h=harness({provedFirst:true}),r=h.run();
 assert.equal(r.search.completedDepth,12);
 assert.ok(r.bestProof);
});
test('root lines are filtered for legality before presentation',()=>{
 const h=harness(),r=h.run();
 assert.ok(!r.candidates.some(c=>c.i===100));
});
test('only exact completed-depth root estimates receive comparable scores',()=>{
 const h=harness({candidateDepth:5}),r=h.run();
 const shallower=r.candidates.find(c=>c.i===112),exact=r.candidates.find(c=>c.i===113);
 assert.equal(shallower.comparison.scoreComparable,false);
 assert.equal(shallower.delta,null);
 assert.equal(exact.comparison.scoreComparable,true);
 assert.equal(r.search.sameRootComparison,false);
 assert.equal(r.loss,null);
});
test('bounded/unfinished roots report no precision they do not have',()=>{
 const h=harness({timeout:true}),r=h.run({timeMs:350});
 assert.equal(r.search.compared,0);
 assert.ok(r.candidates.every(c=>!c.comparison.scoreComparable));
});
test('supported same-root estimates are not falsely described as verified wins',()=>{
 const h=harness(),r=h.run();
 assert.ok(r.candidates.every(c=>c.comparison.kind!=='verified-win'));
 assert.equal(r.search.sameRootComparison,true);
});
console.log(passed+' A2 MultiPV and search-evidence tests passed');
