/* A native sticky stage consumes scroll distance without resizing the cards. */
(() => {
  'use strict';
  const section = document.querySelector('.journey');
  const stage = section?.querySelector('.journey-stage');
  const videos = [...(stage?.querySelectorAll('.story-video') || [])];
  if (!stage || !videos.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const autoplay = section.dataset.playback === 'auto';
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  let enabled = false;
  let start = 0;
  let distance = 0;
  let chapterDistance = 0;
  let playable = videos;
  let lastWidth = innerWidth;
  let lastHeight = innerHeight;

  const consumed = () => enabled ? clamp(scrollY - start, 0, distance) : 0;
  window.EZJourneyPin = {
    get enabled() { return enabled; },
    get start() { return start; },
    get end() { return start + distance; },
    consumed,
    motionScrollY: () => scrollY - consumed(),
    progress(video) {
      if (!enabled) return null;
      const index = playable.indexOf(video);
      if (index < 0) return 0;
      // Each clip has its own chapter; the last 20% holds its final frame.
      return clamp(((scrollY - start) / chapterDistance - index) / .8);
    },
  };

  function measure() {
    playable = videos.filter(video => !video.error);
    enabled = !reduced.matches && playable.length > 0 && (!autoplay || innerWidth > 600);
    section.classList.toggle('has-scroll-story', enabled);
    if (!enabled) {
      section.style.removeProperty('height');
      section.style.removeProperty('--story-pin-top');
      distance = 0;
      window.dispatchEvent(new Event('journeypinchange'));
      return;
    }
    const stageTop = stage.getBoundingClientRect().top;
    const cardRects = [...stage.querySelectorAll('.story-photo')].map(card => card.getBoundingClientRect());
    const contentBottom = Math.max(...cardRects.map(rect => rect.bottom - stageTop));
    const activeTop = Math.min(...playable.map(video => video.getBoundingClientRect().top - stageTop));
    const navigationBottom = document.querySelector('.navigation')?.getBoundingClientRect().bottom || 70;
    // Let the heading scroll naturally above the viewport if needed. All card
    // widths, heights, grid positions and gaps stay exactly as authored.
    const fitBottom = Math.min(0, innerHeight - 24 - contentBottom);
    const keepVideosVisible = Math.min(0, navigationBottom + 14 - activeTop);
    const pinTop = Math.max(fitBottom, keepVideosVisible);
    chapterDistance = Math.max(1100, Math.round(innerHeight * 1.8));
    distance = autoplay ? Math.round(innerHeight * .8) : chapterDistance * playable.length;
    section.style.setProperty('--story-pin-top', `${pinTop.toFixed(2)}px`);
    section.style.height = `${stage.offsetHeight + distance}px`;
    start = section.getBoundingClientRect().top + scrollY - pinTop;
    window.dispatchEvent(new Event('journeypinchange'));
  }

  function resize() {
    // Safari's retracting address bar must not keep changing the timeline.
    if (innerWidth === lastWidth && Math.abs(innerHeight - lastHeight) < 140) return;
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    measure();
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pageshow', measure);
  reduced.addEventListener('change', measure);
  for (const video of videos) video.addEventListener('error', measure);
  measure();
  if (document.fonts?.ready) document.fonts.ready.then(measure);
})();
