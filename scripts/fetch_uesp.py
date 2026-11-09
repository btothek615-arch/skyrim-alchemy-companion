"""Fetch raw wikitext from UESP's MediaWiki API (en.uesp.net) into ./raw/ for offline parsing."""
import json, os, re, sys, time, urllib.request, urllib.parse

API = "https://en.uesp.net/w/api.php"
OUT = os.path.join(os.path.dirname(__file__), "raw")
os.makedirs(OUT, exist_ok=True)

def api(params):
    params = dict(params, format="json", formatversion="2")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "SkyrimAlchemyCompanion/1.0 (data build script)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print("retry", e, file=sys.stderr); time.sleep(3)
    raise RuntimeError("API failed")

def fetch_pages(titles):
    """Return {requested_title: wikitext} following redirects."""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i+50]
        d = api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "redirects": 1, "titles": "|".join(batch)})
        q = d["query"]
        alias = {}
        for n in q.get("normalized", []): alias[n["to"]] = alias.get(n["from"], n["from"])
        for r in q.get("redirects", []): alias[r["to"]] = alias.get(r["from"], r["from"])
        for p in q["pages"]:
            if "revisions" not in p:
                print("MISSING", p["title"], file=sys.stderr); continue
            req_title = alias.get(p["title"], p["title"])
            out[req_title] = p["revisions"][0]["slots"]["main"]["content"]
            out[p["title"]] = out[req_title]
        time.sleep(1)
    return out

def save(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    top = fetch_pages(["Skyrim:Ingredients", "Skyrim:Alchemy Effects", "Skyrim:Creation Club"])
    save("top.json", top)
    ings = sorted(set(re.findall(r"\{\{Ingredient Entry\|ing=([^|}]+)", top["Skyrim:Ingredients"])))
    save("ingredient_pages.json", fetch_pages(["Skyrim:" + n.strip() for n in ings]))
    effs = sorted(set(re.findall(r"\{\{Anchor\|\[\[Skyrim:([^|\]]+)", top["Skyrim:Alchemy Effects"])))
    save("effect_pages.json", fetch_pages(["Skyrim:" + n.strip() for n in effs]))
    print(len(ings), "ingredients;", len(effs), "effects")
