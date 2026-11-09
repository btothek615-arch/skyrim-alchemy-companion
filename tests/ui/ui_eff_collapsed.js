(async () => {
  document.querySelector('.tab[data-tab="effects"]').click();
  await new Promise(r => setTimeout(r, 200));
  const items = [...document.querySelectorAll('.eff-item')];
  const h = items.map(i => i.getBoundingClientRect().height);
  const list = document.querySelector('#effList');
  return { count: items.length, minH: Math.min(...h), maxH: Math.max(...h), scrollH: list.scrollHeight, clientH: list.clientHeight };
})()
