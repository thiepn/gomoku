from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
original=s
marker='mobile-playability-v12'
if marker in s:
    raise SystemExit('Mobile playability layer already present')

# Route every visible modern "online room" entry to the new private-room UI,
# not the retired self-hosted matchmaking/account surface.
replacements={
    "if(id==='online'){openPlatform();return;}": "if(id==='online'){$('onlineBtn').click();return;}",
    "online:openPlatform": "online:()=>$('onlineBtn').click()",
    "online:()=>api.openPlatform()": "online:()=>click('onlineBtn')",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit('Expected online routing hook not found: '+old)
    s=s.replace(old,new,1)

# Remove the obsolete public matchmaking command from the command palette.
s=s.replace(",['Matchmaking and optional account',openPlatform]",'',1)

block=r'''
<style id="mobile-playability-v12">
/* Final mobile authority: board-first layout, explicit touch confirmation, and thumb-reachable controls. */
@media(max-width:760px){
  html,body{max-width:100%;overflow-x:hidden}
  body[data-v92-route="play"]{padding-bottom:calc(150px + env(safe-area-inset-bottom))}
  body[data-v92-route="play"] main{padding:8px 4px 170px!important}
  body[data-v92-route="play"] .board-side{width:100%;margin:0}
  body[data-v92-route="play"] .board-col{width:100%;max-width:640px;margin-inline:auto}
  body[data-v92-route="play"] .board-top{min-height:42px;margin:0 8px 8px}
  body[data-v92-route="play"] .board-heading{margin-top:4px;gap:7px}
  body[data-v92-route="play"] .board-heading h2{font-size:18px;line-height:1.2}
  body[data-v92-route="play"] .board-top .eyebrow{font-size:8px;letter-spacing:.13em}
  body[data-v92-route="play"] .move-badge{font-size:21px}
  body[data-v92-route="play"] .move-badge span{font-size:7px;margin-top:4px}
  body[data-v92-route="play"] .board-shell{width:100%;border-radius:5px;box-shadow:0 10px 22px -9px rgba(76,52,16,.34),0 2px 5px #46321820}
  body[data-v92-route="play"] #boardGrid{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:contain}
  body[data-v92-route="play"] .board-point{-webkit-tap-highlight-color:transparent}
  body[data-v92-route="play"] .board-point.v12-mobile-selected{background:radial-gradient(circle at center,color-mix(in srgb,var(--seal) 20%,transparent) 0 28%,color-mix(in srgb,var(--seal) 72%,transparent) 30% 35%,transparent 38%)}
  body[data-v92-route="play"] .caption{margin:10px 8px 0;font-size:9px;gap:6px}
  body[data-v92-route="play"] #v93MobileMatchStrip{width:calc(100% - 16px);margin:7px 8px 0;min-height:42px;padding:7px 10px}
  body[data-v92-route="play"] #v92GameBar{margin:7px 8px 0!important;gap:5px!important}
  body[data-v92-route="play"] #v92GameBar .v92-game-btn{min-height:44px!important;padding:6px 4px!important;font-size:10px!important;border-radius:7px}
  body[data-v92-route="play"] #v92GameBar #v92New{background:transparent;border-color:var(--hair);color:var(--ink);box-shadow:none}
  body[data-v92-route="play"] #v92GameBar #v92GameMore{font-weight:700}

  /* Touch confirmation becomes a true thumb dock instead of an inline row below the board. */
  body[data-v92-route="play"].v12-touch-confirm #placement:not([hidden]){position:fixed;left:50%;right:auto;bottom:calc(61px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:29;width:min(640px,calc(100vw - 12px));min-height:62px;margin:0;padding:7px 8px 7px 11px;border:1px solid var(--hair2);border-radius:11px;background:color-mix(in srgb,var(--paper) 95%,transparent);box-shadow:0 -5px 24px rgba(30,22,13,.14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  body[data-v92-route="play"].v12-touch-confirm #placement>div{min-width:0;overflow:hidden}
  body[data-v92-route="play"].v12-touch-confirm #selectionText{font-size:13px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  body[data-v92-route="play"].v12-touch-confirm #selectionHint{font-size:9px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
  body[data-v92-route="play"].v12-touch-confirm #placeBtn{flex:none;min-width:128px;min-height:48px;padding:9px 15px;border-radius:8px;background:var(--seal);border-color:var(--seal);color:#fff7eb;font-size:12px;font-weight:760;box-shadow:0 3px 10px color-mix(in srgb,var(--seal) 24%,transparent)}
  body[data-v92-route="play"].v12-touch-confirm #placeBtn:disabled{background:var(--card);border-color:var(--hair);color:var(--ink2);box-shadow:none;opacity:.72}
  body[data-v92-route="play"]:not(.v12-touch-confirm) #placement{display:none!important}
  body[data-v92-route="play"].v12-touch-confirm .toast{bottom:calc(137px + env(safe-area-inset-bottom))!important}

  /* Online rooms use the match strip as the direct room-controls entry while playing. */
  body.v12-online-room[data-v92-route="play"] #v92GameBar #v92New,
  body.v12-online-room[data-v92-route="play"] #v92GameBar #v92Undo,
  body.v12-online-room[data-v92-route="play"] #v92GameBar #v92Hint{display:none!important}
  body.v12-online-room[data-v92-route="play"] #v92GameBar #v92GameMore{flex:1}

  /* Compact top chrome without shrinking touch targets. */
  body.v111-ready .top{padding:9px 10px 8px!important;min-height:52px}
  body.v111-ready .logo-seal{width:32px;height:32px;font-size:19px;border-radius:7px}
  body.v111-ready .brand{gap:8px}
  body.v111-ready .brand h1{font-size:16px;letter-spacing:.12em}
  body.v111-ready .header-tools .icon-btn,body.v111-ready .v111-menu-trigger{width:40px;min-width:40px;min-height:40px;height:40px}

  /* Dialogs and private rooms are comfortable on phone keyboards and avoid iOS focus zoom. */
  dialog input,dialog select,dialog textarea{font-size:16px!important}
  #workbenchDialog:has(#roomCode){width:calc(100vw - 10px);max-width:560px;max-height:calc(100dvh - 10px);padding:14px!important;border-radius:12px}
  #workbenchDialog:has(#roomCode) .field-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  #workbenchDialog:has(#roomCode) label{margin-top:10px}
  #workbenchDialog:has(#roomCode) input,#workbenchDialog:has(#roomCode) select{width:100%;min-height:48px;padding:10px 11px;border-radius:8px}
  #workbenchDialog #roomCode{text-transform:uppercase;letter-spacing:.12em;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:750}
  #workbenchDialog:has(#roomCode)>.button-row,#workbenchDialog:has(#roomCode) .button-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  #workbenchDialog:has(#roomCode) #resumeRoom{grid-column:1/-1}
  #workbenchDialog:has(#roomCode) .button-row .btn{width:100%;min-height:46px;margin:0}
  #roomDetails{margin-top:12px}
  #roomDetails .lab-scroll{max-height:24dvh;margin:8px 0}
  #roomDetails>input[aria-label="Room message"]{width:100%;min-height:48px;margin-top:8px;padding:10px 11px;border-radius:8px}
  #roomDetails>input[aria-label="Room message"]+.btn{width:100%;min-height:46px;margin-top:6px}
  #workbenchDialog:has(#roomCode) .dialog-actions{position:sticky;bottom:0;background:var(--paper)}

  /* Bottom navigation stays visually separate from the move-confirmation dock. */
  body.v111-ready #v92Primary{box-shadow:0 -5px 18px rgba(25,18,10,.08)}
}
@media(max-width:390px){
  body[data-v92-route="play"] main{padding-inline:2px!important}
  body[data-v92-route="play"].v12-touch-confirm #placement:not([hidden]){width:calc(100vw - 8px);padding-left:9px}
  body[data-v92-route="play"].v12-touch-confirm #placeBtn{min-width:112px;padding-inline:10px}
  body[data-v92-route="play"].v12-touch-confirm #selectionHint{display:none}
  body[data-v92-route="play"] #v92GameBar .v92-game-btn{font-size:9px!important}
}
@media(pointer:coarse){button,.btn,.v92-game-btn,.v111-menu-action,.v111-tool{-webkit-tap-highlight-color:transparent}}
</style>
<script id="mobile-playability-v12-script">
(()=>{'use strict';
 const $=id=>document.getElementById(id),body=document.body,grid=$('boardGrid'),place=$('placeBtn'),touch=$('touchChk'),online=$('onlineBtn');
 if(!body||!grid)return;
 const coarse=matchMedia('(pointer:coarse)');
 const syncTouch=()=>body.classList.toggle('v12-touch-confirm',coarse.matches&&(touch?.checked!==false));
 syncTouch();touch?.addEventListener('change',syncTouch);coarse.addEventListener?.('change',syncTouch);

 // Strong visual confirmation of the currently tapped intersection.
 let selected=null;
 const clearSelected=()=>{selected?.classList.remove('v12-mobile-selected');selected=null};
 grid.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const b=e.target.closest?.('.board-point');if(!b||b.getAttribute('aria-disabled')==='true')return;clearSelected();selected=b;b.classList.add('v12-mobile-selected')},{passive:true});
 addEventListener('gomoku:move',clearSelected);
 place?.addEventListener('click',()=>requestAnimationFrame(clearSelected));

 // Shorter phone labels keep the action bar legible at 360 px without reducing touch size.
 const relabel=()=>{if(innerWidth>760)return;if($('v92New'))$('v92New').textContent='New';if($('v92GameMore'))$('v92GameMore').textContent='More'};
 relabel();addEventListener('resize',relabel,{passive:true});

 // Detect a connected private room from the authoritative room button state.
 const syncOnline=()=>{const active=/^Room\s+[A-Z2-9]{8}$/.test((online?.textContent||'').trim());body.classList.toggle('v12-online-room',active);const strip=$('v93MobileMatchStrip'),main=$('v93MobileMatchText'),change=strip?.querySelector('.v93-match-change');if(active&&strip&&main){main.textContent='Private '+online.textContent.trim();if(change)change.textContent='Room ›'}else if(!active&&change&&change.textContent==='Room ›')change.textContent='Change ›'};
 const onlineObs=online?new MutationObserver(syncOnline):null;onlineObs?.observe(online,{subtree:true,childList:true,characterData:true});syncOnline();
 // During an online match, the compact match strip opens room controls/chat instead of local match settings.
 $('v93MobileMatchStrip')?.addEventListener('click',e=>{if(!body.classList.contains('v12-online-room'))return;e.preventDefault();e.stopImmediatePropagation();online?.click()},{capture:true});

 // Make Private room a first-class Menu action and bypass all retired matchmaking routes.
 const mountPrivate=()=>{const menu=$('v111MenuDialog'),main=menu?.querySelector('.v111-menu-main');if(!menu||!main){setTimeout(mountPrivate,80);return}const specialist=menu.querySelector('[data-v111-tool="online"]');if(specialist){specialist.querySelector('b')&&(specialist.querySelector('b').textContent='Private room');specialist.querySelector('span')&&(specialist.querySelector('span').textContent='Invite-only play with a room code.');specialist.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();menu.close();setTimeout(()=>online?.click(),0)},true)}if(!$('v12PrivateRoomMenu')){const b=document.createElement('button');b.id='v12PrivateRoomMenu';b.type='button';b.className='v111-menu-action';b.innerHTML='<b>Private room</b><span>Create or join an invite-only online game.</span>';b.onclick=()=>{menu.close();setTimeout(()=>online?.click(),0)};main.append(b)}};
 mountPrivate();
})();
</script>
'''
if '</body>' not in s:
    raise SystemExit('No </body> insertion point')
s=s.replace('</body>',block+'\n</body>',1)

# Structural sanity checks.
checks=[
    ('mobile layer', marker in s),
    ('private V92 route', "online:()=>click('onlineBtn')" in s),
    ('private V85 route', "online:()=>$('onlineBtn').click()" in s),
    ('thumb dock', 'v12-touch-confirm #placement:not([hidden])' in s),
    ('edge board', 'main{padding:8px 4px 170px!important}' in s),
    ('room menu', 'v12PrivateRoomMenu' in s),
    ('room dialog mobile', '#workbenchDialog:has(#roomCode)' in s),
]
failed=[name for name,ok in checks if not ok]
if failed: raise SystemExit('Failed checks: '+', '.join(failed))
if s==original: raise SystemExit('Patch made no changes')
p.write_text(s,encoding='utf-8')
print('Applied mobile playability layer',len(original),'->',len(s))
