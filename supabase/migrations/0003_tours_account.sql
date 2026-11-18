-- Social Publy: Ergänzung für Phase 6 und 7 (Kneipentouren, Kontolöschung)
-- Einspielen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run (einmalig, nach 0002_feed_links.sql).

-- ---------------------------------------------------------------------------
-- Kneipentouren
-- ---------------------------------------------------------------------------

-- Feed-Einträge zu Touren merken sich die Tour, damit Freunde beitreten können
alter table public.activities add column if not exists tour_id uuid references public.tours on delete cascade;
create index if not exists activities_tour on public.activities (tour_id);

-- Nur Touren von heute oder gestern erscheinen im Feed (nachträglich erkannte ältere Abende nicht)
create or replace function public.log_tour_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.day < current_date - 1 or not shares(new.owner_id) then
    return new;
  end if;
  insert into activities (actor, type, venue_name, tour_id) values (new.owner_id, 'tour', new.name, new.id);
  return new;
end;
$$;

-- Wer eine Tour verlässt, nimmt seine Besuche aus der Tour
create or replace function public.leave_tour_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update visits set tour_id = null where tour_id = old.tour_id and user_id = old.user_id;
  return old;
end;
$$;
drop trigger if exists tour_members_leave on public.tour_members;
create trigger tour_members_leave after delete on public.tour_members
  for each row execute function public.leave_tour_cleanup();

-- Besuche dürfen nur Touren zugeordnet werden, an denen man teilnimmt
create or replace function public.check_visit_tour()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tour_id is not null and not is_tour_member(new.tour_id, new.user_id) then
    raise exception 'Keine Teilnahme an dieser Tour.';
  end if;
  return new;
end;
$$;
drop trigger if exists visits_tour_check on public.visits;
create trigger visits_tour_check before insert or update of tour_id on public.visits
  for each row execute function public.check_visit_tour();

-- Touren, an denen ich teilnehme oder die Freunde gestartet haben, samt Teilnehmerzahl
create or replace function public.visible_tours(p_since date default current_date - 60)
returns table (id uuid, owner_id uuid, owner_name text, name text, day date, members integer, joined boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.owner_id, p.display_name, t.name, t.day,
         (select count(*) from tour_members m where m.tour_id = t.id)::integer + 1,
         is_tour_member(t.id, auth.uid())
  from tours t join profiles p on p.id = t.owner_id
  where t.day >= p_since
    and (is_tour_member(t.id, auth.uid()) or (are_friends(t.owner_id, auth.uid()) and shares(t.owner_id)));
$$;

-- ---------------------------------------------------------------------------
-- Konto löschen (Art. 17 DSGVO)
-- ---------------------------------------------------------------------------
-- Die App entfernt zuerst die Fotodateien über die Speicher-Schnittstelle und ruft dann diese Funktion auf.
-- Das Löschen des Anmeldekontos entfernt über „on delete cascade“ Profil, Besuche, Bewertungen,
-- Fotos (Einträge), Freundschaften, Markierungen, Touren, Feed und Push-Abos.
-- Locations im gemeinsamen Katalog bleiben bestehen; der Verweis auf die anlegende Person wird entfernt.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  delete from auth.users where id = v_me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.visible_tours(date) from public, anon;
grant execute on function public.visible_tours(date) to authenticated;
revoke execute on function public.leave_tour_cleanup() from public, anon, authenticated;
revoke execute on function public.check_visit_tour() from public, anon, authenticated;
