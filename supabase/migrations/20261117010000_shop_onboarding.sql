begin;

create table if not exists public.quickprint_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.quickprint_platform_admins enable row level security;
revoke all on public.quickprint_platform_admins from anon, authenticated;

-- Bootstrap the platform with the confirmed counter account already assigned by its owner.
do $$
declare
  platform_owner uuid;
begin
  if not exists (select 1 from public.quickprint_platform_admins) then
    select u.id into strict platform_owner
    from public.quickprint_shop_staff s
    join auth.users u on u.id = s.user_id
    where s.shop_id = 'campus-prints' and u.is_anonymous is false and u.email_confirmed_at is not null;
    insert into public.quickprint_platform_admins (user_id) values (platform_owner);
  end if;
end;
$$;

create table if not exists public.quickprint_shops (
  shop_id text primary key check (shop_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  profile jsonb not null default '{}',
  management jsonb not null default '{}',
  counter_email text,
  active boolean not null default true
);
alter table public.quickprint_shops enable row level security;
revoke all on public.quickprint_shops from anon, authenticated;
grant select (shop_id, profile) on public.quickprint_shops to anon, authenticated;
drop policy if exists "Read active shop profiles" on public.quickprint_shops;
create policy "Read active shop profiles" on public.quickprint_shops
  for select to anon, authenticated using (active);

create table if not exists public.quickprint_counter_devices (
  shop_id text primary key references public.quickprint_shops(shop_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade
);
create table if not exists public.quickprint_counter_setup_links (
  shop_id text primary key references public.quickprint_shops(shop_id) on delete cascade,
  code uuid not null unique,
  expires_at timestamptz not null
);
alter table public.quickprint_counter_devices enable row level security;
alter table public.quickprint_counter_setup_links enable row level security;
revoke all on public.quickprint_counter_devices, public.quickprint_counter_setup_links from anon, authenticated;

insert into public.quickprint_shops (shop_id)
values ('campus-prints'), ('sri-krishna-xerox'), ('balaji-xerox'), ('vidyarthi-books')
on conflict do nothing;
insert into public.quickprint_shops (shop_id, profile)
values ('abhinav', '{
  "id":"abhinav","slug":"abhinav","name":"abhinav book","location":"dfkf","phone":"7989869191",
  "tagline":"High-speed document printing, xerox & binding","openingHours":"Mon - Sat: 8:30 AM – 9:00 PM",
  "isOpen":true,"retentionMinutes":10,"acceptedPaymentModes":["counter","online"],
  "pricing":{"bwPerPage":2,"colorPerPage":10,"duplexRateRatio":0.9,"paperSizes":[
    {"id":"A4","name":"A4 (Standard 75 GSM)","multiplier":1},
    {"id":"Legal","name":"Legal (Long)","multiplier":1.25},
    {"id":"A3","name":"A3 (Large Ledger)","multiplier":2}
  ]}
}')
on conflict do nothing;

insert into public.quickprint_shops (shop_id, profile)
values ('c', '{
  "id":"c","slug":"c","name":"chinna A TO Z collection","location":"Central City Bookstore","phone":"7989859191",
  "tagline":"High-speed document printing, xerox & binding","openingHours":"Mon - Sat: 8:30 AM – 9:00 PM",
  "isOpen":true,"retentionMinutes":10,"acceptedPaymentModes":["counter","online"],
  "pricing":{"bwPerPage":2,"colorPerPage":10,"duplexRateRatio":0.9,"paperSizes":[
    {"id":"A4","name":"A4 (Standard 75 GSM)","multiplier":1},
    {"id":"Legal","name":"Legal (Long)","multiplier":1.25},
    {"id":"A3","name":"A3 (Large Ledger)","multiplier":2}
  ]}
}')
on conflict do nothing;

create or replace function public.quickprint_is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.quickprint_platform_admins where user_id = auth.uid());
$$;

create or replace function public.quickprint_shop_accepts_uploads(target_shop text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select active from public.quickprint_shops where shop_id = target_shop),
    exists (select 1 from public.quickprint_shop_staff where shop_id = target_shop)
  );
$$;

