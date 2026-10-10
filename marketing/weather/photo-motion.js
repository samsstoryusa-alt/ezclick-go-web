(() => {
  'use strict';
  const section = document.querySelector('.journey');
  const gallery = section?.querySelector('.photo-story');
  if (!gallery) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 600px)');
  const cards = [...gallery.querySelectorAll('.story-photo')];
  // Keep keyboard and screen-reader order aligned with the responsive grid.
  function syncReadingOrder() {
    const truck = gallery.querySelector('.photo-cabin');
    const voice = gallery.querySelector('.photo-phone');
    if (narrow.matches) gallery.insertBefore(voice, truck);
    else gallery.insertBefore(truck, voice);
  }
  syncReadingOrder();
  // Left and middle drift down at different speeds; right travels against them.
  const rates = [.05, .10, -.12];
  let visible = false;
  let frame = 0;
  let lastTime = 0;
  let current = .5;
  let target = .5;
  let top = 0;
  let height = 0;
  let viewport = innerHeight;
  let lastScrollY = scrollY;
  let lastScrollTime = performance.now();
  const clamp = x => Math.max(0, Math.min(1, x));
  const motionY = () => window.EZJourneyPin?.motionScrollY() ?? scrollY;

  function readTarget() {
    target = clamp((motionY() + viewport - top) / (height + viewport));
  }
  function measure() {
    viewport = innerHeight;
    top = gallery.getBoundingClientRect().top + motionY();
    height = gallery.offsetHeight;
    readTarget();
  }
  function paint() {
    const amount = narrow.matches ? .22 : 1;
    const position = current - .5;
    for (let index = 0; index < cards.length; index++) {
      cards[index].style.setProperty('--card-y', `${(position * (height + viewport) * rates[index] * amount).toFixed(2)}px`);
      cards[index].style.setProperty('--image-y', `${(-position * 34 * amount).toFixed(2)}px`);
      cards[index].style.setProperty('--image-scale', (1.16 - current * .05).toFixed(4));
    }
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    section.classList.remove('is-moving');
  }
  function tick(now) {
    frame = 0;
    if (!visible || reduced.matches || document.hidden) return stop();
    const dt = lastTime ? Math.min(now - lastTime, 50) : 16.667;
    lastTime = now;
    current += (target - current) * (1 - Math.exp(-dt / 110));
    const settled = Math.abs(target - current) < .00015;
    if (settled) current = target;
    paint();
    if (settled) stop();
    else frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (frame || !visible || reduced.matches || document.hidden) return;
    section.classList.add('is-moving');
    frame = requestAnimationFrame(tick);
  }
  function reset() {
    measure();
    current = target;
    if (reduced.matches) {
      stop();
      for (const card of cards) {
        card.style.removeProperty('--card-y');
        card.style.removeProperty('--image-y');
        card.style.removeProperty('--image-scale');
      }
    } else paint();
  }
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const elapsed = now - lastScrollTime;
    const position = motionY();
    const velocity = elapsed < 180 ? (position - lastScrollY) * 1000 / Math.max(8, elapsed) : 0;
    lastScrollY = position;
    lastScrollTime = now;
    if (visible && !reduced.matches) window.EZPhotoWarp?.setScrollVelocity(velocity);
    readTarget();
    wake();
  }, { passive: true });
  window.addEventListener('resize', reset, { passive: true });
  window.addEventListener('journeypinchange', reset);
  window.addEventListener('sectionjump', reset);
  reduced.addEventListener('change', reset);
  narrow.addEventListener('change', () => { syncReadingOrder(); reset(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { reset(); wake(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { reset(); wake(); }
      else stop();
    }, { rootMargin: '220px 0px' }).observe(section);
  } else visible = true;
  reset();
  if (document.fonts?.ready) document.fonts.ready.then(reset);
})();
