import fs from 'node:fs';
import process from 'node:process';

const api=String(process.env.GOMOKU_ROOM_API||'').replace(/\/$/,'');
const supabase=String(process.env.P23_SUPABASE_URL||'').replace(/\/$/,'');
const anon=String(process.env.GOMOKU_ROOM_KEY||'');
const service=String(process.env.P23_SERVICE_KEY||'');
const evidencePath=String(process.env.P23_EVIDENCE_FILE||'/tmp/p23-adversarial-evidence.json');
if(!api||!supabase||!anon||!service)throw new Error('P23 local Supabase API, anon key, service key and gomoku-room API are required.');

const checks=[];
const record=(name,ok,details={})=>{checks.push({name,ok,...details});if(!ok)throw new Error('P23 failed: '+name+' '+JSON.stringify(details));console.log('PASS '+name);};
const randomToken=(prefix='tok')=>prefix+'_'+crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const jsonHeaders=(key=anon)=>({apikey:key,'content-type':'application/json'});

async function request(path,{method='GET',body,headers={}}={}){
  const res=await fetch(api+path,{method,headers:{apikey:anon,...headers,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:(typeof body==='string'?body:JSON.stringify(body))});
  let data=null;try{data=await res.json();}catch{}
  return {status:res.status,data,headers:Object.fromEntries(res.headers.entries())};
}
async function auth(path,{method='POST',body,token}={}){
  return request(path,{method,body,headers:{'x-gomoku-account-token':token}});
}
async function signup(label){
  const email='p23-'+label+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'@example.invalid';
  const password='P23-'+crypto.randomUUID()+'aA1!';
  let res=await fetch(supabase+'/auth/v1/signup',{method:'POST',headers:jsonHeaders(anon),body:JSON.stringify({email,password})});
  let data=await res.json();
  if(!res.ok)throw new Error('signup failed '+res.status+' '+JSON.stringify(data));
  if(!data.access_token){
    res=await fetch(supabase+'/auth/v1/token?grant_type=password',{method:'POST',headers:jsonHeaders(anon),body:JSON.stringify({email,password})});
    data=await res.json();
  }
  if(!res.ok||!data.access_token||!data.user?.id)throw new Error('local auth session unavailable '+res.status+' '+JSON.stringify(data));
  return {id:data.user.id,token:data.access_token,email};
}
async function serviceRest(path,{method='POST',body,prefer='resolution=merge-duplicates,return=minimal'}={}){
  const res=await fetch(supabase+'/rest/v1/'+path,{method,headers:{...jsonHeaders(service),Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  if(!res.ok)throw new Error('service REST '+path+' -> '+res.status+' '+await res.text());
}
async function bootstrapShared(){
  await serviceRest('account_apps?on_conflict=slug',{body:{slug:'gomoku',name:'Gomoku',description:'P23 local security fixture',path:'/gomoku/',active:true}});
  await serviceRest('account_app_permissions?on_conflict=app_slug,permission_id',{body:{app_slug:'gomoku',permission_id:'identity.basic',name:'Basic identity',description:'P23 local fixture',required:true,mutable_by_user:false,sensitivity:'basic',active:true}});
}
async function connect(user,username){
  await serviceRest('account_app_connections?on_conflict=user_id,app_slug',{body:{user_id:user.id,app_slug:'gomoku',status:'connected',source:'account'}});
  await serviceRest('account_app_grants?on_conflict=user_id,app_slug,permission_id',{body:{user_id:user.id,app_slug:'gomoku',permission_id:'identity.basic',status:'granted',granted_at:new Date().toISOString()}});
  await serviceRest('leaderboard_profiles?on_conflict=user_id',{body:{user_id:user.id,username,username_normalized:username.toLowerCase()}});
}

await bootstrapShared();
const a=await signup('a'),b=await signup('b');
await connect(a,'P23Alice');
await connect(b,'P23Bob');

const noAccount=await request('/api/ranked/me',{method:'POST',body:{}});
record('account endpoint rejects anonymous caller',noAccount.status===401,{status:noAccount.status});
const badAccount=await auth('/api/ranked/me',{body:{},token:'definitely-not-a-jwt'});
record('account endpoint rejects malformed account token',badAccount.status===401,{status:badAccount.status});
const me=await auth('/api/ranked/me',{body:{},token:a.token});
record('connected local account can reach its own account endpoint',me.status===200&&me.data?.username==='P23Alice',{status:me.status});

const admin=await auth('/api/admin/overview',{method:'GET',token:a.token});
record('ordinary connected account cannot become administrator',admin.status===403,{status:admin.status});

const fakeJwt='eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJpc3MiOiJodHRwczovL3Rva2VuLmFjdGlvbnMuZ2l0aHVidXNlcmNvbnRlbnQuY29tIn0.ZmFrZQ';
const automation=await request('/api/automation/admission',{method:'POST',body:{gitSha:'0'.repeat(40),checks:{}},headers:{authorization:'Bearer '+fakeJwt}});
record('forged GitHub automation JWT is rejected',automation.status===401,{status:automation.status});

const historyA=randomToken('histA').slice(0,64),historyB=randomToken('histB').slice(0,64);
const created=await auth('/api/rooms',{body:{id:'P23-ROOM-A',name:'ignored',historyToken:historyA},token:a.token});
record('fixture room A created',created.status===201&&created.data?.token,{status:created.status});
const roomA=created.data.id,hostToken=created.data.token;

const bolaBefore=await auth('/api/rooms/'+roomA,{method:'GET',token:b.token});
record('account B cannot read account A room before joining',bolaBefore.status===401,{status:bolaBefore.status});

const joined=await auth('/api/rooms/'+roomA+'/join',{body:{name:'ignored',historyToken:historyB},token:b.token});
record('fixture user B joins room A',joined.status===200&&joined.data?.token,{status:joined.status});
const guestToken=joined.data.token;

const randomBearer=await request('/api/rooms/'+roomA,{headers:{authorization:'Bearer '+randomToken('wrong')}});
record('random room capability cannot read a room',randomBearer.status===401,{status:randomBearer.status});
const randomAction=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'move',i:112,revision:joined.data.state.revision,gameVersion:joined.data.state.gameVersion,commandId:'p23-wrong-0001'},headers:{authorization:'Bearer '+randomToken('wrong')}});
record('random room capability cannot mutate a room',randomAction.status===401,{status:randomAction.status});

const second=await auth('/api/rooms',{body:{id:'P23-ROOM-B',historyToken:randomToken('histC').slice(0,64)},token:b.token});
record('fixture room B created',second.status===201&&second.data?.token,{status:second.status});
const cross=await request('/api/rooms/'+second.data.id,{headers:{authorization:'Bearer '+hostToken}});
record('room A capability cannot read room B',cross.status===401,{status:cross.status});

const move=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'move',i:112,revision:joined.data.state.revision,gameVersion:joined.data.state.gameVersion,commandId:'p23-move-0001'},headers:{authorization:'Bearer '+hostToken}});
record('authorized host move succeeds',move.status===200&&move.data?.game?.moves?.length===1,{status:move.status});
const replay=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'move',i:112,revision:joined.data.state.revision,gameVersion:joined.data.state.gameVersion,commandId:'p23-move-0001'},headers:{authorization:'Bearer '+hostToken}});
record('duplicate command id is idempotent',replay.status===200&&replay.data?.game?.moves?.length===1,{status:replay.status,moves:replay.data?.game?.moves?.length});
const stale=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'move',i:113,revision:joined.data.state.revision,gameVersion:joined.data.state.gameVersion,commandId:'p23-stale-0001'},headers:{authorization:'Bearer '+guestToken}});
record('stale revision cannot race a committed action',stale.status===409,{status:stale.status});

