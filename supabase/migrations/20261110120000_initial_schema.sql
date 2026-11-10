-- Treeniksen perusrakenne.
--
-- Jokaisessa taulussa on user_id, ja rivitason oikeudet (RLS) sallivat vain
-- omien rivien käsittelyn. Myös lapsitauluissa on user_id, jotta oikeustarkistus
-- ei tarvitse liitoksia: se on nopeampi ja helpompi lukea.
--
-- Sovellus ei kirjoita treenitauluihin suoraan, vaan save_workout-funktion kautta
-- (seuraava migraatio), joka purkaa sovelluksen JSON-muotoisen treenin näihin.

-- ------------------------------------------------------------------ treenit

create table public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sport text not null check (sport in (
    'strength', 'run', 'bike', 'swim', 'nordic', 'skating', 'hike',
    'climb', 'alpine', 'windsurf', 'wingfoil', 'yoga', 'pilates', 'other'
  )),
  date date not null,
  title text not null,
  template_id text,

  -- Itse kirjattu
  started_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  rpe smallint check (rpe between 1 and 10),
  notes text,

  -- Kellon mittaama, Stravan kautta. Mitattu voittaa kirjatun sovelluksessa.
  strava_activity_id bigint,
  measured_started_at timestamptz,
  measured_duration_sec integer check (measured_duration_sec >= 0),
  distance_m numeric(9, 1) check (distance_m >= 0),
  avg_hr smallint,
  max_hr smallint,
  calories integer,
  elevation_gain_m numeric(7, 1),
  pending_match jsonb,

  created_at timestamptz not null default now(),
  -- Synkka: viimeisin kirjoitus voittaa. Poistettu rivi jää merkinnäksi, jotta
  -- poisto välittyy muille laitteille.
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint workouts_measured_complete check (
    strava_activity_id is null
    or (measured_started_at is not null and measured_duration_sec is not null)
  )
);

-- Sama Strava-aktiviteetti ei voi tulla kahdesti.
create unique index workouts_user_strava_idx
  on public.workouts (user_id, strava_activity_id)
  where strava_activity_id is not null;
create index workouts_user_updated_idx on public.workouts (user_id, updated_at);
create index workouts_user_date_idx on public.workouts (user_id, date desc);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position smallint not null check (position >= 0),
  -- Sovelluksen oma lohkotunniste (esim. pohjan "a1"), säilytetään sellaisenaan.
  client_id text not null,
  rest_sec integer not null check (rest_sec >= 0),
  unique (workout_id, position)
);
create index workout_blocks_user_idx on public.workout_blocks (user_id);

create table public.block_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null references public.workout_blocks (id) on delete cascade,
  position smallint not null check (position >= 0),
  -- Liikekirjaston tunniste (koodissa) tai oman liikkeen tunniste.
  exercise_id text not null,
  feel text check (feel in ('very_easy', 'easy', 'right', 'hard', 'max')),
  unique (block_id, position)
);
-- Liikkeen historia ja kehityskäyrät haetaan tällä.
create index block_exercises_user_exercise_idx on public.block_exercises (user_id, exercise_id);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_exercise_id uuid not null references public.block_exercises (id) on delete cascade,
  position smallint not null check (position >= 0),
  reps smallint check (reps >= 0),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  duration_sec integer check (duration_sec >= 0),
  done boolean not null default true,
  unique (block_exercise_id, position)
);
create index sets_user_idx on public.sets (user_id);

-- ------------------------------------------------- pohjat ja omat liikkeet

-- Pohjista ei lasketa tilastoja, joten niiden sisältö on JSON:na samassa
-- muodossa kuin sovelluksessa. Tunniste on sovelluksen oma (esim. "template-a").
create table public.templates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  blocks jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.custom_exercises (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  muscle_group text not null check (muscle_group in (
    'chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'full_body'
  )),
  measurement text not null check (measurement in ('weight_reps', 'reps', 'time')),
  per_side boolean not null default false,
  aliases text[] not null default '{}',
  weight_step_kg numeric(5, 2) check (weight_step_kg > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);
-- Samannimistä omaa liikettä ei voi olla kahta, isoista kirjaimista riippumatta.
create unique index custom_exercises_user_name_idx
  on public.custom_exercises (user_id, lower(name))
  where deleted_at is null;

-- ------------------------------------------------------------ oikeudet (RLS)

alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.templates enable row level security;
alter table public.custom_exercises enable row level security;

-- (select auth.uid()) eikä pelkkä auth.uid(): arvo lasketaan kerran per kysely
-- eikä kerran per rivi.
create policy "Vain omat rivit" on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Vain omat rivit" on public.workout_blocks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Vain omat rivit" on public.block_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Vain omat rivit" on public.sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Vain omat rivit" on public.templates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Vain omat rivit" on public.custom_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Kirjautumaton (anon) ei tarvitse mitään. RLS estäisi jo rivit, mutta
-- oikeudet poistetaan myös kokonaan, ettei yksikin unohtunut politiikka avaa niitä.
revoke all on table
  public.workouts, public.workout_blocks, public.block_exercises,
  public.sets, public.templates, public.custom_exercises
from anon;
