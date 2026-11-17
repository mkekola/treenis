-- Kommentit kavereiden treeneihin (Marian päätökset 17.11.): avoin ketju treenin alla, ja
-- kommentoijan nimi näkyy kaikille ketjun lukijoille. Ilmoitus treenin tekijälle ja ketjuun
-- aiemmin kommentoineille. Muokkausta ei ole. Kirjoittaja poistaa oman kommenttinsa, ja
-- treenin tekijä voi poistaa minkä tahansa kommentin omasta treenistään.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  -- Push-funktio merkitsee ilmoituksen lähetetyksi, jotta sama kommentti ei ilmoita kahdesti.
  notified_at timestamptz
);
create index comments_workout_idx on public.comments (workout_id, created_at);
alter table public.comments enable row level security;
-- Ei käytäntöjä: kommentit luetaan syötteen kautta ja kirjoitetaan funktioilla.
revoke all on table public.comments from anon, authenticated;

alter table public.notification_settings
  add column comments boolean not null default true;

-- Kommentoida voi treeniä, jonka näkee syötteessä: oma treeni tai kaverin jaettu treeni.
create function public.add_comment(target_workout uuid, comment_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  new_id uuid;
begin
  select w.user_id into owner
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  where w.id = target_workout and w.deleted_at is null and p.share_workouts and not w.hidden_from_friends
    and public.is_visible_workout(w, p.share_strava);
  if owner is null or (owner <> uid and not public.are_friends(uid, owner)) then
    raise exception 'Treeniä ei voi kommentoida';
  end if;
  insert into public.comments (workout_id, user_id, body)
  values (target_workout, uid, btrim(comment_body))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_comment(target_comment uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.comments c
  using public.workouts w
  where c.id = target_comment
    and w.id = c.workout_id
    and (select auth.uid()) in (c.user_id, w.user_id);
$$;

revoke execute on function public.add_comment(uuid, text) from public, anon;
revoke execute on function public.delete_comment(uuid) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;

-- Syöte palauttaa myös kommentit. Uusi sarake vaatii funktion luomisen uudelleen; vanha
-- sovellusversio ei käytä saraketta. Muuten sama kuin 20261117160000_share_weights.
drop function public.friend_feed(date);

create function public.friend_feed(since date)
returns table (
  workout_id uuid,
  user_id uuid,
  name text,
  is_me boolean,
  sport text,
  -- Aina null: syöte näyttää lajin, ei treenin nimeä. Sarake säilyy, jotta vanha sovellusversio toimii.
  title text,
  date date,
  started_at timestamptz,
  from_strava boolean,
  duration_sec integer,
  distance_m numeric,
  exercises jsonb,
  records jsonb,
  reactions jsonb,
  comments jsonb
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
    select w.*, p.display_name, p.share_records, p.share_exercises, p.share_weights,
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
    null::text,
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
        'bestKg', case when v.share_weights then
          (select max(s.weight_kg) from public.sets s where s.block_exercise_id = be.id and s.done) end
      ) order by b.position, be.position)
      from public.workout_blocks b
      join public.block_exercises be on be.block_id = b.id
      left join public.custom_exercises ce on ce.user_id = v.user_id and ce.id = be.exercise_id
      where b.workout_id = v.id
    ), '[]'::jsonb) end,
    -- Ennätys: liikkeen raskain tehty sarja on raskaampi kuin missään aiemmassa treenissä.
    -- Ensimmäinen kerta ei ole ennätys, koska ei ole mihin verrata.
    case when v.share_records then coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseId', x.exercise_id, 'name', x.name,
        'weightKg', case when v.share_weights then x.best end))
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
    ), '[]'::jsonb),
    -- Kommentoijan nimi näkyy kaikille, myös niille, jotka eivät ole hänen kavereitaan.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'userId', c.user_id,
        'name', cp.display_name,
        'body', c.body,
        'createdAt', c.created_at
      ) order by c.created_at)
      from public.comments c
      join public.profiles cp on cp.id = c.user_id
      where c.workout_id = v.id
    ), '[]'::jsonb)
  from visible v
  order by v.date desc, coalesce(v.measured_started_at, v.started_at, v.created_at) desc;
$$;

revoke execute on function public.friend_feed(date) from public, anon;
grant execute on function public.friend_feed(date) to authenticated;
