from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="competitive2-core"','id="competitive2-style"','id="competitive2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="postgame2-runtime"')<html.index('id="competitive2-runtime"')
assert 'competitive-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuCompetitive2','competitivePlay','cp2Series','MATCH CONTINUES','Review this game']:
    assert marker in html,marker
print('PASS Gomoku 1.6 Competitive Play 2.0 integration contract.')
