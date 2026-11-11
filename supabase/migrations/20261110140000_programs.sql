-- Ohjelmat kokoavat treenipohjia: esimerkiksi "Koko kroppa 2krt/vko" sisältää
-- treenit A ja B. Treeni kuuluu yhteen ohjelmaan, ja ohjelma omistaa treeniensä
-- järjestyksen. Kuten pohjat, ohjelmat ovat sovelluksen muodossa sellaisinaan.

create table public.programs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  template_ids text[] not null default '{}',
  -- Käytössä on viimeksi käyttöön otettu ohjelma. Erillistä "aktiivinen"-lippua
  -- ei ole, joten kahdella laitteella ei voi syntyä kahta aktiivista.
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

alter table public.programs enable row level security;

create policy "Vain omat rivit" on public.programs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.programs from anon;
