-- Reaktioilmoitus muistetaan erillään reaktiosta. Kun kaveri poistaa reaktion ja antaa sen
-- uudelleen, reactions-rivi syntyy uudestaan, mutta ilmoitus ei lähde toista kertaa.
-- reactions.notified_at jää toistaiseksi käyttämättömäksi ja poistetaan myöhemmin, jotta
-- vanha push-funktio toimii siihen asti, kun uusi on julkaistu.

create table public.reaction_notices (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);
alter table public.reaction_notices enable row level security;
-- Ei käytäntöjä: vain push-funktio (service role) lukee ja kirjoittaa.
revoke all on table public.reaction_notices from anon, authenticated;
