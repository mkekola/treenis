-- Kävely omaksi lajikseen. Stravasta tulevat kävelyt saavat sen.

alter table public.workouts drop constraint workouts_sport_check;
alter table public.workouts add constraint workouts_sport_check check (sport in (
  'strength', 'run', 'bike', 'swim', 'nordic', 'skating', 'hike', 'walk',
  'climb', 'alpine', 'windsurf', 'kitesurf', 'yoga', 'pilates', 'other'
));
