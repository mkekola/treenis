-- Käsin kirjattu matka ja keskisyke, esimerkiksi juoksu ilman Stravaa.
-- Omat sarakkeensa, koska distance_m ja avg_hr ovat kellon mittaamia, ja
-- mitattu voittaa kirjatun: molemmat säilyvät, ja sovellus valitsee.
-- Tallennus- ja hakufunktiot päivitetään kuljettamaan uudet kentät.

alter table public.workouts
  add column logged_distance_m numeric check (logged_distance_m >= 0),
  add column logged_avg_hr smallint check (logged_avg_hr between 20 and 250);

create or replace function public.save_workout(payload jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid := (payload ->> 'id')::uuid;
  v_updated timestamptz := coalesce((payload ->> 'updatedAt')::timestamptz, now());
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

  insert into public.workouts as w (
    id, user_id, sport, date, title, template_id,
    started_at, duration_sec, rpe, notes, logged_distance_m, logged_avg_hr,
    strava_activity_id, measured_started_at, measured_duration_sec, distance_m,
    avg_hr, max_hr, calories, elevation_gain_m, pending_match,
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
    (payload #>> '{measured,stravaActivityId}')::bigint,
    (payload #>> '{measured,startedAt}')::timestamptz,
    (payload #>> '{measured,durationSec}')::integer,
    (payload #>> '{measured,distanceM}')::numeric,
    (payload #>> '{measured,avgHr}')::smallint,
    (payload #>> '{measured,maxHr}')::smallint,
    (payload #>> '{measured,calories}')::integer,
    (payload #>> '{measured,elevationGainM}')::numeric,
    payload -> 'pendingMatch',
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

-- Treenit sovelluksen JSON-muodossa. Ilman since-arvoa kaikki, muuten vain
-- sen jälkeen muuttuneet (myös poistetut, jotta poisto välittyy laitteelle).
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

