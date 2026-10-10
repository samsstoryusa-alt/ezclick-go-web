/* Loop visible cards; keep a manual pause available without changing scroll. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const video of document.querySelectorAll('.story-video')) {
    const card = video.closest('.story-photo'), caption = card.querySelector('figcaption');
    const button = document.createElement('button');
    const title = caption.querySelector('h3').textContent;
    button.type = 'button';
    button.className = 'card-playback';
    caption.append(button);
    let visible = false, blocked = false, pausedByUser = false, pending = false, failed = false;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    const update = () => {
      if (failed) { button.hidden = false; button.disabled = true; button.textContent = 'Video unavailable'; button.setAttribute('aria-label', 'Video unavailable: ' + title); return; }
      button.hidden = reduced.matches;
      button.textContent = video.paused ? 'Play video' : 'Pause video';
      button.setAttribute('aria-label', (video.paused ? 'Play: ' : 'Pause: ') + title);
    };
    async function play() {
      if (pending || !video.paused) return;
      pending = true;
      try {
        await video.play();
        if (!visible || document.hidden || pausedByUser || reduced.matches) video.pause();
      } catch (error) {
        if (error.name !== 'AbortError') blocked = true;
      } finally { pending = false; update(); }
    }
    function sync() {
      if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && video.querySelector('source[src]')) { showFailure(); return; }
      video.controls = reduced.matches && !failed;
      if (!visible || document.hidden || reduced.matches || pausedByUser) video.pause();
      else if (!blocked) void play();
      update();
    }
    button.addEventListener('click', () => {
      if (!video.paused) { pausedByUser = true; video.pause(); }
      else { pausedByUser = false; blocked = false; void play(); }
      update();
    });
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    function showFailure() { failed = true; blocked = true; video.pause(); video.controls = false; card.classList.add('caption-visible'); update(); }
    video.addEventListener('error', showFailure);
    for (const source of video.querySelectorAll('source')) source.addEventListener('error', showFailure);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .35;
        if (visible) card.classList.add('caption-visible');
        sync();
      }, { threshold: [0, .35] }).observe(video);
    } else {
      blocked = true; visible = true; video.controls = true;
      card.classList.add('caption-visible');
    }
    sync();
  }
})();