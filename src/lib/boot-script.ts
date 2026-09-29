import { accents, DEVICE_SETTINGS_KEY, INTRO_SEEN_KEY, INTRO_SESSION_KEY } from '@/lib/device';

/**
 * Applies device settings to <html> before the first paint so the accent,
 * and motion preference never flash, and decides whether the intro plays
 * (`data-intro="full|short"`: full on the first visit, short later, once per
 * browser session; never on email links, dev pages or for automated
 * browsers unless `vt:intro-force` is set). Kept tiny and dependency-free.
 */
export const bootScript = `(function(){try{
var d=document.documentElement,s={};
try{var raw=localStorage.getItem(${JSON.stringify(DEVICE_SETTINGS_KEY)});if(raw){s=(JSON.parse(raw)||{}).state||{};}}catch(e){}
var accents=${JSON.stringify(accents)};
d.setAttribute('data-accent',accents.indexOf(s.accent)>=0?s.accent:'amber');
if(s.motion==='reduced'){d.setAttribute('data-motion','reduced');}
try{
var mode=s.intro||'auto',p=location.pathname;
var quiet=/^\\/(?:[a-z]{2}\\/)?(?:auth\\/confirm|cinema|og-card|design)(?:\\/|$)/.test(p);
var robot=navigator.webdriver&&localStorage.getItem('vt:intro-force')!=='1';
if(mode!=='off'&&!quiet&&!robot&&!sessionStorage.getItem(${JSON.stringify(INTRO_SESSION_KEY)})){
d.setAttribute('data-intro',mode==='short'||localStorage.getItem(${JSON.stringify(INTRO_SEEN_KEY)})?'short':'full');
}
}catch(e){}
}catch(e){}})();`;
