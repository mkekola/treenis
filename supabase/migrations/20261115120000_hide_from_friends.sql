-- Yksittäisen treenin voi piilottaa kaverisyötteestä (Marian toive). Piilotus koskee
-- vain näkyvyyttä: treeni lasketaan yhä haasteisiin (challenge_score ei muutu), ja
-- annetut reaktiot jäävät tallelle, jolloin ne palaavat, jos piilotuksen perii.

alter table public.workouts
  add column hidden_from_friends boolean not null default false;

-- Tallennus ja haku kuljettavat piilotuksen laitteen ja palvelimen välillä.
create or replace function public.save_workout(payload jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid := (payload ->> 'id')::uuid;
  v_updated timestamptz := coalesce((payload ->> 'updatedAt')::timestamptz, now());
  v_strava bigint := (payload #>> '{measured,stravaActivityId}')::bigint;
  v_existing timestamptz;
  v_block jsonb;
  v_block_pos integer;
  v_block_id uuid;
  v_exercise jsonb;
  v_exercise_pos integer;
  v_exercise_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan' using errcode = '42501';
  end if;

  -- Viimeisin kirjoitus voittaa: vanhempi versio ohitetaan kokonaan.
  select w.updated_at into v_existing from public.workouts w where w.id = v_id;
  if found and v_existing > v_updated then
    return false;
  end if;

  if v_strava is not null and payload ->> 'deletedAt' is null then
    update public.workouts w
    set deleted_at = now(), updated_at = now()
    where w.user_id = v_user and w.strava_activity_id = v_strava and w.id <> v_id
      and w.deleted_at is null and w.id::text like '00000000-0000-4000-8000-%';

    update public.workouts w
    set strava_activity_id = null, measured_started_at = null, measured_duration_sec = null,
        distance_m = null, avg_hr = null, max_hr = null, calories = null, elevation_gain_m = null,
        updated_at = now()
    where w.user_id = v_user and w.strava_activity_id = v_strava and w.id <> v_id and w.deleted_at is null;
  end if;

  insert into public.workouts as w (
    id, user_id, sport, date, title, template_id,
    started_at, duration_sec, rpe, notes, logged_distance_m, logged_avg_hr,
    strava_activity_id, measured_started_at, measured_duration_sec, distance_m,
    avg_hr, max_hr, calories, elevation_gain_m, pending_match, hidden_from_friends,
    updated_at, deleted_at
  ) values (
    v_id, v_user, payload ->> 'sport', (payload ->> 'date')::date, payload ->> 'title',
    payload ->> 'templateId',
    (payload #>> '{logged,startedAt}')::timestamptz,
    (payload #>> '{logged,durationSec}')::integer,
    (payload #>> '{logged,rpe}')::smallint,
    payload #>> '{logged,notes}',
    (payload #>> '{logged,distanceM}')::numeric,
    (payload #>> '{logged,avgHr}')::smallint,
    v_strava,
    (payload #>> '{measured,startedAt}')::timestamptz,
    (payload #>> '{measured,durationSec}')::integer,
    (payload #>> '{measured,distanceM}')::numeric,
    (payload #>> '{measured,avgHr}')::smallint,
    (payload #>> '{measured,maxHr}')::smallint,
    (payload #>> '{measured,calories}')::integer,
    (payload #>> '{measured,elevationGainM}')::numeric,
    payload -> 'pendingMatch',
    coalesce((payload ->> 'hiddenFromFriends')::boolean, false),
    v_updated,
    (payload ->> 'deletedAt')::timestamptz
  )
  on conflict (id) do update set
    sport = excluded.sport,
    date = excluded.date,
    title = excluded.title,
    template_id = excluded.template_id,
    started_at = excluded.started_at,
    duration_sec = excluded.duration_sec,
    rpe = excluded.rpe,
    notes = excluded.notes,
    logged_distance_m = excluded.logged_distance_m,
    logged_avg_hr = excluded.logged_avg_hr,
    strava_activity_id = excluded.strava_activity_id,
    measured_started_at = excluded.measured_started_at,
    measured_duration_sec = excluded.measured_duration_sec,
    distance_m = excluded.distance_m,
    avg_hr = excluded.avg_hr,
    max_hr = excluded.max_hr,
    calories = excluded.calories,
    elevation_gain_m = excluded.elevation_gain_m,
    pending_match = excluded.pending_match,
    hidden_from_friends = excluded.hidden_from_friends,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at;

  -- Sisältö korvataan kokonaan: vanhat lohkot pois (liikkeet ja sarjat
  -- poistuvat ketjussa) ja uudet sisään.
  delete from public.workout_blocks b where b.workout_id = v_id;

  for v_block, v_block_pos in
    select value, ordinality - 1
    from jsonb_array_elements(coalesce(payload #> '{logged,blocks}', '[]'::jsonb)) with ordinality
  loop
    insert into public.workout_blocks (user_id, workout_id, position, client_id, rest_sec)
    values (v_user, v_id, v_block_pos, v_block ->> 'id', (v_block ->> 'restSec')::integer)
    returning id into v_block_id;

    for v_exercise, v_exercise_pos in
      select value, ordinality - 1
      from jsonb_array_elements(coalesce(v_block -> 'exercises', '[]'::jsonb)) with ordinality
    loop
      insert into public.block_exercises (user_id, block_id, position, exercise_id, feel)
      values (v_user, v_block_id, v_exercise_pos, v_exercise ->> 'exerciseId', v_exercise ->> 'feel')
      returning id into v_exercise_id;

      insert into public.sets (
        user_id, block_exercise_id, position, reps, weight_kg, duration_sec, done
      )
      select
        v_user, v_exercise_id, s.ordinality - 1,
        (s.value ->> 'reps')::smallint,
        (s.value ->> 'weightKg')::numeric,
        (s.value ->> 'durationSec')::integer,
        coalesce((s.value ->> 'done')::boolean, true)
      from jsonb_array_elements(coalesce(v_exercise -> 'sets', '[]'::jsonb)) with ordinality as s;
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.get_workouts(since timestamptz default null)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', w.id,
    'sport', w.sport,
    'date', w.date,
    'title', w.title,
    'templateId', w.template_id,
    'updatedAt', w.updated_at,
    'deletedAt', w.deleted_at,
    'pendingMatch', w.pending_match,
    'hiddenFromFriends', case when w.hidden_from_friends then true end,
    'measured', case when w.strava_activity_id is null then null else jsonb_build_object(
      'stravaActivityId', w.strava_activity_id,
      'startedAt', w.measured_started_at,
      'durationSec', w.measured_duration_sec,
      'distanceM', w.distance_m,
      'avgHr', w.avg_hr,
      'maxHr', w.max_hr,
      'calories', w.calories,
      'elevationGainM', w.elevation_gain_m
    ) end,
    'logged', jsonb_build_object(
      'startedAt', w.started_at,
      'durationSec', w.duration_sec,
      'rpe', w.rpe,
      'notes', w.notes,
      'distanceM', w.logged_distance_m,
      'avgHr', w.logged_avg_hr,
      'blocks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.client_id,
          'restSec', b.rest_sec,
          'exercises', coalesce((
            select jsonb_agg(jsonb_build_object(
              'exerciseId', e.exercise_id,
              'feel', e.feel,
              'sets', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'reps', s.reps,
                  'weightKg', s.weight_kg,
                  'durationSec', s.duration_sec,
                  'done', s.done
                ) order by s.position)
                from public.sets s
                where s.block_exercise_id = e.id
              ), '[]'::jsonb)
            ) order by e.position)
            from public.block_exercises e
            where e.block_id = b.id
          ), '[]'::jsonb)
        ) order by b.position)
        from public.workout_blocks b
        where b.workout_id = w.id
      ), '[]'::jsonb)
    )
  ))
  from public.workouts w
  where since is null or w.updated_at > since
  order by w.updated_at
$$;

-- Piilotettu treeni ei näy syötteessä kavereille eikä itselle, koska oma syöte näyttää
-- treenit niin kuin kaverit ne näkevät.
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
      and not w.hidden_from_friends
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

-- Piilotettuun treeniin ei voi reagoida.
create or replace function public.react(target_workout uuid, new_reaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  select w.user_id into owner
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  where w.id = target_workout and p.share_workouts and not w.hidden_from_friends
    and public.is_visible_workout(w, p.share_strava);
  if owner is null or owner = uid or not public.are_friends(uid, owner) then
    raise exception 'Treeniin ei voi reagoida';
  end if;
  if new_reaction is null then
    delete from public.reactions r where r.workout_id = target_workout and r.user_id = uid;
  else
    insert into public.reactions (workout_id, user_id, reaction) values (target_workout, uid, new_reaction)
    on conflict (workout_id, user_id) do update set reaction = excluded.reaction, created_at = now();
  end if;
end;
$$;
