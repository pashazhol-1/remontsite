-- ОтчетСтроителя: таблицы, связи, роли и хранилище.
-- Скопируйте этот файл в SQL Editor проекта Supabase и нажмите Run.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null check (role in ('admin', 'builder')),
  created_at timestamptz not null default now()
);

create table if not exists public.work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.work_categories(id) on delete restrict,
  store_name text,
  receipt_date date,
  receipt_number text,
  total_amount numeric(12,2),
  currency text not null default 'BYN',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'unpaid', 'paid')),
  comment_text text,
  audio_url text,
  audio_transcription text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_images (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  previous_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_processing (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  provider text,
  model text,
  processing_status text not null default 'pending',
  confidence numeric(5,2),
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  display_name text;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    assigned_role := 'builder';
  else
    assigned_role := 'admin';
  end if;

  display_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, name, email, role)
  values (new.id, display_name, new.email, assigned_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.work_categories enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_images enable row level security;
alter table public.receipt_items enable row level security;
alter table public.messages enable row level security;
alter table public.payment_history enable row level security;
alter table public.ai_processing enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "categories_select" on public.work_categories;
create policy "categories_select" on public.work_categories
  for select using (auth.role() = 'authenticated');

drop policy if exists "categories_admin_write" on public.work_categories;
create policy "categories_admin_write" on public.work_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "receipts_select" on public.receipts;
create policy "receipts_select" on public.receipts
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "receipts_insert_builder" on public.receipts;
create policy "receipts_insert_builder" on public.receipts
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'builder'
    )
  );

drop policy if exists "receipts_update_admin" on public.receipts;
create policy "receipts_update_admin" on public.receipts
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "receipts_update_builder_audio" on public.receipts;
create policy "receipts_update_builder_audio" on public.receipts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "receipts_delete_admin" on public.receipts;
create policy "receipts_delete_admin" on public.receipts
  for delete using (public.is_admin());

create or replace function public.protect_receipt_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.category_id is distinct from old.category_id
    or new.store_name is distinct from old.store_name
    or new.receipt_date is distinct from old.receipt_date
    or new.receipt_number is distinct from old.receipt_number
    or new.total_amount is distinct from old.total_amount
    or new.currency is distinct from old.currency
    or new.status is distinct from old.status
    or new.comment_text is distinct from old.comment_text
    or new.audio_transcription is distinct from old.audio_transcription
  then
    raise exception 'Строитель не может менять чек после отправки';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_receipt_update on public.receipts;
create trigger protect_receipt_update
  before update on public.receipts
  for each row execute function public.protect_receipt_update();

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Роль пользователя менять нельзя';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_change on public.profiles;
create trigger prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

drop policy if exists "receipt_images_select" on public.receipt_images;
create policy "receipt_images_select" on public.receipt_images
  for select using (
    public.is_admin() or exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "receipt_images_insert" on public.receipt_images;
create policy "receipt_images_insert" on public.receipt_images
  for insert with check (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "receipt_items_select" on public.receipt_items;
create policy "receipt_items_select" on public.receipt_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "receipt_items_admin_write" on public.receipt_items;
create policy "receipt_items_admin_write" on public.receipt_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "receipt_items_owner_insert" on public.receipt_items;
create policy "receipt_items_owner_insert" on public.receipt_items
  for insert with check (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid() and (
      public.is_admin() or exists (
        select 1 from public.receipts r
        where r.id = receipt_id and r.user_id = auth.uid()
      )
    )
  );

drop policy if exists "payment_history_admin" on public.payment_history;
create policy "payment_history_admin" on public.payment_history
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai_processing_admin" on public.ai_processing;
create policy "ai_processing_admin" on public.ai_processing
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai_processing_select_owner" on public.ai_processing;
create policy "ai_processing_select_owner" on public.ai_processing
  for select using (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "ai_processing_insert_owner" on public.ai_processing;
create policy "ai_processing_insert_owner" on public.ai_processing
  for insert with check (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('receipt-photos', 'receipt-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('receipt-audio', 'receipt-audio', false)
on conflict (id) do nothing;

drop policy if exists "photos_read" on storage.objects;
create policy "photos_read" on storage.objects
  for select using (
    bucket_id in ('receipt-photos', 'receipt-audio')
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "photos_insert" on storage.objects;
create policy "photos_insert" on storage.objects
  for insert with check (
    bucket_id in ('receipt-photos', 'receipt-audio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "photos_delete_admin" on storage.objects;
create policy "photos_delete_admin" on storage.objects
  for delete using (
    bucket_id in ('receipt-photos', 'receipt-audio')
    and public.is_admin()
  );

insert into public.work_categories (name, description)
select * from (values
  ('Штукатурка стен', 'Черновая и чистовая штукатурка'),
  ('Шпаклёвка', ''),
  ('Электрика', ''),
  ('Сантехника', ''),
  ('Стяжка пола', ''),
  ('Плиточные работы', ''),
  ('Монтаж потолков', ''),
  ('Отделка ванной', ''),
  ('Отделка кухни', ''),
  ('Отделка коридора', ''),
  ('Прочее', '')
) as seed(name, description)
where not exists (select 1 from public.work_categories);
