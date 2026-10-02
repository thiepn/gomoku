import fs from 'node:fs';
import process from 'node:process';

const api=String(process.env.GOMOKU_ROOM_API||'').replace(/\/$/,'');
const key=String(process.env.GOMOKU_ROOM_KEY||'');
const fixtureId=String(process.env.P18_FIXTURE_ROOM||'P18-DR-FIXTURE').toUpperCase();
if(!api||!key)throw new Error('GOMOKU_ROOM_API and GOMOKU_ROOM_KEY are required.');

async function req(path,{method='GET',body,token,ok=[200,201]}={}){
  const res=await fetch(api+path,{
    method,
    headers:{
      apikey:key,
      'content-type':'application/json',
      ...(token?{authorization:'Bearer '+token}:{})
    },
    body:body===undefined?undefined:JSON.stringify(body)
  });
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status))throw new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));
  return data;
}
async function main(){
  const mode=String(process.argv[2]||'').toLowerCase();
  if(mode==='create'){
    const existing=await req('/api/rooms');
    if((existing.rooms||[]).some(x=>x.id===fixtureId)){
      console.log(JSON.stringify({roomId:fixtureId,alreadyPresent:true},null,2));return;
    }
    const created=await req('/api/rooms',{method:'POST',body:{id:fixtureId,name:'P18 Recovery Fixture'}});
    fs.writeFileSync('/tmp/p18-recovery-fixture.json',JSON.stringify({
      roomId:fixtureId,token:created.token,revision:created.state?.revision||0
    },null,2));
    console.log(JSON.stringify({roomId:fixtureId,created:true},null,2));return;
  }
  if(mode==='verify'){
    const rooms=(await req('/api/rooms')).rooms||[];
    const room=rooms.find(x=>x.id===fixtureId);
    if(!room)throw new Error('Recovered fixture room is missing.');
    if(Number(room.playerCount)!==1)throw new Error('Recovered fixture player count is invalid.');
    console.log(JSON.stringify({roomId:fixtureId,recovered:true,playerCount:room.playerCount},null,2));return;
  }
  throw new Error('Usage: node operations/p18-local-fixture.mjs <create|verify>');
}
main().catch(error=>{console.error(error?.stack||String(error));process.exit(1);});
