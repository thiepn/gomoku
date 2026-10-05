"""Static integration contract for Gomoku 1.1 Learning Intelligence."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
for tag,name,file in [
    ('script','learning-intelligence-core','learning/core.js'),
    ('style','learning-intelligence-style','learning/learning.css'),
    ('script','learning-intelligence-runtime','learning/runtime.js'),
]:
    rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(rows)==1,f'Expected one {name}; found {len(rows)}'
    assert rows[0].strip()==(ROOT/file).read_text().strip(),f'Embedding/source mismatch: {file}'

assert html.index('id="learning-intelligence-core"')<html.index('id="learning-intelligence-runtime"')
runtime=(ROOT/'learning/runtime.js').read_text()
for marker in [
    "gomoku.studio.academy.v4",
    "GomokuMistakes",
    "GomokuCourseChapter",
    "startPracticeSession",
    "reviewReport",
    "gomoku-mistakes-changed",
    "v11LearningIntelligence",
    "li11ReviewPrescription",
    "li11ReviewAction",
    "skillPrescription",
    "openReviewCenter",
    "GomokuLearningV11",
]:
    assert marker in runtime,'Missing runtime integration: '+marker

core=(ROOT/'learning/core.js').read_text()
for marker in ['Immediate wins','Remote defense','VCF calculation','Opening flexibility','Full-game transfer','masteryReady','duePracticeIds','transferEvidence','mistakeIds','practiceMotif']:
    assert marker in core,'Missing skill graph/evidence concept: '+marker

browser=(ROOT/'learning/test-browser.py').read_text()
for marker in ['35 skills','duePractice','practiceMotif','practiceState','mobile learning surface']:
    assert marker in browser,'Missing browser acceptance coverage: '+marker

cache=(ROOT/'client-cache-version.txt').read_text().strip()
assert 'learning-1.1.0' in cache
sw=(ROOT/'sw.js').read_text()
assert f"const CACHE_NAME = '{cache}';" in sw
print('PASS Gomoku 1.1 source embeddings, learning integrations and cache boundary.')
