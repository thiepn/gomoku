from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="library2-core"','id="library2-style"','id="library2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="opening2-runtime"')<html.index('id="library2-runtime"')
assert 'library-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuLibrary2','libraryState','reviewDigest','openReviewedGame','openReviewCenter','lib2Home','Review Center','lib2Search']:
    assert marker in html,marker
print('PASS Gomoku 1.9 Library & Archive 2.0 integration contract.')
