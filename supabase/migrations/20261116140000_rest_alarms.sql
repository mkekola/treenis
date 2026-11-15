-- Levon päättymisilmoitus, kun käyttäjä on treenin aikana toisessa sovelluksessa.
-- Sovellus tallentaa ajastuksen siirtyessään taustalle ja poistaa sen palatessaan.
-- Tietokanta tarkistaa 5 sekunnin välein, onko jonkin lepo päättynyt, ja kutsuu
-- push-funktiota vain silloin, kun lähetettävää on.

-- Yksi ajastus per käyttäjä: uusi lepo korvaa edellisen.
create table public.rest_alarms (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fires_at timestamptz not null,
  -- Esim. "Seuraavaksi: Jalkakyykky 80 kg × 10". Sovellus muodostaa tekstin, koska vain se tietää treenin tilan.
  body text not null check (char_length(body) <= 200),
  created_at timestamptz not null default now()
);
alter table public.rest_alarms enable row level security;
create policy "Vain omat ajastukset" on public.rest_alarms for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.rest_alarms from anon;

alter table public.notification_settings
  add column rest boolean not null default true;

-- Erääntyneet ajastukset otetaan lähetettäviksi ja poistetaan samalla, jotta sama
-- ilmoitus ei lähde kahdesti, vaikka tarkistuksia olisi käynnissä päällekkäin.
create function public.claim_due_rest_alarms()
returns table (user_id uuid, body text)
language sql
security definer
set search_path = ''
as $$
  delete from public.rest_alarms a
  where a.fires_at <= now()
  returning a.user_id, a.body;
$$;
revoke execute on function public.claim_due_rest_alarms() from public, anon, authenticated;
grant execute on function public.claim_due_rest_alarms() to service_role;

select cron.schedule(
  'push-rest',
  '5 seconds',
  $$
  select net.http_post(
    url := 'https://kchdtioqxuquewvwhare.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.push_cron_secret()),
    body := '{"action":"rest"}'::jsonb
  )
  where exists (select 1 from public.rest_alarms where fires_at <= now());
  $$
);

-- Tiheä tarkistus kirjaa jokaisen ajon lokiin. Vanhat merkinnät siivotaan kerran yössä.
select cron.schedule(
  'cron-history-cleanup',
  '17 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '1 day' $$
);
