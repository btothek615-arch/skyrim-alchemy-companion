(async () => {
  document.querySelector('.tab[data-tab="effects"]').click();
  await new Promise(r => setTimeout(r, 200));
  const list = document.querySelector('#effList');
  const before = list.scrollHeight;
  const sumH = () => [...document.querySelectorAll('.eff-sum')].map(s => s.getBoundingClientRect().height);
  document.querySelector('.eff-item[data-eff="Cure Disease"] .eff-sum').click();
  document.querySelector('.eff-item[data-eff="Damage Health"] .eff-sum').click();
  await new Promise(r => setTimeout(r, 200));
  const open = document.querySelectorAll('.eff-item.open').length;
  const after = list.scrollHeight;
  const dh = document.querySelector('.eff-item[data-eff="Damage Health"]').getBoundingClientRect().height;
  const s = sumH();
  // scroll Damage Health into view so the screenshot shows the expanded table pushing rows down
  document.querySelector('.eff-item[data-eff="Damage Health"]').scrollIntoView({ block: 'start' });
  list.scrollTop -= 120;
  return { open, scrollBefore: before, scrollAfter: after, dhItemH: dh, minSumH: Math.min(...s), maxSumH: Math.max(...s) };
})()
