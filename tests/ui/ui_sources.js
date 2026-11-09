(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const count = () => document.querySelectorAll('.ing-item').length;
  const item = (n) => document.querySelector(`.ing-item[data-name="${n}"]`);
  const out = { total: count(), hasDropdown: !!document.querySelector('#sourceFilter') };
  document.querySelector('#sources').open = true;
  document.querySelector('.src-cc').open = true;
  const box = (k) => document.querySelector(`input[data-src="${k}"]`);
  out.boxes = document.querySelectorAll('#srcBody input[data-src]').length;
  out.allChecked = [...document.querySelectorAll('#srcBody input[data-src]')].every(i => i.checked);
  item('Blue Mountain Flower').click();
  out.compatAll = count();
  box('CC:Rare Curios').click();   // uncheck
  out.compatNoRC = count();
  out.ccMasterIndeterminate = document.querySelector('#ccMaster').indeterminate;
  out.anyRCshown = [...document.querySelectorAll('.ing-item .tag')].some(t => t.textContent === 'Rare Curios');
  // select an ingredient then hide its source: must stay selected
  item('Wheat').click();
  box('Base').click();
  out.slotsAfterHideBase = [...document.querySelectorAll('.slot h3')].map(h => h.textContent);
  out.baseShown = [...document.querySelectorAll('.ing-item .tag')].some(t => t.textContent === 'Base');
  box('Base').click(); // re-check base
  out.summary = document.querySelector('#srcSummary').textContent;
  out.persisted = localStorage.getItem('sac.hiddenSources');
  await sleep(100);
  return out;
})()
