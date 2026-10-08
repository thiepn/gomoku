from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();cache=(ROOT/'client-cache-version.txt').read_text().strip();sw=(ROOT/'sw.js').read_text()
for marker in ['id="player2-core"','id="player2-style"','id="player2-runtime"']:
    assert html.count(marker)==1,marker
assert html.index('id="library2-runtime"')<html.index('id="player2-runtime"')
assert 'player-2.0.0' in cache
assert "const CACHE_NAME = '"+cache+"';" in sw
for marker in ['GomokuPlayer2','GomokuPlayer2Core','pj2Home','pj2JourneyTool','Player Journey','GomokuLearningV11','GomokuLibrary2','GomokuOpening2','GomokuOnline2','GomokuCompetitive2','journey']:
    assert marker in html,marker
runtime=(ROOT/'player2/runtime.js').read_text()
assert 'showHome(false)' not in runtime,'Play must be the first screen.'
assert 'pj2HomeNav' not in runtime,'Journal cannot be a fourth primary route.'
assert 'reconcile(' in runtime and 'replaceChildren(...summary.stages' not in runtime,'Stable, focus-safe cards required.'
print('PASS Gomoku R1 game-first Player Journey integration contract.')
