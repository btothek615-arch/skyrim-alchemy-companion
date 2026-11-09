/* Core alchemy logic (no DOM). Works in the renderer (window.Alchemy) and in Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Alchemy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createEngine(data) {
    const effectsByName = new Map(data.effects.map((e) => [e.name, e]));
    const ingByName = new Map(data.ingredients.map((i) => [i.name, i]));

    /** Unrounded-then-floored UESP gold formula for one effect. */
    function effectGold(cost, mag, dur) {
      const mf = mag > 0 ? mag : 1;
      const df = dur > 0 ? dur / 10 : 1;
      return Math.floor(cost * Math.pow(mf * df, 1.1));
    }

    /** Potion strength of one ingredient's effect at a given alchemy skill (no perks). */
    function effectStrength(effName, ingEff, skill) {
      const E = effectsByName.get(effName);
      const factor = 4 * (1 + skill / 200); // fAlchemyIngredientInitMult * skill factor
      let mag = ingEff.mag, dur = ingEff.dur;
      if (E.variable === 'dur') dur = Math.round(dur * factor);
      else mag = Math.round(mag * factor);
      return { mag, dur, gold: effectGold(E.baseCost, mag, dur) };
    }

    function isBrewable(effName) {
      const E = effectsByName.get(effName);
      return E && !E.noPotion;
    }

    function effectNames(ing) {
      return ing.effects.filter((e) => isBrewable(e.name)).map((e) => e.name);
    }

    /** Effects present in at least two of the given ingredients. */
    function commonEffects(ings) {
      const count = new Map();
      ings.forEach((ing) => new Set(effectNames(ing)).forEach((n) => count.set(n, (count.get(n) || 0) + 1)));
      return new Set([...count].filter(([, c]) => c >= 2).map(([n]) => n));
    }

    /**
     * Resulting potion. For each active effect the strongest contributing ingredient
     * (highest effect gold value) determines magnitude/duration, as in-game.
     */
    function brew(ings, skill = 100) {
      const active = commonEffects(ings);
      const effects = [];
      active.forEach((name) => {
        let best = null;
        ings.forEach((ing) => {
          const ie = ing.effects.find((e) => e.name === name);
          if (!ie) return;
          const s = effectStrength(name, ie, skill);
          if (!best || s.gold > best.gold) best = Object.assign({ from: ing.name }, s);
        });
        const E = effectsByName.get(name);
        effects.push(Object.assign({ name, type: E.type, variable: E.variable, description: E.description }, best));
      });
      effects.sort((a, b) => b.gold - a.gold || a.name.localeCompare(b.name));
      const value = effects.reduce((s, e) => s + e.gold, 0);
      const lead = effects[0];
      const kind = !lead ? null : lead.type === 'positive' ? 'Potion' : 'Poison';
      const title = lead ? `${kind} of ${lead.name}` : null;
      // ingredients that contribute nothing are wasted in-game
      const unused = ings.filter((ing) => !effectNames(ing).some((n) => active.has(n))).map((i) => i.name);
      return { effects, value, kind, title, active, unused, viable: effects.length > 0 };
    }

    /** Ingredients that share at least one effect with any selected ingredient (selected ones excluded). */
    function compatible(selected, all = data.ingredients) {
      const chosen = new Set(selected.map((i) => i.name));
      if (!selected.length) return all.slice();
      const wanted = new Set(selected.flatMap(effectNames));
      return all.filter((ing) => !chosen.has(ing.name) && effectNames(ing).some((n) => wanted.has(n)));
    }

    function search(list, q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return list;
      return list.filter((i) => i.name.toLowerCase().includes(q) || i.source.toLowerCase().includes(q) ||
        i.effects.some((e) => e.name.toLowerCase().includes(q)));
    }

    return { data, effectsByName, ingByName, effectGold, effectStrength, commonEffects, brew, compatible, search, effectNames };
  }

  return { createEngine };
});
