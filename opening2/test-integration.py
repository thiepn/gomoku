from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="opening2-core"','id="opening2-style"','id="opening2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="online2-runtime"')<html.index('id="opening2-runtime"')
assert 'opening-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuOpening2','GomokuLearningV11','openDatabase','openRepertoire','GomokuCourseChapter11','os2Home','Source database','Opening concepts']:
    assert marker in html,marker
print('PASS Gomoku 1.8 Opening Study & Repertoire 2.0 integration contract.')
