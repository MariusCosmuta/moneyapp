-- MoneyApp: reguli (trigger-e) și calcule (view-uri).
-- Echivalentul lui recalcImprumut_ / recalcIntrare_ / ajusteaza_ din googleSheetApp.

-- Rambursare: categoria = „În" a împrumutului; total rambursat <= suma împrumutului.
create function public.tg_tranzactii_rambursare() returns trigger
language plpgsql set search_path = '' as $$
declare
  imp public.imprumuturi%rowtype;
  rambursat numeric;
begin
  if new.tip <> 'rambursare' or new.deleted_at is not null then
    return new;
  end if;

  select * into imp from public.imprumuturi where id = new.imprumut_id for update;
  if not found or imp.deleted_at is not null then
    raise exception 'Împrumutul nu există.';
  end if;

  new.categorie_id := imp.in_id;

  select coalesce(sum(t.suma), 0) into rambursat
  from public.tranzactii t
  where t.imprumut_id = new.imprumut_id
    and t.tip = 'rambursare'
    and t.deleted_at is null
    and t.id is distinct from new.id;

  if imp.rambursat_legacy + rambursat + new.suma > imp.suma then
    raise exception 'Rambursare > sold. Rămâne % lei.', imp.suma - imp.rambursat_legacy - rambursat;
  end if;
  return new;
end $$;

create trigger tranzactii_rambursare
  before insert or update on public.tranzactii
  for each row execute function public.tg_tranzactii_rambursare();

-- Împrumut: nu poate scădea sub ce s-a rambursat; nu se șterge dacă are rambursări active.
create function public.tg_imprumuturi_validare() returns trigger
language plpgsql set search_path = '' as $$
declare
  rambursat numeric;
begin
  select coalesce(sum(t.suma), 0) into rambursat
  from public.tranzactii t
  where t.imprumut_id = new.id and t.tip = 'rambursare' and t.deleted_at is null;

  if new.deleted_at is not null and old.deleted_at is null and rambursat > 0 then
    raise exception 'Împrumutul are rambursări. Șterge întâi rambursările.';
  end if;
  if new.rambursat_legacy + rambursat > new.suma then
    raise exception 'Suma împrumutului e mai mică decât totalul rambursat (% lei).', new.rambursat_legacy + rambursat;
  end if;
  return new;
end $$;

create trigger imprumuturi_validare
  before update on public.imprumuturi
  for each row execute function public.tg_imprumuturi_validare();

-- Dacă se schimbă „În", rambursările se mută pe noua categorie.
create function public.tg_imprumuturi_in_schimbat() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.tranzactii set categorie_id = new.in_id
  where imprumut_id = new.id and categorie_id <> new.in_id;
  return null;
end $$;

create trigger imprumuturi_in_schimbat
  after update of in_id on public.imprumuturi
  for each row when (old.in_id is distinct from new.in_id)
  execute function public.tg_imprumuturi_in_schimbat();

-- Împrumuturi active cu rambursat / sold / status.
create view public.v_imprumuturi with (security_invoker = true) as
select
  i.id, i.data, i.din_id, d.nume as din, i.in_id, n.nume as in_,
  i.suma, i.nota, i.rambursat_legacy,
  i.rambursat_legacy + coalesce(r.total, 0)          as rambursat,
  i.suma - i.rambursat_legacy - coalesce(r.total, 0) as sold,
  case
    when i.suma - i.rambursat_legacy - coalesce(r.total, 0) <= 0 then 'Rambursat'
    when i.rambursat_legacy + coalesce(r.total, 0) > 0 then 'Parțial'
    else 'Deschis'
  end as status,
  i.created_by, i.created_at
from public.imprumuturi i
join public.categorii d on d.id = i.din_id
join public.categorii n on n.id = i.in_id
left join lateral (
  select sum(t.suma) as total
  from public.tranzactii t
  where t.imprumut_id = i.id and t.tip = 'rambursare' and t.deleted_at is null
) r on true
where i.deleted_at is null;

-- O celulă din „Buget <an>": rândul lunii (valoare) și rândul „Datorii".
--  * valoare: intrări + rambursări (luna rambursării) + sold inițial + rambursat_legacy (luna împrumutului, pe „În")
--  * datorii: -sold pe „Din", în luna împrumutului
create view public.v_buget_celule with (security_invoker = true) as
with miscari as (
  select extract(year from t.data)::int as an, extract(month from t.data)::int as luna,
         t.categorie_id, t.suma as valoare, 0::numeric as datorii
  from public.tranzactii t
  where t.deleted_at is null
  union all
  select extract(year from i.data)::int, extract(month from i.data)::int,
         i.in_id, i.rambursat_legacy, 0
  from public.imprumuturi i
  where i.deleted_at is null and i.rambursat_legacy <> 0
  union all
  select extract(year from v.data)::int, extract(month from v.data)::int,
         v.din_id, 0, -v.sold
  from public.v_imprumuturi v
  where v.sold <> 0
)
select an, luna, categorie_id, sum(valoare) as valoare, sum(datorii) as datorii
from miscari
group by an, luna, categorie_id;

-- Coloana „Total" din Sheet, pe lună.
create view public.v_buget_luna with (security_invoker = true) as
select an, luna, sum(valoare) as total_luna, sum(datorii) as total_datorii
from public.v_buget_celule
group by an, luna;
