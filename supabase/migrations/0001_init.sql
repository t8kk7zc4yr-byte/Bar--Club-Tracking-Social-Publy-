-- Social Publy: Datenbankschema für Supabase (PostgreSQL)
-- Einspielen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run (einmalig, auf leerem Projekt).
--
-- Grundsätze
--   * Jede Tabelle hat Row Level Security. Ohne passende Regel ist nichts lesbar.
--   * Eigene Daten: voller Zugriff. Daten von Freunden: nur über die Funktionen friend_*(),
--     die Getränke, Ausgaben und Freitext-Begleitung gar nicht erst ausgeben.
--   * Teilen ist standardmäßig aus (profiles.share_with_friends = false).
--   * Einladungscodes stehen bewusst NICHT in dieser Datei (das Repository ist öffentlich).
--     Anlegen im SQL Editor, z. B.:
--       insert into public.invite_codes (code, max_uses, note) values ('MEINCODE', 3, 'Gründer');

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen ohne Tabellenbezug
-- ---------------------------------------------------------------------------

create or replace function public.gen_friend_code()
returns text language sql volatile set search_path = public as $$
  select 'SP-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Profil (1:1 zu auth.users); wird bei der Registrierung per Trigger angelegt
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  friend_code text unique not null default public.gen_friend_code(),
  avatar_color text not null default '#ff4fa3' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  share_with_friends boolean not null default false,
  -- Zeitpunkt der Volljährigkeitsbestätigung; das Geburtsdatum selbst wird nicht gespeichert
  adult_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private Einstellungen, die geräteübergreifend gelten
create table public.user_settings (
  user_id uuid primary key references public.profiles on delete cascade default auth.uid(),
  monthly_spend_limit numeric(8, 2) check (monthly_spend_limit >= 0),
  updated_at timestamptz not null default now()
);

-- Einladungscodes für die geschlossene Testphase
create table public.invite_codes (
  code text primary key check (code = upper(code)),
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- Freundschaften (gerichtet angefragt, nach Annahme beidseitig gültig)
create table public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- höchstens eine Beziehung je Paar, unabhängig von der Richtung
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index on public.friendships (addressee);

-- Benachrichtigungen je Freund (jede Seite stellt für sich ein; fehlender Eintrag = an)
create table public.friend_settings (
  owner uuid not null references public.profiles on delete cascade default auth.uid(),
  friend uuid not null references public.profiles on delete cascade,
  notify_entries boolean not null default true,
  notify_going_out boolean not null default true,
  primary key (owner, friend)
);

-- „Bin unterwegs“: nur manuell gesetzt, läuft ab
create table public.going_out (
  user_id uuid primary key references public.profiles on delete cascade default auth.uid(),
  until timestamptz,
  place text check (char_length(place) <= 80),
  updated_at timestamptz not null default now()
);

-- Gemeinsamer Katalog der Locations (keine persönlichen Angaben)
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'sonstiges',
  city text not null default '' check (char_length(city) <= 80),
  address text check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  osm_id text unique,
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.venues (lat, lng);

-- Kneipentouren
create table public.tours (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tours (owner_id, day desc);

create table public.tour_members (
  tour_id uuid not null references public.tours on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  joined_at timestamptz not null default now(),
  primary key (tour_id, user_id)
);
create index on public.tour_members (user_id);

-- Persönliche Sicht auf eine Location: Bewertung, Tags, Favorit, Wunschliste
create table public.user_venues (
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  venue_id uuid not null references public.venues on delete cascade,
  rating smallint check (rating between 1 and 10),
  review text check (char_length(review) <= 2000),
  tags text[] not null default '{}',
  price_level smallint check (price_level between 1 and 4),
  food_note text check (char_length(food_note) <= 300),
  favorite boolean not null default false,
  wishlist boolean not null default false,
  cover_photo uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, venue_id)
);
create index on public.user_venues (venue_id);

-- Besuche
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  venue_id uuid not null references public.venues on delete restrict,
  visited_at timestamptz not null,
  rating smallint check (rating between 1 and 10),
  note text check (char_length(note) <= 2000),
  drinks jsonb not null default '[]',          -- privat: [{ "name": "Kölsch", "count": 2 }]
  spend numeric(8, 2) check (spend >= 0),       -- privat
  companions_text text[] not null default '{}', -- privat: Begleitung ohne Konto
  tour_id uuid references public.tours on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.visits (user_id, visited_at desc);
create index on public.visits (venue_id);
create index on public.visits (tour_id);

-- Markierte Freunde; sichtbar wird die Markierung erst nach Bestätigung durch die markierte Person
create table public.visit_companions (
  visit_id uuid not null references public.visits on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (visit_id, user_id)
);
create index on public.visit_companions (user_id);

-- Fotos (Datei im privaten Storage-Bucket „photos“ unter <user_id>/<id>.jpg)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  venue_id uuid not null references public.venues on delete restrict,
  visit_id uuid references public.visits on delete set null,
  storage_path text not null unique,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.photos (user_id);
create index on public.photos (venue_id);

-- Feed-Einträge; entstehen ausschließlich über Trigger
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('checkin', 'new_venue', 'going_out', 'rating', 'photo', 'tour')),
  venue_id uuid references public.venues on delete set null,
  venue_name text,
  city text,
  rating smallint,
  created_at timestamptz not null default now()
);
create index on public.activities (actor, created_at desc);

