-- Kaverien syöte ja reaktiot. Syöte luetaan suoraan treeneistä funktiolla, joka
-- noudattaa jakamisasetuksia joka hetki: asetuksen muutos koskee myös vanhoja treenejä.
--
-- Kavereille näkyy vain Treenikseen kirjattu. Stravan ehdot sallivat Strava-datan
-- näyttämisen vain käyttäjälle itselleen, joten pelkkä Strava-treeni ei näy, eikä
-- syötteeseen oteta mitattuja kenttiä (kesto, matka, syke) lainkaan.

-- --------------------------------------------------------- jakamisasetukset

-- Profiilissa, koska kaverit lukevat sitä jo. Asetukset eivät paljasta mitään.
alter table public.profiles
  add column share_workouts boolean not null default true,
  add column share_records boolean not null default true,
  add column share_exercises boolean not null default false;

create function public.set_share_settings(workouts boolean, records boolean, exercises boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set share_workouts = workouts, share_records = records, share_exercises = exercises, updated_at = now()
  where id = (select auth.uid());
$$;

-- ------------------------------------------------------------ apufunktiot

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;

-- Treenikseen kirjattu: salitreeni (lohkoja) tai käsin kirjattu treeni ilman Stravaa.
-- Stravasta tullut treeni ei kelpaa, vaikka sitä olisi muokattu, koska nimi ja laji
-- ovat Stravan dataa. Poikkeus on salitreeni, joka on yhdistetty kellon mittaukseen:
-- sen sisältö ja nimi ovat Treeniksen.
create function public.is_shareable_workout(w public.workouts)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select w.deleted_at is null and (
    exists (select 1 from public.workout_blocks b where b.workout_id = w.id)
    or (w.strava_activity_id is null and (w.started_at is not null or w.duration_sec is not null))
  );
$$;

-- --------------------------------------------------------------- reaktiot

-- Reaktio tallennetaan avaimena, ei emojina: sama emoji voi olla eri tavuina eri laitteilla.
create table public.reactions (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reaction text not null check (reaction in ('party', 'clap', 'heart', 'hundred', 'trophy', 'fire', 'hot')),
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);
alter table public.reactions enable row level security;
-- Ei käytäntöjä: reaktiot luetaan syötteen kautta ja kirjoitetaan react-funktiolla.

-- Yksi reaktio per henkilö per treeni. null poistaa reaktion.
create function public.react(target_workout uuid, new_reaction text)
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
  where w.id = target_workout and p.share_workouts and public.is_shareable_workout(w);
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

-- ------------------------------------------------------------------ syöte

-- Omat ja kaverien treenit annetusta päivästä alkaen. Omat ovat mukana, jotta näet
-- saamasi reaktiot. Reagoijan nimi näytetään vain, jos hän on sinä tai kaverisi.
create function public.friend_feed(since date)
returns table (
  workout_id uuid,
  user_id uuid,
  name text,
  is_me boolean,
  sport text,
  title text,
  date date,
  started_at timestamptz,
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
    select w.*, p.display_name, p.share_records, p.share_exercises, w.user_id = (select id from me) as mine
    from public.workouts w
    join people on people.user_id = w.user_id
    join public.profiles p on p.id = w.user_id
    where w.date >= since
      and (w.user_id = (select id from me) or p.share_workouts)
      and public.is_shareable_workout(w)
  )
  select
    v.id,
    v.user_id,
    v.display_name,
    v.mine,
    v.sport,
    v.title,
    v.date,
    v.started_at,
    case when v.mine or v.share_exercises then coalesce((
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
    case when v.mine or v.share_records then coalesce((
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
  order by v.date desc, coalesce(v.started_at, v.created_at) desc;
$$;

-- ----------------------------------------------------------------- oikeudet

revoke all on table public.reactions from anon;

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_shareable_workout(public.workouts) from public, anon, authenticated;

revoke execute on function public.set_share_settings(boolean, boolean, boolean) from public, anon;
revoke execute on function public.react(uuid, text) from public, anon;
revoke execute on function public.friend_feed(date) from public, anon;
grant execute on function public.set_share_settings(boolean, boolean, boolean) to authenticated;
grant execute on function public.react(uuid, text) to authenticated;
grant execute on function public.friend_feed(date) to authenticated;
