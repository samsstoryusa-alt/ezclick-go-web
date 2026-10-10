(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.body.classList.add('faq-enhanced');
  for (const item of document.querySelectorAll('.faq-item')) {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq-answer');
    let expanded = item.open, closeTimer = 0, frame = 0;
    summary.setAttribute('aria-expanded', String(expanded));
    answer.inert = !expanded;
    item.classList.toggle('is-open', expanded);
    summary.addEventListener('click', event => {
      event.preventDefault();
      expanded = !expanded;
      clearTimeout(closeTimer);
      cancelAnimationFrame(frame);
      summary.setAttribute('aria-expanded', String(expanded));
      answer.inert = !expanded;
      if (expanded) {
        item.open = true;
        frame = requestAnimationFrame(() => {
          // Establish the collapsed frame before the height transition.
          void answer.offsetHeight;
          item.classList.add('is-open');
        });
      } else {
        item.classList.remove('is-open');
        if (reduced.matches) item.open = false;
        else closeTimer = setTimeout(() => { if (!expanded) item.open = false; }, 350);
      }
    });
  }
})();