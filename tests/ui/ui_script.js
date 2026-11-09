(async () => {
  const click = (sel) => document.querySelector(sel).click();
  const item = (n) => document.querySelector(`.ing-item[data-name="${n}"]`);
  const out = {};
  out.total = document.querySelectorAll('.ing-item').length;
  item('Blue Mountain Flower').click();
  out.afterOne = document.querySelectorAll('.ing-item').length;
  out.firstSlot = document.querySelector('.slot[data-slot="0"] h3').textContent;
  item('Wheat').click();
  out.afterTwo = document.querySelectorAll('.ing-item').length;
  out.highlightedRows = document.querySelectorAll('.eff-row.common').length;
  item("Giant's Toe").click();
  out.title = document.querySelector('.result-head h2').textContent;
  out.value = document.querySelector('.result .gold').textContent.trim();
  out.wheatInList = !!item('Wheat');
  click('[data-act="save"]');
  await new Promise(r => setTimeout(r, 300));
  out.favCount = document.querySelector('#favCount').textContent;
  click('[data-remove="1"]');
  out.afterRemove = [...document.querySelectorAll('.slot h3')].map(h => h.textContent);
  item('Wheat').click();
  return out;
})()
