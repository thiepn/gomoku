import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const assert=(v,m)=>{if(!v)throw new Error(m);};
for(const marker of [
  'room-ranked-p7',
  'roomRankedPanel',
  'function startRankedQueue',
  'function pollRankedQueue',
  'function refreshRankedLeaderboard',
  'function queueNextRankedMatch',
  "accountBound",
  "Find next ranked match",
  "RANKED RENJU",
  "$('undoBtn').disabled=ranked||",
  "Find next ranked match"
])assert(html.includes(marker),'missing P7 UI marker: '+marker);
assert((html.match(/id="room-ranked-p7"/g)||[]).length===1,'P7 style block must be unique');
const pos=html.indexOf("const ROOM_PROJECT_URL=");
const start=html.lastIndexOf('<script',pos),open=html.indexOf('>',start),end=html.indexOf('</script>',pos);
assert(start>=0&&open>start&&end>pos,'could not isolate online-room script');
new Function(html.slice(open+1,end));
console.log('PASS P7 ranked UI source: unique styles, matchmaking/leaderboard wiring, account-bound restore, and script syntax.');
