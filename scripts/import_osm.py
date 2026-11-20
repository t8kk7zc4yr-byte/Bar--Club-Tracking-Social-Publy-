#!/usr/bin/env python3
"""
Social Publy: Import von Bars, Kneipen, Clubs und Biergärten aus OpenStreetMap in den Katalog.

Quelle ist eine OSM-Datei im PBF-Format (z. B. https://download.geofabrik.de/europe/germany-latest.osm.pbf).
Für ganz Deutschland wird sie vorher mit osmium-tool gefiltert (siehe .github/workflows/import-osm.yml).

Aufruf:
  python3 scripts/import_osm.py DATEI.osm.pbf               # nur auswerten, Ergebnis als JSON ausgeben
  python3 scripts/import_osm.py DATEI.osm.pbf --upload      # zusätzlich in Supabase schreiben
Für --upload müssen SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY gesetzt sein (nie ins Repository!).

Daten: © OpenStreetMap-Mitwirkende, Open Database License (ODbL).
"""
import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import osmium

VENUE_TYPES = {"bar", "pub", "nightclub", "biergarten", "hookah_lounge"}
PLACE_TYPES = {"city": 3, "town": 2, "village": 1}
MAX_PLACE_KM = 8.0


def category_for(tags: dict, name: str) -> str:
    """Zuordnung zu den Kategorien der App. Bei Änderungen auch src/data/osm.ts (categoryFor) anpassen."""
    a = tags.get("amenity", "")
    if re.search(r"irish", name, re.I) or tags.get("cuisine") == "irish":
        return "irish_pub"
    if re.search(r"shisha|hookah", name, re.I) or a == "hookah_lounge":
        return "shisha_bar"
    if a == "nightclub":
        return "club"
    if a == "biergarten":
        return "biergarten"
    if a == "pub":
        return "brauhaus" if tags.get("microbrewery") == "yes" else "kneipe"
    if a == "bar":
        if re.search(r"cocktail", name, re.I) or tags.get("cocktails") == "yes":
            return "cocktailbar"
        if re.search(r"wein|wine|vino", name, re.I):
            return "weinbar"
        return "bar"
    return "sonstiges"


class Collector(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.venues = []
        self.places = []

    def _venue(self, kind, oid, tags, lat, lon):
        name = (tags.get("name") or "").strip()
        if not name or lat is None:
            return
        street = " ".join(p for p in [tags.get("addr:street"), tags.get("addr:housenumber")] if p)
        city = (tags.get("addr:city") or "").strip()
        rest = " ".join(p for p in [tags.get("addr:postcode"), city] if p)
        self.venues.append({
            "osm_id": f"{kind}/{oid}",
            "name": name[:120],
            "category": category_for(tags, name),
            "city": city[:80],
            "address": (", ".join(p for p in [street, rest] if p) or None),
            "lat": round(lat, 7),
            "lng": round(lon, 7),
        })

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if tags.get("amenity") in VENUE_TYPES and n.location.valid():
            self._venue("node", n.id, tags, n.location.lat, n.location.lon)
        elif tags.get("place") in PLACE_TYPES and tags.get("name") and n.location.valid():
            self.places.append((n.location.lat, n.location.lon, tags["name"], PLACE_TYPES[tags["place"]]))

    def way(self, w):
        tags = {t.k: t.v for t in w.tags}
        if tags.get("amenity") not in VENUE_TYPES:
            return
        pts = [(nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
        if not pts:
            return
        self._venue("way", w.id, tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def km(lat1, lon1, lat2, lon2):
    x = (lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(x, lat2 - lat1) * 111.2


def fill_cities(venues, places):
    """Stadt ergänzen, wo addr:city fehlt: nächstgelegener Ort (Stadt vor Dorf bei ähnlicher Entfernung)."""
    grid = {}
    for p in places:
        grid.setdefault((int(p[0] * 10), int(p[1] * 10)), []).append(p)
    filled = 0
    for v in venues:
        if v["city"]:
            continue
        gx, gy = int(v["lat"] * 10), int(v["lng"] * 10)
        best, best_score = None, None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for p in grid.get((gx + dx, gy + dy), []):
                    d = km(v["lat"], v["lng"], p[0], p[1])
                    if d > MAX_PLACE_KM:
                        continue
                    score = d / (1 + 0.6 * p[3])  # größere Orte ziehen stärker
                    if best_score is None or score < best_score:
                        best, best_score = p, score
        if best:
            v["city"] = best[2][:80]
            filled += 1
    return filled


def rest(method, path, body=None, extra_headers=None):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Content-Type": "application/json"}
    if key.count(".") == 2:
        headers["Authorization"] = f"Bearer {key}"
    headers.update(extra_headers or {})
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code >= 500 and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"Supabase antwortet {e.code}: {msg}")
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise


def count(filter_):
    _, headers, _ = rest("GET", f"venues?{filter_}&select=id", extra_headers={"Prefer": "count=exact", "Range": "0-0"})
    rng = headers.get("Content-Range", "*/0")
    return int(rng.split("/")[-1] or 0)


def upload(venues):
    run = datetime.now(timezone.utc).isoformat()
    before = count("source=eq.osm&active=eq.true")
    print(f"Aktive OSM-Locations vor dem Import: {before}")
    batch = 500
    for i in range(0, len(venues), batch):
        rows = [dict(v, source="osm", active=True, osm_seen_at=run) for v in venues[i:i + batch]]
        rest("POST", "venues?on_conflict=osm_id", rows, {"Prefer": "resolution=merge-duplicates,return=minimal"})
        print(f"  {min(i + batch, len(venues))} von {len(venues)} übertragen", flush=True)
    # Sicherung: Nur deaktivieren, wenn der Import nicht offensichtlich unvollständig war
    if before and len(venues) < before * 0.8:
        print(f"WARNUNG: nur {len(venues)} statt bisher {before} Locations; nicht mehr gefundene werden NICHT deaktiviert.")
        return
    stale = f"source=eq.osm&active=eq.true&osm_seen_at=lt.{urllib.parse.quote(run)}"
    gone = count(stale)
    if gone:
        rest("PATCH", f"venues?{stale}", {"active": False}, {"Prefer": "return=minimal"})
    print(f"Aktive OSM-Locations nach dem Import: {count('source=eq.osm&active=eq.true')}; nicht mehr in OpenStreetMap und deaktiviert: {gone}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pbf")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--json", help="Ergebnis zusätzlich als JSON-Datei speichern")
    args = ap.parse_args()

    t = time.time()
    c = Collector()
    c.apply_file(args.pbf, locations=True)
    # Doppelte Kennungen (sollte nicht vorkommen) zusammenfassen
    venues = list({v["osm_id"]: v for v in c.venues}.values())
    filled = fill_cities(venues, c.places)
    cats = {}
    for v in venues:
        cats[v["category"]] = cats.get(v["category"], 0) + 1
    no_city = sum(1 for v in venues if not v["city"])
    print(f"{len(venues)} Locations in {time.time() - t:.0f} s gelesen; Stadt ergänzt bei {filled}, ohne Stadt: {no_city}")
    print("Nach Art:", json.dumps(dict(sorted(cats.items(), key=lambda x: -x[1])), ensure_ascii=False))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(venues, f, ensure_ascii=False)
    if args.upload:
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            raise SystemExit("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.")
        upload(venues)


if __name__ == "__main__":
    main()
