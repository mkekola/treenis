-- Kaverit: nimi, jonka kaverit näkevät, pysyvä kaverikoodi ja kaverisuhteet.
-- Selain lukee tauluja vain RLS:n rajaamana. Kaikki muutokset tehdään
-- funktioilla, jotta säännöt (esim. vain vastaanottaja hyväksyy) ovat yhdessä paikassa.

-- -------------------------------------------------------------------- nimet

-- Tilin nimi on Supabasen kirjautumistiedoissa (user_metadata.name), joita muut
-- eivät saa lukea. Kaverit näkevät sen kopion tästä taulusta.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Kopio pysyy ajan tasalla tilin tiedoista, joten sovelluksen ei tarvitse kirjoittaa sitä.
create function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do update
    set display_name = excluded.display_name, updated_at = now()
    where public.profiles.display_name is distinct from excluded.display_name;
  return new;
end;
$$;

create trigger sync_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_profile();

insert into public.profiles (id, display_name)
select id, coalesce(trim(raw_user_meta_data ->> 'name'), '') from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------------- koodit

-- Kuusi merkkiä ilman sekaantuvia merkkejä (I, O, 0, 1). Näytetään muodossa K7P2-QX.
create table public.friend_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.friend_codes enable row level security;

create policy "Vain oma koodi" on public.friend_codes for select to authenticated
  using (user_id = (select auth.uid()));

-- Satunnaisuus pgcryptosta, ei random()-funktiosta, jottei koodeja voi arvata.
-- 256 on jaollinen 32:lla, joten jokainen merkki on yhtä todennäköinen.
create function public.new_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, 1 + get_byte(bytes, i) % 32, 1);
  end loop;
  return result;
end;
$$;

-- Palauttaa oman koodin ja luo sen ensimmäisellä kerralla. regenerate = true vaihtaa
-- koodin, jolloin vanha lakkaa toimimasta.
create function public.my_friend_code(regenerate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result text;
begin
  if uid is null then
    raise exception 'Ei kirjautunut';
  end if;
  if not regenerate then
    select code into result from public.friend_codes where user_id = uid;
    if result is not null then
      return result;
    end if;
  end if;
  loop
    begin
      result := public.new_friend_code();
      insert into public.friend_codes (user_id, code) values (uid, result)
      on conflict (user_id) do update set code = excluded.code, created_at = now();
      return result;
    exception when unique_violation then
      -- Sama koodi on jo jollakulla toisella. Arvotaan uusi.
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- suhteet

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
alter table public.friendships enable row level security;

-- Yksi suhde paria kohden suunnasta riippumatta.
create unique index friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

create policy "Omat kaverisuhteet" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Nimen näkee itse ja jokainen, jonka kanssa on suhde tai pyyntö kumpaan tahansa suuntaan.
create policy "Oma ja kaverien nimet" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.requester = (select auth.uid()) and f.addressee = profiles.id)
         or (f.addressee = (select auth.uid()) and f.requester = profiles.id)
    )
  );

-- Pyyntö koodilla. Palauttaa tuloksen tekstinä, jotta sovellus voi näyttää oikean viestin.
-- Jos toinen on jo pyytänyt sinua, koodin syöttäminen hyväksyy pyynnön.
create function public.request_friend(friend_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target uuid;
  existing public.friendships;
begin
  if uid is null then
    raise exception 'Ei kirjautunut';
  end if;
  select user_id into target from public.friend_codes where code = upper(friend_code);
  if target is null then
    return 'not_found';
  end if;
  if target = uid then
    return 'self';
  end if;
  select * into existing from public.friendships
  where least(requester, addressee) = least(uid, target)
    and greatest(requester, addressee) = greatest(uid, target);
  if existing.id is null then
    insert into public.friendships (requester, addressee) values (uid, target);
    return 'requested';
  elsif existing.status = 'accepted' then
    return 'already_friends';
  elsif existing.addressee = uid then
    update public.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
    return 'accepted';
  else
    return 'already_requested';
  end if;
end;
$$;

-- Vain pyynnön vastaanottaja voi hyväksyä tai hylätä. Hylätty pyyntö poistetaan.
create function public.respond_friend_request(request_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where id = request_id and addressee = (select auth.uid()) and status = 'pending';
  else
    delete from public.friendships
    where id = request_id and addressee = (select auth.uid()) and status = 'pending';
  end if;
end;
$$;

-- Kaverin poisto tai oman pyynnön peruminen. Kumpi tahansa osapuoli voi purkaa suhteen.
create function public.remove_friend(friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where id = friendship_id and (select auth.uid()) in (requester, addressee);
end;
$$;

-- ----------------------------------------------------------------- oikeudet

revoke all on table public.profiles, public.friend_codes, public.friendships from anon;

revoke execute on function public.sync_profile() from public, anon, authenticated;
revoke execute on function public.new_friend_code() from public, anon, authenticated;

revoke execute on function public.my_friend_code(boolean) from public, anon;
revoke execute on function public.request_friend(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.my_friend_code(boolean) to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