create or replace function public.quickprint_can_manage_shop(target_shop text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.quickprint_shop_accepts_uploads(target_shop) and (
    public.quickprint_is_platform_admin()
    or exists (select 1 from public.quickprint_shop_staff where shop_id = target_shop and user_id = auth.uid())
    or exists (select 1 from public.quickprint_counter_devices where shop_id = target_shop and user_id = auth.uid())
    or exists (
      select 1 from public.quickprint_shops s
      join auth.users u on lower(u.email) = s.counter_email
      where s.shop_id = target_shop and u.id = auth.uid()
        and u.email_confirmed_at is not null and u.is_anonymous is false
    )
  );
$$;

create or replace function public.quickprint_create_shop(target_shop text, public_profile jsonb, shop_management jsonb, owner_email text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.quickprint_is_platform_admin() then
    raise exception 'Platform owner access required' using errcode = '42501';
  end if;
  if public_profile->>'name' is null or btrim(public_profile->>'name') = ''
     or public_profile->>'id' is distinct from target_shop
     or public_profile->>'slug' is distinct from target_shop then
    raise exception 'A shop name and valid URL are required' using errcode = '22023';
  end if;
  insert into public.quickprint_shops (shop_id, profile, management, counter_email)
  values (target_shop, public_profile, shop_management, nullif(lower(btrim(owner_email)), ''));
end;
$$;

create or replace function public.quickprint_update_shop(target_shop text, public_profile jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.quickprint_can_manage_shop(target_shop) then
    raise exception 'Counter access required' using errcode = '42501';
  end if;
  if public_profile->>'id' is distinct from target_shop
     or public_profile->>'slug' is distinct from target_shop then
    raise exception 'The shop URL cannot be changed here' using errcode = '22023';
  end if;
  update public.quickprint_shops set profile = public_profile where shop_id = target_shop and active;
  if not found then raise exception 'Shop not found'; end if;
end;
$$;

create or replace function public.quickprint_list_managed_shops()
returns table (shop_id text, profile jsonb, management jsonb, counter_email text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.quickprint_is_platform_admin() then
    raise exception 'Platform owner access required' using errcode = '42501';
  end if;
  return query select s.shop_id, s.profile, s.management, s.counter_email
    from public.quickprint_shops s where s.active order by s.shop_id;
end;
$$;

create or replace function public.quickprint_set_counter_email(target_shop text, owner_email text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.quickprint_is_platform_admin() then
    raise exception 'Platform owner access required' using errcode = '42501';
  end if;
  update public.quickprint_shops set counter_email = nullif(lower(btrim(owner_email)), '')
  where shop_id = target_shop and active;
  if not found then raise exception 'Shop not found'; end if;
end;
$$;

create or replace function public.quickprint_archive_shop(target_shop text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.quickprint_is_platform_admin() then
    raise exception 'Platform owner access required' using errcode = '42501';
  end if;
  update public.quickprint_shops set active = false where shop_id = target_shop and active;
end;
$$;

create or replace function public.quickprint_create_counter_link(target_shop text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  new_code uuid := gen_random_uuid();
begin
  if not public.quickprint_is_platform_admin() then
    raise exception 'Platform owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quickprint_shops where shop_id = target_shop and active) then
    raise exception 'Shop not found';
  end if;
  insert into public.quickprint_counter_setup_links (shop_id, code, expires_at)
  values (target_shop, new_code, now() + interval '24 hours')
  on conflict (shop_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return new_code;
end;
$$;

create or replace function public.quickprint_activate_counter(target_shop text, setup_code uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  counter_user uuid := auth.uid();
begin
  if counter_user is null then
    raise exception 'Counter session required' using errcode = '42501';
  end if;
  delete from public.quickprint_counter_setup_links
  where shop_id = target_shop and code = setup_code and expires_at > now()
    and public.quickprint_shop_accepts_uploads(target_shop);
  if not found then raise exception 'This counter setup link is invalid or expired'; end if;
  insert into public.quickprint_counter_devices (shop_id, user_id)
  values (target_shop, counter_user)
  on conflict (shop_id) do update set user_id = excluded.user_id;
end;
$$;

revoke all on function public.quickprint_is_platform_admin(), public.quickprint_can_manage_shop(text),
  public.quickprint_create_shop(text, jsonb, jsonb, text), public.quickprint_update_shop(text, jsonb),
  public.quickprint_list_managed_shops(), public.quickprint_set_counter_email(text, text),
  public.quickprint_archive_shop(text), public.quickprint_create_counter_link(text),
  public.quickprint_activate_counter(text, uuid) from public;
grant execute on function public.quickprint_is_platform_admin(), public.quickprint_can_manage_shop(text),
  public.quickprint_create_shop(text, jsonb, jsonb, text), public.quickprint_update_shop(text, jsonb),
  public.quickprint_list_managed_shops(), public.quickprint_set_counter_email(text, text),
  public.quickprint_archive_shop(text), public.quickprint_create_counter_link(text),
  public.quickprint_activate_counter(text, uuid) to authenticated;

drop policy if exists "Read QuickPrint files for customer or shop" on storage.objects;
create policy "Read QuickPrint files for customer or shop" on storage.objects
  for select to authenticated using (
    bucket_id = 'print-files' and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or public.quickprint_can_manage_shop((storage.foldername(name))[1])
    )
  );

drop policy if exists "Delete QuickPrint files for customer or shop" on storage.objects;
create policy "Delete QuickPrint files for customer or shop" on storage.objects
  for delete to authenticated using (
    bucket_id = 'print-files' and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or public.quickprint_can_manage_shop((storage.foldername(name))[1])
    )
  );

commit;
