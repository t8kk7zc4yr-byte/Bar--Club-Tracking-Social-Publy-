# Push-Benachrichtigungen einrichten

Einmalig nötig, in dieser Reihenfolge. Die Bezeichnungen im Supabase-Dashboard können leicht abweichen.

## 1. Schlüssel als Secrets hinterlegen

Die Werte stehen in der Datei `supabase/.push-secrets.local.txt` auf Tills Mac. Diese Datei gelangt nie ins Repository; nicht weitergeben.

1. Supabase-Dashboard öffnen, links **Edge Functions**, dann **Secrets**.
2. Drei Einträge anlegen, jeweils Name und Wert aus der Datei kopieren:
   * `VAPID_PUBLIC_KEY`
   * `VAPID_PRIVATE_KEY`
   * `VAPID_SUBJECT`
3. Speichern.

## 2. Server-Funktion „notify“ anlegen

1. **Edge Functions**, dann **Deploy a new function** bzw. **Create a new function**, Variante **Via Editor**.
2. Name: `notify` (genau so, klein geschrieben).
3. Den vorhandenen Beispielcode im Editor vollständig löschen und den gesamten Inhalt von `supabase/functions/notify/index.ts` einfügen.
4. **Deploy** klicken und warten, bis die Funktion als aktiv angezeigt wird.
5. Die Funktion öffnen, Reiter **Details** oder **Settings**: die Option **Enforce JWT verification** (bzw. „Verify JWT“) **ausschalten** und speichern.
   Die Datenbank ruft die Funktion ohne Anmeldung auf. Das ist sicher, weil die Funktion jeden Eintrag selbst prüft und nur einmal versendet.

## 3. Auslöser in der Datenbank

Im **SQL Editor** den Inhalt von `supabase/migrations/0004_push.sql` ausführen. Die Sicherheitsabfrage kann bestätigt werden.

Danach die Strecke prüfen: `supabase/tests/push_check.sql` in zwei Schritten ausführen (Anleitung im Kopf der Datei). Erwartet werden drei Auslöser und eine Antwort mit Status 200.

## 4. Öffentlicher Schlüssel für die App

1. GitHub-Repository, **Settings**, **Secrets and variables**, **Actions**, Reiter **Variables**.
2. Neue Variable `VITE_VAPID_PUBLIC_KEY` mit dem Wert von `VAPID_PUBLIC_KEY` aus der Datei.
3. In GitHub Desktop **Push origin**, damit die App neu veröffentlicht wird.

## 5. Auf dem iPhone einschalten

1. Die App in **Safari** öffnen.
2. Unten auf **Teilen**, dann **Zum Home-Bildschirm**, **Hinzufügen**.
3. Die App **vom Home-Bildschirm** öffnen und anmelden (die Home-Bildschirm-App hat eine eigene Anmeldung).
4. **Profil**, **Benachrichtigungen**, Schalter **Push auf diesem Gerät** einschalten und die Rückfrage von iOS mit **Erlauben** bestätigen.

Voraussetzung ist iOS 16.4 oder neuer. Auf Android funktioniert Push auch direkt im Browser (Chrome).

## 6. Prüfen

* Zwei Konten sind befreundet und haben im Profil „Mit Freunden teilen“ eingeschaltet; beide haben Push eingeschaltet.
* Konto A checkt ein oder schaltet „Ich bin unterwegs“ ein. Konto B sollte innerhalb weniger Sekunden eine Benachrichtigung erhalten, auch bei geschlossener App.
* Kommt nichts an: Im Supabase-Dashboard unter **Edge Functions**, **notify**, **Logs** nachsehen und die Meldung an Claude weitergeben.

## Was versendet wird

| Ereignis | Empfänger | Abschaltbar |
|:---|:---|:---|
| Check-in, erster Besuch, Bewertung, geteiltes Foto, neue Tour | bestätigte Freunde | je Freund: „Neue Einträge“ |
| „Bin unterwegs“ | bestätigte Freunde | je Freund: „Ist unterwegs“ |
| Markierung als Begleitung | die markierte Person | nur über Push aus |
| Freundschaftsanfrage | die angefragte Person | nur über Push aus |

Ohne „Mit Freunden teilen“ entstehen keine Feed-Einträge und damit auch keine Benachrichtigungen an Freunde.
Der Inhalt jeder Nachricht ist Ende-zu-Ende verschlüsselt; die Push-Dienste von Apple bzw. Google sehen nur, dass eine Nachricht zugestellt wird.
