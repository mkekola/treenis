-- Oman liikkeen päälihakset korvaavien liikkeiden ehdotuksiin (src/lib/substitutes.ts).
-- Tyhjä (null): liike on luotu ennen lihasvalintaa, ja lihakset arvioidaan lihasryhmästä.
-- Vanha sovellusversio ei lähetä saraketta, joten sen tallennus ei tyhjennä valintaa.

alter table public.custom_exercises
  add column muscles text[] check (muscles <@ array[
    'chest', 'front_delts', 'side_delts', 'rear_delts', 'lats', 'upper_back', 'lower_back',
    'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'adductors', 'calves',
    'abs', 'obliques'
  ]::text[]);
