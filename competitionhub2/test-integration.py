from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="competitionhub2-core"','id="competitionhub2-style"','id="competitionhub2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="competitive2-runtime"')<html.index('id="competitionhub2-runtime"')
assert 'competitionhub-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuCompetitionHub2','Competition hub','Local competitive','Ranked Renju','Seasons & tournaments','Players & challenges','Casual rooms']:
    assert marker in html,marker
print('PASS Gomoku 1.7 Competition Hub 2.0 integration contract.')
