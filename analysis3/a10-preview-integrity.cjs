/* A10 preview origin and byte-integrity verification. No deployment or writes. */
'use strict';
const crypto=require('node:crypto');
const ASSETS=Object.freeze(['index.html','sw.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png']);
const SHA=/^[a-f0-9]{64}$/;
function previewUrl(value,{allowLocal=false}={}){
 let u;
 try{u=new URL(value)}catch{throw Error('Invalid candidate preview URL');}
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Preview URL must have clean root path and no credentials or parameters');
 const local=allowLocal&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname);
 if(!local&&(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app')||
     /(^|\.)((www|gomoku|thiepn)\.)?thiepn\.dev$/.test(u.hostname)))
   throw Error('Preview must use a dedicated HTTPS .vercel.app host; never production');
 if(!local&&(/^(?:www|api|gomoku)\.vercel\.app$/.test(u.hostname)||u.hostname==='vercel.app'))
   throw Error('Unscoped shared host not accepted');
 return u;
}
function validate(expected){
 if(!expected||!ASSETS.every(k=>SHA.test(expected.assets?.[k]||''))||
    !/^[a-f0-9]{40}$/.test(expected.sourceSha||''))
   throw Error('Missing immutable SHA-256 assets or source identity');
 if(!SHA.test(expected.offlineZipSha256||''))throw Error('Missing pinned immutable offline archive hash');
 return true;
}
async function probe(value,expected,{allowLocal=false,fetchFn=fetch}={}){
 validate(expected);const base=previewUrl(value,{allowLocal});
 let checks=[];
 for(const name of ASSETS){
   const url=new URL(name,base);
   const response=await fetchFn(url.toString(),{redirect:'manual',cache:'no-store',headers:{'x-a10-verify':'1'}});
   if(response.status!==200||response.redirected||response.url&&new URL(response.url).origin!==base.origin)
     throw Error('Preview returned non-200 or redirected asset: '+name);
   const body=Buffer.from(await response.arrayBuffer());
   const hash=crypto.createHash('sha256').update(body).digest('hex');
   if(hash!==expected.assets[name])throw Error('Live preview content diverges from A9 candidate: '+name);
   checks.push({path:name,sha256:hash,bytes:body.length});
 }
 return Object.freeze({url:base.origin+'/',sourceSha:expected.sourceSha,
   archiveSha256:expected.offlineZipSha256,verifiedAssets:checks,
   statement:'Live bytes match the A9 CI artifact. Physical-device acceptance and production release remain unverified.'});
}
module.exports=Object.freeze({ASSETS,previewUrl,validate,probe});
if(require.main===module){
 const fs=require('node:fs');
 (async()=>{
   const url=process.env.A10_PREVIEW_URL,receipt=process.env.A10_RECEIPT_PATH||'analysis10-test-output/a10-verified-preview.json';
   const result=await probe(url,JSON.parse(fs.readFileSync(receipt,'utf8')));
   const out='analysis10-test-output/a10-https-probe.json';
   fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
   console.log('PASS A10 live HTTPS preview hashes match all eight A9 signed candidate assets: '+result.url);
 })().catch(e=>{console.error(String(e));process.exitCode=1});
}
