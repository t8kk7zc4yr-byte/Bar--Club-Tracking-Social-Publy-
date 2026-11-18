-- Social Publy: Prüfung der Push-Strecke (Datenbank -> Funktion „notify“)
--
-- Ausführen im SQL Editor in zwei Schritten (Aufrufe der Datenbank gehen erst nach dem Ausführen hinaus):
--   Schritt 1: nur den Abschnitt „SCHRITT 1“ markieren und mit Run ausführen.
--   Schritt 2: etwa 5 Sekunden warten, dann nur den Abschnitt „SCHRITT 2“ markieren und ausführen.
-- Es werden keine Nutzerdaten verändert und keine Benachrichtigungen versendet.

-- ======================= SCHRITT 1 =======================
-- Sind die Auslöser angelegt? Erwartet: drei Zeilen (activities_push, visit_companions_push, friendships_push).
select tgname as ausloeser, tgrelid::regclass as tabelle
from pg_trigger
where tgname in ('activities_push', 'visit_companions_push', 'friendships_push')
order by 1;

-- Ruft die Funktion mit einer ungültigen Kennung auf; sie darf nichts versenden.
select net.http_post(
  url := 'https://dmjfxfenuxublybwmfhj.supabase.co/functions/v1/notify',
  body := '{"table":"activities","id":"00000000-0000-0000-0000-000000000000"}'::jsonb,
  headers := '{"Content-Type": "application/json"}'::jsonb
) as anfrage_nr;

-- ======================= SCHRITT 2 =======================
-- Antwort der Funktion. Erwartet: status_code 200 und content {"skipped":true}.
select id, status_code, content, error_msg, created
from net._http_response
order by created desc
limit 5;
