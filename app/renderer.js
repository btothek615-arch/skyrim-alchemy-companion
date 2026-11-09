/* global Alchemy, ALCHEMY_DATA */
'use strict';

const engine = Alchemy.createEngine(ALCHEMY_DATA);
const { ingByName, effectsByName } = engine;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US');

const state = {
  slots: [null, null, null],   // ingredient objects
  query: '',
  hiddenSources: new Set(),   // source keys unchecked in the Sources panel
  skill: 100,
  effQuery: '',
  effType: '',
  open: new Set(),
  favorites: [],
};

const selected = () => state.slots.filter(Boolean);
const tagLabel = (ing) => (ing.tag === 'CC' ? ing.source : ing.tag === 'Base' ? 'Base' : ing.tag);
const tagHtml = (ing) => `<span class="tag ${esc(ing.tag)}" title="${esc(ing.source)}">${esc(tagLabel(ing))}</span>` + (ing.quest ? '<span class="tag q" title="Quest / limited-sample ingredient">Quest</span>' : '');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1900);
}

/* ---------------- storage ---------------- */
const store = {
  async load() {
    if (window.sac) return (await window.sac.getFavorites()) || [];
    try { return JSON.parse(localStorage.getItem('sac.favorites') || '[]'); } catch { return []; }
  },
  async save(list) {
    if (window.sac) return window.sac.setFavorites(list);
    localStorage.setItem('sac.favorites', JSON.stringify(list));
  },
};

/* ---------------- source filter ---------------- */
const MAIN_SOURCES = [['Base', 'Base game'], ['DG', 'Dawnguard'], ['HF', 'Hearthfire'], ['DB', 'Dragonborn']];
const sourceKey = (ing) => (ing.tag === 'CC' ? 'CC:' + ing.source : ing.tag);
const visibleIngredients = () => ALCHEMY_DATA.ingredients.filter((i) => !state.hiddenSources.has(sourceKey(i)));
const ccSources = () => [...new Set(ALCHEMY_DATA.ingredients.filter((i) => i.tag === 'CC').map((i) => i.source))].sort((a, b) => a.localeCompare(b));
const countBy = (key) => ALCHEMY_DATA.ingredients.filter((i) => sourceKey(i) === key).length;

function initSources() {
  try { (JSON.parse(localStorage.getItem('sac.hiddenSources') || '[]') || []).forEach((k) => state.hiddenSources.add(k)); } catch { /* ignore */ }
  const cb = (key, label, cls = '') => `<label class="src-cb ${cls}"><input type="checkbox" data-src="${esc(key)}"><span>${esc(label)}</span><em>${countBy(key)}</em></label>`;
  const cc = ccSources();
  $('#srcBody').innerHTML = `
    <div class="src-main">${MAIN_SOURCES.map(([k, l]) => cb(k, l)).join('')}</div>
    <details class="src-cc">
      <summary><label class="src-cb master"><input type="checkbox" id="ccMaster"><span>Creation Club</span><em>${cc.reduce((n, s) => n + countBy('CC:' + s), 0)}</em></label></summary>
      <div class="src-cc-list">${cc.map((s) => cb('CC:' + s, s)).join('')}</div>
    </details>
    <div class="src-actions"><button class="linkbtn" data-srcall="1">Select all</button><button class="linkbtn" data-srcall="0">Clear all</button></div>`;
  $('#srcBody').addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'ccMaster') cc.forEach((s) => (t.checked ? state.hiddenSources.delete('CC:' + s) : state.hiddenSources.add('CC:' + s)));
    else if (t.dataset.src) (t.checked ? state.hiddenSources.delete(t.dataset.src) : state.hiddenSources.add(t.dataset.src));
    sourcesChanged();
  });
  $('#srcBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-srcall]'); if (!b) return;
    const keys = [...MAIN_SOURCES.map(([k]) => k), ...cc.map((s) => 'CC:' + s)];
    if (b.dataset.srcall === '1') state.hiddenSources.clear(); else keys.forEach((k) => state.hiddenSources.add(k));
    sourcesChanged();
  });
  // clicking the master checkbox must not toggle the <details>
  $('#ccMaster').addEventListener('click', (e) => e.stopPropagation());
  $('.src-cc summary .src-cb').addEventListener('click', (e) => { if (e.target.id !== 'ccMaster') { e.preventDefault(); e.currentTarget.closest('details').toggleAttribute('open'); } });
  syncSourceUI();
}

