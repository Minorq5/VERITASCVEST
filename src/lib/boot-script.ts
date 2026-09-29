import { accents, DEVICE_SETTINGS_KEY } from '@/lib/device';

/**
 * Applies device settings to <html> before the first paint so the accent,
 * cursor and motion preference never flash. Kept tiny and dependency-free.
 */
export const bootScript = `(function(){try{
var d=document.documentElement,s={};
try{var raw=localStorage.getItem(${JSON.stringify(DEVICE_SETTINGS_KEY)});if(raw){s=(JSON.parse(raw)||{}).state||{};}}catch(e){}
var accents=${JSON.stringify(accents)};
d.setAttribute('data-accent',accents.indexOf(s.accent)>=0?s.accent:'cyan');
if(s.motion==='reduced'){d.setAttribute('data-motion','reduced');}
var fine=window.matchMedia&&window.matchMedia('(pointer: fine)').matches;
if(fine&&s.cursor!=='system'){d.setAttribute('data-cursor','custom');}
}catch(e){}})();`;
