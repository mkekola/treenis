-- Strava-aktiviteetti kuuluu yhdelle voimassa olevalle treenille. Ennen tätä myös
-- poistettu rivi varasi aktiviteetin: kun muistiinpanoista tuotu treeni yhdistyi
-- olemassa olevaan Strava-treeniin, sovellus poisti Strava-treenin, mutta palvelin
-- hylkäsi yhdistetyn treenin (duplicate key) ja muutos jäi jonoon pysyvästi.

drop index public.workouts_user_strava_idx;
create unique index workouts_user_strava_idx on public.workouts (user_id, strava_activity_id)
  where strava_activity_id is not null and deleted_at is null;

-- Sama kuin ennen, mutta treeni, joka ottaa Strava-aktiviteetin, vapauttaa sen muilta:
-- pelkkä Strava-treeni (tunniste 00000000-0000-4000-8000-…) poistetaan, ja kirjatusta
-- treenistä irrotetaan vain mittaus, jolloin itse treeni säilyy.
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
    v_strava,
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
