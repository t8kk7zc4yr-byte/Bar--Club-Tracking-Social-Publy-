-- Social Publy: Ergänzung für Phase 5 (Freunde und Feed)
-- Einspielen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run (einmalig, nach 0001_init.sql).
--
-- Inhalt
--   * Feed-Einträge merken sich den zugehörigen Besuch bzw. das Foto und verschwinden mit ihnen.
--   * Wer das Teilen abschaltet oder eine Freundschaft beendet, braucht nichts weiter zu tun:
--     die Zugriffsregeln aus 0001 blenden die Einträge sofort aus.

alter table public.activities add column if not exists visit_id uuid references public.visits on delete cascade;
alter table public.activities add column if not exists photo_id uuid references public.photos on delete cascade;
create index if not exists activities_visit on public.activities (visit_id);
create index if not exists activities_photo on public.activities (photo_id);

drop function if exists public.add_activity(uuid, text, uuid, text, smallint);

create or replace function public.add_activity(
  p_actor uuid, p_type text, p_venue uuid, p_place text, p_rating smallint,
  p_visit uuid default null, p_photo uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := p_place;
  v_city text;
begin
  if not shares(p_actor) then return; end if;
  if p_venue is not null then
    select name, city into v_name, v_city from venues where id = p_venue;
  end if;
  insert into activities (actor, type, venue_id, venue_name, city, rating, visit_id, photo_id)
  values (p_actor, p_type, p_venue, v_name, v_city, p_rating, p_visit, p_photo);
  -- Obergrenze: je Person bleiben die neuesten 500 Einträge
  delete from activities
  where actor = p_actor
    and id in (select id from activities where actor = p_actor order by created_at desc offset 500);
end;
$$;

create or replace function public.log_visit_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  -- Nachgetragene ältere Besuche erzeugen keinen Feed-Eintrag
  if new.deleted_at is not null or new.visited_at < now() - interval '12 hours' then
    return new;
  end if;
  select not exists (
    select 1 from visits where user_id = new.user_id and venue_id = new.venue_id and id <> new.id and deleted_at is null
  ) into v_first;
  perform add_activity(new.user_id, case when v_first then 'new_venue' else 'checkin' end, new.venue_id, null, new.rating, new.id, null);
  return new;
end;
$$;

create or replace function public.log_photo_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared and new.deleted_at is null and (tg_op = 'INSERT' or not old.shared) then
    perform add_activity(new.user_id, 'photo', new.venue_id, null, null, new.visit_id, new.id);
  elsif tg_op = 'UPDATE' and old.shared and not new.shared then
    -- Freigabe zurückgenommen: Feed-Eintrag entfernen
    delete from activities where photo_id = new.id;
  end if;
  return new;
end;
$$;

-- Bewertung eines Besuchs nachträglich geändert: Feed-Eintrag mitziehen
create or replace function public.sync_visit_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rating is distinct from old.rating then
    update activities set rating = new.rating where visit_id = new.id and type in ('checkin', 'new_venue');
  end if;
  return new;
end;
$$;
drop trigger if exists visits_activity_update on public.visits;
create trigger visits_activity_update after update of rating on public.visits
  for each row execute function public.sync_visit_activity();

-- „Bin unterwegs“ vorzeitig beendet: Feed-Eintrag der letzten Stunden entfernen
create or replace function public.log_going_out()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.until is not null and new.until > now()
     and (tg_op = 'INSERT' or old.until is null or old.until < now()) then
    perform add_activity(new.user_id, 'going_out', null, new.place, null);
  elsif tg_op = 'UPDATE' and new.until is null and old.until is not null and old.until > now() then
    delete from activities where actor = new.user_id and type = 'going_out' and created_at > now() - interval '8 hours';
  end if;
  return new;
end;
$$;

revoke execute on function public.add_activity(uuid, text, uuid, text, smallint, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sync_visit_activity() from public, anon;
