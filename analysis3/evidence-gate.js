/* Analysis 3.0 R4: pure, fail-closed evidence boundary.
 * NOT wired into the shipped application until an integration milestone.
 * It accepts independent rule and certificate verifiers; never trusts a
 * "proven" label, heuristic score, or principal variation by itself.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.GomokuEvidenceGate=api;
})(typeof globalThis==='object'?globalThis:null,function(){
  'use strict';
  const RULES=new Set(['freestyle','exact-five','renju-practice']);
  const point=i=>Number.isInteger(i)&&i>=0&&i<225;
  const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===225&&b.length===225&&a.every((x,i)=>x===b[i]);
  function validBoard(board){
    if(!Array.isArray(board)||board.length!==225||!board.every(x=>x===0||x===1||x===2))
      throw Error('Invalid board for evidence verification');
  }
  function certified(cert,board,attacker,rule,verifyCertificate){
    if(!cert||cert.rule!==rule||cert.attacker!==attacker||!same(cert.position,board)||
       !cert.proof||!Number.isInteger(cert.upperBoundPlies)||cert.upperBoundPlies<1||
       typeof verifyCertificate!=='function')return false;
    try{return verifyCertificate(cert)===true;}catch{return false;}
  }
  function analyzeMove({board,side,rule,move,legalMove,verifyCertificate,
                         ownCertificate=null,opponentCertificate=null,rootThreatCertificate=null,
                         score=null,scoreComparable=false}){
    validBoard(board);
    if(!RULES.has(rule)||![1,2].includes(side))throw Error('Invalid rule or side for evidence');
    if(!point(move)&&move!==-1)throw Error('Invalid move coordinate');
    if(typeof legalMove!=='function')throw Error('Rule-engine legality verifier required');
    // The injected rule engine checks pass, opening policy, forbidden moves and terminals.
    let status;
    try{status=legalMove(board,side,rule,move);}catch{status=null;}
    if(!status||status.legal!==true)
      return {move,kind:'illegal',claim:'Illegal under the selected rules',verified:false,score:null,reason:status?.reason||'The rule verifier rejected the move.'};
    if(status.win===true)
      return {move,kind:'verified-win',claim:'Immediate legal win',verified:true,score:null,reason:'The move wins by the selected game rules.'};
    const after=board.slice();
    if(point(move))after[move]=side;
    // A certificate from the *root* must prove THIS candidate as its first move.
    if(certified(ownCertificate,board,side,rule,verifyCertificate)&&ownCertificate.proof.move===move)
      return {move,kind:'verified-win',claim:'Verified forcing win',verified:true,score:null,reason:'An independently validated attack covers required defenses.'};
    // A certificate after our move proves that AFTER-POSITION loses.
    if(certified(opponentCertificate,after,3-side,rule,verifyCertificate))
      return {move,kind:'verified-loss',claim:'Verified losing continuation',verified:true,score:null,reason:'The opponent has a validated winning strategy after this move. Avoidability is not established.'};
    // Rechecking the same root attack with the proposed move applied only shows
    // the recorded proof no longer applies; it does NOT prove survival.
    if(certified(rootThreatCertificate,board,3-side,rule,verifyCertificate)){
      const counterfactual={...rootThreatCertificate,position:after};
      let stillProven=false;
      try{stillProven=verifyCertificate(counterfactual)===true;}catch{}
      if(!stillProven)
        return {move,kind:'blocks-known-threat',claim:'Blocks a checked forcing line',verified:false,score:null,reason:'This known proof fails against the actual resulting board; other attacks remain unresolved.'};
    }
    const comparable=scoreComparable===true&&typeof score==='number'&&Number.isFinite(score);
    return {move,kind:comparable?'estimate':'unknown',claim:comparable?'Search estimate':'Insufficient evidence',verified:false,score:comparable?score:null,
      reason:comparable?'A comparable completed search estimate; not a calibrated win probability.':'No validated tactical outcome or comparable score.'};
  }
  function compareDecision(played,alternatives){
    if(!played||!Array.isArray(alternatives))throw Error('Missing decision evidence');
    const winning=alternatives.some(x=>x.kind==='verified-win');
    if(played.kind==='illegal')return {kind:'illegal',avoidable:null,message:'Move is illegal; no strategic score.'};
    if(played.kind==='verified-win')return {kind:'winning',avoidable:false,message:'The selected move has a proven winning outcome.'};
    if(played.kind==='verified-loss')return winning
      ? {kind:'avoidable-loss',avoidable:true,message:'This move permits a verified loss while a separately verified win was available.'}
      : {kind:'loss-after-move',avoidable:null,message:'Opponent win verified after this move; the evidence does not establish whether the loss was avoidable.'};
    if(winning)return {kind:'missed-verified-win',avoidable:true,message:'A separately proven winning alternative exists; the played move has no proven winning result.'};
    if(played.kind==='blocks-known-threat')return {kind:'defensive',avoidable:null,message:'The move interrupts a verified threat line but is not proven safe.'};
    return {kind:'unresolved',avoidable:null,message:'Do not assign a proof-level verdict from heuristic estimates.'};
  }
  function compareScores(a,b){
    return a?.kind==='estimate'&&b?.kind==='estimate'&&typeof a.score==='number'&&typeof b.score==='number'
      ? a.score-b.score : null;
  }
  return Object.freeze({validBoard,certified,analyzeMove,compareDecision,compareScores});
});
