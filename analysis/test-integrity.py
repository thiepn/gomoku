"""Independent release invariant: the prior Renju-fixed game's logic is unchanged."""
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[1];html=(root/'index.html').read_text();modules=dict(re.findall(r'<script id="([^"]+)"[^>]*>(.*?)</script>',html,re.S));baseline=json.loads((root/'analysis/baseline-integrity.json').read_text())
for name,digest in baseline['preserved'].items():
    content=modules['game-app'] if name=='_game-app-excluding-material' else modules[name]
    if name=='_game-app-excluding-material':
        a=content.index('function bake(){');b=content.index('function drawTri(',a);content=content[:a]+content[b:]
    assert hashlib.sha256(content.encode()).hexdigest()==digest,'Baseline logic changed: '+name
for tag,name,file in [('script','analysis2-core','core.js'),('script','analysis2-runtime','runtime.js'),('script','analysis2-training','training.js'),('style','analysis2-style','analysis.css')]:
    matches=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(matches)==1 and matches[0].strip()==(root/'analysis'/file).read_text().strip(),'Embedding/source mismatch: '+file
assert html.index('id="analysis2-core"')<html.index('id="analysis2-runtime"')<html.index('id="guided-review-script"')<html.index('id="analysis2-training"')
print('PASS',len(baseline['preserved']),'prior-release module/logic hashes preserved; four Analysis 2.0 embeddings verified.')
