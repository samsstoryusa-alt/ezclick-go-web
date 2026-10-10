(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const curtain = document.createElement('div');
  curtain.className = 'section-curtain';
  curtain.hidden = true;
  curtain.setAttribute('aria-hidden', 'true');
  document.body.append(curtain);
  let sequence = 0;
  let animation = null;

  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  function clearCurtain() {
    animation?.cancel();
    animation = null;
    curtain.hidden = true;
    curtain.style.opacity = '0';
    root.classList.remove('section-jumping');
  }

  function jump(target, hash, keyboard) {
    const oldURL = location.href;
    const inset = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
    const position = Math.max(0, target.getBoundingClientRect().top + scrollY - inset);
    window.scrollTo({top: position, left: 0, behavior: 'auto'});
    if (location.hash !== hash) {
      history.pushState(history.state, '', hash);
      window.dispatchEvent(new HashChangeEvent('hashchange', {oldURL, newURL: location.href}));
    }
    // Snap scroll-driven artwork to its destination while the curtain is opaque.
    window.dispatchEvent(new Event('sectionjump'));
    if (keyboard) {
      const heading = target.querySelector('h1, h2') || target;
      const previousTabindex = heading.getAttribute('tabindex');
      heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
      heading.addEventListener('blur', () => {
        if (previousTabindex === null) heading.removeAttribute('tabindex');
        else heading.setAttribute('tabindex', previousTabindex);
      }, {once: true});
    }
  }

  async function fadeTo(opacity, duration) {
    const from = Number(getComputedStyle(curtain).opacity);
    animation?.cancel();
    animation = curtain.animate([{opacity: from}, {opacity}], {
      duration, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards'
    });
    await animation.finished;
    curtain.style.opacity = String(opacity);
  }

  async function navigate(target, hash, keyboard, instant) {
    const current = ++sequence;
    root.classList.add('section-jumping');
    if (instant || reduced.matches || typeof curtain.animate !== 'function') {
      jump(target, hash, keyboard);
      clearCurtain();
      return;
    }
    if (curtain.hidden) {
      curtain.style.opacity = '0';
      curtain.hidden = false;
    }
    try {
      await fadeTo(1, 220);
      if (current !== sequence) return;
      jump(target, hash, keyboard);
      // Allow layout, image decode and scroll-linked art to settle behind the curtain.
      await frame();
      await frame();
      await pause(70);
      if (current !== sequence) return;
      await fadeTo(0, 280);
    } catch (error) {
      if (current === sequence && error.name !== 'AbortError') jump(target, hash, keyboard);
    } finally {
      if (current === sequence) clearCurtain();
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const hash = link.getAttribute('href');
    if (hash.length < 2) return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    void navigate(target, hash, event.detail === 0, link.classList.contains('skip-link'));
  });

  curtain.addEventListener('wheel', event => event.preventDefault(), {passive: false});
  window.addEventListener('pagehide', () => { sequence++; clearCurtain(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { sequence++; clearCurtain(); } });
})();