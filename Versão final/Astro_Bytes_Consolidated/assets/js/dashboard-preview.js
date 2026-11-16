/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

(() => {
  /* Fit cards of different heights without stretching their contents. */
  const grid = document.querySelector('#dashboard-widgets');
  const cards = [...grid.querySelectorAll('[data-widget]')];
  let layoutFrame;

  function scheduleLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      for (const card of cards) {
        if (card.hidden) continue;
        card.style.gridRowEnd = `span ${Math.ceil((card.offsetHeight + 22) / 30)}`;
      }
    });
  }

  const sizeObserver = new ResizeObserver(scheduleLayout);
  cards.forEach(card => sizeObserver.observe(card));
  const visibilityObserver = new MutationObserver(scheduleLayout);
  cards.forEach(card => visibilityObserver.observe(card, {attributes:true, attributeFilter:['hidden']}));
  window.addEventListener('resize', scheduleLayout);
  scheduleLayout();

  const image = document.querySelector("#dashboard-pet-image");
  const message = document.querySelector("#dashboard-pet-message");
  const affection = document.querySelector("#dashboard-pet-button");
  const cheer = document.querySelector("#dashboard-cheer-button");
  const rest = document.querySelector("#dashboard-rest-button");
  let asleep = false;
  let timer;

  function show(expression, text) {
    image.src = `assets/images/rise_pet_${expression}.png`;
    image.alt = `Rise looking ${expression}`;
    message.textContent = text;
  }

  /* Capture affection here to keep one reaction controller per widget. */
  affection.addEventListener("click", (event) => {
    event.stopImmediatePropagation();
    if (asleep) return;
    clearTimeout(timer);
    show("love", "Sending a little love across the stars!");
    timer = setTimeout(() => show("normal", "Ready for a little break?"), 3000);
  }, true);

  cheer.addEventListener("click", () => {
    if (asleep) return;
    clearTimeout(timer);
    show("happy", "A little smile for your space journey!");
    timer = setTimeout(() => show("normal", "Ready for a little break?"), 3000);
  });

  rest.addEventListener("click", () => {
    clearTimeout(timer);
    asleep = !asleep;
    rest.textContent = asleep ? "Wake Up" : "Rest";
    affection.disabled = asleep;
    cheer.disabled = asleep;
    show(asleep ? "asleep" : "normal", asleep ? "Zzz… Resting among the stars." : "Ready for a little break?");
  });
})();
