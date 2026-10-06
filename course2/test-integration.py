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

assert html.index('id="learning-intelligence-runtime"')<html.index('id="course2-runtime"')
assert html.index('id="course2-core"')<html.index('id="course2-runtime"')

runtime=(ROOT/'course2/runtime.js').read_text()
for marker in [
    'c20Journey','c20ConceptDialog','MASTERY CHECKPOINT','GomokuLearningV11',
    'GomokuCourseChapter','prefers-reduced-motion','TRANSFER CHECK','GomokuCourse2',
    'gomoku-course2-transfer-changed','decorateCatalog','is-static','c20-burst'
]:
    assert marker in runtime,'Missing Course 2.0 integration: '+marker

core=(ROOT/'course2/core.js').read_text()
for marker in [
    "VERSION='1.2.0'","Seeing the Board","Forks & Double Threats","Advanced Renju",
    "Expert Calculation","Full-Game Mastery","transferEvidence","cleanEvidence"
]:
    assert marker in core,'Missing Course 2.0 contract: '+marker

css=(ROOT/'course2/course2.css').read_text()
for marker in ['c20StoneIn','c20Draw','c20Pulse','c20CopyIn','c20Wrong','c20Burst','prefers-reduced-motion']:
    assert marker in css,'Missing motion/accessibility contract: '+marker

cache=(ROOT/'client-cache-version.txt').read_text().strip()
assert 'learning-1.1.0' in cache
assert 'course-2.0.0' in cache
sw=(ROOT/'sw.js').read_text()
assert f"const CACHE_NAME = '{cache}';" in sw
print('PASS Gomoku 1.2 Course 2.0 source embeddings and learning integration.')
