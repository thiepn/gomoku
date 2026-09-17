"""Release invariants: preserve all rule, engine, lesson, and review modules."""
from pathlib import Path
import re,hashlib,json
ROOT=Path(__file__).resolve().parents[1];html=(ROOT/'index.html').read_text()
modules=dict(re.findall(r'<script id="([^"]+)"[^>]*>(.*?)</script>',html,re.S));expected=json.loads((ROOT/'ui/preserved-scripts.json').read_text())
for name,digest in expected.items():
    if name=='_game-app-excluding-material':
        content=modules['game-app'];a=content.index('function bake(){');b=content.index('function drawTri(',a);content=content[:a]+content[b:]
    else:content=modules[name]
    assert hashlib.sha256(content.encode()).hexdigest()==digest,'Unexpected change to '+name
for tag,id,name in [('style','tournament-table-style','studio.css'),('script','tournament-table-script','studio.js')]:
    results=re.findall(fr'<{tag} id="{id}">(.*?)</{tag}>',html,re.S)
    assert len(results)==1 and results[0].strip()==(ROOT/'ui'/name).read_text().strip(),'Embedding differs from source: '+name
print('PASS release module hashes match the approved integrity manifest; both UI embeddings match their source.')
# The post-release audit adds storage/recovery behavior, not new exercise content.
source=(ROOT/'audit/course-storage.js').read_text().strip()
assert modules['course-storage-script'].strip()==source,'Course storage embedding differs from source'
assert html.index('id="course-storage-script"')<html.index('id="course-ch1-v1-script"'),'Storage adapter must load before lessons'
for name,digest in json.loads((ROOT/'audit/course-content-baseline.json').read_text()).items():
    body=modules[name].replace('GomokuCourseStorage.getItem','localStorage.getItem').replace('GomokuCourseStorage.setItem','localStorage.setItem')
    body=re.sub(r"^addEventListener\('gomoku:course-restored'.*?;\n",'',body,flags=re.M)
    assert hashlib.sha256(body.strip().encode()).hexdigest()==digest,'Lesson content changed: '+name
print('PASS all 14 course modules retain identical lesson content outside the approved storage adapter changes.')
