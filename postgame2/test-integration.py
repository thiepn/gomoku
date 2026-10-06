from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
sw=(ROOT/'sw.js').read_text()
for marker in ['id="postgame2-core"','id="postgame2-style"','id="postgame2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="gamefeel2-runtime"')<html.index('id="postgame2-runtime"')
assert 'postgame-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
assert '#resultDialog #resultAnalyzeBtn,#resultDialog #resultCoachBtn{display:none!important}' in html
assert 'GomokuPostGame2' in html
assert 'GomokuReview' in html
assert 'Review key moments' in html
print('PASS Gomoku 1.5 Post-Game Experience 2.0 integration contract.')