-- Web-Push-Abonnements (ein Gerät = ein Eintrag)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade default auth.uid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (owner);

-- updated_at serverseitig pflegen (Grundlage für den Abgleich mit den Geräten)
create trigger touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch before update on public.user_settings for each row execute function public.touch_updated_at();
create trigger touch before update on public.going_out for each row execute function public.touch_updated_at();
create trigger touch before update on public.venues for each row execute function public.touch_updated_at();
create trigger touch before update on public.tours for each row execute function public.touch_updated_at();
create trigger touch before update on public.user_venues for each row execute function public.touch_updated_at();
create trigger touch before update on public.visits for each row execute function public.touch_updated_at();
create trigger touch before update on public.photos for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für Zugriffsregeln (security definer, um Rekursion zwischen Regeln zu vermeiden)
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

create or replace function public.shares(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select share_with_friends from profiles where id = uid), false);
$$;

create or replace function public.tour_owner(t uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from tours where id = t;
$$;

create or replace function public.is_tour_member(t uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tours where id = t and owner_id = uid)
      or exists (select 1 from tour_members where tour_id = t and user_id = uid);
$$;

create or replace function public.owns_visit(v uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from visits where id = v and user_id = uid);
$$;

-- ---------------------------------------------------------------------------
-- Rechte und Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.invite_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_settings enable row level security;
alter table public.going_out enable row level security;
alter table public.venues enable row level security;
alter table public.tours enable row level security;
alter table public.tour_members enable row level security;
alter table public.user_venues enable row level security;
alter table public.visits enable row level security;
alter table public.visit_companions enable row level security;
alter table public.photos enable row level security;
alter table public.activities enable row level security;
alter table public.push_subscriptions enable row level security;

-- Nicht angemeldete Besucher erhalten keinerlei Tabellenzugriff
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- invite_codes und activities werden nur über Funktionen bzw. Trigger geschrieben
revoke all on public.invite_codes from authenticated;
revoke insert, update, delete on public.activities from authenticated;
-- Profil: anlegen und löschen nur über Registrierung bzw. Kontolöschung; ändern nur ausgewählte Spalten
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_color, share_with_friends) on public.profiles to authenticated;
-- Freundschaft: nur der Status ist änderbar; Markierung: nur der Status
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
revoke update on public.visit_companions from authenticated;
grant update (status) on public.visit_companions to authenticated;

