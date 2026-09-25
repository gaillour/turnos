-- ============================================================================
-- Turnos-Simple (Demo Interactiva B2B) - Esquema de Base de Datos Supabase
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================================

-- 1. Habilitar extensión para UUIDs (por defecto activa en Supabase)
create extension if not exists "pgcrypto";

-- 2. Tabla de Recursos (Agnóstica al nicho: ej. "Recurso A", "Sillón 1", "Cancha 5")
create table if not exists public.recursos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    activo boolean not null default true,
    created_at timestamptz not null default now()
);

-- 3. Tabla de Turnos
create table if not exists public.turnos (
    id uuid primary key default gen_random_uuid(),
    recurso_id uuid not null references public.recursos(id) on delete cascade,
    hora_inicio text not null, -- Formato HH:MM (ej. '09:00', '10:30', '12:00')
    estado text not null default 'libre' check (estado in ('libre', 'ocupado')),
    nombre_cliente text,
    created_at timestamptz not null default now(),
    unique (recurso_id, hora_inicio)
);

-- 4. Habilitar Row Level Security (RLS) con políticas de demostración
alter table public.recursos enable row level security;
alter table public.turnos enable row level security;

drop policy if exists "Lectura pública de recursos" on public.recursos;
create policy "Lectura pública de recursos"
    on public.recursos for select
    using (true);

drop policy if exists "Escritura pública de recursos para demo" on public.recursos;
create policy "Escritura pública de recursos para demo"
    on public.recursos for all
    using (true)
    with check (true);

drop policy if exists "Lectura pública de turnos" on public.turnos;
create policy "Lectura pública de turnos"
    on public.turnos for select
    using (true);

drop policy if exists "Escritura pública de turnos para demo" on public.turnos;
create policy "Escritura pública de turnos para demo"
    on public.turnos for all
    using (true)
    with check (true);

-- 5. REQUISITO CRÍTICO: Habilitar Supabase Realtime para la tabla `turnos`
alter table public.turnos replica identity full;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'turnos'
    ) then
        alter publication supabase_realtime add table public.turnos;
    end if;
end $$;

-- 6. Datos Semilla (Seed Data) usando la terminología amigable "Espacio"
insert into public.recursos (nombre, activo)
values
    ('Espacio 1', true),
    ('Espacio 2', true),
    ('Espacio 3', true)
on conflict (nombre) do update set activo = excluded.activo;

-- Insertar grilla inicial de turnos del día
do $$
declare
    rec_a uuid;
    rec_b uuid;
    rec_s1 uuid;
begin
    select id into rec_a from public.recursos where nombre = 'Espacio 1' limit 1;
    select id into rec_b from public.recursos where nombre = 'Espacio 2' limit 1;
    select id into rec_s1 from public.recursos where nombre = 'Espacio 3' limit 1;

    insert into public.turnos (recurso_id, hora_inicio, estado, nombre_cliente)
    values
        (rec_a, '09:00', 'ocupado', 'Martina López'),
        (rec_a, '10:30', 'libre', null),
        (rec_a, '12:00', 'libre', null),
        (rec_a, '15:00', 'ocupado', 'Lucía Fernández'),
        (rec_b, '10:30', 'ocupado', 'Sofía Martínez'),
        (rec_b, '12:00', 'libre', null),
        (rec_b, '16:00', 'libre', null),
        (rec_s1, '14:30', 'ocupado', 'Camila Torres'),
        (rec_s1, '17:00', 'libre', null),
        (rec_s1, '18:00', 'libre', null)
    on conflict (recurso_id, hora_inicio) do nothing;
end $$;
