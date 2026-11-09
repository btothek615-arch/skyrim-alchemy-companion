const assert = require('assert');
const data = require('../app/data/alchemy.json');
const eng = require('../app/alchemy.js').createEngine(data);
const I = (n) => { const i = eng.ingByName.get(n); assert(i, 'missing ' + n); return i; };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('dataset size', () => {
  assert.strictEqual(data.ingredients.length, 190);
  data.ingredients.forEach((i) => assert.strictEqual(i.effects.length, 4, i.name));
});
t('standard effect values at skill 100 match UESP table', () => {
  data.effects.filter((e) => e.uespValue100 != null).forEach((E) => {
    const s = eng.effectStrength(E.name, { mag: E.baseMag, dur: E.baseDur }, 100);
    assert.strictEqual(s.gold, E.uespValue100, E.name);
  });
});
t('Blue Mountain Flower + Wheat = Restore/Fortify Health potion', () => {
  const p = eng.brew([I('Blue Mountain Flower'), I('Wheat')]);
  assert.deepStrictEqual([...p.active].sort(), ['Fortify Health', 'Restore Health']);
  assert.strictEqual(p.kind, 'Potion');
});
t('River Betty controls Damage Health over Nirnroot (priority by strength)', () => {
  const p = eng.brew([I('River Betty'), I('Nirnroot')]);
  const dh = p.effects.find((e) => e.name === 'Damage Health');
  assert.strictEqual(dh.from, 'River Betty'); assert.strictEqual(dh.mag, 30);
});
t('3 ingredients: effect active when shared by >= 2', () => {
  const p = eng.brew([I('Blue Mountain Flower'), I('Wheat'), I('Giant\'s Toe')]);
  assert(p.active.has('Fortify Health') && p.active.has('Restore Health'));
});
t('no common effect -> not viable', () => {
  assert.strictEqual(eng.brew([I('Abecean Longfin'), I('Bear Claws')]).viable, false);
});
t('compatible list excludes selected and requires a shared effect', () => {
  const a = I('Abecean Longfin');
  const c = eng.compatible([a]);
  assert(!c.includes(a));
  c.forEach((i) => assert(i.effects.some((e) => a.effects.some((x) => x.name === e.name))));
  const c2 = eng.compatible([a, I('Wheat')]);
  assert(c2.length > c.length);
});
t('Glassfish Fortify Persuasion never brews', () => {
  assert(!eng.compatible([I('Glassfish')]).some((i) => i.effects.some((e) => e.name === 'Fortify Persuasion')));
});
console.log(`${n} tests passed`);
