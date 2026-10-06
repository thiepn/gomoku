"""Static integration contract for Gomoku 1.2 Course 2.0."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
for tag,name,file in [
    ('script','course2-core','course2/core.js'),
    ('style','course2-style','course2/course2.css'),
    ('script','course2-runtime','course2/runtime.js'),
]:
    rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(rows)==1,f'Expected one {name}; found {len(rows)}'
    assert rows[0].strip()==(ROOT/file).read_text().strip(),f'Embedding/source mismatch: {file}'

assert html.index('id="learning-intelligence-runtime"')<html.index('id="course2-core"')
assert html.index('id="course2-core"')<html.index('id="course2-runtime"')

runtime=(ROOT/'course2/runtime.js').read_text()
for marker in [
    'gomoku.course2.transfer.v1',
    'Animated concept',
    'Try transfer',
    'prefers-reduced-motion',
    'GomokuLearningV11',
    'gomoku:course2-transfer',
    'GomokuCourse2',
]:
    assert marker in runtime,'Missing Course 2.0 runtime integration: '+marker

learning_core=(ROOT/'learning/core.js').read_text()
learning_runtime=(ROOT/'learning/runtime.js').read_text()
assert "input.transfer" in learning_core
assert "source:'course2'" in learning_core
assert "GomokuCourse2?.evidence" in learning_runtime
assert "gomoku:course2-transfer" in learning_runtime

cache=(ROOT/'client-cache-version.txt').read_text().strip()
assert 'course2-1.2.0' in cache
sw=(ROOT/'sw.js').read_text()
assert f"const CACHE_NAME = '{cache}';" in sw

print('PASS Gomoku 1.2 embeddings, transfer evidence, learning integration and cache boundary.')
