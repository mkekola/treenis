-- Käyttäjän kiinnittämät korvaavat liikkeet (Marian päätös 17.11.): Vaihda liike -valitsimessa
-- minkä tahansa liikkeen voi kiinnittää toisen korvaajaksi, ja kiinnitetyt näkyvät
-- korvaavien kärjessä. Yksi rivi per liike, joten viimeisin muutos voittaa kuten pohjissa.
-- Irrotettu liike jää tyhjäksi listaksi eikä rivi poistu.

create table public.substitute_pins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) between 1 and 100),
  substitute_ids text[] not null default '{}' check (cardinality(substitute_ids) <= 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
alter table public.substitute_pins enable row level security;

create policy "Vain omat rivit" on public.substitute_pins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.substitute_pins from anon;
