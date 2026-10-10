/* A17 operator release-operations desk: strictly documentary checks, never a release API. */
'use strict';
const G=require('./a17-operator-gate.cjs'),LOCK=require('./a10-source-lock.json');
function readiness({source,preview,physical,rollback,custody,ownerPacket,a12,realDeviceCount=0,
 authenticatedHumanKeys=0,cutover,postRelease}={}){
 const gates=[
  {id:'original-a9',status:source?.status==='original-ci-bytes-ready-for-independent-review'&&
    source.originalSourceSha===LOCK.sourceSha?'documented-ci-only':'blocked'},
  {id:'real-hosted-eight-assets',status:preview?.status==='preview-bytes-observed-unsigned'&&
    preview.sourceSha===LOCK.sourceSha&&preview.assets?.length===8?'requires-independent-witness':'blocked'},
  {id:'physical-18-cases',status:realDeviceCount===18&&
    physical?.status==='independently-reviewed-real-device-originals'?'requires-separate-human-signoff':'blocked'},
  {id:'controlled-pwa-and-rollback',status:rollback?.status==='independently-reviewed-previous-stable-restore'?
   'requires-separate-human-signoff':'blocked'},
  {id:'external-consumed-challenge',status:custody?.status==='independent-custody-documents-ready-for-human-review'?
   'requires-real-external-authentication':'blocked'},
  {id:'independent-human-keys',status:authenticatedHumanKeys>=3?
   'requires-original-key-fingerprint-review':'blocked'},
  {id:'owner-release-decision',status:ownerPacket?.status==='ready-for-separate-human-release-decision'?
   'separate-owner-action-required':'blocked'},
  {id:'a12-executed-cutover',status:cutover?.status==='completed-production-cutover'&&
   a12?.status==='manual-review-only'?'requires-actual-independent-verification':'blocked'},
  {id:'a13-real-postrelease-monitoring',status:postRelease?.status==='ready-for-manual-stability-review'?
   'requires-independent-original-evidence':'blocked'}
 ];
 return G.result('human-approval-and-production-operation-open',
  'A17 dashboard never authorizes merge, deployment, rollback, migration, release or closure. Real human/device/source inspection remains required.',
  {gates,readiness:'HOLD',automatedProductionApproval:false});
}
module.exports={readiness};
