# Katalog aus OpenStreetMap einrichten

Einmalig nötig, in dieser Reihenfolge. Danach läuft der Import jeden Monat am 3. automatisch.

## 1. Datenbank vorbereiten

Im Supabase **SQL Editor** den Inhalt von `supabase/migrations/0005_osm_catalog.sql` ausführen. Die Sicherheitsabfrage kann bestätigt werden.

Danach zur Kontrolle `supabase/tests/rls_check.sql` erneut ausführen; alle Zeilen sollten mit „OK“ beginnen (jetzt 34 statt 30).

## 2. Geheimen Schlüssel bei GitHub hinterlegen

Der Import schreibt mit dem geheimen Schlüssel von Supabase in die Datenbank. Dieser Schlüssel gehört nur in die Secrets von GitHub, nie in den Chat oder eine Datei.

1. Supabase-Dashboard, **Project Settings**, **API Keys**: den **Secret key** (beginnt mit `sb_secret_`) kopieren. Gibt es nur die ältere Ansicht, den Schlüssel **service_role** nehmen.
2. GitHub-Repository, **Settings**, **Secrets and variables**, **Actions**, Reiter **Secrets**, **New repository secret**.
3. Name: `SUPABASE_SERVICE_ROLE_KEY`, Wert: der kopierte Schlüssel, **Add secret**.

## 3. Ersten Import starten

1. In GitHub Desktop **Push origin**, damit der Workflow im Repository liegt.
2. GitHub-Repository, Reiter **Actions**, links **Locations aus OpenStreetMap importieren**, rechts **Run workflow**, **Run workflow**.
3. Der Lauf dauert etwa 15 bis 30 Minuten (Download der Deutschland-Datei mit rund 4 GB, Filtern, Hochladen). Ein grüner Haken heißt: fertig.

Im letzten Schritt des Laufs („In den Katalog schreiben“) steht, wie viele Locations übernommen wurden.

## 4. Prüfen

* Auf der Karte in eine Stadt hineinzoomen: Ab einer gewissen Zoomstufe erscheinen graue Pins für alle Bars, Kneipen und Clubs.
* Beim Check-in werden Locations in der Nähe direkt aus dem Katalog vorgeschlagen.

## Hinweise

* Quelle: Geofabrik, Auszug „Germany“ aus OpenStreetMap. Daten © OpenStreetMap-Mitwirkende, ODbL.
* Locations, die aus OpenStreetMap verschwinden, werden beim nächsten Lauf als inaktiv markiert, nicht gelöscht, weil Besuche auf sie verweisen können.
* Fehlt eine Bar im Katalog, kann man sie in der App selbst anlegen (nur für sich und Freunde sichtbar) oder direkt in OpenStreetMap eintragen; dann erscheint sie nach dem nächsten Import für alle.
* Rechtliche Punkte zum Import: `docs/RECHT-CHECKLISTE.md`, Abschnitt „Import von Locations aus OpenStreetMap“.
