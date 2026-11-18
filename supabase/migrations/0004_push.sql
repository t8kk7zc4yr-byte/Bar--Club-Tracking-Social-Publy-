-- Social Publy: Push-Benachrichtigungen (Phase 5, Teil 2)
-- Einspielen: Supabase Dashboard > SQL Editor > gesamten Inhalt einfügen > Run (einmalig, nach 0003).
-- Voraussetzung: Die Server-Funktion „notify“ ist angelegt (siehe docs/PUSH-EINRICHTEN.md).
--
-- Bei jedem neuen Feed-Eintrag, jeder Markierung und jeder Freundschaftsanfrage ruft die Datenbank die
-- Funktion „notify“ auf und übergibt nur die Kennung des Eintrags. „pushed_at“ verhindert Doppelversand.

create extension if not exists pg_net with schema extensions;

alter table public.activities add column if not exists pushed_at timestamptz;
alter table public.visit_companions add column if not exists pushed_at timestamptz;
alter table public.friendships add column if not exists pushed_at timestamptz;

-- Markierungen brauchen einen Zeitstempel, damit alte Einträge nicht nachträglich versendet werden
alter table public.visit_companions add column if not exists created_at timestamptz not null default now();

create or replace function public.push_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_body jsonb;
begin
  if tg_table_name = 'activities' then
    v_body := jsonb_build_object('table', 'activities', 'id', new.id);
  elsif tg_table_name = 'visit_companions' then
    v_body := jsonb_build_object('table', 'visit_companions', 'visit_id', new.visit_id, 'user_id', new.user_id);
  elsif tg_table_name = 'friendships' then
    v_body := jsonb_build_object('table', 'friendships', 'requester', new.requester, 'addressee', new.addressee);
  else
    return new;
  end if;
  perform net.http_post(
    url := 'https://dmjfxfenuxublybwmfhj.supabase.co/functions/v1/notify',
    body := v_body,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Ein Fehler beim Benachrichtigen darf nie das Speichern des Eintrags verhindern
  return new;
end;
$$;

revoke execute on function public.push_notify() from public, anon, authenticated;

drop trigger if exists activities_push on public.activities;
create trigger activities_push after insert on public.activities
  for each row execute function public.push_notify();

drop trigger if exists visit_companions_push on public.visit_companions;
create trigger visit_companions_push after insert on public.visit_companions
  for each row execute function public.push_notify();

drop trigger if exists friendships_push on public.friendships;
create trigger friendships_push after insert on public.friendships
  for each row execute function public.push_notify();
