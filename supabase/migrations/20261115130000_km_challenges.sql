-- Kilometrihaasteet: juoksukilometrit ja kilometrit jalan (juoksu, kävely ja vaellus).
-- Tulos palautetaan metreinä, jotta challenge_score pysyy kokonaislukuna; sovellus
-- näyttää sen kilometreinä.

alter table public.challenges drop constraint challenges_metric_check;
alter table public.challenges add constraint challenges_metric_check
  check (metric in ('strength', 'workouts', 'weeks', 'run_km', 'foot_km'));

-- Osallistujan tulos aikavälillä. Mukana vain treenit, jotka saavat näkyä kavereille.
-- Stravan mittaama matka lasketaan vain Strava-jakamisen luvalla, koska kaverit näkevät
-- summan; muuten mukana on käsin kirjattu matka. Sama sääntö kuin syötteessä.
create or replace function public.challenge_score(member uuid, metric text, from_date date, to_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select w.date, w.sport,
      coalesce(case when p.share_strava then w.distance_m end, w.logged_distance_m, 0) as distance_m
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
    when 'run_km' then (select coalesce(round(sum(distance_m)), 0) from counted where sport = 'run')
    when 'foot_km' then (
      select coalesce(round(sum(distance_m)), 0) from counted where sport in ('run', 'walk', 'hike')
    )
  end)::integer;
$$;
