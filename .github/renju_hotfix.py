from pathlib import Path
import re
import subprocess
import tempfile

path = Path('index.html')
s = path.read_text(encoding='utf-8')
original = s

# Main-board Renju: enforce forbidden moves only. Opening/swap procedures stay separate.
center_rule = "    if(renju&&moveCount===0&&!board.some(Boolean)&&i!==112) return invalid('opening-center');\n"
if s.count(center_rule) != 1:
    raise SystemExit(f'Expected exactly one Renju center-first restriction, found {s.count(center_rule)}')
s = s.replace(center_rule, '', 1)

old_rules = "'renju-practice':{label:'Renju practice',short:'Renju',description:'Black: exactly five; overlines, double-fours and genuine double-threes rejected. White: five or more. Center-first practice opening; no tournament swaps.'}"
new_rules = "'renju-practice':{label:'Renju',short:'Renju',description:'Black: exactly five; overlines, double-fours and genuine double-threes are forbidden. White: five or more.'}"
if s.count(old_rules) != 1:
    raise SystemExit(f'Expected exactly one Renju rules descriptor, found {s.count(old_rules)}')
s = s.replace(old_rules, new_rules, 1)

# Remove the obsolete opening foul from main-board messages.
s = s.replace("  'double-three':'Black cannot create two genuine threes.','opening-center':'Black opens at H8 in Renju practice.',\n", "  'double-three':'Black cannot create two genuine threes.',\n", 1)

# Correct the main-board UI copy without changing the separate opening/competition tools.
s = s.replace('15 × 15 · Renju practice', '15 × 15 · Renju', 1)
s = s.replace('Center-first opening', 'Black forbidden moves enforced', 1)
s = s.replace(
    'All modes use a 15 × 15 board. Renju practice opens at H8 and rejects Black fouls. The opening lab offers local swap/proposal procedures. Main-board Renju blocks fouls as practice; it is not a tournament referee. Optional clocks restore paused.',
    'All modes use a 15 × 15 board. Renju forbids Black overlines, double-fours and genuine double-threes; White is unrestricted by those fouls. Opening and swap procedures are separate tools and are not applied to the main-board Renju ruleset. Optional clocks restore paused.',
    1,
)
s = s.replace('In Renju practice, beginning near the center is the clearest starting point.', 'In Renju, beginning near the center is usually the clearest starting point.', 1)

# Prevent literal escaped newline sequences (for example "\\n\\n") from leaking into visible UI.
marker = 'renju-forbidden-hotfix-ui'
if marker not in s:
    ui_fix = r'''<script id="renju-forbidden-hotfix-ui">
(()=>{'use strict';
  const clean=v=>String(v??'').replace(/\\n\\n+/g,' ').replace(/\\n/g,' ');
  function scrub(root){
    if(!root)return;
    const nodes=[];
    if(root.nodeType===Node.TEXT_NODE)nodes.push(root);
    else if(root.nodeType===Node.ELEMENT_NODE){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())nodes.push(walker.currentNode);
    }
    for(const node of nodes){
      const tag=node.parentElement?.tagName;
      if(!tag||/^(SCRIPT|STYLE|TEXTAREA|PRE|CODE)$/.test(tag))continue;
      if(node.nodeValue?.includes('\\n'))node.nodeValue=clean(node.nodeValue);
    }
  }
  const start=()=>{
    scrub(document.body);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')scrub(record.target);
        else for(const node of record.addedNodes)scrub(node);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>
'''
    if '</body>' not in s:
        raise SystemExit('Could not find </body> insertion point')
    s = s.replace('</body>', ui_fix + '</body>', 1)

# Structural assertions.
if "opening-center" in re.search(r"function legalMove\(board,i,color,moveCount\)\s*\{[\s\S]*?\n  \}", s).group(0):
    raise SystemExit('Center-first Renju restriction still present in legalMove')
if "label:'Renju',short:'Renju'" not in s:
    raise SystemExit('Renju display metadata was not updated')
if marker not in s:
    raise SystemExit('Visible escaped-newline sanitizer was not inserted')

path.write_text(s, encoding='utf-8')

# Run focused regression tests against the actual rules engine embedded in the patched file.
html = s
match = re.search(r'<script id="rules-engine">([\s\S]*?)</script>', html)
if not match:
    raise SystemExit('rules-engine script not found')

test_js = match.group(1) + r'''
const assert=require('assert');
const e=createEngine('renju-practice');
const board=(black=[],white=[])=>{const b=new Int8Array(225);for(const i of black)b[i]=1;for(const i of white)b[i]=2;return b;};
let a;
a=e.legalMove(board(),0,1,0); assert.equal(a.legal,true,'Renju must allow a free Black first move');
a=e.legalMove(board([107,108,109,110,111]),112,1,5); assert.equal(a.legal,false); assert.equal(a.reason,'overline');
a=e.legalMove(board([109,110,111,67,82,97]),112,1,6); assert.equal(a.legal,false); assert.equal(a.reason,'double-four');
a=e.legalMove(board([111,113,97,127]),112,1,4); assert.equal(a.legal,false); assert.equal(a.reason,'double-three');
a=e.legalMove(board([108,109,110,111]),112,1,4); assert.equal(a.legal,true); assert.equal(a.win,true,'Black exact five must win');
a=e.legalMove(board([], [107,108,109,110,111]),112,2,5); assert.equal(a.legal,true); assert.equal(a.win,true,'White overline must remain legal and winning');
console.log('Renju forbidden-move regression checks passed');
'''
with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
    f.write(test_js)
    test_path = f.name
result = subprocess.run(['node', test_path], text=True, capture_output=True)
if result.returncode:
    print(result.stdout)
    print(result.stderr)
    raise SystemExit('Renju regression tests failed')
print(result.stdout.strip())
print('Patched index.html successfully')