-- Profile: eigenes Profil sowie Profile von Personen, mit denen eine Freundschaft oder Anfrage besteht
create policy "profil lesen" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.friendships f
    where (f.requester = auth.uid() and f.addressee = profiles.id)
       or (f.addressee = auth.uid() and f.requester = profiles.id)
  )
);
create policy "profil ändern" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "einstellungen eigene" on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Freundschaften: Anfragen laufen über request_friend(); annehmen darf nur die angefragte Person
create policy "freundschaft lesen" on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
create policy "anfrage annehmen" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "freundschaft beenden" on public.friendships for delete to authenticated
  using (requester = auth.uid() or addressee = auth.uid());

create policy "benachrichtigungen eigene" on public.friend_settings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid() and public.are_friends(owner, friend));

-- Unterwegs-Status: eigener voll; Freunde lesen, solange Teilen aktiv ist
create policy "unterwegs eigener" on public.going_out for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "unterwegs freunde lesen" on public.going_out for select to authenticated
  using (public.are_friends(user_id, auth.uid()) and public.shares(user_id));

-- Katalog: alle Angemeldeten lesen; anlegen über upsert_venue(); ändern nur, wer angelegt hat
create policy "locations lesen" on public.venues for select to authenticated using (true);
create policy "location anlegen" on public.venues for insert to authenticated with check (created_by = auth.uid());
create policy "location ändern" on public.venues for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Touren
create policy "tour eigene" on public.tours for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tour lesen" on public.tours for select to authenticated using (
  public.is_tour_member(id, auth.uid())
  or (public.are_friends(owner_id, auth.uid()) and public.shares(owner_id))
);
create policy "tourmitglieder lesen" on public.tour_members for select to authenticated
  using (public.is_tour_member(tour_id, auth.uid()));
create policy "tour beitreten" on public.tour_members for insert to authenticated with check (
  user_id = auth.uid()
  and public.are_friends(public.tour_owner(tour_id), auth.uid())
  and public.shares(public.tour_owner(tour_id))
);
create policy "tour verlassen" on public.tour_members for delete to authenticated
  using (user_id = auth.uid() or public.tour_owner(tour_id) = auth.uid());

-- Persönliche Daten: ausschließlich die Person selbst. Freunde lesen über friend_*()-Funktionen.
create policy "meine locations" on public.user_venues for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meine besuche" on public.visits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Markierungen
create policy "markierung lesen" on public.visit_companions for select to authenticated
  using (user_id = auth.uid() or public.owns_visit(visit_id, auth.uid()));
create policy "freund markieren" on public.visit_companions for insert to authenticated with check (
  status = 'pending'
  and public.owns_visit(visit_id, auth.uid())
  and public.are_friends(user_id, auth.uid())
);
create policy "markierung beantworten" on public.visit_companions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "markierung entfernen" on public.visit_companions for delete to authenticated
  using (user_id = auth.uid() or public.owns_visit(visit_id, auth.uid()));

-- Fotos: eigene voll; Freunde nur ausdrücklich freigegebene
create policy "meine fotos" on public.photos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "freigegebene fotos lesen" on public.photos for select to authenticated using (
  shared and deleted_at is null
  and public.are_friends(user_id, auth.uid()) and public.shares(user_id)
);

-- Feed
create policy "feed lesen" on public.activities for select to authenticated using (
  actor = auth.uid() or (public.are_friends(actor, auth.uid()) and public.shares(actor))
);

create policy "push eigene" on public.push_subscriptions for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Registrierung
-- ---------------------------------------------------------------------------

-- Vorabprüfung im Registrierungsformular (ohne Verbrauch des Codes)
create or replace function public.check_invite(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from invite_codes where code = upper(trim(p_code)) and used_count < max_uses);
$$;

-- Wird bei jeder Registrierung ausgeführt. Scheitert die Prüfung, wird kein Konto angelegt.
-- Erwartet in den Metadaten der Registrierung: invite_code, adult_confirmed (true), display_name.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
begin
  if coalesce(new.raw_user_meta_data ->> 'adult_confirmed', '') <> 'true' then
    raise exception 'Registrierung nur ab 18 Jahren.';
  end if;
  update invite_codes set used_count = used_count + 1 where code = v_code and used_count < max_uses;
  if not found then
    raise exception 'Einladungscode ungültig oder aufgebraucht.';
  end if;
  insert into profiles (id, display_name, adult_confirmed_at)
  values (new.id, case when v_name = '' then 'Ich' else v_name end, now());
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Funktionen für die App
-- ---------------------------------------------------------------------------

