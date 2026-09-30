import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const assert=(v,m)=>{if(!v)throw new Error(m);};
for(const marker of [
  'room-profile-p6',
  'roomAccountPanel',
  'function roomAuthClient',
  'function connectGomokuAccount',
  'function openPlayerProfile',
  'function bindRoomProfileName',
  'X-Gomoku-Account-Token',
  "action:'link_identity'",
  'sb-hycegznamzjhwinegaai-auth-token',
  'https://account.thiepn.dev/apps/gomoku'
])assert(html.includes(marker),'missing P6 UI marker: '+marker);
assert((html.match(/id="room-profile-p6"/g)||[]).length===1,'P6 style block must be unique');
const pos=html.indexOf("const ROOM_PROJECT_URL=");
const start=html.lastIndexOf('<script',pos),open=html.indexOf('>',start),end=html.indexOf('</script>',pos);
assert(start>=0&&open>start&&end>pos,'could not isolate online-room script');
new Function(html.slice(open+1,end));
console.log('PASS P6 identity/profile UI source: unique styles, auth wiring, account-token separation, profile actions, and online script syntax.');
