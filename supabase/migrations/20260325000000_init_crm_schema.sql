-- ============================================================
-- Pudu CRM — Schema inicial
-- ============================================================

-- Enums
create type contact_status as enum ('Prospecto', 'Cliente Activo', 'Inactivo', 'VIP');
create type deal_stage as enum ('Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre', 'Ganado', 'Perdido');
create type activity_type as enum ('llamada', 'reunion', 'email', 'tarea');
create type activity_priority as enum ('baja', 'media', 'alta');
create type company_size as enum ('1-10', '11-50', '51-200', '201-1000', '1000+');

-- ============================================================
-- COMPANIES
-- ============================================================
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sector      text,
  rut         text,
  website     text,
  address     text,
  city        text,
  size        company_size,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text unique,
  phone       text,
  role        text,
  status      contact_status default 'Prospecto',
  vip         boolean default false,
  lead_value  numeric(12,0) default 0,
  company_id  uuid references companies(id) on delete set null,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- DEALS
-- ============================================================
create table deals (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  value        numeric(12,0) default 0,
  stage        deal_stage default 'Prospección',
  probability  int default 0 check (probability between 0 and 100),
  close_date   date,
  owner        text,
  description  text,
  company_id   uuid references companies(id) on delete set null,
  contact_id   uuid references contacts(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table activities (
  id          uuid primary key default gen_random_uuid(),
  type        activity_type not null default 'tarea',
  title       text not null,
  description text,
  priority    activity_priority default 'media',
  scheduled_at timestamptz,
  completed   boolean default false,
  company_id  uuid references companies(id) on delete set null,
  contact_id  uuid references contacts(id) on delete set null,
  deal_id     uuid references deals(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at before update on companies for each row execute function update_updated_at();
create trigger trg_contacts_updated_at  before update on contacts  for each row execute function update_updated_at();
create trigger trg_deals_updated_at     before update on deals     for each row execute function update_updated_at();
create trigger trg_activities_updated_at before update on activities for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (habilitar, políticas abiertas por ahora)
-- ============================================================
alter table companies  enable row level security;
alter table contacts   enable row level security;
alter table deals      enable row level security;
alter table activities enable row level security;

-- Políticas temporales (acceso total mientras no haya auth)
create policy "allow all" on companies  for all using (true) with check (true);
create policy "allow all" on contacts   for all using (true) with check (true);
create policy "allow all" on deals      for all using (true) with check (true);
create policy "allow all" on activities for all using (true) with check (true);

-- ============================================================
-- SEED DATA (datos de prueba)
-- ============================================================
insert into companies (name, sector, city, size) values
  ('Tech Patagonia SpA',    'Tecnología',  'Santiago',     '11-50'),
  ('Antofagasta Minerals',  'Minería',     'Antofagasta',  '1000+'),
  ('Viña Concha y Toro',    'Agroindustria','Santiago',    '201-1000'),
  ('Cencosud S.A.',         'Retail',      'Santiago',     '1000+'),
  ('Banco de Chile',        'Finanzas',    'Santiago',     '1000+');

insert into contacts (first_name, last_name, email, phone, role, status, vip, lead_value, company_id)
select
  'Javier', 'Valenzuela', 'javier.v@empresa.cl', null, null, 'Prospecto', false, 2450000,
  id from companies where name = 'Tech Patagonia SpA'
union all
select
  'Isabel', 'Allende', 'i.allende@miningcorp.cl', '+56 9 8234 1102', 'Chief Procurement Officer', 'Cliente Activo', true, 12800000,
  id from companies where name = 'Antofagasta Minerals'
union all
select
  'Ricardo', 'Müller', 'rm@vinosdelsur.cl', null, null, 'Inactivo', false, 0,
  id from companies where name = 'Viña Concha y Toro'
union all
select
  'Constanza', 'Morán', 'connie@retailchile.com', null, null, 'Prospecto', false, 5120000,
  id from companies where name = 'Cencosud S.A.';