-- Freundschaftsanfrage per Code, ohne dass Profile durchsuchbar werden
create or replace function public.request_friend(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_name text;
begin
  if v_me is null then raise exception 'Nicht angemeldet.'; end if;
  select id, display_name into v_other, v_name from profiles where friend_code = upper(trim(p_code));
  if v_other is null then raise exception 'Kein Konto mit diesem Code gefunden.'; end if;
  if v_other = v_me then raise exception 'Das ist dein eigener Code.'; end if;
  if exists (
    select 1 from friendships
    where (requester = v_me and addressee = v_other) or (requester = v_other and addressee = v_me)
  ) then
    raise exception 'Ihr seid bereits vernetzt oder eine Anfrage ist offen.';
  end if;
  insert into friendships (requester, addressee) values (v_me, v_other);
  return v_name;
end;
$$;

-- Location anlegen; gibt bei bereits vorhandener OpenStreetMap-Kennung die bestehende ID zurück
create or replace function public.upsert_venue(
  p_id uuid, p_name text, p_category text, p_city text, p_address text,
  p_lat double precision, p_lng double precision, p_osm_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_osm_id is not null then
    select id into v_id from venues where osm_id = p_osm_id;
    if v_id is not null then return v_id; end if;
  end if;
  select id into v_id from venues where id = p_id;
  if v_id is not null then return v_id; end if;
  insert into venues (id, name, category, city, address, lat, lng, osm_id, created_by)
  values (coalesce(p_id, gen_random_uuid()), p_name, coalesce(p_category, 'sonstiges'), coalesce(p_city, ''),
          p_address, p_lat, p_lng, p_osm_id, auth.uid())
  on conflict (osm_id) do update set osm_id = excluded.osm_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Besuche von Freunden: ohne Getränke, Ausgaben und Freitext-Begleitung
create or replace function public.friend_visits(p_friend uuid default null, p_since timestamptz default null)
returns table (id uuid, user_id uuid, venue_id uuid, visited_at timestamptz, rating smallint, note text, tour_id uuid)
language sql stable security definer set search_path = public as $$
  select v.id, v.user_id, v.venue_id, v.visited_at, v.rating, v.note, v.tour_id
  from visits v
  where v.deleted_at is null
    and v.user_id <> auth.uid()
    and (p_friend is null or v.user_id = p_friend)
    and (p_since is null or v.visited_at >= p_since)
    and are_friends(v.user_id, auth.uid())
    and shares(v.user_id);
$$;

-- Bewertungen, Tags, Favoriten und Wunschliste von Freunden
create or replace function public.friend_user_venues(p_friend uuid default null)
returns table (user_id uuid, venue_id uuid, rating smallint, review text, tags text[], price_level smallint,
               food_note text, favorite boolean, wishlist boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select uv.user_id, uv.venue_id, uv.rating, uv.review, uv.tags, uv.price_level,
         uv.food_note, uv.favorite, uv.wishlist, uv.updated_at
  from user_venues uv
  where uv.deleted_at is null
    and uv.user_id <> auth.uid()
    and (p_friend is null or uv.user_id = p_friend)
    and are_friends(uv.user_id, auth.uid())
    and shares(uv.user_id);
$$;

-- Markierungen, die mich betreffen, samt der nötigen Angaben zum Besuch
create or replace function public.my_companion_requests()
returns table (visit_id uuid, owner_id uuid, owner_name text, venue_id uuid, visited_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select v.id, v.user_id, p.display_name, v.venue_id, v.visited_at, c.status
  from visit_companions c
  join visits v on v.id = c.visit_id and v.deleted_at is null
  join profiles p on p.id = v.user_id
  where c.user_id = auth.uid();
$$;

-- Besuche aller Teilnehmer einer Tour (nur für Mitglieder), wieder ohne private Spalten
create or replace function public.tour_visits(p_tour uuid)
returns table (id uuid, user_id uuid, display_name text, venue_id uuid, visited_at timestamptz, rating smallint)
language sql stable security definer set search_path = public as $$
  select v.id, v.user_id, p.display_name, v.venue_id, v.visited_at, v.rating
  from visits v join profiles p on p.id = v.user_id
  where v.tour_id = p_tour and v.deleted_at is null
    and is_tour_member(p_tour, auth.uid())
    and is_tour_member(p_tour, v.user_id);
$$;

-- ---------------------------------------------------------------------------
-- Feed: Aktivitäten automatisch erzeugen (nur wenn die Person das Teilen aktiviert hat)
-- ---------------------------------------------------------------------------

create or replace function public.add_activity(p_actor uuid, p_type text, p_venue uuid, p_place text, p_rating smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := p_place;
  v_city text;
begin
  if not shares(p_actor) then return; end if;
  if p_venue is not null then
    select name, city into v_name, v_city from venues where id = p_venue;
  end if;
  insert into activities (actor, type, venue_id, venue_name, city, rating)
  values (p_actor, p_type, p_venue, v_name, v_city, p_rating);
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
  perform add_activity(new.user_id, case when v_first then 'new_venue' else 'checkin' end, new.venue_id, null, new.rating);
  return new;
end;
$$;
create trigger visits_activity after insert on public.visits
  for each row execute function public.log_visit_activity();

create or replace function public.log_rating_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rating is null or new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.rating is not distinct from new.rating then return new; end if;
  -- kein zweiter Eintrag, wenn gerade erst ein Check-in für dieselbe Location gemeldet wurde
  if exists (
    select 1 from activities
    where actor = new.user_id and venue_id = new.venue_id and created_at > now() - interval '10 minutes'
  ) then
    return new;
  end if;
  perform add_activity(new.user_id, 'rating', new.venue_id, null, new.rating);
  return new;
end;
$$;
create trigger user_venues_activity after insert or update of rating on public.user_venues
  for each row execute function public.log_rating_activity();

create or replace function public.log_photo_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared and new.deleted_at is null and (tg_op = 'INSERT' or not old.shared) then
    perform add_activity(new.user_id, 'photo', new.venue_id, null, null);
  end if;
  return new;
end;
$$;
create trigger photos_activity after insert or update of shared on public.photos
  for each row execute function public.log_photo_activity();

create or replace function public.log_going_out()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.until is not null and new.until > now()
     and (tg_op = 'INSERT' or old.until is null or old.until < now()) then
    perform add_activity(new.user_id, 'going_out', null, new.place, null);
  end if;
  return new;
end;
$$;
create trigger going_out_activity after insert or update of until on public.going_out
  for each row execute function public.log_going_out();

create or replace function public.log_tour_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform add_activity(new.owner_id, 'tour', null, new.name, null);
  return new;
end;
$$;
create trigger tours_activity after insert on public.tours
  for each row execute function public.log_tour_activity();

-- Ausführungsrechte: Funktionen sind nur für Angemeldete; einzig die Code-Vorabprüfung ist offen
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.add_activity(uuid, text, uuid, text, smallint) from authenticated;
grant execute on function public.check_invite(text) to anon;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket „photos“, Pfad <user_id>/<foto-id>.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;

create policy "fotos hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos lesen" on storage.objects for select to authenticated using (
  bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.photos ph where ph.storage_path = storage.objects.name)
  )
);
create policy "fotos löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Hinweise für spätere Schritte
--   * Push (Phase 5): Database Webhook auf INSERT in public.activities und public.visit_companions
--     an die Edge Function „notify“; diese beachtet friend_settings und versendet Web Push (VAPID).
--   * Kontolöschung (Phase 7): Edge Function „delete-account“ entfernt zuerst die Dateien im Bucket
--     und löscht dann den Eintrag in auth.users; alle Tabellen hängen per „on delete cascade“ daran.
