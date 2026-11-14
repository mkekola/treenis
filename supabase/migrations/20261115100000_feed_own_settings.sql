-- Omat treenit syötteessä samoilla jakamisasetuksilla kuin kavereille (Marian toive):
-- syötteestä näkee, miltä oma treeni kavereille näyttää. Ennen omat näkyivät aina kokonaan.
-- Palautettavat sarakkeet eivät muutu, joten funktio korvataan suoraan.

create or replace function public.friend_feed(since date)
returns table (
  workout_id uuid,
  user_id uuid,
  name text,
  is_me boolean,
  sport text,
  -- null pelkälle Strava-treenille: Stravassa kirjoitettua nimeä ei näytetä kavereille.
  title text,
  date date,
  started_at timestamptz,
  from_strava boolean,
  duration_sec integer,
  distance_m numeric,
  exercises jsonb,
  records jsonb,
  reactions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as id
  ),
  people as (
    select me.id as user_id from me
    union
    select case when f.requester = me.id then f.addressee else f.requester end
    from public.friendships f, me
    where f.status = 'accepted' and me.id in (f.requester, f.addressee)
  ),
  visible as (
    select w.*, p.display_name, p.share_records, p.share_exercises,
      w.user_id = (select id from me) as mine,
      p.share_strava as strava_ok,
      not public.is_shareable_workout(w) as strava_only
    from public.workouts w
    join people on people.user_id = w.user_id
    join public.profiles p on p.id = w.user_id
    where w.date >= since
      and p.share_workouts
      and public.is_visible_workout(w, p.share_strava)
  )
  select
    v.id,
    v.user_id,
    v.display_name,
    v.mine,
    v.sport,
    case when v.strava_only then null else v.title end,
    v.date,
    v.started_at,
    v.strava_only,
    coalesce(case when v.strava_ok then v.measured_duration_sec end, v.duration_sec),
    coalesce(case when v.strava_ok then v.distance_m end, v.logged_distance_m),
    case when v.share_exercises then coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseId', be.exercise_id,
        'name', ce.name,
        'sets', (select count(*) from public.sets s where s.block_exercise_id = be.id and s.done),
        'bestKg', (select max(s.weight_kg) from public.sets s where s.block_exercise_id = be.id and s.done)
      ) order by b.position, be.position)
      from public.workout_blocks b
      join public.block_exercises be on be.block_id = b.id
      left join public.custom_exercises ce on ce.user_id = v.user_id and ce.id = be.exercise_id
      where b.workout_id = v.id
    ), '[]'::jsonb) end,
    -- Ennätys: liikkeen raskain tehty sarja on raskaampi kuin missään aiemmassa treenissä.
    -- Ensimmäinen kerta ei ole ennätys, koska ei ole mihin verrata.
    case when v.share_records then coalesce((
      select jsonb_agg(jsonb_build_object('exerciseId', x.exercise_id, 'name', x.name, 'weightKg', x.best))
      from (
        select be.exercise_id, max(ce.name) as name, max(s.weight_kg) as best
        from public.workout_blocks b
        join public.block_exercises be on be.block_id = b.id
        join public.sets s on s.block_exercise_id = be.id and s.done and s.weight_kg > 0
        left join public.custom_exercises ce on ce.user_id = v.user_id and ce.id = be.exercise_id
        where b.workout_id = v.id
        group by be.exercise_id
      ) x
      where x.best > (
        select max(s2.weight_kg)
        from public.workouts w2
        join public.workout_blocks b2 on b2.workout_id = w2.id
        join public.block_exercises be2 on be2.block_id = b2.id
        join public.sets s2 on s2.block_exercise_id = be2.id and s2.done
        where w2.user_id = v.user_id
          and w2.deleted_at is null
          and w2.id <> v.id
          and be2.exercise_id = x.exercise_id
          and (w2.date < v.date
            or (w2.date = v.date and coalesce(w2.started_at, w2.created_at) < coalesce(v.started_at, v.created_at)))
      )
    ), '[]'::jsonb) end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'reaction', r.reaction,
        'userId', r.user_id,
        'name', case when r.user_id in (select user_id from people) then rp.display_name end
      ) order by r.created_at)
      from public.reactions r
      join public.profiles rp on rp.id = r.user_id
      where r.workout_id = v.id
    ), '[]'::jsonb)
  from visible v
  order by v.date desc, coalesce(v.measured_started_at, v.started_at, v.created_at) desc;
$$;
