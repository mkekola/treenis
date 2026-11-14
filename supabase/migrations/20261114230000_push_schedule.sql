-- Ajastetut muistutukset: tietokanta herättää push-funktion kerran tunnissa, ja funktio
-- päättää Suomen ajan mukaan, onko jokin muistutus ajankohtainen (haaste 2 pv klo 18,
-- tulos klo 9, viikkoputki lauantaina klo 12). Tunneittain, jotta kesäaika ei sotke.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- Herätyksen salaisuus luodaan tässä eikä sitä näe kukaan. Funktio tarkistaa sen
-- tietokannasta push_cron_secret()-funktiolla, joten sitä ei tarvitse kopioida minnekään.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_secret');

create function public.push_cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret';
$$;

revoke execute on function public.push_cron_secret() from public, anon, authenticated;
grant execute on function public.push_cron_secret() to service_role;

-- Muistutukset kertovat tilanteen, joten funktio laskee haasteiden tulokset.
grant execute on function public.challenge_score(uuid, text, date, date) to service_role;

select cron.schedule(
  'push-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://kchdtioqxuquewvwhare.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.push_cron_secret()),
    body := '{"action":"scheduled"}'::jsonb
  );
  $$
);
