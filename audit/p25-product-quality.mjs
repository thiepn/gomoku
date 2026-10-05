import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const out=path.join(process.cwd(),'p25-audit-output');
fs.mkdirSync(out,{recursive:true});
const base=String(process.env.P25_URL||'http://127.0.0.1:8765/').replace(/\/?$/,'/');
const errors=[],steps=[],axeFindings=[];
const safe=s=>String(s).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();

async function shot(page,n,name){
  const file=path.join(out,String(n).padStart(2,'0')+'-'+safe(name)+'.png');
  await page.screenshot({path:file,fullPage:true});
  return path.basename(file);
}
async function axe(page,name){
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  const violations=result.violations.map(v=>({
    id:v.id,impact:v.impact,help:v.help,helpUrl:v.helpUrl,
    nodes:v.nodes.slice(0,8).map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary}))
  }));
  axeFindings.push({step:name,violations});
  const blocking=violations.filter(v=>v.impact==='critical'||v.impact==='serious');
  if(blocking.length)throw new Error('Blocking axe violations at '+name+': '+JSON.stringify(blocking));
}
async function smallTargets(page){
  return page.evaluate(()=>{
    const openDialogs=[...document.querySelectorAll('dialog[open]')];
    const root=openDialogs.at(-1)||document;
    return [...root.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="tab"]')]
      .filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return !el.closest('[hidden]')&&!el.disabled&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;})
      .map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id||null,label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,80),width:r.width,height:r.height};})
      .filter(x=>x.width<24||x.height<24);
  });
}
async function focusWalk(page,limit=40){
  const bad=[];
  for(let i=0;i<limit;i++){
    await page.keyboard.press('Tab');
    const state=await page.evaluate(()=>{
      const el=document.activeElement;if(!el||el===document.body)return null;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {tag:el.tagName,id:el.id||null,label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,80),
        top:r.top,left:r.left,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth};
    });
    if(!state)continue;
    const obscured=state.bottom<=0||state.top>=state.h||state.right<=0||state.left>=state.w;
    const visible=state.outlineStyle!=='none'&&parseFloat(state.outlineWidth||'0')>=2;
    if(obscured||!visible)bad.push({...state,obscured,visible});
  }
  return bad;
}
async function capture(page,n,name,notes=''){
  await page.waitForTimeout(120);
  const screenshot=await shot(page,n,name);
  await axe(page,name);
  const targets=await smallTargets(page);
  steps.push({n,name,notes,screenshot,undersizedTargets:targets});
  if(targets.length)throw new Error('Undersized targets at '+name+': '+JSON.stringify(targets.slice(0,15)));
}
async function closeDialogs(page){await page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');}
async function route(page,name){await closeDialogs(page);await page.locator('#v92Primary button[data-v92-route="'+name+'"]').click();await page.waitForTimeout(120);}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',colorScheme:'light'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror',e=>errors.push(String(e)));

await page.goto(base+'?p25=audit',{waitUntil:'domcontentloaded',timeout:45000});
await page.waitForFunction('document.body.dataset.ready==="true" && document.body.dataset.uiReady==="true" && window.GomokuStudio');
await page.waitForTimeout(900);

let n=1;
await capture(page,n++,'first-launch','Initial app state including first-run UI when present.');
await closeDialogs(page);
const skip=page.locator('a.skip[href="#boardGrid"]').first();
await skip.focus();
const skipFocus=await page.evaluate(()=>{const e=document.activeElement,r=e?.getBoundingClientRect?.();return {id:e?.id||null,visible:!!r&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight};});
if(!skipFocus.visible)throw new Error('Skip link is not visibly focusable: '+JSON.stringify(skipFocus));
await skip.click();
await page.waitForFunction('document.activeElement?.id==="boardGrid" || document.activeElement?.id?.startsWith("point-")');

await page.evaluate('()=>{const game=GomokuStudio.exportGame();game.mode="local";game.moves=[];game.initial=[];game.startColor=1;game.terminal=null;game.aiPaused=false;game.gameId="p25-"+Math.random().toString(36).slice(2);GomokuStudio.importGame(game);}');
await page.waitForTimeout(700);
await closeDialogs(page);
await route(page,'play');
await capture(page,n++,'play-home','Primary gameplay workspace with a valid local fixture.');

