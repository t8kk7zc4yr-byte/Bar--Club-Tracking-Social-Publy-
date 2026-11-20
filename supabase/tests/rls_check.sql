-- Social Publy: Prüfung der Zugriffsregeln mit drei Probe-Nutzern
--
-- Ausführen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run.
-- Voraussetzung: 0001, 0002 und 0003 sind eingespielt.
--
-- Das Skript legt drei Probe-Nutzer an (A und B werden Freunde, C bleibt fremd), spielt typische Abläufe
-- durch und nimmt am Ende ALLES wieder zurück. Es bleiben keine Daten in der Datenbank.
-- Ergebnis: eine Tabelle, in der jede Zeile mit OK oder FEHLER beginnt.

drop table if exists sp_test_results;
create temp table sp_test_results (nr integer, ergebnis text);

do $$
declare
  r text[] := '{}';
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  x uuid := gen_random_uuid();
  code_b text;
  code_a text;
  v_venue uuid;
  v_private uuid;
  v_osm uuid;
  v_visit uuid;
  v_photo_private uuid;
  v_photo_shared uuid;
  v_tour uuid;
  n integer;
  t text;
  ok boolean;
begin
  begin
    -- ---------------- Vorbereitung als Administrator ----------------
    insert into public.invite_codes (code, max_uses, note) values ('SPTESTLAUF', 10, 'Testlauf');

    -- Registrierung ohne Volljährigkeit muss scheitern
    begin
      insert into auth.users (id, email, raw_user_meta_data)
      values (x, 'sp-test-x@example.invalid', '{"invite_code":"SPTESTLAUF","display_name":"X"}');
      r := r || 'FEHLER Registrierung ohne Altersbestätigung wurde angenommen'::text;
    exception when others then
      r := r || 'OK    Registrierung ohne Altersbestätigung wird abgelehnt'::text;
    end;

    -- Registrierung mit falschem Einladungscode muss scheitern
    begin
      insert into auth.users (id, email, raw_user_meta_data)
      values (x, 'sp-test-x@example.invalid', '{"invite_code":"FALSCH","display_name":"X","adult_confirmed":true}');
      r := r || 'FEHLER Registrierung mit falschem Einladungscode wurde angenommen'::text;
    exception when others then
      r := r || 'OK    Registrierung mit falschem Einladungscode wird abgelehnt'::text;
    end;

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'sp-test-a@example.invalid', '{"invite_code":"SPTESTLAUF","display_name":"Anna","adult_confirmed":true}'),
      (b, 'sp-test-b@example.invalid', '{"invite_code":"SPTESTLAUF","display_name":"Ben","adult_confirmed":true}'),
      (c, 'sp-test-c@example.invalid', '{"invite_code":"SPTESTLAUF","display_name":"Clara","adult_confirmed":true}');
    select count(*) into n from public.profiles where id in (a, b, c) and adult_confirmed_at is not null and not share_with_friends;
    r := r || (case when n = 3 then 'OK    ' else 'FEHLER ' end || 'Profile angelegt, Teilen standardmäßig aus');
    select friend_code into code_b from public.profiles where id = b;
    select friend_code into code_a from public.profiles where id = a;

    -- Ab hier als angemeldete Nutzer; die Rolle „authenticated“ unterliegt allen Zugriffsregeln

    -- ---------------- Anna: Freundschaftsanfrage an Ben ----------------
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    perform public.request_friend(code_b);
    update public.profiles set share_with_friends = true where id = a;

    -- Profil-Spalten, die nur das System setzen darf, sind geschützt
    begin
      update public.profiles set adult_confirmed_at = null where id = a;
      r := r || 'FEHLER Altersbestätigung ließ sich vom Nutzer ändern'::text;
    exception when others then
      r := r || 'OK    Altersbestätigung kann der Nutzer nicht ändern'::text;
    end;

    -- ---------------- Ben: Anfrage annehmen ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    update public.friendships set status = 'accepted' where requester = a and addressee = b;
    get diagnostics n = row_count;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben kann Annas Anfrage annehmen');
    update public.profiles set share_with_friends = true where id = b;

    -- ---------------- Anna: Location, Bewertung, Besuch, Fotos, unterwegs ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    v_venue := public.upsert_venue(null, 'Testkneipe Probe', 'kneipe', 'Köln', null, 50.9, 6.9, null);
    insert into public.user_venues (venue_id, rating, tags, favorite) values (v_venue, 8, '{live_fussball}', true);
    insert into public.visits (venue_id, visited_at, rating, note, drinks, spend, companions_text)
    values (v_venue, now(), 8, 'Guter Abend', '[{"name":"Kölsch","count":3}]', 24.50, '{Oma Erna}')
    returning id into v_visit;
    insert into public.photos (venue_id, visit_id, storage_path, shared) values (v_venue, v_visit, a || '/privat.jpg', false)
    returning id into v_photo_private;
    insert into public.photos (venue_id, visit_id, storage_path, shared) values (v_venue, v_visit, a || '/geteilt.jpg', true)
    returning id into v_photo_shared;
    insert into public.going_out (until, place) values (now() + interval '4 hours', 'Altstadt');

    -- Eigene Location (ohne OpenStreetMap-Kennung) und eine aus dem Katalog
    v_private := public.upsert_venue(null, 'Annas Geheimtipp', 'bar', 'Köln', null, 50.91, 6.91, null);
    v_osm := public.upsert_venue(null, 'Katalog-Kneipe Probe', 'kneipe', 'Köln', null, 50.92, 6.92, 'node/999999999999');
    begin
      update public.venues set source = 'osm', active = false where id = v_private;
      r := r || 'FEHLER Anna konnte Quelle oder Status einer Location ändern'::text;
    exception when others then
      r := r || 'OK    Quelle und Status einer Location kann niemand aus der App ändern'::text;
    end;

    -- Markieren: Ben (Freund) ja, Clara (fremd) nein
    insert into public.visit_companions (visit_id, user_id) values (v_visit, b);
    begin
      insert into public.visit_companions (visit_id, user_id) values (v_visit, c);
      r := r || 'FEHLER Anna konnte eine fremde Person markieren'::text;
    exception when others then
      r := r || 'OK    Fremde Personen lassen sich nicht markieren'::text;
    end;

    -- Tour anlegen und Besuch zuordnen
    insert into public.tours (name, day) values ('Probetour', current_date) returning id into v_tour;
    update public.visits set tour_id = v_tour where id = v_visit;

    -- ---------------- Ben: was sieht der Freund? ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    select count(*) into n from public.visits where user_id = a;
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Ben liest Annas Besuche nicht direkt aus der Tabelle (mit Getränken und Ausgaben)');
    select count(*) into n from public.venues where id in (v_private, v_osm);
    r := r || (case when n = 2 then 'OK    ' else 'FEHLER ' end || 'Ben sieht Annas eigene Location und den Katalogeintrag');
    select count(*) into n from public.friend_visits(a) where note = 'Guter Abend' and rating = 8;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht Annas Besuch (Ort, Zeit, Bewertung, Notiz)');
    select array_to_string(proargnames, ',') into t from pg_proc
      where proname = 'friend_visits' and pronamespace = 'public'::regnamespace;
    r := r || (case when t is not null and t !~ '(drinks|spend|companions_text)' then 'OK    ' else 'FEHLER ' end
               || 'friend_visits liefert keine Getränke, Ausgaben oder Freitext-Begleitung');
    select count(*) into n from public.friend_user_venues(a) where rating = 8 and 'live_fussball' = any(tags);
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht Annas Bewertung und Tags');
    select count(*) into n from public.photos where user_id = a;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht nur das freigegebene Foto (' || n || ' von 2)');
    select count(*) into n from public.activities where actor = a;
    r := r || (case when n >= 3 then 'OK    ' else 'FEHLER ' end || 'Ben sieht Annas Feed (' || n || ' Einträge: Location, Foto, unterwegs, Tour)');
    select count(*) into n from public.going_out where user_id = a and until > now();
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht, dass Anna unterwegs ist');
    select count(*) into n from public.my_companion_requests() where visit_id = v_visit and status = 'pending';
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht die offene Markierung');
    update public.visit_companions set status = 'accepted' where visit_id = v_visit and user_id = b;
    get diagnostics n = row_count;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben kann die Markierung bestätigen');
    select count(*) into n from public.visible_tours() where id = v_tour and not joined;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben sieht Annas Tour');
    insert into public.tour_members (tour_id) values (v_tour);
    select count(*) into n from public.tour_visits(v_tour);
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Ben tritt der Tour bei und sieht ihre Stationen');

    -- ---------------- Clara: Fremde sieht nichts ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', c::text, true);
    select (select count(*) from public.friend_visits(a)) + (select count(*) from public.friend_user_venues(a))
         + (select count(*) from public.photos where user_id = a) + (select count(*) from public.activities where actor = a)
         + (select count(*) from public.going_out where user_id = a) + (select count(*) from public.profiles where id = a)
         + (select count(*) from public.visible_tours() where owner_id = a) + (select count(*) from public.tour_visits(v_tour))
      into n;
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Clara (keine Freundin) sieht nichts von Anna (' || n || ' Treffer)');
    select count(*) into n from public.venues where id = v_private;
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Clara sieht Annas selbst angelegte Location nicht');
    select count(*) into n from public.venues where id = v_osm;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Clara sieht Katalogeinträge aus OpenStreetMap');
    begin
      insert into public.tour_members (tour_id) values (v_tour);
      r := r || 'FEHLER Clara konnte Annas Tour beitreten'::text;
    exception when others then
      r := r || 'OK    Clara kann Annas Tour nicht beitreten'::text;
    end;
    begin
      update public.visits set tour_id = v_tour where user_id = c;
      insert into public.visits (venue_id, visited_at, tour_id) values (v_venue, now() - interval '30 days', v_tour);
      r := r || 'FEHLER Clara konnte einen Besuch in Annas Tour eintragen'::text;
    exception when others then
      r := r || 'OK    Clara kann keine Besuche in fremde Touren eintragen'::text;
    end;
    -- Clara fragt Anna an und versucht, die eigene Anfrage selbst anzunehmen
    perform public.request_friend(code_a);
    update public.friendships set status = 'accepted' where requester = c and addressee = a;
    select count(*) into n from public.friendships where requester = c and addressee = a and status = 'accepted';
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Eigene Anfrage lässt sich nicht selbst annehmen');

    -- ---------------- Nicht angemeldet ----------------
    perform set_config('role', 'anon', true);
    begin
      select count(*) into n from public.venues;
      r := r || 'FEHLER Ohne Anmeldung sind Locations lesbar'::text;
    exception when others then
      r := r || 'OK    Ohne Anmeldung ist nichts lesbar'::text;
    end;
    perform set_config('role', 'authenticated', true);

    -- ---------------- Anna schaltet das Teilen ab ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    update public.profiles set share_with_friends = false where id = a;
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    select (select count(*) from public.friend_visits(a)) + (select count(*) from public.activities where actor = a)
         + (select count(*) from public.going_out where user_id = a) + (select count(*) from public.photos where user_id = a)
      into n;
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Nach Abschalten des Teilens sieht Ben nichts mehr (' || n || ' Treffer)');

    -- ---------------- Anna löscht Besuch und Konto ----------------
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    delete from public.visits where id = v_visit;
    perform set_config('role', 'postgres', true);
    select count(*) into n from public.activities where visit_id = v_visit or photo_id in (v_photo_private, v_photo_shared);
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Mit dem Besuch verschwinden die zugehörigen Feed-Einträge');
    perform set_config('role', 'authenticated', true);
    perform public.delete_my_account();
    perform set_config('role', 'postgres', true);
    select (select count(*) from auth.users where id = a) + (select count(*) from public.profiles where id = a)
         + (select count(*) from public.user_venues where user_id = a) + (select count(*) from public.photos where user_id = a)
         + (select count(*) from public.friendships where a in (requester, addressee)) + (select count(*) from public.activities where actor = a)
         + (select count(*) from public.tours where owner_id = a) + (select count(*) from public.going_out where user_id = a)
      into n;
    r := r || (case when n = 0 then 'OK    ' else 'FEHLER ' end || 'Kontolöschung entfernt alle Daten von Anna (' || n || ' Reste)');
    select count(*) into n from public.venues where id = v_venue and created_by is null;
    r := r || (case when n = 1 then 'OK    ' else 'FEHLER ' end || 'Location bleibt im Katalog, ohne Verweis auf Anna');

    raise exception 'SP_TEST_ENDE';
  exception when others then
    if sqlerrm <> 'SP_TEST_ENDE' then
      r := r || ('FEHLER Abbruch: ' || sqlerrm);
    end if;
  end;
  -- Alle Testdaten sind an dieser Stelle zurückgenommen
  insert into sp_test_results select ord::integer, val from unnest(r) with ordinality as u(val, ord);
end $$;

select nr, ergebnis from sp_test_results order by nr;
