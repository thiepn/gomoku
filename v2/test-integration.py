from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="gomoku-v2-core"','id="gomoku-v2-style"','id="gomoku-v2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="library2-runtime"')<html.index('id="gomoku-v2-runtime"')
assert 'gomoku-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuV2','journey:safe(()=>api?.journey?.()','GomokuLearningV11','GomokuCourse2','GomokuLibrary2','GomokuOpening2','GomokuCompetitive2','GomokuOnline2','v2Home','v2HomeNav']:
    assert marker in html,marker
print('PASS Gomoku 2.0 Unified Player Journey integration contract.')
