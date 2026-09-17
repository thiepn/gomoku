"""Reproducibly embed the chapter storage adapter before the chapter modules."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1];p=root/'index.html';html=p.read_text()
source=(root/'audit/course-storage.js').read_text()
block='<script id="course-storage-script">\n'+source+'\n</script>'
pattern=r'<script id="course-storage-script">.*?</script>'
count=len(re.findall(pattern,html,re.S))
if count==1:html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
elif count==0:
    anchor='<script id="course-ch1-v1-script">'
    assert html.count(anchor)==1,'Chapter anchor changed; review before embedding'
    html=html.replace(anchor,block+'\n'+anchor,1)
else:raise SystemExit('Duplicate course storage modules; refusing rewrite')
assert html.index('id="course-storage-script"')<html.index('id="course-ch1-v1-script"')
p.write_text(html)
print('Embedded course progress recovery adapter.')
