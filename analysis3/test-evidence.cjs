'use strict';
/* R4 evidence-boundary tests; pure Node, zero external dependencies. */
const assert=require('node:assert/strict');
const {analyzeMove,compareDecision,compareScores,certified}=require('./evidence-gate.js');
const empty=()=>Array(225).fill(0);
const board=empty();board[112]=1;board[113]=2;
const legal=(b,c,r,m)=>m===-1?{legal:true,win:false}:b[m]?{legal:false,reason:'occupied'}:{legal:true,win:false};
const cert=(b,attacker,move=114,rule='freestyle')=>({rule,attacker,position:b.slice(),upperBoundPlies:5,
  proof:{move},referenceBoard:b.join(''),valid:true});
const verify=c=>c.valid===true&&c.referenceBoard===c.position.join('');
const evaluate=(move,extra={})=>analyzeMove({board,side:1,rule:'freestyle',move,legalMove:legal,verifyCertificate:verify,...extra});
let passed=0;
function test(label,run){run();passed++;console.log('PASS '+label);}
test('illegal occupied point never receives evidence-based ranking',()=>{
  const r=evaluate(112,{score:999999,scoreComparable:true});assert.equal(r.kind,'illegal');assert.equal(r.score,null);
});
test('malformed input fails closed rather than being scored',()=>{
  assert.throws(()=>analyzeMove({board:[1,2],side:1,rule:'freestyle',move:111,legalMove:legal}),/Invalid board/);
});
test('root certificate must match rule, color and exact board',()=>{
  const c=cert(board,1);assert.equal(certified(c,board,1,'freestyle',verify),true);
  assert.equal(certified(c,board,2,'freestyle',verify),false);
  assert.equal(certified(c,board,1,'exact-five',verify),false);
  const stale=board.slice();stale[5]=2;assert.equal(certified(c,stale,1,'freestyle',verify),false);
});
test('unverified claimed proof is never enough for a verified win',()=>{
  const c=cert(board,1);c.valid=false;
  assert.equal(evaluate(114,{ownCertificate:c}).kind,'unknown');
});
test('verified root proof must begin at the candidate actually played',()=>{
  const c=cert(board,1,114);assert.equal(evaluate(114,{ownCertificate:c}).kind,'verified-win');
  assert.equal(evaluate(115,{ownCertificate:c}).kind,'unknown');
});
test('opponent proof is verified only against the complete after-position',()=>{
  const after=board.slice();after[115]=1;
  assert.equal(evaluate(115,{opponentCertificate:cert(after,2)}).kind,'verified-loss');
  assert.equal(evaluate(116,{opponentCertificate:cert(after,2)}).kind,'unknown');
});
test('mutated certificate cannot validate a losing after-position',()=>{
  const after=board.slice();after[115]=1;const c=cert(after,2);c.proof.move=100;c.valid=false;
  assert.equal(evaluate(115,{opponentCertificate:c}).kind,'unknown');
});
test('losing after-position alone is not labeled an avoidable blunder',()=>{
  const after=board.slice();after[115]=1;
  const loss=evaluate(115,{opponentCertificate:cert(after,2)});
  assert.deepEqual(compareDecision(loss,[]).avoidable,null);
  assert.equal(compareDecision(loss,[]).kind,'loss-after-move');
});
test('separately proved winning alternative establishes an avoidable loss',()=>{
  const after=board.slice();after[115]=1;
  const loss=evaluate(115,{opponentCertificate:cert(after,2)}),win=evaluate(114,{ownCertificate:cert(board,1,114)});
  assert.equal(compareDecision(loss,[win]).kind,'avoidable-loss');
  assert.equal(compareDecision(loss,[win]).avoidable,true);
});
test('blocking a single known threat remains unproven safety',()=>{
  const attack=cert(board,2,114);
  const r=evaluate(114,{rootThreatCertificate:attack});
  assert.equal(r.kind,'blocks-known-threat');assert.equal(r.verified,false);assert.equal(r.score,null);
  assert.match(r.reason,/other attacks remain unresolved/);
});
test('a comparable search estimate is explicitly not a proof',()=>{
  const estimate=evaluate(114,{score:13,scoreComparable:true});
  assert.equal(estimate.kind,'estimate');assert.equal(estimate.verified,false);
  assert.equal(evaluate(114,{score:13,scoreComparable:false}).kind,'unknown');
});
test('only comparable estimates have score differences',()=>{
  const a=evaluate(114,{score:10,scoreComparable:true}),b=evaluate(115,{score:3,scoreComparable:true});
  assert.equal(compareScores(a,b),7);assert.equal(compareScores(a,evaluate(116)),null);
});
test('the only observed winning move wins under an explicit legal-rule verdict',()=>{
  const win=evaluate(114,{legalMove:()=>({legal:true,win:true})});
  assert.equal(win.kind,'verified-win');assert.equal(win.claim,'Immediate legal win');
});
test('a pass remains a legal, unproven choice when rule engine allows it',()=>{
  assert.equal(evaluate(-1).kind,'unknown');
  assert.equal(evaluate(-1,{legalMove:()=>({legal:false,reason:'pass forbidden'})}).kind,'illegal');
});
console.log(passed+' Analysis 3.0 evidence contract tests passed');