function syncSourceUI() {
  $$('#srcBody input[data-src]').forEach((i) => { i.checked = !state.hiddenSources.has(i.dataset.src); });
  const cc = ccSources(); const on = cc.filter((s) => !state.hiddenSources.has('CC:' + s)).length;
  const m = $('#ccMaster'); m.checked = on === cc.length; m.indeterminate = on > 0 && on < cc.length;
  const total = MAIN_SOURCES.length + cc.length; const shown = total - state.hiddenSources.size;
  $('#srcSummary').textContent = shown === total ? 'All sources' : `${shown} of ${total} shown`;
}

function sourcesChanged() {
  localStorage.setItem('sac.hiddenSources', JSON.stringify([...state.hiddenSources]));
  syncSourceUI(); renderList();
}

/* ---------------- builder: list ---------------- */
function renderList() {
  const sel = selected();
  let list = engine.compatible(sel, visibleIngredients());
  list = engine.search(list, state.query);
  const wanted = new Set(sel.flatMap(engine.effectNames));
  const full = sel.length >= 3;
  $('#listInfo').textContent = sel.length
    ? `${list.length} compatible ingredient${list.length === 1 ? '' : 's'}${full ? ' · potion complete' : ''}`
    : `${list.length} of ${ALCHEMY_DATA.ingredients.length} ingredients${state.hiddenSources.size ? ' (some sources hidden)' : ''}`;
  const ul = $('#ingList');
  if (!list.length) {
    ul.innerHTML = `<li class="empty">${sel.length ? 'No other ingredient shares an effect with your selection.' : 'No ingredients match your search.'}</li>`;
    return;
  }
  ul.innerHTML = list.map((ing) => {
    const shared = sel.length ? engine.effectNames(ing).filter((n) => wanted.has(n)) : [];
    return `<li class="ing-item" data-name="${esc(ing.name)}" title="${esc(ing.effects.map((e) => e.name).join(' · '))}">
      <span class="nm">${esc(ing.name)}</span>
      ${shared.length ? `<span class="shared">${shared.map((s) => `<b>${esc(s)}</b>`).join(', ')}</span>` : ''}
      ${tagHtml(ing)}</li>`;
  }).join('');
}

function addIngredient(ing) {
  if (state.slots.some((s) => s && s.name === ing.name)) return toast(`${ing.name} is already selected`);
  const idx = state.slots.indexOf(null);
  if (idx < 0) return toast('All three slots are full — remove an ingredient first');
  const sel = selected();
  if (sel.length && !engine.compatible(sel, [ing]).length) return toast(`${ing.name} shares no effect with your selection`);
  state.slots[idx] = ing;
  renderBuilder();
}

function removeSlot(i) { state.slots[i] = null; renderBuilder(); }
function resetBuilder() { state.slots = [null, null, null]; renderBuilder(); }

/* ---------------- builder: slots & result ---------------- */
function multText(ing, e) {
  const E = effectsByName.get(e.name);
  if (e.noPotion) return 'Unique effect — cannot be brewed';
  const parts = [];
  const magTxt = `mag ${fmt(e.mag)}`; const durTxt = `dur ${fmt(e.dur)}s`;
  const mm = E.baseMag ? e.mag / E.baseMag : 1; const dm = E.baseDur ? e.dur / E.baseDur : 1;
  parts.push(`${magTxt} <span class="${Math.abs(mm - 1) > 1e-3 ? 'ns' : ''}">(×${fmt(mm)})</span>`);
  parts.push(`${durTxt} <span class="${Math.abs(dm - 1) > 1e-3 ? 'ns' : ''}">(×${fmt(dm)})</span>`);
  if (e.estimated) parts.push('<span title="Hidden value derived from UESP gold multiplier">≈</span>');
  return parts.join(' · ');
}