await closeDialogs(page);
await route(page,'play');
await page.locator('#point-112').focus();
await page.keyboard.press('ArrowRight');
const keyboardState=await page.evaluate(()=>({
  active:document.activeElement?.id||null,
  current:document.querySelector('.board-point[aria-current="true"]')?.id||null,
  tabstop:document.querySelector('.board-point[tabindex="0"]')?.id||null,
  openDialogs:document.querySelectorAll('dialog[open]').length
}));
if(!['point-113'].includes(keyboardState.active)&&!['point-113'].includes(keyboardState.current)&&!['point-113'].includes(keyboardState.tabstop))throw new Error('Board keyboard navigation failed: '+JSON.stringify(keyboardState));
await page.locator('#point-112').focus();await page.keyboard.press('Enter');
await page.waitForFunction('GomokuStudio.diagnostics().moves===1');
await capture(page,n++,'play-after-move','Committed move with updated guidance.');

await route(page,'improve');
await page.waitForFunction('document.querySelector("#uiRouteStatus")?.textContent==="Improve section"');
await capture(page,n++,'improve-catalog','Learning catalog.');
await page.locator('[data-open-chapter="1"]').click();
await page.locator('#ch1CourseDialog').waitFor({state:'visible'});
await capture(page,n++,'learning-dialog','Representative course dialog.');
await page.keyboard.press('Escape');

await route(page,'library');
await capture(page,n++,'library','Saved games and library.');

await route(page,'play');
await page.locator('#v111MenuBtn').click();
await page.locator('[data-v111-action="settings"]').click();
await page.locator('#settingsDialog').waitFor({state:'visible'});
await capture(page,n++,'settings','Preferences/accessibility dialog.');
await page.keyboard.press('Escape');

await page.locator('#v92New').click();
await page.locator('#newDialog').waitFor({state:'visible'});
await capture(page,n++,'new-game','New-game choice flow.');
await page.keyboard.press('Escape');

await page.evaluate('()=>{const game=GomokuStudio.exportGame();game.mode="local";game.initial=[];game.moves=[{i:112,color:1},{i:97,color:2},{i:111,color:1},{i:98,color:2},{i:110,color:1}];game.startColor=1;game.terminal=null;GomokuStudio.importGame(game);}');
await page.locator('#uiReviewCurrent').click();
await page.locator('#grDialog').waitFor({state:'visible'});
await capture(page,n++,'guided-review','Review workspace.');
await page.keyboard.press('Escape');

await route(page,'play');
const focusFailures=await focusWalk(page,40);
if(focusFailures.length)throw new Error('Focus visibility/obscuration failures: '+JSON.stringify(focusFailures.slice(0,12)));

await page.evaluate('document.body.classList.add("large-text","high-contrast")');
await capture(page,n++,'high-contrast-large-text','Built-in accessibility presentation settings.');
await page.evaluate('document.body.classList.remove("large-text","high-contrast")');

await page.setViewportSize({width:390,height:844});
await route(page,'play');await capture(page,n++,'mobile-play','Narrow play layout.');
await route(page,'improve');await capture(page,n++,'mobile-improve','Narrow learning layout.');

if(errors.length)throw new Error('Uncaught page errors: '+JSON.stringify(errors));
const report={version:'p25.product-quality.v1',url:base,steps,axeFindings,errors,
  standards:{axeTags:['wcag2a','wcag2aa','wcag21aa','wcag22aa'],targetSize:'>=24 CSS px',keyboard:'40-step focus walk with >=2px visible outline and non-obscured focus'},
  limits:['Automated checks do not prove complete WCAG conformance.','Screen-reader speech output and physical assistive-technology behavior remain manual verification areas.','P24 owns cross-engine and physical-device boundary claims.'],
  generatedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'p25-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS P25 product quality audit: '+steps.length+' captured states.');
await context.close();await browser.close();
