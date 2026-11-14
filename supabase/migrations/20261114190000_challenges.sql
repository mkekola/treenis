-- Haasteet: aikarajattu kisa kaverien kesken. Tulokset lasketaan treeneistä,
-- jotka saavat näkyä kavereille: Treenikseen kirjatut aina, Stravasta tuodut vain
-- käyttäjän luvalla (share_strava). Kaikki muutokset tehdään funktioilla.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references auth.users (id) on delete cascade,
  -- strength = salitreenit, workouts = kaikki treenit, weeks = viikot, joilla vähintään 2 treeniä
  metric text not null check (metric in ('strength', 'workouts', 'weeks')),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92)
);
alter table public.challenges enable row level security;

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted')),
  primary key (challenge_id, user_id)
);
alter table public.challenge_members enable row level security;
create index challenge_members_user_idx on public.challenge_members (user_id);
-- Ei käytäntöjä: haasteet luetaan my_challenges-funktiolla ja muutetaan funktioilla.

-- Osallistujan tulos aikavälillä. Mukana vain treenit, jotka saavat näkyä kavereille.
create function public.challenge_score(member uuid, metric text, from_date date, to_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select w.date, w.sport
    from public.workouts w
    join public.profiles p on p.id = w.user_id
    where w.user_id = member
      and w.date between from_date and to_date
      and public.is_visible_workout(w, p.share_strava)
  )
  select (case metric
    when 'strength' then (select count(*) from counted where sport = 'strength')
    when 'workouts' then (select count(*) from counted)
    when 'weeks' then (
      select count(*) from (
        select date_trunc('week', date) from counted group by 1 having count(*) >= 2
      ) full_weeks
    )
  end)::integer;
$$;

-- Haaste kavereille. Luoja on heti mukana, kutsutut hyväksyvät itse.
create function public.create_challenge(metric text, starts_on date, ends_on date, invitees uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  invitee uuid;
begin
  if uid is null then
    raise exception 'Ei kirjautunut';
  end if;
  if coalesce(array_length(invitees, 1), 0) not between 1 and 9 then
    raise exception 'Haasteeseen kutsutaan 1–9 kaveria';
  end if;
  foreach invitee in array invitees loop
    if invitee = uid or not public.are_friends(uid, invitee) then
      raise exception 'Haasteeseen voi kutsua vain kavereita';
    end if;
  end loop;
  insert into public.challenges (creator, metric, starts_on, ends_on)
  values (uid, metric, starts_on, ends_on)
  returning id into new_id;
  insert into public.challenge_members (challenge_id, user_id, status) values (new_id, uid, 'accepted');
  insert into public.challenge_members (challenge_id, user_id)
  select new_id, i from unnest(invitees) as i on conflict do nothing;
  return new_id;
end;
$$;

-- Kutsuun vastaaminen. Hylätty kutsu poistuu.
create function public.respond_challenge(target_challenge uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if accept then
    update public.challenge_members set status = 'accepted'
    where challenge_id = target_challenge and user_id = (select auth.uid()) and status = 'invited';
  else
    delete from public.challenge_members
    where challenge_id = target_challenge and user_id = (select auth.uid()) and status = 'invited';
  end if;
end;
$$;

-- Haasteesta poistuminen. Kun ketään ei ole jäljellä, haaste poistetaan.
create function public.leave_challenge(target_challenge uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.challenge_members
  where challenge_id = target_challenge and user_id = (select auth.uid());
  delete from public.challenges c
  where c.id = target_challenge
    and not exists (select 1 from public.challenge_members m where m.challenge_id = c.id and m.status = 'accepted');
end;
$$;

-- Omat haasteet, myös avoimet kutsut ja kahden viikon sisällä päättyneet.
-- Osallistujat näkevät toistensa nimet ja tulokset. Tulos lasketaan tähän päivään asti.
-- previous_score on oma tulos edelliseltä yhtä pitkältä jaksolta: oma saavutus.
create function public.my_challenges()
returns table (
  id uuid,
  metric text,
  starts_on date,
  ends_on date,
  creator uuid,
  my_status text,
  previous_score integer,
  members jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.metric,
    c.starts_on,
    c.ends_on,
    c.creator,
    mine.status,
    case when mine.status = 'accepted' then public.challenge_score(
      mine.user_id, c.metric, c.starts_on - (c.ends_on - c.starts_on + 1), c.starts_on - 1
    ) end,
    (
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id,
        'name', p.display_name,
        'status', m.status,
        'score', case when m.status = 'accepted' and c.starts_on <= current_date
          then public.challenge_score(m.user_id, c.metric, c.starts_on, least(c.ends_on, current_date)) end
      ) order by p.display_name)
      from public.challenge_members m
      join public.profiles p on p.id = m.user_id
      where m.challenge_id = c.id
    )
  from public.challenges c
  join public.challenge_members mine on mine.challenge_id = c.id and mine.user_id = (select auth.uid())
  where c.ends_on >= current_date - 14
  order by c.ends_on;
$$;

revoke all on table public.challenges, public.challenge_members from anon;

revoke execute on function public.challenge_score(uuid, text, date, date) from public, anon, authenticated;
revoke execute on function public.create_challenge(text, date, date, uuid[]) from public, anon;
revoke execute on function public.respond_challenge(uuid, boolean) from public, anon;
revoke execute on function public.leave_challenge(uuid) from public, anon;
revoke execute on function public.my_challenges() from public, anon;
grant execute on function public.create_challenge(text, date, date, uuid[]) to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.leave_challenge(uuid) to authenticated;
grant execute on function public.my_challenges() to authenticated;
