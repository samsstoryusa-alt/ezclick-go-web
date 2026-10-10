(() => {
 'use strict';
 const cards = [...document.querySelectorAll('.plans-grid .plan-card')];
 // Highlighting a card is local preview selection, never a purchase action.
 const controls = new Map();
 function choose(selected) {
  cards.forEach(card => {
   const active = card === selected;
   card.classList.toggle('is-chosen', active);
   controls.get(card).setAttribute('aria-pressed', String(active));
  });
 }
 cards.forEach(card => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'plan-pick';
  button.setAttribute('aria-label', 'Highlight ' + card.querySelector('h3').textContent.trim() + ' plan');
  button.setAttribute('aria-pressed', 'false');
  controls.set(card, button);
  card.append(button);
  card.classList.add('is-selectable');
  button.addEventListener('click', () => choose(card));
  card.addEventListener('click', event => {
   if (event.target.closest('a,button,input,select,textarea,label')) return;
   if (window.getSelection()?.toString()) return;
   choose(card);
   button.focus({preventScroll: true});
  });
 });
})();
