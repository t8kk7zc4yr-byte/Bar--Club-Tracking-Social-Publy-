-- Social Publy: Katalog aus OpenStreetMap (Import ganz Deutschland)
-- Einspielen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run (einmalig, nach 0004).
--
-- * Locations aus OpenStreetMap (source = 'osm') sind für alle Angemeldeten sichtbar.
-- * Selbst angelegte Locations (source = 'user') sieht nur, wer sie angelegt hat, deren bestätigte Freunde
--   und wer sie bereits in der eigenen Liste hat. Damit bleibt der öffentliche Katalog reine OpenStreetMap-Daten
--   (Lizenz ODbL, siehe docs/RECHT-CHECKLISTE.md).
-- * Der monatliche Import (scripts/import_osm.py) markiert geschlossene Locations als inaktiv statt sie zu löschen,
--   weil Besuche auf sie verweisen können.

alter table public.venues add column if not exists source text not null default 'user' check (source in ('osm', 'user'));
alter table public.venues add column if not exists active boolean not null default true;
alter table public.venues add column if not exists osm_seen_at timestamptz;

update public.venues set source = 'osm' where osm_id is not null and source <> 'osm';

create index if not exists venues_osm_geo on public.venues (lat, lng) where source = 'osm' and active;
create index if not exists venues_created_by on public.venues (created_by) where source = 'user';
create index if not exists venues_name_lower on public.venues (lower(name));

-- Hat jemand eine Location in der eigenen Liste oder einen Besuch dort?
create or replace function public.references_venue(v uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_venues where venue_id = v and user_id = uid)
      or exists (select 1 from visits where venue_id = v and user_id = uid);
$$;
revoke execute on function public.references_venue(uuid, uuid) from public, anon;
grant execute on function public.references_venue(uuid, uuid) to authenticated;

drop policy if exists "locations lesen" on public.venues;
create policy "locations lesen" on public.venues for select to authenticated using (
  source = 'osm'
  or created_by = auth.uid()
  or (created_by is not null and public.are_friends(created_by, auth.uid()))
  or public.references_venue(id, auth.uid())
);

-- Nutzer dürfen Quelle, Status und Importdatum nicht setzen; das übernimmt upsert_venue bzw. der Import
revoke insert, update on public.venues from authenticated;
grant insert (id, name, category, city, address, lat, lng, created_by) on public.venues to authenticated;
grant update (name, category, city, address, lat, lng) on public.venues to authenticated;

-- Anlegen: mit OpenStreetMap-Kennung als Katalogeintrag, sonst als eigene Location
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
  insert into venues (id, name, category, city, address, lat, lng, osm_id, created_by, source)
  values (coalesce(p_id, gen_random_uuid()), p_name, coalesce(p_category, 'sonstiges'), coalesce(p_city, ''),
          p_address, p_lat, p_lng, p_osm_id, auth.uid(), case when p_osm_id is null then 'user' else 'osm' end)
  on conflict (osm_id) do update set osm_id = excluded.osm_id
  returning id into v_id;
  return v_id;
end;
$$;