function renderSlots() {
  const common = engine.commonEffects(selected());
  $$('.slot').forEach((el, i) => {
    const ing = state.slots[i];
    if (!ing) {
      el.className = 'slot card empty';
      const firstEmpty = state.slots.indexOf(null) === i;
      el.innerHTML = `<div><div class="num">${['I', 'II', 'III'][i]}</div><div>${firstEmpty ? 'Choose an ingredient from the list' : 'Empty slot'}</div></div>`;
      return;
    }
    el.className = 'slot card';
    el.innerHTML = `
      <div class="slot-head"><h3>${esc(ing.name)}</h3>
        <button class="x" data-remove="${i}" title="Remove ${esc(ing.name)}" aria-label="Remove">×</button></div>
      <div class="slot-meta">${tagHtml(ing)}<span>${esc(ing.source)}</span><span>· ${fmt(ing.value)} gold</span>${ing.weight != null ? `<span>· ${fmt(ing.weight)} wt</span>` : ''}</div>
      <ul class="eff-rows">${ing.effects.map((e) => {
        const E = effectsByName.get(e.name);
        return `<li class="eff-row ${common.has(e.name) ? 'common' : ''} ${e.noPotion ? 'disabled' : ''}" title="${esc(E.description || '')}">
          <span class="en ${E.type}">${esc(e.name)}</span><span class="mult">${multText(ing, e)}</span></li>`;
      }).join('')}</ul>
      <span class="slot-num">${['I', 'II', 'III'][i]}</span>`;
  });
}

