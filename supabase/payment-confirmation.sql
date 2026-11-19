-- Подтверждение оплаты и уведомления.
-- В Supabase: SQL Editor → New query → вставьте этот файл → Run.
-- Повторный запуск безопасен.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'receipts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.receipts drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.receipts
  add constraint receipts_status_check
  check (status in ('pending_review', 'unpaid', 'awaiting_confirmation', 'paid'));

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
    or new.comment_text is distinct from old.comment_text
    or new.audio_transcription is distinct from old.audio_transcription
  then
    raise exception 'Строитель не может менять чек после отправки';
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

drop policy if exists "payment_history_owner_insert" on public.payment_history;
create policy "payment_history_owner_insert" on public.payment_history
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_receipt_event(target_receipt uuid, event_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.receipts;
  actor uuid := auth.uid();
  summary text;
begin
  if actor is null then
    raise exception 'Нужно войти';
  end if;

  select * into rec from public.receipts where id = target_receipt;
  if rec.id is null then
    raise exception 'Чек не найден';
  end if;

  summary := coalesce(rec.store_name, 'Чек без магазина') || ', ' || coalesce(rec.total_amount::text, '—') || ' ' || rec.currency;

  if event_kind in ('payment_confirmed', 'payment_rejected', 'payment_cancelled') then
    update public.notifications
    set read_at = now()
    where receipt_id = rec.id
      and kind = 'payment_requested'
      and read_at is null;
  end if;

  if event_kind = 'receipt_created' then
    if rec.user_id <> actor then
      raise exception 'Нельзя';
    end if;
    insert into public.notifications (user_id, receipt_id, kind, title, body)
    select p.id, rec.id, event_kind,
      case when rec.status = 'pending_review' then 'Чек на проверке' else 'Новый чек' end,
      summary
    from public.profiles p
    where p.role = 'admin';
  elsif event_kind = 'payment_requested' then
    if not public.is_admin() or rec.status <> 'awaiting_confirmation' then
      raise exception 'Нельзя';
    end if;
    insert into public.notifications (user_id, receipt_id, kind, title, body)
    values (rec.user_id, rec.id, event_kind, 'Подтвердите оплату', 'Вы получили деньги по чеку ' || summary || '?');
  elsif event_kind = 'payment_confirmed' then
    if actor <> rec.user_id or rec.status <> 'paid' then
      raise exception 'Нельзя';
    end if;
    insert into public.notifications (user_id, receipt_id, kind, title, body)
    select p.id, rec.id, event_kind, 'Оплата подтверждена', summary
    from public.profiles p
    where p.role = 'admin';
  elsif event_kind = 'payment_rejected' then
    if actor <> rec.user_id or rec.status <> 'unpaid' then
      raise exception 'Нельзя';
    end if;
    insert into public.notifications (user_id, receipt_id, kind, title, body)
    select p.id, rec.id, event_kind, 'Строитель не подтвердил оплату', summary
    from public.profiles p
    where p.role = 'admin';
  elsif event_kind = 'payment_cancelled' then
    if not public.is_admin() or rec.status <> 'unpaid' then
      raise exception 'Нельзя';
    end if;
    insert into public.notifications (user_id, receipt_id, kind, title, body)
    values (rec.user_id, rec.id, event_kind, 'Заказчик отменил отметку об оплате', summary);
  else
    raise exception 'Неизвестное событие';
  end if;
end;
$$;

revoke all on function public.notify_receipt_event(uuid, text) from public;
grant execute on function public.notify_receipt_event(uuid, text) to authenticated;

drop policy if exists "receipts_delete_builder" on public.receipts;
create policy "receipts_delete_builder" on public.receipts
  for delete using (
    user_id = auth.uid()
    and status in ('pending_review', 'unpaid')
  );

drop policy if exists "photos_delete_owner" on storage.objects;
create policy "photos_delete_owner" on storage.objects
  for delete using (
    bucket_id in ('receipt-photos', 'receipt-audio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
