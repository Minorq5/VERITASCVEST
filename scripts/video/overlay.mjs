/**
 * What the viewer of a recording needs and a headless browser does not draw:
 * a visible pointer, a ring on every click, and a chapter caption. Injected
 * into the page only while recording (never part of the app).
 */
export function overlayInit() {
  const CAPTION_KEY = 'vt-rec-caption';

  function install() {
    if (document.getElementById('vt-rec')) return;
    const root = document.createElement('div');
    root.id = 'vt-rec';
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    root.innerHTML = `
      <div id="vt-rec-caption" style="position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:7px 12px;background:#0b0b0d;border:1px solid #26292f;border-radius:4px;font:500 12px/16px var(--font-jetbrains,ui-monospace),monospace;letter-spacing:.08em;text-transform:uppercase;color:#f2ede4;white-space:nowrap;transition:opacity .25s ease;"></div>
      <div id="vt-rec-ring" style="position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border:1.5px solid #ff8a2a;border-radius:50%;opacity:0;"></div>
      <svg id="vt-rec-cursor" width="22" height="22" viewBox="0 0 22 22" style="position:absolute;left:0;top:0;transform:translate(-200px,-200px);">
        <path d="M3 2 L17.5 10.6 L11.2 12 L14.9 18.8 L12.3 20.2 L8.6 13.4 L3.6 17.9 Z" fill="#f2ede4" stroke="#050506" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>`;
    document.documentElement.appendChild(root);
    // Phones have their tab bar at the bottom: the caption goes under the header instead.
    if (matchMedia('(hover: none)').matches) {
      const caption = root.querySelector('#vt-rec-caption');
      caption.style.bottom = 'auto';
      caption.style.top = 'calc(env(safe-area-inset-top) + 64px)';
      caption.style.fontSize = '11px';
    }
    const cursor = root.querySelector('#vt-rec-cursor');
    const ring = root.querySelector('#vt-rec-ring');
    // On a phone there is no pointer: show a fingertip only while pressing.
    const touch = matchMedia('(hover: none)').matches;
    if (touch) {
      cursor.innerHTML = '<circle cx="11" cy="11" r="10" fill="rgba(242,237,228,0.28)" stroke="rgba(242,237,228,0.9)" stroke-width="1.2"/>';
      cursor.setAttribute('width', '44');
      cursor.setAttribute('height', '44');
      cursor.style.opacity = '0';
      cursor.style.transition = 'opacity 120ms ease';
    }
    const place = (x, y) => {
      cursor.style.transform = touch ? `translate(${x - 22}px, ${y - 22}px)` : `translate(${x - 3}px, ${y - 2}px)`;
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
    };
    if (window.__vtPointer) place(window.__vtPointer.x, window.__vtPointer.y);
    addEventListener(
      'mousemove',
      (e) => {
        window.__vtPointer = { x: e.clientX, y: e.clientY };
        place(e.clientX, e.clientY);
      },
      { capture: true, passive: true },
    );
    if (touch) {
      addEventListener('mouseup', () => (cursor.style.opacity = '0'), { capture: true, passive: true });
    }
    addEventListener(
      'mousedown',
      () => {
        if (touch) cursor.style.opacity = '1';
        ring.animate(
          [
            { opacity: 0.95, transform: 'scale(0.4)' },
            { opacity: 0, transform: 'scale(1.6)' },
          ],
          { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
      },
      { capture: true, passive: true },
    );
    try {
      const saved = sessionStorage.getItem(CAPTION_KEY);
      if (saved) window.__vtCaption(saved);
    } catch {
      /* storage may be unavailable on a data document */
    }
  }

  window.__vtCaption = (text) => {
    try {
      sessionStorage.setItem(CAPTION_KEY, text ?? '');
    } catch {
      /* ignore */
    }
    const el = document.getElementById('vt-rec-caption');
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      return;
    }
    const [num, ...rest] = text.split(' · ');
    el.innerHTML = rest.length
      ? `<span style="color:#ff8a2a">${num}</span><span style="color:#3a3d45">/</span><span>${rest.join(' · ')}</span>`
      : `<span>${text}</span>`;
    el.style.display = 'flex';
    el.style.opacity = '1';
    // On a phone the caption only announces the chapter, then gets out of the way.
    clearTimeout(window.__vtCaptionTimer);
    if (matchMedia('(hover: none)').matches) {
      window.__vtCaptionTimer = setTimeout(() => (el.style.opacity = '0'), 3200);
    }
  };

  window.__vtInstall = install;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
