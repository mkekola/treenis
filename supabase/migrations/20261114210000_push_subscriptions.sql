-- Push-ilmoitukset: laitteiden ilmoitusosoitteet ja käyttäjän ilmoitusasetukset.
-- Käyttäjä hallitsee vain omia rivejään. Lähetys tehdään Edge Functionissa palveluavaimella.

-- Yksi rivi per laite. endpoint on ilmoituspalvelun (Apple, Google) antama osoite.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create policy "Vain omat laitteet" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Mitä ilmoituksia käyttäjä haluaa. Kaikki päällä oletuksena (Marian päätös).
create table public.notification_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  friend_requests boolean not null default true,
  reactions boolean not null default true,
  challenges boolean not null default true,
  streak boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;

create policy "Vain omat asetukset" on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.push_subscriptions, public.notification_settings from anon;
