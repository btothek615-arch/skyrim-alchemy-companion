(async () => {
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('.tab[data-tab="favorites"]').click();
  return { favs: document.querySelectorAll('.fav').length, text: document.querySelector('.fav h3')?.textContent };
})()
