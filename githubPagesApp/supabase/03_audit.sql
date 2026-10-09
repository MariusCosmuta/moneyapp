-- MoneyApp: jurnal de audit (cine, când, ce valoare veche / nouă).

create table public.audit_log (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  actiune    text not null,
  vechi      jsonb,
  nou        jsonb,
  user_id    uuid default auth.uid(),
  user_email text default (auth.jwt() ->> 'email'),
  la         timestamptz not null default now()
);

create index audit_log_la_idx on public.audit_log (la desc);

-- security definer: scrie în audit_log chiar dacă utilizatorul nu are drept de insert acolo
create function public.tg_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (tabela, actiune, vechi, nou)
  values (
    tg_table_name,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit after insert or update or delete on public.categorii
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.ani
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.categorii_inactive
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.imprumuturi
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.tranzactii
  for each row execute function public.tg_audit();
