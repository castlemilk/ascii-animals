(() => {
  'use strict';
  const search = document.querySelector('#animal-search');
  const habitat = document.querySelector('#habitat');
  const availability = document.querySelector('#availability');
  const cards = [...document.querySelectorAll('.animal')];
  const update = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0, available = 0;
    for (const card of cards) {
      const show = card.querySelector('h3').textContent.toLocaleLowerCase().includes(query)
        && (habitat.value === 'all' || habitat.value === card.dataset.habitat)
        && (availability.value === 'all' || availability.value === card.dataset.status);
      card.hidden = !show;
      if (show) { count++; if (card.dataset.status === 'available') available++; }
    }
    document.querySelector('#results').textContent = `${count} ${count === 1 ? 'animal' : 'animals'} · ${available} available`;
    document.querySelector('#empty').hidden = count !== 0;
  };
  search.addEventListener('input', update);
  habitat.addEventListener('change', update);
  availability.addEventListener('change', update);
  document.querySelector('#reset').addEventListener('click', () => {
    search.value = ''; habitat.value = 'all'; availability.value = 'all'; update(); search.focus();
  });
  document.querySelector('.filters').hidden = false;
})();
