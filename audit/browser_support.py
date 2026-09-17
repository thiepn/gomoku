from pathlib import Path
import os,json
ROOT=Path(__file__).resolve().parents[1]
MOCK='''<script>window.__auditStore=new Map(); Object.defineProperty(window,"localStorage",{configurable:true,value:{get length(){return __auditStore.size},key:i=>Array.from(__auditStore.keys())[i]??null,getItem:k=>__auditStore.get(k)??null,setItem:(k,v)=>{if(window.__quotaKey===k)throw new DOMException('Full','QuotaExceededError');__auditStore.set(k,String(v))},removeItem:k=>__auditStore.delete(k),clear:()=>__auditStore.clear()}});</script>'''
def load(browser,seed=None,mobile=False):
    context=browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1000},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
    page=context.new_page();page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if os.getenv('AUDIT_URL'):
        if seed: context.add_init_script('for(const [k,v] of Object.entries('+json.dumps(seed)+'))localStorage.setItem(k,v);')
        page.goto(os.environ['AUDIT_URL'],wait_until='domcontentloaded')
    else:
        seeded='<script>for(const [k,v] of Object.entries('+json.dumps(seed or {})+'))localStorage.setItem(k,v);</script>'
        page.set_content(MOCK+seeded+Path(os.getenv('AUDIT_HTML',str(ROOT/'index.html'))).read_text(),wait_until='domcontentloaded')
    page.wait_for_function('document.body.dataset.uiReady==="true"');page.wait_for_timeout(1300)
    page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
    return context,page,errors

def click(page,id):page.evaluate('(id)=>document.getElementById(id).click()',id)
def state(page):return page.evaluate('GomokuStudio.exportGame()')
def fixture(rule='freestyle'):
    return dict(version=3,variant=rule,mode='local',humanColor=1,level='mid',initial=[],startColor=1,moves=[dict(i=i,color=k%2+1) for k,i in enumerate([112,97,113,98])],touchConfirm=False,soundOn=False)
