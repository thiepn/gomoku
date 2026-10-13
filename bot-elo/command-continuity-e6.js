/* Gomoku E6 command continuity.
 * Stores ONE pending human command envelope in sessionStorage, never a board,
 * result, rating, account token or second match history. The server owns all
 * moves/outcomes. Automatic replay is deliberately DISABLED after uncertainty:
 * users first reconcile the immutable server command receipt.
 */
(function(){
'use strict';
if(window.GomokuBotCommandE6)return;
const KEY='gomoku.bot.e6.pending-command.v1';
let volatile=null;
const VALID=/^[A-Za-z0-9._:-]{8,96}$/,UUID=/^[a-f0-9-]{36}$/i;
function owner(){
 const a=window.GomokuCompetitionBridge?.account?.();
 return a?.connected===true&&typeof a.userId==='string'&&
   /^[0-9a-f-]{36}$/i.test(a.userId)?a.userId:null;
}
function safeRead(){
 let raw=null;
 try{raw=sessionStorage.getItem(KEY);}catch{}
 if(!raw&&volatile)raw=JSON.stringify(volatile);
 if(!raw)return null;
 try{
   const p=JSON.parse(raw);
   if(!p||p.version!=='e6.1'||!UUID.test(p.matchId)||!VALID.test(p.commandId)||
     typeof p.owner!=='string'||!Number.isSafeInteger(p.revision)||
     p.revision<0||!['move','resign'].includes(p.action)||
     (p.action==='move'&&(!Number.isInteger(p.i)||p.i< -1||p.i>224))||
     typeof p.issuedAt!=='number')throw Error('Invalid saved command');
   if(Date.now()-p.issuedAt>7*24*60*60*1000)return null;
   return p;
 }catch{return null;}
}
function save(p){
 volatile=p;
 try{sessionStorage.setItem(KEY,JSON.stringify(p));}catch{}
}
function clear(){
 volatile=null;
 try{sessionStorage.removeItem(KEY);}catch{}
}
function pending(){
 const p=safeRead(),active=owner();
 // THIEPN OAuth may still be restoring when the standalone scripts boot.
 // Keep the envelope unread until identity is resolved; never replay it as guest.
 if(!active)return null;
 if(!p)return null;
 if(p.owner!==active){clear();return null;}
 return {...p};
}
function prepare(match,action,i){
 const existing=pending();
 if(existing)throw Error('A previous move is awaiting server confirmation. Resolve it before playing again.');
 const who=owner();
 if(!who)throw Error('Connect the original THIEPN Account before sending a verified move.');
 if(!match?.id||match.status!=='active'||!Number.isSafeInteger(match.revision))
   throw Error('There is no active verified match.');
 const p={version:'e6.1',matchId:match.id,commandId:crypto.randomUUID?
   crypto.randomUUID():[Date.now().toString(36),Math.random().toString(36).slice(2)].join('-'),
   owner:who,revision:match.revision,action,i:action==='resign'?null:i,issuedAt:Date.now()};
 save(p);return {...p};
}
async function inspect(transport,match){
 const p=pending();
 if(!p)return {status:'clear',pending:null,match};
 if(!transport?.accountGet||!match||p.matchId!==match.id)
   return {status:'different-match',pending:p,match};
 try{
   const response=await transport.accountGet('/api/bot-matches/'+encodeURIComponent(p.matchId)+
     '/commands/'+encodeURIComponent(p.commandId));
   if(!response?.match)throw Error('Missing verified recovery state.');
   if(response.state==='applied'){
     clear();return {status:'applied',pending:null,match:response.match,appliedRevision:response.appliedRevision};
   }
   if(response.state!=='unknown')throw Error('Unexpected recovery result.');
   if(response.match.status!=='active'||Number(response.match.revision)!==p.revision){
     // Do not replay a stale command over another tab's legitimate move.
     clear();return {status:'stale',pending:null,match:response.match};
   }
   return {status:'unconfirmed',pending:p,match:response.match};
 }catch(e){
   return {status:'unreachable',pending:p,match,error:String(e?.message||'Unable to reach match server')};
 }
}
async function retry(transport){
 const p=pending();
 if(!p)throw Error('No preserved command remains.');
 if(!transport?.accountPost)throw Error('Account API is not connected.');
 return transport.accountPost('/api/bot-matches/'+encodeURIComponent(p.matchId)+'/action',{
   commandId:p.commandId,revision:p.revision,action:p.action,i:p.i
 });
}
function acknowledge(match){
 const p=pending();
 if(!p||!match||p.matchId!==match.id)return;
 // Successful server response with a revision advance is proof of acceptance.
 if(Number(match.revision)>p.revision)clear();
}
window.GomokuBotCommandE6=Object.freeze({version:'e6.1',prepare,pending,inspect,retry,acknowledge,clear,owner});
})();
