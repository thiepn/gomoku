"""R2 runtime performance regression checks and portable artifact consistency."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
assert (ROOT/'index.html').stat().st_size <= 3_500_000,'Portable HTML exceeded reviewed 3.5 MB size ceiling'
modules={'online2':'online2/runtime.js','course2':'course2/runtime.js','learning-intelligence':'learning/runtime.js','player2':'player2/runtime.js'}
for tag,path in modules.items():
    source=(ROOT/path).read_text()
    assert '<script id="'+tag+'-runtime">\n'+source+'\n</script>' in html,tag+' source and bundled runtime must match'
    assert 'if(!document.hidden' in source,tag+' must suppress hidden-tab polling'
online=(ROOT/'online2/runtime.js').read_text()
assert '},4000);' in online and '},400);' not in online,'Online 400ms hot-loop must be eliminated'
assert "node?.id==='workbenchDialog'" in online,'Mutation handling must be scoped to online workbench'
course=(ROOT/'course2/runtime.js').read_text()
assert '},10000);' in course and 'lastStructure=structure()' in course,'Course polling and redundant DOM replacement must be bounded'
learning=(ROOT/'learning/runtime.js').read_text()
assert '},8000);' in learning and '},2500);' not in learning,'Learning should not continuously recompute every 2.5s'
player=(ROOT/'player2/runtime.js').read_text()
assert "if(document.body.dataset.pj2Route!=='home')return;" in player,'Board move should not recompute hidden journal'
assert '},8000);' in player,'Journal safety polling should be reduced'
print('PASS R2 guarded timers, workbench scope, source embedding and 3.5 MB size ceiling.')
