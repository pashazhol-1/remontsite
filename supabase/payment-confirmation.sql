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
  if current_setting('app.recognition_update', true) = 'on' then
    if new.user_id is distinct from old.user_id
      or new.category_id is distinct from old.category_id
      or new.comment_text is distinct from old.comment_text
      or new.audio_url is distinct from old.audio_url
      or new.audio_transcription is distinct from old.audio_transcription
    then
      raise exception 'Распознавание не может менять эти поля';
    end if;
    return new;
  end if;

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
      'Новый чек',
      case
        when rec.store_name is null then 'Фото ещё читается. Магазин и сумма появятся сами.'
        else summary
      end
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

create or replace function public.apply_receipt_recognition(target_receipt uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.receipts;
  actor uuid := auth.uid();
  next_status text;
  item jsonb;
  receipt_day date;
begin
  if actor is null then
    raise exception 'Нужно войти';
  end if;

  select * into rec from public.receipts where id = target_receipt;
  if rec.id is null then
    raise exception 'Чек не найден';
  end if;
  if rec.user_id <> actor and not public.is_admin() then
    raise exception 'Нельзя';
  end if;
  if exists (select 1 from public.ai_processing where receipt_id = rec.id) then
    return;
  end if;

  next_status := rec.status;
  if rec.status = 'pending_review' and coalesce((payload->>'needsReview')::boolean, true) = false then
    next_status := 'unpaid';
  end if;

  begin
    receipt_day := nullif(payload->>'receiptDate', '')::date;
  exception
    when others then
      receipt_day := null;
  end;

  perform set_config('app.recognition_update', 'on', true);

  update public.receipts
  set
    store_name = nullif(payload->>'storeName', ''),
    receipt_date = receipt_day,
    receipt_number = nullif(payload->>'receiptNumber', ''),
    total_amount = nullif(payload->>'totalAmount', '')::numeric,
    currency = coalesce(nullif(payload->>'currency', ''), currency),
    status = next_status,
    updated_at = now()
  where id = rec.id;

  for item in select value from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    insert into public.receipt_items (receipt_id, name, quantity, unit_price, total_price)
    values (
      rec.id,
      coalesce(nullif(item->>'name', ''), 'Без названия'),
      coalesce((item->>'quantity')::numeric, 1),
      coalesce((item->>'unitPrice')::numeric, 0),
      coalesce((item->>'totalPrice')::numeric, 0)
    );
  end loop;

  insert into public.ai_processing (receipt_id, provider, model, processing_status, confidence, error_message)
  values (
    rec.id,
    nullif(payload->>'provider', ''),
    nullif(payload->>'model', ''),
    case when coalesce((payload->>'needsReview')::boolean, true) then 'needs_review' else 'ok' end,
    nullif(payload->>'confidence', '')::numeric,
    nullif(payload->>'reviewReason', '')
  );
end;
$$;

revoke all on function public.apply_receipt_recognition(uuid, jsonb) from public;
grant execute on function public.apply_receipt_recognition(uuid, jsonb) to authenticated;
