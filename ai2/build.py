"""Embed Gomoku 1.3 AI 2.0 and its live-opponent hooks.

Idempotent. Review/Analysis search remains untouched; only live AI move selection
receives the AI 2.0 effective-level/search-policy hooks.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'index.html';html=html_path.read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if 'course-2.0.0' not in cache or 'ai-2.0.0' not in cache: raise SystemExit('AI 2.0 requires the v1.2 stack and ai-2.0.0 cache boundary.')
assets=[('script','ai2-core',ROOT/'ai2/core.js'),('style','ai2-style',ROOT/'ai2/ai2.css'),('script','ai2-runtime',ROOT/'ai2/runtime.js')]
for tag,name,path in assets:
    content=path.read_text()
    if tag=='script' and '</script' in content.lower(): raise SystemExit('Unexpected script terminator in '+str(path))
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>';pattern=rf'<{tag} id="{re.escape(name)}">.*?</{tag}>'
    rows=re.findall(pattern,html,re.S)
    if len(rows)>1: raise SystemExit('Duplicate AI 2.0 asset: '+name)
    if rows: html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1: raise SystemExit('Expected one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)
old_level="const level=S.mode==='arena'&&color===2?S.opponentLevel:S.level;"
new_level="const selectedLevel=S.mode==='arena'&&color===2?S.opponentLevel:S.level;/* AI2_SEARCH_HOOK */\n  const level=purpose==='move'&&window.GomokuAI2?.effectiveLevel?window.GomokuAI2.effectiveLevel({selected:selectedLevel,mode:S.mode,rule:S.variant,moveCount:S.records.length,gameId:S.gameId}):selectedLevel;"
if '/* AI2_SEARCH_HOOK */' not in html:
    if old_level not in html: raise SystemExit('Live level hook target moved.')
    html=html.replace(old_level,new_level,1)
old_cfg="const config=purpose==='move'?{...CFG[level],style:S.style,seed:S.seed^S.records.length,multiPV:5,randomPool:1}:\n    {...CFG.advanced,timeMs:1000,maxDepth:4,width:14,style:'balanced',seed:S.seed};"
new_cfg="const baseConfig=purpose==='move'?{...CFG[level],style:S.style,seed:S.seed^S.records.length,multiPV:5,randomPool:1}:\n    {...CFG.advanced,timeMs:1000,maxDepth:4,width:14,style:'balanced',seed:S.seed};/* AI2_CONFIG_HOOK */\n  const config=purpose==='move'&&window.GomokuAI2?.searchConfig?window.GomokuAI2.searchConfig(level,baseConfig,{mode:S.mode,rule:S.variant,moveCount:S.records.length,gameId:S.gameId}):baseConfig;"
if '/* AI2_CONFIG_HOOK */' not in html:
    if old_cfg not in html: raise SystemExit('Live config hook target moved.')
    html=html.replace(old_cfg,new_cfg,1)
old_accept="if(purpose==='move'&&!compat)result=v113Humanize(result,board,color,count,level,S.style,S.seed^S.records.length);"
new_accept="if(purpose==='move'&&!compat)result=v113Humanize(result,board,color,count,level,S.style,S.seed^S.records.length);\n    if(purpose==='move'&&!compat)try{window.dispatchEvent(new CustomEvent('gomoku-ai2-search',{detail:{gameId:S.gameId,selectedLevel,effectiveLevel:level,reason:result?.reason||'',depth:result?.depth||0,nodes:result?.nodes||0,elapsedMs:result?.elapsedMs||0,backend:result?.backend||'',confidence:result?.confidence?.band||'',humanized:result?.humanization?.deliberate===true}}));}catch{}/* AI2_TELEMETRY_HOOK */"
if '/* AI2_TELEMETRY_HOOK */' not in html:
    if old_accept not in html: raise SystemExit('Live telemetry hook target moved.')
    html=html.replace(old_accept,new_accept,1)
if html.index('id="course2-runtime"')>html.index('id="ai2-runtime"'): raise SystemExit('AI 2.0 must load after Course 2.0.')
if html.index('id="ai2-core"')>html.index('id="ai2-runtime"'): raise SystemExit('AI 2.0 core/runtime order invalid.')
html_path.write_text(html)
sw=ROOT/'sw.js';sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.3 AI 2.0: benchmarkable search policy + between-game adaptive opponent.')
