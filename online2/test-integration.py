from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="online2-core"','id="online2-style"','id="online2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="competitive2-runtime"')<html.index('id="online2-runtime"')
assert 'online-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuOnline2','How do you want to play?','Tournaments & players','Play online','op2RoomContext']:
    assert marker in html,marker
print('PASS Gomoku 1.7 Online Play 2.0 integration contract.')
