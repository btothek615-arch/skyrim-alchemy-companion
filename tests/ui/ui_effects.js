(async () => {
  document.querySelector('.tab[data-tab="effects"]').click();
  const s = document.querySelector('#effSearch'); s.value = 'damage health'; s.dispatchEvent(new Event('input'));
  document.querySelector('.eff-item[data-eff="Damage Health"] .eff-sum').click();
  const rows = document.querySelectorAll('.eff-item[data-eff="Damage Health"] tbody tr').length;
  return { items: document.querySelectorAll('.eff-item').length, dhRows: rows };
})()
