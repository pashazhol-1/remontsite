-- Работы мастеров и назначение видов работ.
-- Выполните этот файл в SQL Editor, если база уже создана.

alter table public.work_categories
  add column if not exists assignee_ids uuid[] not null default '{}';

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.work_categories(id) on delete restrict,
  title text not null,
  start_date date,
  end_date date,
  total_amount numeric(12,2),
  currency text not null default 'BYN',
  progress text not null default 'planned' check (progress in ('planned', 'done')),
  status text not null default 'unpaid' check (status in ('unpaid', 'awaiting_confirmation', 'paid')),
  comment_text text,
  audio_url text,
  audio_transcription text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_images (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists work_id uuid references public.works(id) on delete cascade;

alter table public.works enable row level security;
alter table public.work_images enable row level security;

drop policy if exists "works_select" on public.works;
create policy "works_select" on public.works
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "works_insert" on public.works;
create policy "works_insert" on public.works
  for insert with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and created_by = auth.uid()
      and exists (
        select 1 from public.work_categories category
        where category.id = category_id
          and (
            cardinality(category.assignee_ids) = 0
            or auth.uid() = any(category.assignee_ids)
          )
      )
    )
  );

drop policy if exists "works_update" on public.works;
create policy "works_update" on public.works
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "works_delete" on public.works;
create policy "works_delete" on public.works
  for delete using (
    public.is_admin()
    or (user_id = auth.uid() and progress = 'planned' and status = 'unpaid')
  );

create or replace function public.protect_work_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    if new.status = 'paid' and old.status is distinct from 'paid' then
      raise exception 'Оплата становится окончательной только после подтверждения строителя';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.created_by is distinct from old.created_by then
    raise exception 'Нельзя менять мастера у работы';
  end if;

  if old.progress = 'planned' and old.status = 'unpaid' then
    if new.status is distinct from old.status and new.status <> 'unpaid' then
      raise exception 'Строитель не отмечает оплату сам';
    end if;
    return new;
  end if;

  if new.title is distinct from old.title
    or new.category_id is distinct from old.category_id
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.total_amount is distinct from old.total_amount
    or new.currency is distinct from old.currency
    or new.comment_text is distinct from old.comment_text
    or new.audio_transcription is distinct from old.audio_transcription
  then
    raise exception 'Эту работу уже нельзя менять';
  end if;

  if new.progress is distinct from old.progress and not (old.progress = 'planned' and new.progress = 'done') then
    raise exception 'Можно только отметить работу выполненной';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'awaiting_confirmation' and new.status in ('paid', 'unpaid') then
      return new;
    end if;
    raise exception 'Строитель может только подтвердить или отклонить оплату';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_work_update on public.works;
create trigger protect_work_update
  before update on public.works
  for each row execute function public.protect_work_update();

drop policy if exists "work_images_select" on public.work_images;
create policy "work_images_select" on public.work_images
  for select using (
    exists (
      select 1 from public.works work
      where work.id = work_id and (work.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "work_images_insert" on public.work_images;
create policy "work_images_insert" on public.work_images
  for insert with check (
    exists (
      select 1 from public.works work
      where work.id = work_id and (work.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "work_images_delete" on public.work_images;
create policy "work_images_delete" on public.work_images
  for delete using (
    exists (
      select 1 from public.works work
      where work.id = work_id and (work.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "photos_insert_admin" on storage.objects;
create policy "photos_insert_admin" on storage.objects
  for insert with check (
    bucket_id in ('receipt-photos', 'receipt-audio')
    and public.is_admin()
  );

create or replace function public.notify_work_event(target_work uuid, event_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  work public.works%rowtype;
  summary text;
begin
  select * into work from public.works where id = target_work;
  if work.id is null then
    return;
  end if;

  summary := work.title || ', ' || coalesce(work.total_amount::text, '—') || ' ' || work.currency;

  if event_kind in ('payment_confirmed', 'payment_rejected', 'payment_cancelled') then
    update public.notifications
    set read_at = now()
    where work_id = work.id and kind = 'payment_requested' and read_at is null;
  end if;

  if event_kind = 'work_created' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    select id, work.id, event_kind, 'Новая работа', summary
    from public.profiles where role = 'admin';
  elsif event_kind = 'work_assigned' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    values (work.user_id, work.id, event_kind, 'Вам назначили работу', summary);
  elsif event_kind = 'work_completed' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    select id, work.id, event_kind, 'Работа выполнена', summary
    from public.profiles where role = 'admin';
  elsif event_kind = 'payment_requested' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    values (work.user_id, work.id, event_kind, 'Подтвердите оплату', 'Вы получили деньги за работу ' || summary || '?');
  elsif event_kind = 'payment_rejected' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    select id, work.id, event_kind, 'Строитель не подтвердил оплату', summary
    from public.profiles where role = 'admin';
  elsif event_kind = 'payment_cancelled' then
    insert into public.notifications (user_id, work_id, kind, title, body)
    values (work.user_id, work.id, event_kind, 'Заказчик отменил отметку об оплате', summary);
  end if;
end;
$$;

drop policy if exists "receipts_insert_builder" on public.receipts;
drop policy if exists "receipts_insert_own" on public.receipts;
create policy "receipts_insert_own" on public.receipts
  for insert with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

revoke all on function public.notify_work_event(uuid, text) from public;
grant execute on function public.notify_work_event(uuid, text) to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.works to authenticated;
grant select, insert, delete on public.work_images to authenticated;

-- Роль при регистрации берётся из выбранного входа: заказчик или строитель.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  display_name text;
  requested text;
begin
  requested := new.raw_user_meta_data->>'role';
  if requested in ('admin', 'builder') then
    assigned_role := requested;
  elsif exists (select 1 from public.profiles where role = 'admin') then
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
