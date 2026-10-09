-- MoneyApp: tabele de bază. Rulează în Supabase → SQL Editor, în ordinea 01 → 04.

create table public.categorii (
  id         bigint generated always as identity primary key,
  nume       text not null unique check (length(trim(nume)) > 0),
  owner      text not null default 'Marius' check (owner in ('Marius', 'Isabela')),
  tinta      numeric(12,2) not null default 0,
  notite     text not null default '',
  ordine     int not null default 0,
  created_at timestamptz not null default now()
);

create table public.ani (
  an int primary key check (an between 2000 and 2100)
);

-- o categorie e activă implicit; un rând aici o ascunde în anul respectiv
create table public.categorii_inactive (
  categorie_id bigint not null references public.categorii(id) on delete cascade,
  an           int    not null references public.ani(an) on delete cascade,
  primary key (categorie_id, an)
);

create table public.imprumuturi (
  id               bigint generated always as identity primary key,
  data             date not null,
  din_id           bigint not null references public.categorii(id) on delete restrict,
  in_id            bigint not null references public.categorii(id) on delete restrict,
  suma             numeric(12,2) not null check (suma > 0),
  -- rambursări vechi din Sheet, contabilizate pe luna împrumutului
  rambursat_legacy numeric(12,2) not null default 0 check (rambursat_legacy >= 0),
  nota             text not null default '',
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  check (din_id <> in_id),
  check (rambursat_legacy <= suma)
);

create table public.tranzactii (
  id           bigint generated always as identity primary key,
  data         date not null,
  categorie_id bigint not null references public.categorii(id) on delete restrict,
  suma         numeric(12,2) not null check (suma <> 0),
  nota         text not null default '',
  tip          text not null default 'intrare' check (tip in ('intrare', 'rambursare', 'sold_initial')),
  imprumut_id  bigint references public.imprumuturi(id) on delete restrict,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check ((tip = 'rambursare') = (imprumut_id is not null)),
  check (tip <> 'rambursare' or suma > 0)
);

create index tranzactii_data_idx on public.tranzactii (data) where deleted_at is null;
create index tranzactii_imprumut_idx on public.tranzactii (imprumut_id) where imprumut_id is not null;
create index imprumuturi_data_idx on public.imprumuturi (data) where deleted_at is null;
