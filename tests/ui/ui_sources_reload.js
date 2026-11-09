(async () => {
  const r = { persisted: localStorage.getItem('sac.hiddenSources'), rcChecked: document.querySelector('input[data-src="CC:Rare Curios"]').checked, total: document.querySelectorAll('.ing-item').length };
  localStorage.removeItem('sac.hiddenSources');
  return r;
})()
