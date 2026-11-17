begin;

create table if not exists public.quickprint_shop_staff (
  shop_id text not null check (shop_id ~ '^[a-zA-Z0-9_-]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (shop_id, user_id)
);

alter table public.quickprint_shop_staff enable row level security;
revoke all on public.quickprint_shop_staff from anon, authenticated;
grant select on public.quickprint_shop_staff to authenticated;

drop policy if exists "Read own QuickPrint shops" on public.quickprint_shop_staff;
create policy "Read own QuickPrint shops" on public.quickprint_shop_staff
  for select to authenticated using (
    user_id = (select auth.uid())
    and not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  );

create or replace function public.quickprint_shop_accepts_uploads(target_shop text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.quickprint_shop_staff where shop_id = target_shop
  );
$$;

revoke all on function public.quickprint_shop_accepts_uploads(text) from public;
grant execute on function public.quickprint_shop_accepts_uploads(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('print-files', 'print-files', false, 50000000)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "QuickPrint uploads to own folder" on storage.objects;
create policy "QuickPrint uploads to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'print-files'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.quickprint_shop_accepts_uploads((storage.foldername(name))[1])
  );

drop policy if exists "Read QuickPrint files for customer or shop" on storage.objects;
create policy "Read QuickPrint files for customer or shop" on storage.objects
  for select to authenticated using (
    bucket_id = 'print-files' and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (select 1 from public.quickprint_shop_staff
                 where shop_id = (storage.foldername(name))[1] and user_id = (select auth.uid()))
    )
  );

drop policy if exists "Delete QuickPrint files for customer or shop" on storage.objects;
create policy "Delete QuickPrint files for customer or shop" on storage.objects
  for delete to authenticated using (
    bucket_id = 'print-files' and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (select 1 from public.quickprint_shop_staff
                 where shop_id = (storage.foldername(name))[1] and user_id = (select auth.uid()))
    )
  );

commit;