const chat=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'chat',text:'<img src=x onerror=alert(1)>',revision:move.data.revision,gameVersion:move.data.gameVersion,commandId:'p23-chat-0001'},headers:{authorization:'Bearer '+hostToken}});
record('player chat fixture succeeds',chat.status===200,{status:chat.status});
const spectator=await request('/api/rooms/'+roomA+'/spectate?viewer=P23SPECTATOR1234');
record('public spectator view works without player capability',spectator.status===200&&spectator.data?.role==='spectator',{status:spectator.status});
record('spectator response does not disclose player chat',Array.isArray(spectator.data?.state?.chat)&&spectator.data.state.chat.length===0,{chat:spectator.data?.state?.chat});

const resign=await request('/api/rooms/'+roomA+'/action',{method:'POST',body:{action:'resign',revision:chat.data.revision,gameVersion:chat.data.gameVersion,commandId:'p23-resign-0001'},headers:{authorization:'Bearer '+guestToken}});
record('fixture match can complete',resign.status===200&&resign.data?.game?.result,{status:resign.status});
const history=await request('/api/history',{method:'POST',body:{historyToken:historyA,limit:10}});
record('valid history capability returns completed match',history.status===200&&Array.isArray(history.data?.matches)&&history.data.matches.some(x=>x.roomId===roomA),{status:history.status,count:history.data?.matches?.length});
const match=history.data.matches.find(x=>x.roomId===roomA);
const wrongHistory=randomToken('wronghist').slice(0,64);
const historyBola=await request('/api/history/'+encodeURIComponent(roomA)+'/'+match.gameVersion,{method:'POST',body:{historyToken:wrongHistory}});
record('unrelated history capability cannot read another saved match',historyBola.status===403,{status:historyBola.status});

const malformed=await request('/api/history',{method:'POST',body:'{"historyToken":'});
record('malformed JSON returns 400',malformed.status===400,{status:malformed.status});

const huge='{"historyToken":"'+('A'.repeat(40000))+'"}';
const stream=new ReadableStream({
  start(controller){
    const bytes=new TextEncoder().encode(huge);
    controller.enqueue(bytes.slice(0,16000));
    controller.enqueue(bytes.slice(16000));
    controller.close();
  }
});
const oversizedRes=await fetch(api+'/api/history',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:stream,duplex:'half'});
record('chunked body without Content-Length is bounded at 32 KiB',oversizedRes.status===413,{status:oversizedRes.status,contentLengthSent:false});

const unknown=await request('/api/definitely-not-a-route');
record('unknown route fails closed',unknown.status===404,{status:unknown.status});
const wrongMethod=await request('/api/admin/overview',{method:'POST',body:{}});
record('wrong method does not bypass admin routing',wrongMethod.status===404,{status:wrongMethod.status});

const evidence={version:'p23.adversarial.v1',passed:checks.every(x=>x.ok),checks,generatedAt:new Date().toISOString()};
fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
