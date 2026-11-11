-- Strava-tuonti. Palvelin vain tuo aktiviteetit, sovellus yhdistää ne
-- kirjattuihin treeneihin (src/lib/strava.ts), koska vain puhelin näkee
-- treenit, joita ei ole vielä synkattu.

-- Yhteys ja tokenit. Ei käytäntöjä: RLS estää selaimelta kaiken, ja vain
-- Edge Function lukee taulua palveluavaimella. Yksi rivi per käyttäjä, ja
-- athlete_id kertoo webhookille, kenen aktiviteetista on kyse.
create table public.strava_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  last_import_at timestamptz
);
alter table public.strava_connections enable row level security;

-- Kertakäyttöinen OAuth-tunniste. Stravalta paluu voi osua iPhonessa Safariin,
-- jossa käyttäjä ei ole kirjautunut, joten tunniste kertoo kenen yhteys on.
create table public.strava_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.strava_oauth_states enable row level security;

-- Tuodut aktiviteetit sellaisenaan. Sovellus lukee vain omansa.
create table public.strava_activities (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  sport_type text not null,
  name text not null,
  started_at timestamptz not null,
  elapsed_sec integer not null check (elapsed_sec >= 0),
  moving_sec integer check (moving_sec >= 0),
  distance_m numeric check (distance_m >= 0),
  avg_hr smallint,
  max_hr smallint,
  calories integer,
  elevation_gain_m numeric,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);
alter table public.strava_activities enable row level security;

create index strava_activities_user_updated_idx on public.strava_activities (user_id, updated_at);

create policy "Vain omat aktiviteetit" on public.strava_activities for select to authenticated
  using ((select auth.uid()) = user_id);

-- Yhteyden tila sovellukselle ilman tokeneita.
create function public.strava_status()
returns table (connected_at timestamptz, last_import_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.connected_at, c.last_import_at
  from public.strava_connections c
  where c.user_id = (select auth.uid());
$$;

revoke execute on function public.strava_status() from public, anon;
grant execute on function public.strava_status() to authenticated;
