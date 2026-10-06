"""Static integration contract for Gomoku 1.3 AI 2.0."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1];html=(ROOT/'index.html').read_text()
for tag,name,file in [('script','ai2-core','ai2/core.js'),('style','ai2-style','ai2/ai2.css'),('script','ai2-runtime','ai2/runtime.js')]:
 rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
 assert len(rows)==1,f'Expected one {name}; found {len(rows)}'
 assert rows[0].strip()==(ROOT/file).read_text().strip(),f'Embedding/source mismatch: {file}'
for marker in ['AI2_SEARCH_HOOK','AI2_CONFIG_HOOK','AI2_TELEMETRY_HOOK',"window.GomokuAI2?.effectiveLevel","window.GomokuAI2?.searchConfig","gomoku-ai2-search"]: assert marker in html,'Missing live AI 2.0 hook: '+marker
assert html.index('id="course2-runtime"')<html.index('id="ai2-runtime"') and html.index('id="ai2-core"')<html.index('id="ai2-runtime"')
runtime=(ROOT/'ai2/runtime.js').read_text()
for marker in ['Adaptive opponent','effectiveLevel','searchConfig','gomoku:move','finishGame','frozen','72%','28%']: assert marker in runtime,'Missing AI 2.0 runtime contract: '+marker
core=(ROOT/'ai2/core.js').read_text()
for marker in ["VERSION='1.3.0'","resolveAdaptive","tuneSearch","benchmarkSummary","need-more-games","cooldown"]: assert marker in core,'Missing AI 2.0 core contract: '+marker
cache=(ROOT/'client-cache-version.txt').read_text().strip();assert 'course-2.0.0' in cache and 'ai-2.0.0' in cache
assert f"const CACHE_NAME = '{cache}';" in (ROOT/'sw.js').read_text()
print('PASS Gomoku 1.3 AI 2.0 embeddings, live hooks and cache boundary.')
