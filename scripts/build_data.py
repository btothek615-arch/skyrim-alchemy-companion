"""Parse the raw UESP wikitext (fetched by fetch_uesp.py) into app/data/alchemy.json.

Effects: Base_Cost / Base_Mag / Base_Dur from the Skyrim:Alchemy Effects "Effect List" table.
Ingredients: value, weight, 4 effects (in order) and non-standard multipliers ({{Effect Mult|mag|x}},
{{Effect Mult|dur|x}}, {{Effect Mult|val|x}}) from each ingredient's {{Ingredient Summary}}.
Per-ingredient explicit Base Mag/Base Dur tables on effect pages (e.g. Damage Health) override.
"""
import json, math, os, re, sys

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "..", "app", "data", "alchemy.json")

top = json.load(open(os.path.join(RAW, "top.json"), encoding="utf-8"))
ing_pages = json.load(open(os.path.join(RAW, "ingredient_pages.json"), encoding="utf-8"))
eff_pages = json.load(open(os.path.join(RAW, "effect_pages.json"), encoding="utf-8"))
notes = []  # verification notes surfaced in the app / README

def clean(s):
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = s.replace("'''", "").replace("''", "")
    return s.strip()

def num(s):
    s = clean(s).replace("<sup>†</sup>", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None

# ---------------------------------------------------------------- effects
eff_text = top["Skyrim:Alchemy Effects"]
eff_text = eff_text[eff_text.find("==Effect List=="):eff_text.find("== Notes ==")]
effects = {}
page_to_name = {}
for row in eff_text.split("\n|-")[1:]:
    m = re.search(r'!class="Effect(Pos|Neg)"\|\{\{Anchor\|\[\[Skyrim:([^|\]]+)\|([^\]]+)\]\]\}\}', row)
    if not m:
        continue
    kind, page, name = m.group(1), m.group(2).strip(), m.group(3).strip()
    row = row.split("\n|}")[0]
    lines = [l for l in row.strip().split("\n") if l.strip()]
    last = lines[-1]
    cells = [c for c in re.split(r"\|\|", last.lstrip("|"))]
    def cellval(c):
        return num(c.split("|")[-1])
    cost, mag, dur, val100 = (cellval(c) for c in cells[:4])
    variable = "mag" if 'class="EffectPos"' in cells[1] else ("dur" if 'class="EffectPos"' in cells[2] else "mag")
    desc = ""
    for l in lines:
        if l.startswith("|") and not l.startswith("||") and "||" not in l and len(l) > 2 and not l.startswith("|-"):
            desc = clean(l[1:])
    effects[name] = dict(name=name, type="positive" if kind == "Pos" else "negative", baseCost=cost,
                         baseMag=mag, baseDur=dur, variable=variable, uespValue100=val100,
                         description=desc, page=page, ingredients=[])
    page_to_name[page] = name
    page_to_name[name] = name

page_to_name.setdefault("Fortify Archery", "Fortify Archery" if "Fortify Archery" in effects else "Fortify Marksman")
page_to_name.setdefault("Fortify Marksman", page_to_name["Fortify Archery"])
if "Fortify Persuasion" not in effects:
    effects["Fortify Persuasion"] = dict(name="Fortify Persuasion", type="positive", baseCost=0, baseMag=0, baseDur=0, variable="mag",
        uespValue100=None, description="Unique to Glassfish (Fishing). No other ingredient has it, so it can never appear in a crafted potion.",
        page="Glassfish", ingredients=[], noPotion=True)
    notes.append("Effect 'Fortify Persuasion' (Glassfish only) is not in UESP's Alchemy Effects table; it cannot be brewed, so no cost data is needed.")

# cross check against each effect page's {{Effect Summary}}
for page, text in eff_pages.items():
    page = page.replace("Skyrim:", "")
    name = page_to_name.get(page)
    m = re.search(r"\{\{Effect Summary(.*?)\n\}\}", text, re.S)
    if not name or not m:
        continue
    kv = {k: clean(v) for k, v in re.findall(r"\|(alch\w+)=([^\n|]*)", m.group(1))}
    e = effects[name]
    for key, fld in (("alchcost", "baseCost"), ("alchmag", "baseMag"), ("alchdur", "baseDur")):
        if kv.get(key) not in (None, "") and abs(float(kv[key]) - e[fld]) > 1e-9:
            notes.append(f"Effect '{name}': {fld} differs between Alchemy Effects table ({e[fld]}) and effect page ({kv[key]}); table value used.")

# explicit per-ingredient base values on effect pages (tables with "Base Mag" / "Base Dur")
explicit = {}  # (ingredient, effect) -> (mag, dur)
for page, text in eff_pages.items():
    name = page_to_name.get(page.replace("Skyrim:", ""))
    if not name or "Base Mag" not in text:
        continue
    tbl = text[text.find("Base Mag") - 400:]
    tbl = tbl[tbl.find("{|"):]
    tbl = tbl[:tbl.find("\n|}")]
    header = re.findall(r"^!(.*)$", tbl, re.M)
    hdr = [clean(h.split("|")[-1]) for h in header]
    try:
        im, idur = hdr.index("Base Mag"), hdr.index("Base Dur")
    except ValueError:
        continue
    for row in tbl.split("\n|-")[1:]:
        row = row.strip().lstrip("|")
        cells = [c.strip() for c in row.split("||")]
        if len(cells) < len(hdr):
            continue
        ing = re.sub(r"\{\{.*?\}\}|<sup>.*?</sup>", "", clean(cells[0])).strip()
        explicit[(ing, name)] = (num(cells[im]), num(cells[idur]))

# ---------------------------------------------------------------- ingredients
ing_text = top["Skyrim:Ingredients"]
cc_start = ing_text.find("==Creation Club Ingredients==")
quest_start = ing_text.find("==Quest Ingredients==")
entries = []
for m in re.finditer(r"\{\{Ingredient Entry\|(.*?)\}\}\s*$", ing_text, re.M):
    body = m.group(1)
    name = re.search(r"ing=([^|]+)", body).group(1).strip()
    st = re.search(r"\|set=([^|]+)", body)
    mod = re.search(r"\|mod=(\{\{[^}]*\}\}|\[\[[^\]]*\]\])", body)
    section = "quest" if m.start() > quest_start else ("cc" if m.start() > cc_start else "main")
    entries.append(dict(name=name, set=st.group(1).strip() if st else None, mod=mod.group(1) if mod else "", section=section))

def summaries(text):
    out = []
    for m in re.finditer(r"\{\{Ingredient Summary(.*?)\n\}\}", text, re.S):
        kv = {}
        # values may contain {{templates|with|pipes}}; split on top-level "|key="
        for k, v in re.findall(r"\|(\w+)=((?:\{\{.*?\}\}|[^|\n{])*)", m.group(1)):
            kv[k] = v.strip()
        out.append(kv)
    return out

def mults(extra):
    d = {k: float(v) for k, v in re.findall(r"Effect Mult\|(mag|dur|val)\|([\d.]+)", extra or "")}
    return d.get("mag", 1.0), d.get("dur", 1.0), d.get("val")

def raw_cost(cost, mag, dur):
    """UESP gold formula, unrounded: cost * max(mag,1)^1.1 * (dur/10 if dur else 1)^1.1."""
    mf = mag if mag > 0 else 1
    df = dur / 10 if dur > 0 else 1
    return cost * (mf * df) ** 1.1

def source_of(entry, kv):
    mod = clean(kv.get("mod", "")) or ""
    page = ing_pages.get("Skyrim:" + entry["name"], "")
    hdr = re.search(r"\{\{CC Header\|([^}|]+)", page)
    if entry["name"] in ("Rot Scale", "Screaming Maw", "Thorn Hook"):
        return "CC", "Saints & Seducers"  # data shipped in Update.esm (SE patch 1.5.97), placed in-world by Saints & Seducers
    if "_ResourcePack" in mod:
        return "Base", "Skyrim (Resource Pack, patch 1.6.1130)"
    if entry["set"] == "bloodchill":
        return "CC", "Bloodchill Manor"
    em = entry["mod"]
    if "{{DG}}" in em: return "DG", "Dawnguard"
    if "{{DB}}" in em: return "DB", "Dragonborn"
    if "Hearthfire" in em: return "HF", "Hearthfire"
    ccm = re.search(r"\{\{CC\|([^}]+)\}\}", em)
    if ccm: return "CC", ccm.group(1)
    if hdr: return "CC", hdr.group(1).strip()
    if mod: return "CC", mod
    if entry["section"] == "cc":
        return "CC", "Creation Club"
    return "Base", "Skyrim"

ingredients = []
seen = set()
for e in entries:
    text = ing_pages.get("Skyrim:" + e["name"])
    if text is None:
        notes.append(f"Ingredient '{e['name']}': UESP page not found; skipped."); continue
    sums = summaries(text)
    if e["set"]:
        sums = [s for s in sums if s.get("set") == e["set"]]
    else:
        sums = [s for s in sums if not s.get("set")] or sums[:1]
    if not sums:
        notes.append(f"Ingredient '{e['name']}' ({e['set']}): no Ingredient Summary found; skipped."); continue
    kv = sums[0]
    tag, src = source_of(e, kv)
    disp = e["name"] + (" (Bloodchill Manor)" if e["set"] == "bloodchill" else "")
    if disp in seen: continue
    seen.add(disp)
    effs = []
    for i in range(1, 5):
        en = clean(kv.get(f"eff{i}", ""))
        en = page_to_name.get(en, en)
        if en not in effects or effects[en].get("noPotion"):
            if en in effects:
                effs.append(dict(name=en, mag=0, dur=0, magMult=1, durMult=1, valMult=None, noPotion=True)); continue
            notes.append(f"Ingredient '{disp}': effect '{en}' not in effect table."); continue
        E = effects[en]
        mm, dm, vm = mults(kv.get(f"extra{i}"))
        mag, dur = E["baseMag"] * mm, E["baseDur"] * dm
        estimated = False
        key = (e["name"], en)
        if key in explicit and explicit[key][0] is not None:
            mag, dur = explicit[key]
            mag = mag if mag is not None else E["baseMag"]
            dur = dur if dur is not None else E["baseDur"]
        elif vm is not None:
            # check the documented gold multiplier is explained by mag/dur multipliers
            std = raw_cost(E["baseCost"], E["baseMag"] * 6, E["baseDur"]) if E["variable"] == "mag" else raw_cost(E["baseCost"], E["baseMag"], E["baseDur"] * 6)
            new = raw_cost(E["baseCost"], mag * 6, dur) if E["variable"] == "mag" else raw_cost(E["baseCost"], mag, dur * 6)
            ratio = new / std if std else 1
            if abs(ratio - vm) / vm > 0.06:
                # hidden (non-displayed) attribute changed; solve it from the gold multiplier
                estimated = True
                f = (vm / ratio) ** (1 / 1.1)
                def rnd(x): return round(x) if x >= 1 else round(x, 2)
                if mm != 1 and dm == 1 and E["baseDur"] > 0:
                    dur = rnd(dur * f)          # magnitude documented -> hidden duration changed
                elif dm != 1 and mm == 1 and E["baseMag"] > 0:
                    mag = rnd(mag * f)          # duration documented -> hidden magnitude changed
                else:
                    fixed = "dur" if E["variable"] == "mag" else "mag"
                    if fixed == "dur" and E["baseDur"] > 0: dur = rnd(dur * f)
                    elif fixed == "mag" and E["baseMag"] > 0: mag = rnd(mag * f)
                    elif E["baseMag"] > 0: mag = rnd(mag * f)
                    else: dur = rnd(dur * f)
                notes.append(f"'{disp}' / {en}: UESP lists gold x{vm} not explained by mag/dur multipliers; hidden value derived from the gold multiplier (mag={mag:.3g}, dur={dur:.3g}).")
        # game data stores whole numbers here; UESP multipliers are rounded to 2 dp (e.g. 300 x 0.03)
        mag = round(mag) if mag >= 1 else round(mag, 2)
        dur = round(dur) if dur >= 1 else round(dur, 2)
        eff = dict(name=en, mag=mag, dur=dur, magMult=round(mag / E["baseMag"], 3) if E["baseMag"] else (mm if mm != 1 else 1),
                   durMult=round(dur / E["baseDur"], 3) if E["baseDur"] else dm, valMult=vm)
        if estimated: eff["estimated"] = True
        effs.append(eff)
    if len(effs) != 4:
        notes.append(f"Ingredient '{disp}' has {len(effs)} parsed effects.")
    item = dict(name=disp, source=src, tag=tag, value=num(kv.get("value", "") or "0") or 0,
                weight=num(kv.get("weight", "") or "") , id=clean(kv.get("id", "")), effects=effs)
    if e["section"] == "quest": item["quest"] = True
    ingredients.append(item)

for ing in ingredients:
    for i, ef in enumerate(ing["effects"]):
        effects[ef["name"]]["ingredients"].append(dict(ingredient=ing["name"], slot=i + 1, mag=ef["mag"], dur=ef["dur"], source=ing["source"], tag=ing["tag"]))

# check computed 100-skill standard value against UESP table value column
for E in effects.values():
    m6 = round(E["baseMag"] * 6) if E["variable"] == "mag" else E["baseMag"]
    d6 = round(E["baseDur"] * 6) if E["variable"] == "dur" else E["baseDur"]
    v = math.floor(raw_cost(E["baseCost"], m6, d6))
    if E["uespValue100"] is not None and v != E["uespValue100"]:
        notes.append(f"Effect '{E['name']}': computed standard value at skill 100 = {v}, UESP table shows {E['uespValue100']:g}.")
    if not E["ingredients"]:
        notes.append(f"Effect '{E['name']}' has no ingredients.")

# in-game (SE/AE) name of the archery effect
if "Fortify Marksman" in effects:
    E = effects.pop("Fortify Marksman"); E["name"] = "Fortify Archery"; effects["Fortify Archery"] = E
    for ing in ingredients:
        for ef in ing["effects"]:
            if ef["name"] == "Fortify Marksman": ef["name"] = "Fortify Archery"
ingredients.sort(key=lambda x: x["name"].lower())
out = dict(meta=dict(title="Skyrim Anniversary Edition alchemy data", source="en.uesp.net (Skyrim:Ingredients, Skyrim:Alchemy Effects, individual ingredient & effect pages)",
                     formula="Effect gold = floor(BaseCost * (max(Mag,1) * (Dur>0 ? Dur/10 : 1))^1.1); Mag = round(BaseMag*4*(1+Skill/200)) for magnitude-scaling effects (duration for Invisibility/Paralysis/Slow/Waterbreathing). Potion value = sum of effect values.",
                     ingredientCount=len(ingredients), effectCount=len(effects), notes=notes),
           effects=sorted(effects.values(), key=lambda x: x["name"]), ingredients=ingredients)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(ingredients), "ingredients,", len(effects), "effects")
print("\n".join(notes))
from collections import Counter
print(Counter(i["source"] for i in ingredients))

# script-tag version for the renderer (file:// fetch is unreliable in Electron)
with open(os.path.join(os.path.dirname(OUT), "alchemy-data.js"), "w", encoding="utf-8") as f:
    f.write("window.ALCHEMY_DATA = " + json.dumps(out, ensure_ascii=False) + ";\n")
