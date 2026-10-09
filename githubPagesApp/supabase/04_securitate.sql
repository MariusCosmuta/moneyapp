-- MoneyApp: acces doar pentru membri (Row Level Security).
-- După rulare, adaugă emailurile în SQL Editor (NU în repository):
--   insert into public.membri (email) values ('tu@exemplu.ro'), ('ea@exemplu.ro');

create table public.membri (
  email text primary key check (email = lower(email))
);
alter table public.membri enable row level security; -- fără politici: invizibil din API

create function public.este_membru() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membri m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.este_membru() from public, anon;
grant execute on function public.este_membru() to authenticated;

-- Anonimii nu au acces la nimic.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

alter table public.categorii          enable row level security;
alter table public.ani                enable row level security;
alter table public.categorii_inactive enable row level security;
alter table public.imprumuturi        enable row level security;
alter table public.tranzactii         enable row level security;
alter table public.audit_log          enable row level security;

-- categorii, ani, categorii_inactive: citire / scriere / ștergere pentru membri
create policy membri_select on public.categorii for select to authenticated using (public.este_membru());
create policy membri_insert on public.categorii for insert to authenticated with check (public.este_membru());
create policy membri_update on public.categorii for update to authenticated using (public.este_membru()) with check (public.este_membru());
create policy membri_delete on public.categorii for delete to authenticated using (public.este_membru());

create policy membri_select on public.ani for select to authenticated using (public.este_membru());
create policy membri_insert on public.ani for insert to authenticated with check (public.este_membru());
create policy membri_delete on public.ani for delete to authenticated using (public.este_membru());

create policy membri_select on public.categorii_inactive for select to authenticated using (public.este_membru());
create policy membri_insert on public.categorii_inactive for insert to authenticated with check (public.este_membru());
create policy membri_delete on public.categorii_inactive for delete to authenticated using (public.este_membru());

-- imprumuturi, tranzactii: fără DELETE (ștergere = deleted_at, reversibilă)
create policy membri_select on public.imprumuturi for select to authenticated using (public.este_membru());
create policy membri_insert on public.imprumuturi for insert to authenticated with check (public.este_membru());
create policy membri_update on public.imprumuturi for update to authenticated using (public.este_membru()) with check (public.este_membru());

create policy membri_select on public.tranzactii for select to authenticated using (public.este_membru());
create policy membri_insert on public.tranzactii for insert to authenticated with check (public.este_membru());
create policy membri_update on public.tranzactii for update to authenticated using (public.este_membru()) with check (public.este_membru());

-- audit_log: doar citire (scrierea o face trigger-ul tg_audit)
create policy membri_select on public.audit_log for select to authenticated using (public.este_membru());
