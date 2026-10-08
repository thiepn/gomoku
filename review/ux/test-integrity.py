"""Check the approved review core, exact single embedding, and safe cache migration."""
from pathlib import Path
import re, hashlib
root=Path(__file__).resolve().parents[2]
js=(root/'review/review.js').read_text()
core=js.split("if(typeof window !== 'undefined')")[0]
assert hashlib.sha256(core.encode()).hexdigest()=='a127e4b06fae8c2b9ab80887ae0e69aa9795b98eeb91371af8685159dfae8b5f','Pure review judgment core changed'
html=(root/'index.html').read_text()
for tag,name,file in [('style','review-workspace-style','review/ux/workspace.css'),('script','guided-review-script','review/review.js'),('script','analysis3-workspace-core','analysis3/workspace-core.js'),('style','analysis3-workspace-style','analysis3/workspace.css'),('script','analysis4-game-diagnosis-core','analysis3/game-diagnosis.js'),('style','analysis4-game-diagnosis-style','analysis3/game-diagnosis.css')]:
    rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(rows)==1 and rows[0].strip()==(root/file).read_text().strip(),'Embedding/source mismatch: '+file
assert "VERSION='3.0.0-a4'" in js and "ANALYSIS_VERSION='3.0.0-a2'" in js and "workspaceVersion:'3.0.0-a4'" in js,'Review and engine evidence generations mismatch'
assert "'3.0.0-a3',VERSION].includes(data.version)" in js,'Historical A2 review cannot migrate'
assert "r?.analysisVersion===ANALYSIS_VERSION" in js,'Stale analysis can be reused'
assert "STORE='gomoku.guided-review.v1'" in js,'Existing cache key changed'
assert 'review-ux-3.0.0-a4' in (root/'sw.js').read_text(),'Service worker did not receive the A3 cache version'
print('PASS approved review core; single embeddings; old analyses rejected, variations preserved.')
