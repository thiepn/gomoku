import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const assert=(v,m)=>{if(!v)throw new Error(m);};
for(const marker of [
  "ROOM_HISTORY_KEY='gomoku.room.history.v1'",
  'YOUR MATCH HISTORY',
  'function refreshMatchHistory',
  'function openSavedMatch',
  'function copySavedMatch',
  'historyToken:roomHistoryToken()'
]) assert(html.includes(marker),'missing P5 UI marker: '+marker);
assert((html.match(/id="roomHistoryList"/g)||[]).length===1,'match-history list must be mounted exactly once');
assert((html.match(/id="room-history-p5"/g)||[]).length===1,'match-history style block must be unique');
const pos=html.indexOf("ROOM_HISTORY_KEY='gomoku.room.history.v1'");
const start=html.lastIndexOf('<script',pos),open=html.indexOf('>',start),end=html.indexOf('</script>',pos);
assert(start>=0&&open>start&&end>pos,'could not isolate online-room script');
const js=html.slice(open+1,end);
new Function(js);
console.log('PASS P5 history UI source: unique mount, credential wiring, review/copy controls, and online-room script syntax.');
