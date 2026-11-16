-- Aikasarjan työajan loppu käyttää samaa ajastusta kuin lepo, mutta omalla otsikolla
-- ("Aika loppui"). Ilman otsikkoa ilmoitus on levon "Lepo ohi", joten vanha sovellusversio
-- toimii ennallaan.

alter table public.rest_alarms
  add column title text check (char_length(title) <= 60);

-- Palautettava rivi muuttuu, joten funktio luodaan uudelleen.
drop function public.claim_due_rest_alarms();

create function public.claim_due_rest_alarms()
returns table (user_id uuid, title text, body text)
language sql
security definer
set search_path = ''
as $$
  delete from public.rest_alarms a
  where a.fires_at <= now()
  returning a.user_id, a.title, a.body;
$$;
revoke execute on function public.claim_due_rest_alarms() from public, anon, authenticated;
grant execute on function public.claim_due_rest_alarms() to service_role;