function renderResult() {
  const sel = selected();
  const el = $('#result');
  if (sel.length < 2) {
    el.innerHTML = `<div class="hint"><h2>${sel.length ? 'Add a second ingredient' : 'Begin your brew'}</h2>
      <p>${sel.length ? `The list now shows only ingredients that share an effect with <b>${esc(sel[0].name)}</b>.` :
        'Pick an ingredient on the left. The list will narrow to ingredients that can form a viable potion with it. Shared effects are highlighted in yellow.'}</p>
      ${sel.length ? '<div class="actions" style="justify-content:center"><button class="btn" data-act="reset">Reset</button></div>' : ''}</div>`;
    return;
  }
  const p = engine.brew(sel, state.skill);
  if (!p.viable) {
    el.innerHTML = `<div class="hint"><h2>No common effects</h2><p>These ingredients share no effects.</p>
      <div class="actions" style="justify-content:center"><button class="btn" data-act="reset">Reset</button></div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="result-head">
      <div><div class="kind">${p.kind} · ${sel.length} ingredients · skill ${state.skill}</div><h2>${esc(p.title)}</h2></div>
      <div class="spacer"></div>
      <div class="gold"><span class="coin"></span>${p.value}<small>base gold</small></div>
      <div class="actions">
        <button class="btn primary" data-act="save">★ Save to Favorites</button>
        <button class="btn" data-act="reset">Reset</button>
      </div>
    </div>
    <div class="result-body">
      <table class="res-table">
        <thead><tr><th>Effect</th><th>Type</th><th class="num">Magnitude</th><th class="num">Duration</th><th>Strength from</th><th class="num">Gold</th></tr></thead>
        <tbody>${p.effects.map((e) => `<tr>
          <td><b>${esc(e.name)}</b><div class="desc">${esc(describe(e))}</div></td>
          <td><span class="pill ${e.type}">${e.type === 'positive' ? 'Beneficial' : 'Harmful'}</span></td>
          <td class="num">${fmt(e.mag)}</td><td class="num">${e.dur ? fmt(e.dur) + ' s' : '—'}</td>
          <td>${esc(e.from)}</td><td class="num"><b>${e.gold}</b></td></tr>`).join('')}</tbody>
      </table>
      ${p.unused.length ? `<div class="warn">⚠ ${p.unused.map(esc).join(', ')} contributes no active effect and would be wasted.</div>` : ''}
      <div class="note">Value = Σ floor(BaseCost × (Mag × Dur/10)<sup>1.1</sup>) per effect, alchemy skill ${state.skill}, no perks or Fortify Alchemy (UESP formula). Each effect uses the strongest contributing ingredient's magnitude/duration.</div>
    </div>`;
}

function describe(e) {
  return (e.description || '').replace(/<mag>/g, fmt(e.mag)).replace(/<dur>/g, fmt(e.dur));
}

function renderBuilder() { renderSlots(); renderResult(); renderList(); }

async function saveFavorite() {
  const sel = selected();
  const p = engine.brew(sel, state.skill);
  if (sel.length < 2 || !p.viable) return toast('Select at least two compatible ingredients');
  const key = sel.map((i) => i.name).sort().join('|');
  if (state.favorites.some((f) => f.ingredients.slice().sort().join('|') === key)) return toast('This combination is already in Favorites');
  state.favorites.unshift({ id: Date.now().toString(36), ingredients: sel.map((i) => i.name), title: p.title, savedAt: new Date().toISOString() });
  await store.save(state.favorites);
  renderFavorites();
  toast(`Saved “${p.title}” to Favorites`);
}

/* ---------------- effects index ---------------- */
function renderEffects() {
  const q = state.effQuery.trim().toLowerCase();
  const list = ALCHEMY_DATA.effects.filter((E) => (!state.effType || E.type === state.effType) &&
    (!q || E.name.toLowerCase().includes(q) || E.ingredients.some((r) => r.ingredient.toLowerCase().includes(q))));
  $('#effList').innerHTML = list.length ? list.map((E) => {
    const open = state.open.has(E.name) || (q && !E.name.toLowerCase().includes(q));
    const rows = E.ingredients.slice().sort((a, b) => a.ingredient.localeCompare(b.ingredient)).map((r) => {
      const ing = ingByName.get(r.ingredient);
      const nsM = Math.abs(r.mag - E.baseMag) > 1e-6 && !E.noPotion;
      const nsD = Math.abs(r.dur - E.baseDur) > 1e-6 && !E.noPotion;
      const gold = E.noPotion ? '—' : engine.effectStrength(E.name, r, state.skill).gold;
      return `<tr><td><button class="linkbtn" data-add="${esc(r.ingredient)}" title="Add to Potion Builder">${esc(r.ingredient)}</button></td>
        <td>${tagHtml(ing)} <span class="desc">${esc(r.source)}</span></td>
        <td class="num ${nsM ? 'nonstd' : ''}">${fmt(r.mag)}</td><td class="num ${nsD ? 'nonstd' : ''}">${fmt(r.dur)}</td>
        <td class="num">${['1st', '2nd', '3rd', '4th'][r.slot - 1]}</td><td class="num">${gold}</td></tr>`;
    }).join('');
    return `<div class="eff-item card ${open ? 'open' : ''}" data-eff="${esc(E.name)}">
      <div class="eff-sum"><svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        <span class="en ${E.type}">${esc(E.name)}</span><span class="d">${esc((E.description || '').replace(/<mag>/g, 'X').replace(/<dur>/g, 'Y'))}</span>
        <span class="stats">${E.ingredients.length} ingredient${E.ingredients.length === 1 ? '' : 's'}${E.noPotion ? '' : ` · cost ${E.baseCost} · mag ${E.baseMag} · dur ${E.baseDur}`}</span></div>
      <div class="eff-detail"><table><thead><tr><th>Ingredient</th><th>Source</th><th class="num">Base mag</th><th class="num">Base dur</th><th class="num">Slot</th><th class="num">Gold @${state.skill}</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="note">Highlighted numbers are non-standard strengths. Gold is this effect alone at skill ${state.skill}, no perks.</div></div></div>`;
  }).join('') : '<div class="empty-state"><h2>No effects found</h2></div>';
}

/* ---------------- favorites ---------------- */
function renderFavorites() {
  $('#favCount').textContent = state.favorites.length;
  const el = $('#favList');
  if (!state.favorites.length) {
    el.innerHTML = '<div class="empty-state"><h2>No favorites yet</h2><p>Build a potion with two or three ingredients and press “Save to Favorites”.</p></div>';
    return;
  }
  el.innerHTML = state.favorites.map((f) => {
    const ings = f.ingredients.map((n) => ingByName.get(n)).filter(Boolean);
    const missing = f.ingredients.length - ings.length;
    const p = engine.brew(ings, state.skill);
    return `<div class="fav card" data-id="${esc(f.id)}">
      <div class="fav-head"><h3>${esc(p.title || f.title || 'Unknown mixture')}</h3><div class="gold"><span class="coin"></span>${p.value}</div></div>
      <div class="fav-ings">${ings.map((i) => `<span class="chip">${esc(i.name)} ${tagHtml(i)}</span>`).join('')}</div>
      <div class="fav-effs">${p.effects.map((e) => `<span class="pill ${e.type}" title="mag ${fmt(e.mag)}, dur ${fmt(e.dur)}s, ${e.gold} gold">${esc(e.name)} · ${fmt(e.mag)}${e.dur ? ` / ${fmt(e.dur)}s` : ''}</span>`).join('')}</div>
      ${missing ? '<div class="warn">Some ingredients from this favorite are not in the current data set.</div>' : ''}
      <div class="fav-foot"><span class="fav-date">Saved ${new Date(f.savedAt).toLocaleString()}</span><span class="spacer"></span>
        <button class="btn primary" data-load="${esc(f.id)}">Load in Builder</button><button class="btn" data-del="${esc(f.id)}">Delete</button></div></div>`;
  }).join('');
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
}

/* ---------------- theme ---------------- */
function applyTheme(mode) {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  if (window.sac) window.sac.setTheme(mode);
  localStorage.setItem('sac.theme', mode);
}

/* ---------------- wiring ---------------- */
function init() {
  $('#dataCount').textContent = `${ALCHEMY_DATA.ingredients.length} ingredients · ${ALCHEMY_DATA.effects.length} effects`;
  initSources();

  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#ingSearch').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });
  $('#ingSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = $('#ingList .ing-item'); if (first) addIngredient(ingByName.get(first.dataset.name)); }
  });
  $('#ingList').addEventListener('click', (e) => {
    const li = e.target.closest('.ing-item'); if (li) addIngredient(ingByName.get(li.dataset.name));
  });
  $('.slots').addEventListener('click', (e) => { const b = e.target.closest('[data-remove]'); if (b) removeSlot(+b.dataset.remove); });
  $('#result').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'reset') resetBuilder(); else if (b.dataset.act === 'save') saveFavorite();
  });
  $('#skill').addEventListener('change', (e) => {
    state.skill = Math.min(100, Math.max(15, parseInt(e.target.value, 10) || 100)); e.target.value = state.skill;
    renderBuilder(); renderEffects(); renderFavorites();
  });
  $('#effSearch').addEventListener('input', (e) => { state.effQuery = e.target.value; renderEffects(); });
  $('#effType').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#effType button').forEach((x) => x.classList.toggle('on', x === b)); state.effType = b.dataset.type; renderEffects();
  });
  $('#effList').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const ing = ingByName.get(add.dataset.add);
      switchTab('builder');
      if (selected().length >= 3) resetBuilder();
      addIngredient(ing);
      return;
    }
    const sum = e.target.closest('.eff-sum'); if (!sum) return;
    const item = sum.parentElement; const name = item.dataset.eff;
    item.classList.toggle('open');
    if (item.classList.contains('open')) state.open.add(name); else state.open.delete(name);
  });
  $('#favList').addEventListener('click', async (e) => {
    const load = e.target.closest('[data-load]'); const del = e.target.closest('[data-del]');
    if (load) {
      const f = state.favorites.find((x) => x.id === load.dataset.load);
      state.slots = [0, 1, 2].map((i) => (f.ingredients[i] && ingByName.get(f.ingredients[i])) || null);
      renderBuilder(); switchTab('builder'); toast('Favorite loaded');
    } else if (del) {
      state.favorites = state.favorites.filter((x) => x.id !== del.dataset.del);
      await store.save(state.favorites); renderFavorites(); toast('Favorite deleted');
    }
  });

  const theme = localStorage.getItem('sac.theme') || 'system';
  $('#theme').value = theme; applyTheme(theme);
  $('#theme').addEventListener('change', (e) => applyTheme(e.target.value));

  renderBuilder(); renderEffects();
  store.load().then((f) => { state.favorites = Array.isArray(f) ? f : []; renderFavorites(); });
}

init();
