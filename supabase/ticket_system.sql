create extension if not exists pgcrypto;

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists tickets_user_id_idx on public.tickets(user_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_updated_at_idx on public.tickets(updated_at desc);
create index if not exists ticket_messages_ticket_id_idx
  on public.ticket_messages(ticket_id, created_at);

create or replace function public.touch_ticket_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
  set updated_at = now()
  where id = new.ticket_id;

  return new;
end;
$$;

drop trigger if exists touch_ticket_on_message on public.ticket_messages;

create trigger touch_ticket_on_message
after insert on public.ticket_messages
for each row
execute function public.touch_ticket_updated_at();

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists "Members can read their tickets" on public.tickets;
create policy "Members can read their tickets"
on public.tickets
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Members can create their tickets" on public.tickets;
create policy "Members can create their tickets"
on public.tickets
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins can update tickets" on public.tickets;
create policy "Admins can update tickets"
on public.tickets
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Ticket participants can read messages" on public.ticket_messages;
create policy "Ticket participants can read messages"
on public.ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.tickets
    where tickets.id = ticket_messages.ticket_id
      and (tickets.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists "Ticket participants can send messages" on public.ticket_messages;
create policy "Ticket participants can send messages"
on public.ticket_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.tickets
    where tickets.id = ticket_messages.ticket_id
      and tickets.status = 'open'
      and (
        (
          tickets.user_id = auth.uid()
          and ticket_messages.sender_role = 'member'
        )
        or (
          public.is_admin(auth.uid())
          and ticket_messages.sender_role = 'admin'
        )
      )
  )
);

grant select, insert, update on public.tickets to authenticated;
grant select, insert on public.ticket_messages to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

drop policy if exists "Admins can read member profiles" on public.profiles;
create policy "Admins can read member profiles"
on public.profiles
for select
to authenticated
using (public.is_admin(auth.uid()));
