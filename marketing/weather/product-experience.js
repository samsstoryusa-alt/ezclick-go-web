(() => {
 'use strict';
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 // Static articles remain readable if JavaScript or a media file is unavailable.
 function tabs(container, onSelect) {
  if (!container) return;
  const buttons = Array.from(container.querySelectorAll('[role=tab]'));
  const panels = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));
  if (panels.some(panel => !panel)) return;
  function select(index, focus = false) {
   buttons.forEach((button, i) => {
    button.setAttribute('aria-selected', String(i === index));
    button.tabIndex = i === index ? 0 : -1;
    panels[i].hidden = i !== index;
    panels[i].inert = i !== index;
    panels[i].setAttribute('aria-hidden', String(i !== index));
   });
   onSelect(buttons[index], panels[index]);
   if (focus) buttons[index].focus();
  }
  panels.forEach((panel, i) => {
   panel.setAttribute('role', 'tabpanel');
   panel.setAttribute('aria-labelledby', buttons[i].id);
   panel.tabIndex = 0;
  });
  buttons.forEach((button, i) => {
   button.addEventListener('click', () => select(i));
   button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (i + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (i + buttons.length - 1) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
   });
  });
  container.hidden = false;
  select(0);
 }
 const map = document.querySelector('.example-map');
 const capture = document.getElementById('example-capture');
 const captureLink = document.querySelector('.example-image-link');
 let selection = 0;
 tabs(document.querySelector('.example-options'), (button, panel) => {
  const key = button.dataset.example;
  const token = ++selection;
  panel.classList.remove('is-changing');
  if (!reduced.matches) {
   void panel.offsetWidth;
   panel.classList.add('is-changing');
  }
  const nextSource = key === 'edit' ? 'assets/recorded-edit.webp' : 'assets/recorded-route.webp';
  if (capture.getAttribute('src') === nextSource) {
   map.dataset.view = key;
   captureLink.href = nextSource;
   return;
  }
  // Keep the existing capture visible until the next one has decoded.
  const next = new Image();
  next.src = nextSource;
  const swap = () => {
   if (token !== selection) return;
   capture.src = nextSource;
   captureLink.href = nextSource;
   map.dataset.view = key;
   capture.alt = key === 'edit'
    ? 'Recorded app screenshot with Edit mode open, controls to set route points A and B, Undo and the existing route through Columbia.'
    : 'Recorded map of Nashville to Jacksonville via Columbia, with colored weather checkpoints and the Nashville forecast.';
  };
  if (typeof next.decode === 'function') next.decode().then(swap).catch(() => {});
  else next.onload = swap;
 });
 tabs(document.querySelector('.drive-tabs'), button => {
  const truck = button.dataset.drive === 'truck';
  document.querySelectorAll('[data-drive-image]').forEach(img => {
   const active = img.dataset.driveImage === button.dataset.drive;
   img.classList.toggle('is-active', active);
   img.setAttribute('aria-hidden', String(!active));
   img.alt = active ? (truck ? 'A blue semi truck with a silver trailer and two rear trailer axles on a wet mountain highway, in an illustrative scene.' : 'A winding road leads across green hills toward distant rain.') : '';
  });
  const caption = document.getElementById('drive-art-caption');
  if (caption) caption.textContent = truck ? 'The long haul. With weather in view.' : 'A little planning. A different perspective.';
 });
 document.body.classList.add('product-enhanced');
 if (!captureLink || typeof HTMLDialogElement === 'undefined') return;
 const dialog = document.createElement('dialog');
 dialog.className = 'capture-dialog';
 dialog.setAttribute('aria-label', 'Recorded EZ Click Weather app screenshot');
 const bar = document.createElement('div');
 bar.className = 'capture-dialog-bar';
 const title = document.createElement('span');
 title.textContent = 'Inside EZ Click Weather';
 const close = document.createElement('button');
 close.type = 'button';
 close.textContent = 'Close ×';
 const zoom = document.createElement('button');
 zoom.type = 'button';
 zoom.textContent = 'Zoom in';
 zoom.setAttribute('aria-pressed', 'false');
 const actions = document.createElement('div');
 actions.className = 'capture-dialog-actions';
 actions.append(zoom, close);
 bar.append(title, actions);
 const large = document.createElement('img');
 const caption = document.createElement('p');
 caption.className = 'capture-dialog-caption';
 caption.textContent = 'Actual app capture · October 9, 2026 · Recorded example, not current weather.';
 const viewport = document.createElement('div');
 viewport.className = 'capture-dialog-viewport';
 viewport.tabIndex = 0;
 viewport.setAttribute('role', 'region');
 viewport.setAttribute('aria-label', 'App capture. Use Zoom in to inspect, then scroll or swipe the image.');
 viewport.append(large);
 dialog.append(bar, viewport, caption);
 zoom.addEventListener('click', () => {
  const active = viewport.classList.toggle('is-zoomed');
  zoom.setAttribute('aria-pressed', String(active));
  zoom.textContent = active ? 'Fit image' : 'Zoom in';
 });
 document.body.append(dialog);
 let previousOverflow = '';
 captureLink.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  viewport.classList.remove('is-zoomed');
  zoom.setAttribute('aria-pressed', 'false');
  zoom.textContent = 'Zoom in';
  large.src = captureLink.href;
  large.alt = capture.alt;
  previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  refreshZoom();
 });
 function refreshZoom() {
  const useful = viewport.clientWidth < 1248;
  zoom.hidden = !useful;
  if (!useful) {
   viewport.classList.remove('is-zoomed');
   zoom.setAttribute('aria-pressed', 'false');
   zoom.textContent = 'Zoom in';
  }
 }
 window.addEventListener('resize', () => { if (dialog.open) refreshZoom(); });
 close.addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
 });
 dialog.addEventListener('close', () => {
  document.documentElement.style.overflow = previousOverflow;
  captureLink.focus({preventScroll:true});
 });
})();