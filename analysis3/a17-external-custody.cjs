/* A17 external custody integration contract. Read-only receipt inspection; no provider provisioning or network. */
'use strict';
const G=require('./a17-operator-gate.cjs'),A14=require('./a14-custody.cjs');
const A16=require('./a16-independent-custody.cjs'),Ledger=require('./a15-local-ledger.cjs');
const LOCK=require('./a10-source-lock.json'),ROOTS=require('./a16-witness-roots.json');
const SHA=/^[a-f0-9]{64}$/;
function review({approval,approved=false,local,independent,roots=ROOTS,
  clock=()=>new Date()}={}){
 const gate=G.validate({approval,approved,operation:'external-ledger-review',now:clock()});
 if(gate.status!=='scoped-document-only')return gate;
 let state;
 try{state=Ledger.validate(local);}catch(e){
  return G.result('blocked-local-ledger',String(e.message));
 }
 if(state.count<2||state.consumed.size<1)
  return G.result('blocked-consumption','No consumed original A15 challenge.');
 if(!independent||independent.format!=='GomokuA17IndependentCustodySnapshot'||
  independent.version!==17||independent.repository!=='thiepn/gomoku'||
  independent.originalSourceSha!==LOCK.sourceSha||
  independent.a16HeadSha!=='bb868a84d24f622f8f5dcab64756c803228db8d0'||
  independent.localLedgerDigest!==A14.sha(local)||
  independent.localLedgerHead!==local.head||
  !SHA.test(independent.externalRootDigest||'')||
  !SHA.test(independent.externalReceiptDigest||'')||
  independent.externalRootDigest===local.head||
  independent.externalReceiptDigest===independent.externalRootDigest||
  independent.disposition!=='append-only-custody-claimed'||
  independent.privatePlayerDataIncluded!==false||
  !Number.isSafeInteger(independent.sequence)||independent.sequence<2||
  !Array.isArray(independent.receipts)||independent.receipts.length!==2)
  return G.result('blocked-external-custody','No source-bound independent provider snapshot linked to A15 original records.');
 const [first,last]=independent.receipts,consumed=local.entries.at(-1);
 if(last?.action!=='consume'||first?.action!=='issue'||first.challenge!==consumed.challenge||
  last.challenge!==consumed.challenge||first.digest!==local.entries[0]?.digest||
  last.digest!==consumed.digest||first.sequence>=last.sequence||
  first.remoteTimestamp>=last.remoteTimestamp||
  last.remoteTimestamp!==independent.observedAt||
  Date.parse(independent.observedAt)>clock().getTime()+60000||
  !SHA.test(independent.externalReceiptDigest||''))
  return G.result('blocked-chronology','Original challenge issue/consume chronology differs from independent snapshot.');
 const w=A16.verifySigned({envelope:independent.witness,
  kind:'replay-ledger',payload:independent.witness?.payload,
  rolesRequired:['external-ledger-custodian','independent-evidence-reviewer'],roots});
 if(w.status!=='signed-documents-only')return G.result('blocked-external-signature',w.reason||w.status);
 const p=independent.witness.payload;
 if(p.externalReceiptDigest!==independent.externalReceiptDigest||
  p.externalRootDigest!==independent.externalRootDigest||
  p.localLedgerDigest!==independent.localLedgerDigest||
  p.localLedgerHead!==independent.localLedgerHead||
  p.originalSourceSha!==LOCK.sourceSha||
  p.challenge!==consumed.challenge||
  p.packetDigest!==consumed.packetDigest||
  p.deploymentId!==consumed.deploymentId)
  return G.result('blocked-external-binding','Detached independent witness is not source-bound to exact local challenge and remote custody.');
 return G.result('independent-custody-documents-ready-for-human-review',
  'Signed, source-scoped external ledger documentation reconciles. Provider append-only enforcement and independent real-world signatures remain unverified here.',
  {externalReceiptDigest:independent.externalReceiptDigest,localLedgerHead:local.head,
   replayConsumptionIndependentlyCertified:false});
}
module.exports={review};
