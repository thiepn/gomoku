"""Check the UI-only boundary, exact single embedding, and cache preservation."""
from pathlib import Path
import re, hashlib
root=Path(__file__).resolve().parents[2]
js=(root/'review/review.js').read_text()
core=js.split("if(typeof window !== 'undefined')")[0]
assert hashlib.sha256(core.encode()).hexdigest()=='fa919888664eef4ea474956465cef569771fd038333285833ccad25601f95df8','Pure review judgment core changed'
html=(root/'index.html').read_text()
for tag,name,file in [('style','review-workspace-style','review/ux/workspace.css'),('script','guided-review-script','review/review.js')]:
    rows=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(rows)==1 and rows[0].strip()==(root/file).read_text().strip(),'Embedding/source mismatch: '+file
assert "VERSION='2.0.0'" in js and "workspaceVersion:'2.1.0'" in js,'Existing review cache version changed'
assert "STORE='gomoku.guided-review.v1'" in js,'Existing cache key changed'
assert 'review-ux-2.1.0' in (root/'sw.js').read_text(),'Service worker did not receive a new cache version'
print('PASS pure review core unchanged; review and workspace embedded once; analysis cache format preserved.')
