-- Wingfoil vaihtuu leijalautailuksi. Wingfoil-treenejä ei ole, joten rivejä ei
-- tarvitse muuttaa.

alter table public.workouts drop constraint workouts_sport_check;
alter table public.workouts add constraint workouts_sport_check check (sport in (
  'strength', 'run', 'bike', 'swim', 'nordic', 'skating', 'hike',
  'climb', 'alpine', 'windsurf', 'kitesurf', 'yoga', 'pilates', 'other'
));
