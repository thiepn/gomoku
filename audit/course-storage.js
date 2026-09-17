/* Chapter progress adapter. Corrupt/full storage must not erase earlier work. */
(() => {
  'use strict';
  const keys=Array.from({length:14},(_,i)=>`gomoku.course.chapter${i+1}.v1`);
  const memory=new Map(),blocked=new Set(),unsaved=new Set();let notice;
  function warn(){
    if(!document.body)return;
    if(!notice){notice=document.createElement('aside');notice.id='courseStorageNotice';notice.setAttribute('role','status');notice.style.cssText='position:fixed;bottom:calc(82px + env(safe-area-inset-bottom));left:12px;right:12px;margin:auto;max-width:540px;z-index:2147483645;padding:14px;background:#fff4df;color:#332710;border:2px solid #876415;border-radius:8px;font:14px/1.4 system-ui';document.body.append(notice);}
    notice.replaceChildren(document.createTextNode('Course progress is only in this tab. Storage is full, unavailable, or damaged. Export progress before closing. '));
    const b=document.createElement('button');b.type='button';b.textContent='Export progress';b.onclick=()=>{const blob=new Blob([JSON.stringify({format:'GomokuCourseProgress',version:1,courses:snapshot(),recovery:Object.fromEntries(keys.map(k=>{try{return[k,localStorage.getItem(k)]}catch{return[k,null]}}))},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gomoku-course-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};notice.append(b);
  }
  function valid(raw){
    if(typeof raw!=='string'||raw.length>500000)throw Error('Invalid course record size.');
    const value=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value)||!value.tasks||typeof value.tasks!=='object'||Array.isArray(value.tasks))throw Error('Invalid course progress.');
    if(Object.keys(value.tasks).length>2000||Object.values(value.tasks).some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Invalid task records.');
    return raw;
  }
  function getItem(key){
    if(!keys.includes(key))throw Error('Unknown course key.');
    if(memory.has(key))return memory.get(key);
    try {const raw=localStorage.getItem(key);if(raw!==null)valid(raw);return raw;}
    catch {blocked.add(key);memory.set(key,null);warn();return null;}
  }
  function setItem(key,raw){
    if(!keys.includes(key))throw Error('Unknown course key.');valid(raw);memory.set(key,raw);
    if(blocked.has(key)){unsaved.add(key);warn();return;}
    try {localStorage.setItem(key,raw);unsaved.delete(key);if(!unsaved.size&&!blocked.size){notice?.remove();notice=null;}}
    catch {unsaved.add(key);warn();}
  }
  function snapshot(){const out={};for(const k of keys){const raw=getItem(k);if(raw!==null)out[k]=raw;}return out;}
  function validate(data){
    if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>5000000)throw Error('Invalid course backup.');
    const clean={};for(const [key,raw] of Object.entries(data)){if(!keys.includes(key))throw Error('Unexpected key in course backup.');clean[key]=valid(raw);}return clean;
  }
  function restore(data){
    const clean=validate(data),changed=Object.keys(clean),old=changed.map(k=>localStorage.getItem(k));
    try{for(const key of changed)localStorage.setItem(key,clean[key]);}
    catch(error){for(let i=0;i<changed.length;i++)try{old[i]===null?localStorage.removeItem(changed[i]):localStorage.setItem(changed[i],old[i]);}catch{}throw Error('Progress import failed; earlier records were retained. '+error.message);}
    reloaded(changed);
  }
  function reloaded(changed){for(const key of changed){memory.delete(key);blocked.delete(key);unsaved.delete(key);}if(!unsaved.size&&!blocked.size){notice?.remove();notice=null;}window.dispatchEvent(new CustomEvent('gomoku:course-restored'));window.dispatchEvent(new CustomEvent('gomoku:course-progress'));}
  addEventListener('storage',e=>{const changed=(e.key===null?keys:keys.filter(k=>k===e.key)).filter(k=>!unsaved.has(k));if(changed.length){for(const key of changed){memory.delete(key);blocked.delete(key);}window.dispatchEvent(new CustomEvent('gomoku:course-restored'));window.dispatchEvent(new CustomEvent('gomoku:course-progress'));if(!unsaved.size&&!blocked.size){notice?.remove();notice=null;}}});
  window.GomokuCourseStorage=Object.freeze({getItem,setItem,snapshot,validate,restore,reloaded,keys:Object.freeze(keys),status:()=>({unsaved:[...unsaved],damaged:[...blocked]})});
})();
