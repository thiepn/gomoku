"""Static integration contract for Gomoku 1.4 Game Feel 2.0."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1];html=(ROOT/'index.html').read_text()
for tag,name,file in [('script','gamefeel2-core','gamefeel2/core.js'),('style','gamefeel2-style','gamefeel2/gamefeel2.css'),('script','gamefeel2-runtime','gamefeel2/runtime.js')]:
    rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(rows)==1,f'Expected one {name}; found {len(rows)}'
    assert rows[0].strip()==(ROOT/file).read_text().strip(),f'Embedding/source mismatch: {file}'
assert html.index('id="ai2-runtime"')<html.index('id="gamefeel2-runtime"')
assert html.index('id="gamefeel2-core"')<html.index('id="gamefeel2-runtime"')
runtime=(ROOT/'gamefeel2/runtime.js').read_text()
for marker in ['gomoku:move','gomoku:result','gf2Layer','gf2Outcome','gf2ResultMeta','gf2-active-player','prefers-reduced-motion','microTone','navigator.vibrate']:
    assert marker in runtime,'Missing Game Feel 2.0 runtime contract: '+marker
css=(ROOT/'gamefeel2/gamefeel2.css').read_text()
for marker in ['gf2Impact','gf2Outcome','gf2WinPoint','gf2Fleck','gf2Rewind','gf2Reset','prefers-reduced-motion']:
    assert marker in css,'Missing Game Feel 2.0 visual contract: '+marker
core=(ROOT/'gamefeel2/core.js').read_text()
for marker in ["VERSION='1.4.0'","resultPlan","movePlan","particles","You win"]:
    assert marker in core,'Missing Game Feel 2.0 pure contract: '+marker
cache=(ROOT/'client-cache-version.txt').read_text().strip();assert 'ai-2.0.0' in cache and 'gamefeel-2.0.0' in cache
assert f"const CACHE_NAME = '{cache}';" in (ROOT/'sw.js').read_text()
print('PASS Gomoku 1.4 Game Feel 2.0 source embeddings and cache boundary.')
