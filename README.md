# Social Publy (Arbeitstitel)

Web-App (PWA) zum Festhalten von Bar- und Clubbesuchen: Check-in, Bewertung 1 bis 10, Tags, Karte, Ranking, Dashboard, Freunde. Nachfolger des Prototyps „Tresen“ v0.3.

Der Name ist vorläufig. Er steht in `src/config/app.ts`, `vite.config.ts` (`APP_NAME`), `index.html` (`<title>`) und `public/push-sw.js`.

## Stand

Alle sieben Phasen der Demo sind gebaut. Geprüft sind: Build, 32 automatische Tests, alle Zugriffsregeln gegen die echte Datenbank (`supabase/tests/rls_check.sql`), die Strecke Datenbank zu Push-Funktion (`supabase/tests/push_check.sql`) sowie Check-in, Karte, Ranking, Dashboard, Touren, Rückblick und Budget im Browser mit Handybreite. Auf einem echten iPhone bestätigt ist bisher nur Push (Freundschaftsanfrage).

Noch offen: Test aller Abläufe mit zwei echten Konten (`docs/TESTPLAN.md`), ausgefüllte Datenschutzerklärung und Impressum, die Punkte aus `docs/RECHT-CHECKLISTE.md`.

| Bereich | Stand |
|:---|:---|
| Registrierung mit Einladungscode und Altersprüfung, Anmeldung | fertig |
| Check-in, Locations aus OpenStreetMap, Tags, Fotos, Offline-Warteschlange | fertig |
| Karte, Ranking, Location-Seite | fertig |
| Dashboard, Diagramm-Baukasten, Meilensteine | fertig |
| Freunde, Feed, „Bin unterwegs“, Markieren, Foto-Freigabe | fertig |
| Push-Benachrichtigungen | fertig, auf dem iPhone bestätigt (Freundschaftsanfrage) |
| Freunde-Tipps, Kneipentouren, Jahresrückblick | fertig |
| Datenexport, Kontolöschung, Budget | fertig |
| Datenschutzerklärung, Impressum | Entwürfe mit Platzhaltern |

## Einrichtung

1. Node.js (LTS) und Git installieren.
2. `npm install`
3. `.env.example` nach `.env.local` kopieren und Projekt-URL sowie Anon-Key (Publishable key) aus Supabase eintragen. Niemals den `service_role`- bzw. Secret-Key eintragen.
4. In Supabase die Dateien in `supabase/migrations/` der Reihe nach im SQL Editor ausführen (0001 bis 0004) und Einladungscodes anlegen (Beispiel im Kopf von 0001). Push: `docs/PUSH-EINRICHTEN.md`.
5. `npm run dev` startet die App lokal, `npm run build` erzeugt die Fassung für die Veröffentlichung.

## Veröffentlichung

Bei jedem Stand auf dem Zweig `main` baut `.github/workflows/deploy.yml` die App und veröffentlicht sie auf GitHub Pages. Im Repository unter Settings > Pages als Quelle „GitHub Actions“ wählen und unter Settings > Secrets and variables > Actions > Variables die beiden Werte `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` anlegen.

## Aufbau

| Pfad | Inhalt |
|:---|:---|
| `src/config/app.ts` | Name, Mindestalter, Freundescode-Präfix |
| `src/lib/` | Typen, Tags, Bewertung, Hilfsfunktionen, Bildverkleinerung |
| `src/data/` | Supabase-Anbindung, später lokaler Speicher und Abgleich |
| `src/features/` | Seiten je Funktionsbereich |
| `src/styles/` | Farbthemen und Grundgestaltung |
| `supabase/` | Datenbankschema (Migrationen), Edge Function `notify` |
| `docs/` | Roadmap, rechtliche Checkliste, Testplan, Push-Einrichtung |
| `supabase/tests/` | Prüfskripte für Zugriffsregeln und Push |
