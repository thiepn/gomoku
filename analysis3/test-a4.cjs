'use strict';
const assert=require('node:assert/strict');
const D=require('./game-diagnosis.js');
const board=Array(225).fill(0),positions=[{ply:1,color:1,played:112,board:board.slice(),context:{}},
  {ply:2,color:2,played:113,board:board.slice(),context:{}}];
const exact=(i,score)=>({i,bound:'exact',score,depth:6,comparison:{scoreComparable:true},pv:[i,114]});
const estimate=(extra={})=>({played:112,best:115,label:'Mistake',basis:'selective-estimate',search:{sameRootComparison:true,completedDepth:6},
 candidates:[exact(112,2),exact(115,50)],facts:{win:false,replies:[],ownWins:[]},...extra});
const proof={format:'GomokuStudioProof',position:Array(225).fill(0),proof:{move:116},attacker:2,rule:'freestyle'};
proof.position[112]=1;
const altProof={...proof,position:board.slice(),attacker:1,proof:{move:115}};
const checked={verifyProof:()=>true,rule:'freestyle'};
const legalCore={line:(b,color,rule,moves)=>{
 const out=[],states=[{board:b.slice(),color}];for(const i of moves){const a=states.at(-1).board.slice();if(i<0||i>=225||a[i])break;a[i]=states.at(-1).color;out.push(i);states.push({board:a,color:3-states.at(-1).color});}return {moves:out,states};
}};
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('pending move remains unknown',()=>{
 const c=D.classification(null,positions[0]);assert.equal(c.bucket,'unresolved');assert.equal(c.verified,false);
});
test('immediate winning move is grounded in rule facts',()=>{
 const c=D.classification(estimate({facts:{win:true}}),positions[0]);assert.equal(c.kind,'won-immediately');assert.equal(c.verified,true);
});
test('missed one-move win is a fact but not proof of loss',()=>{
 const c=D.classification(estimate({facts:{win:false,ownWins:[115],replies:[]}}),positions[0]);
 assert.equal(c.kind,'missed-immediate-win');assert.match(c.note,/not automatically/);
});
test('immediate opponent finishing reply is distinguished from verified avoidability',()=>{
 const c=D.classification(estimate({facts:{win:false,replies:[114],ownWins:[]}}),positions[0]);
 assert.equal(c.kind,'allows-immediate-win');assert.match(c.note,/alternative/);
});
test('valid-scope verified after-position loss is not called avoidable',()=>{
 const c=D.classification(estimate({basis:'verified-proof',refutation:proof}),positions[0],checked);
 assert.equal(c.kind,'verified-opponent-win-after');assert.match(c.note,/avoidability has not been established/);
});
test('mismatched after-position certificate is ignored',()=>{
 const fake={...proof,position:board.slice()};
 const c=D.classification(estimate({basis:'verified-proof',refutation:fake}),positions[0],checked);
 assert.equal(c.kind,'provisional-mistake');
});
test('cached proof without an independent verifier remains unconfirmed',()=>{
 const c=D.classification(estimate({basis:'verified-proof',refutation:proof}),positions[0]);
 assert.notEqual(c.kind,'verified-opponent-win-after');assert.equal(c.verified,false);
});
test('wrong attacker or rule cannot masquerade as a verified certificate',()=>{
 const a=D.classification(estimate({basis:'verified-proof',refutation:{...proof,attacker:1}}),positions[0],checked);
 const b=D.classification(estimate({basis:'verified-proof',refutation:{...proof,rule:'exact-five'}}),positions[0],checked);
 assert.equal(a.verified,false);assert.equal(b.verified,false);
});
test('proof claim without verified-proof basis is not accepted',()=>{
 const c=D.classification(estimate({refutation:proof}),positions[0],checked);assert.equal(c.kind,'provisional-mistake');
});
test('prior lost position is not double counted as new mistake',()=>{
 const c=D.classification(estimate({facts:{alreadyLost:true}}),positions[0]);
 assert.equal(c.kind,'already-lost');assert.equal(c.needsReview,false);
});
test('exhaustive verified defense status stays a pre-existing outcome',()=>{
 const c=D.classification(estimate({basis:'verified-proof',defense:{allRefuted:true,enumerationComplete:true,proofCount:2,refuted:4,checked:4}}),positions[0]);
 assert.equal(c.kind,'already-lost');
});
test('selected verified winning alternative is distinguished from played outcome',()=>{
 const c=D.classification(estimate({bestProof:altProof}),positions[0],checked);
 assert.equal(c.kind,'verified-winning-alternative');assert.match(c.note,/recorded move/);
});
test('blocking one known attack does not claim global safety',()=>{
 const c=D.classification(estimate({label:'Defensive move',basis:'verified-defense'}),positions[0]);
 assert.equal(c.kind,'known-threat-blocked');assert.match(c.note,/Other threats/);
});
test('same-root exact completed score allows provisional comparison only',()=>{
 const c=D.classification(estimate(),positions[0]);
 assert.equal(c.kind,'provisional-mistake');assert.equal(c.verified,false);
});
test('engine label with unequal-depth basis is unresolved',()=>{
 const r=estimate({search:{sameRootComparison:false}}),c=D.classification(r,positions[0]);
 assert.equal(c.kind,'unconfirmed-mistake');assert.equal(c.bucket,'unresolved');
});
test('numerical comparison requires exact finite values and same depths',()=>{
 const r=estimate();assert.equal(D.sameRoot(r),true);
 r.candidates[1].depth=3;assert.equal(D.sameRoot(r),false);
});
test('comparison replays from the original exact board',()=>{
 const c=D.contrast(estimate(),positions[0],legalCore,'freestyle');
 assert.equal(c.comparable,true);assert.equal(c.scoreGap,48);
 assert.deepEqual(c.playedLine,[112,114]);assert.deepEqual(c.bestLine,[115,114]);
 assert.deepEqual(positions[0].board,board);
});
test('illegal PV move truncates before exceeding legitimate play',()=>{
 const r=estimate();r.candidates[0].pv=[112,112,114];
 const c=D.contrast(r,positions[0],legalCore,'freestyle');assert.deepEqual(c.playedLine,[112]);
});
test('unsearched suggested best cannot receive numeric comparison',()=>{
 const r=estimate();r.candidates=r.candidates.slice(0,1);
 const c=D.contrast(r,positions[0],legalCore,'freestyle');assert.equal(c.comparable,false);
 assert.equal(c.scoreGap,null);assert.equal(c.bestLine.length,0);
});
test('whole game preserves unknown gaps and both-side summaries',()=>{
 const d=D.summarize(positions,[estimate(),null],{mode:'mine',humanColor:1});
 assert.equal(d.total,2);assert.equal(d.analyzed,1);assert.equal(d.coverage,.5);
 assert.equal(d.summary.pending,1);assert.deepEqual(d.reviewIndices,[0]);
 assert.equal(d.bySide.White.analyzed,0);
});
test('event filters do not silently count normal moves as errors',()=>{
 const d=D.summarize(positions,[estimate(),{played:113,label:'Good',basis:'selective-estimate',facts:{},candidates:[]}]);
 assert.deepEqual(D.filterEvents(d,{category:'provisional'}).map(e=>e.index),[0]);
 assert.deepEqual(D.filterEvents(d,{side:'white'}).map(e=>e.index),[1]);
});
test('full-game after verified loss does not use calibrated percentages',()=>{
 const d=D.summarize(positions,[estimate({basis:'verified-proof',refutation:proof}),null],checked);
 assert.equal(d.events[0].bucket,'verified');assert.equal(d.events[1].bucket,'unresolved');
 assert.ok(!d.scope.includes('90%'));assert.equal(d.nextReview,0);
});
console.log(n+' A4 game diagnosis regressions passed');
