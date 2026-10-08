"""Embed the review source in the portable app; guarded, idempotent replacements."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
cache=(root/'client-cache-version.txt').read_text().strip()
if not cache.startswith('gomoku-'):raise SystemExit('Invalid client cache version.')
path=root/'index.html'
s=path.read_text()
js=(root/'review/review.js').read_text();css=(root/'review/review.css').read_text()
for tag,old,new,content in [('script','v95-postgame-script','guided-review-script',js),('style','v95-postgame-style','guided-review-style',css)]:
    pattern=rf'<{tag} id="(?:{old}|{new})"[^>]*>.*?</{tag}>'
    matches=list(re.finditer(pattern,s,re.S))
    if len(matches)!=1:raise SystemExit(f'Expected one {old}/{new}; found {len(matches)}. Refusing unsafe rewrite.')
    s=re.sub(pattern,lambda _:f'<{tag} id="{new}">\n{content}\n</{tag}>',s,count=1,flags=re.S)
# A3 pure workspace model must exist before the main review script executes.
a3_model=(root/'analysis3/workspace-core.js').read_text()
if '</script' in a3_model.lower():raise SystemExit('Unexpected script terminator in A3 model')
model_block='<script id="analysis3-workspace-core">\n'+a3_model+'\n</script>'
if '<script id="analysis3-workspace-core">' in s:
    s=re.sub(r'<script id="analysis3-workspace-core">.*?</script>',lambda _:model_block,s,count=1,flags=re.S)
else:
    needle='<script id="guided-review-script">'
    if s.count(needle)!=1:raise SystemExit('Missing review script anchor for A3')
    s=s.replace(needle,model_block+'\n'+needle,1)
if 'prepareGuidedReview:' not in s:
    marker="window.GomokuStudio=Object.freeze({version:'12.1.0',"
    if s.count(marker)!=1:raise SystemExit('Core API anchor changed.')
    addition="prepareGuidedReview:()=>{if(network||S.editing||S.busy||storageConflict)throw Error('Finish the current live operation before reviewing.');pauseClock();cancelSearch();cancelJobs();stopReplay();const wasReviewing=S.reviewing;if(!S.reviewing)enterReview(S.records.length);return {game:snapshot(),wasReviewing};},finishGuidedReview:resume=>{if(resume&&!S.result&&S.reviewing)exitReview();},"
    s=s.replace(marker,marker+addition)
if "if(window.GomokuReview)return window.GomokuReview.open();" not in s:
    marker='function openReviewCoach(){'
    if s.count(marker)!=1:raise SystemExit('Review coach anchor changed.')
    s=s.replace(marker,marker+'\n  if(window.GomokuReview)return window.GomokuReview.open();')
# Saved-game review retains the existing replacement confirmation, then uses this same UI.
marker="if(S.records.length)enterReview(target);toast(d.worst?"
replacement="if(S.records.length)enterReview(target);if(S.records.length&&window.GomokuReview)window.GomokuReview.open({ply:target});toast(d.worst?"
s=s.replace(marker,replacement)
# These two observed course refreshers used to mutate their own observer on every frame.
for n in [6,7]:
    s=s.replace(f'if(progress) progress.textContent = `${{p.completed}} / ${{p.totalTasks}}`;',f'if(progress && progress.textContent !== `${{p.completed}} / ${{p.totalTasks}}`) progress.textContent = `${{p.completed}} / ${{p.totalTasks}}`;')
    s=s.replace('if(start) start.textContent = p.complete ? "Review" : (p.completed ? "Continue" : "Start");','if(start && start.textContent !== (p.complete ? "Review" : (p.completed ? "Continue" : "Start"))) start.textContent = p.complete ? "Review" : (p.completed ? "Continue" : "Start");')
# The fallback previously selected the Learn navigation button. Its label observer
# then deleted the inserted course card, causing an endless remove/remount loop.
s=s.replace("document.querySelector('[data-v92-route=\"improve\"]')", "document.querySelector('#v92ImproveHome')")
# Last-loaded presentation stylesheet; source stays separate from scoring logic.
ux=(root/'review/ux/workspace.css').read_text()
block='<style id="review-workspace-style">\n'+ux+'\n</style>'
if '<style id="review-workspace-style">' in s:
    s=re.sub(r'<style id="review-workspace-style">.*?</style>',lambda _:block,s,count=1,flags=re.S)
else:
    s=s.replace('</body>',block+'\n</body>')
# A3 styles are isolated from Guided Review and keep portable/offline parity.
a3_css=(root/'analysis3/workspace.css').read_text()
a3_style='<style id="analysis3-workspace-style">\\n'+a3_css+'\n</style>'
if '<style id="analysis3-workspace-style">' in s:
    s=re.sub(r'<style id="analysis3-workspace-style">.*?</style>',lambda _:a3_style,s,count=1,flags=re.S)
else:
    if s.count('</body>')!=1:raise SystemExit('Missing body terminator for A3')
    s=s.replace('</body>',a3_style+'\n</body>',1)
path.write_text(s)
sw=root/'sw.js';t=sw.read_text();t=re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",t,count=1);sw.write_text(t)
print('Embedded Guided Review / Analysis 3.0 A3 with offline board workspace.')
