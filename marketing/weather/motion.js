(() => {
  'use strict';
  const film = document.querySelector('.film');
  const stage = document.querySelector('.film-stage');
  const video = document.querySelector('#heroVideo');
  const intro = document.querySelector('#heroCopy');
  const toggle = document.querySelector('#filmToggle');
  const toggleLabel = document.querySelector('#filmToggleLabel');
  const chapter = document.querySelector('#chapterName');
  const progressBar = document.querySelector('#filmProgress');
  const hint = document.querySelector('#scrollHint');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const FPS = 60;
  let ready = video.readyState >= 2;
  let playing = false;
  let frame = 0;
  let previousTime = 0;
  let targetProgress = 0;
  let visibleProgress = 0;
  let wantedTime = 0;
  let filmHeight = film.offsetHeight;
  let viewportHeight = stage.offsetHeight;
  let filmTop = film.getBoundingClientRect().top + window.scrollY;
  let lastChapter = '';
  let mediaRequested = !!video.querySelector('source[src]') || !!video.getAttribute('src');
  let mediaFailed = false;
  const initialAnchor = location.hash && location.hash !== '#top' ? document.getElementById(location.hash.slice(1)) : null;
  let waitingForInitialAnchor = !!initialAnchor;
  function canAutoLoadHero() {
    if (waitingForInitialAnchor) {
      const target = initialAnchor.getBoundingClientRect();
      if (target.top < innerHeight && target.bottom > 0) waitingForInitialAnchor = false;
    }
    return !waitingForInitialAnchor && !reduced.matches;
  }
  function ensureHeroLoaded() {
    if (mediaRequested || mediaFailed) return;
    mediaRequested = true;
    video.preload = 'auto';
    for (const source of video.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
    video.load();
  }
  function heroIsNear() {
    const rect = stage.getBoundingClientRect();
    return rect.bottom > -160 && rect.top < innerHeight + 160;
  }
  function failHero() {
    if (!mediaRequested || mediaFailed) return;
    mediaFailed = true;
    stopPlayback(false);
    ready = false;
    targetProgress = visibleProgress = 0;
    film.classList.add('has-film-error');
    document.querySelector('#filmError').hidden = false;
    toggle.disabled = true;
    toggleLabel.textContent = 'Film unavailable';
    intro.inert = false;
    applyProgress(0);
    filmHeight = film.offsetHeight;
    viewportHeight = stage.offsetHeight;
    window.dispatchEvent(new Event('resize'));
  }

  function applyProgress(progress) {
    if (mediaFailed) progress = 0;
    const opacity = reduced.matches ? 1 : clamp(1 - progress / .26);
    stage.style.setProperty('--intro-opacity', opacity.toFixed(4));
    stage.style.setProperty('--intro-y', `${reduced.matches ? 0 : -Math.min(progress * 110, 30)}px`);
    stage.style.setProperty('--end-opacity', reduced.matches ? '0' : clamp((progress - .85) / .1).toFixed(4));
    stage.style.setProperty('--shade-opacity', (1 - Math.sin(progress * Math.PI) * .67).toFixed(4));
    if (intro.inert !== (opacity < .1)) intro.inert = opacity < .1;
    progressBar.style.transform = `scaleX(${progress})`;
    const label = progress < .34 ? '01 / THE ROAD' : progress < .73 ? '02 / THE WEATHER' : '03 / YOUR ROUTE';
    if (label !== lastChapter) { chapter.textContent = label; lastChapter = label; }
  }

  function readScrollTarget() {
    targetProgress = reduced.matches ? 0 : clamp((window.scrollY - filmTop) / Math.max(1, filmHeight - viewportHeight));
  }

  function seekLatest() {
    if (mediaFailed || !ready || playing || video.seeking || Math.abs(video.currentTime - wantedTime) < .004) return;
    video.currentTime = wantedTime;
  }

  // Ease the camera timeline while preserving native page scrolling and touch.
  // The clock runs only while moving or playing, and stops completely when idle.
  function tick(now) {
    frame = 0;
    const dt = previousTime ? Math.min(50, now - previousTime) : 1000 / FPS;
    previousTime = now;
    if (playing) {
      applyProgress(clamp(video.currentTime / (video.duration || 10)));
      frame = requestAnimationFrame(tick);
      return;
    }
    const difference = targetProgress - visibleProgress;
    visibleProgress = reduced.matches || Math.abs(difference) < .00008
      ? targetProgress
      : visibleProgress + difference * (1 - Math.exp(-dt / 140));
    applyProgress(visibleProgress);
    const duration = Number.isFinite(video.duration) ? video.duration : 10;
    const lastFrame = Math.max(0, Math.round(duration * FPS) - 1);
    const frameIndex = Math.min(lastFrame, Math.round(visibleProgress * lastFrame));
    wantedTime = (frameIndex + .15) / FPS;
    seekLatest();
    if (Math.abs(targetProgress - visibleProgress) >= .00008) frame = requestAnimationFrame(tick);
    else previousTime = 0;
  }

  function wake() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function stopPlayback(syncScroll = true) {
    video.pause();
    playing = false;
    visibleProgress = clamp(video.currentTime / (video.duration || 10));
    toggle.setAttribute('aria-pressed', 'false');
    toggleLabel.textContent = 'Play film';
    if (syncScroll) { readScrollTarget(); wake(); }
    else { if (frame) cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  }

  toggle.addEventListener('click', async () => {
    if (playing) return stopPlayback(false);
    if (mediaFailed) return;
    ensureHeroLoaded();
    playing = true;
    toggle.setAttribute('aria-pressed', 'true');
    toggleLabel.textContent = ready ? 'Pause film' : 'Loading film…';
    if (video.ended || video.currentTime > video.duration - .1) video.currentTime = 0;
    try {
      await video.play();
      if (playing) { toggleLabel.textContent = 'Pause film'; wake(); }
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') { stopPlayback(false); toggleLabel.textContent = 'Try play again'; }
      else failHero();
    }
  });
  video.addEventListener('ended', () => { applyProgress(1); stopPlayback(false); });
  video.addEventListener('seeked', () => {
    if (!playing && Math.abs(video.currentTime - wantedTime) >= .004) wake();
  });
  video.addEventListener('loadeddata', () => { if (!mediaFailed) { ready = true; wake(); } });
  video.addEventListener('error', failHero);
  for (const source of video.querySelectorAll('source')) source.addEventListener('error', failHero);
  window.addEventListener('scroll', () => {
    if (playing) stopPlayback(false);
    if (canAutoLoadHero() && heroIsNear()) ensureHeroLoaded();
    readScrollTarget();
    wake();
  }, { passive: true });
  window.addEventListener('resize', () => {
    filmHeight = film.offsetHeight;
    viewportHeight = stage.offsetHeight;
    filmTop = film.getBoundingClientRect().top + window.scrollY;
    readScrollTarget();
    wake();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (playing) stopPlayback(false);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    } else { readScrollTarget(); wake(); }
  });

  window.addEventListener('sectionjump', () => {
    if (playing) stopPlayback(false);
    readScrollTarget();
    visibleProgress = targetProgress;
    previousTime = 0;
    wake();
  });

  function configureMotion() {
    filmHeight = film.offsetHeight;
    hint.lastChild.textContent = reduced.matches ? 'Explore the journey below' : 'Scroll to take the journey';
    readScrollTarget();
    wake();
  }
  reduced.addEventListener('change', configureMotion);
  configureMotion();
  // Wait for initial hash navigation before deciding whether the film is nearby.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if ('IntersectionObserver' in window) {
      const mediaObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && canAutoLoadHero()) ensureHeroLoaded();
      }, { rootMargin: '160px 0px' });
      mediaObserver.observe(stage);
    } else if (heroIsNear() && canAutoLoadHero()) ensureHeroLoaded();
  }));
  reduced.addEventListener('change', () => { if (canAutoLoadHero() && heroIsNear()) ensureHeroLoaded(); });
  window.addEventListener('hashchange', () => { waitingForInitialAnchor = false; if (canAutoLoadHero() && heroIsNear()) ensureHeroLoaded(); });

  if ('IntersectionObserver' in window && !reduced.matches) {
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  }
})();
