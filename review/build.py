"""Embed the review source in the portable app; guarded, idempotent replacements."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
path=root/'index.html'
s=path.read_text()
js=(root/'review/review.js').read_text();css=(root/'review/review.css').read_text()
for tag,old,new,content in [('script','v95-postgame-script','guided-review-script',js),('style','v95-postgame-style','guided-review-style',css)]:
    pattern=rf'<{tag} id="(?:{old}|{new})"[^>]*>.*?</{tag}>'
    matches=list(re.finditer(pattern,s,re.S))
    if len(matches)!=1:raise SystemExit(f'Expected one {old}/{new}; found {len(matches)}. Refusing unsafe rewrite.')
    s=re.sub(pattern,lambda _:f'<{tag} id="{new}">\n{content}\n</{tag}>',s,count=1,flags=re.S)
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
path.write_text(s)
sw=root/'sw.js';t=sw.read_text();t=re.sub(r"const CACHE_NAME = '[^']+';","const CACHE_NAME = 'gomoku-v12.1.0-analysis-2.0.0-table-1.0.1-renju';",t,count=1);sw.write_text(t)
print('Embedded Guided Review 2.0.0; existing game, course and storage formats preserved.')
