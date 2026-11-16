# Social Publy (Arbeitstitel)

Web-App (PWA) zum Festhalten von Bar- und Clubbesuchen: Check-in, Bewertung 1 bis 10, Tags, Karte, Ranking, Dashboard, Freunde. Nachfolger des Prototyps „Tresen“ v0.3.

Der Name ist vorläufig. Er steht in `src/config/app.ts`, `vite.config.ts` (`APP_NAME`), `index.html` (`<title>`) und `public/push-sw.js`.

## Stand

Phase 0 (Einrichtung) ist angelegt, aber noch **nicht gebaut oder getestet**, weil auf dem Entwicklungsrechner Node.js und Git fehlten. Die Paketversionen in `package.json` stammen aus v0.3; `vitest` wird nach der Node-Installation ergänzt.

| Bereich | Stand |
|:---|:---|
| Projektgerüst, PWA-Konfiguration, GitHub-Pages-Workflow | angelegt |
| Farbthemen hell und dunkel (`src/styles/tokens.css`) | angelegt |
| Tags, Kategorien, Bewertungsskala, Datentypen (`src/lib/`) | angelegt |
| Datenbankschema mit Zugriffsregeln (`supabase/migrations/0001_init.sql`) | geschrieben, noch nicht eingespielt |
| Anmeldung, Check-in, Karte, Ranking, Dashboard, Freunde, Push | offen (Phasen 1 bis 7) |

## Einrichtung

1. Node.js (LTS) und Git installieren.
2. `npm install`
3. `.env.example` nach `.env.local` kopieren und Projekt-URL sowie Anon-Key (Publishable key) aus Supabase eintragen. Niemals den `service_role`- bzw. Secret-Key eintragen.
4. In Supabase den Inhalt von `supabase/migrations/0001_init.sql` im SQL Editor ausführen und danach Einladungscodes anlegen (Beispiel im Kopf der Datei).
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
| `supabase/` | Datenbankschema, später Edge Functions |
| `docs/` | Roadmap, rechtliche Checkliste |
