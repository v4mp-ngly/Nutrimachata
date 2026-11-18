-- ═══════════════════════════════════════════════════════════════════════════
-- NutriMachata v134 · Ajustes en Supabase + Doctores por localidad
-- NO destructivo: solo CREA tablas, funciones y políticas nuevas. No modifica ni borra
-- tablas, columnas ni políticas existentes. Se puede ejecutar más de una vez.
--
-- Qué agrega:
--   1. public.nm_ajustes_clinica   → perfil de la clínica, plantillas de dietas, plantillas PDF,
--                                    formularios de consentimiento y preferencias de Facturación
--                                    (antes se perdían al cerrar el navegador).
--   2. public.doctor_localidades    → en qué localidades atiende cada doctor.
--   3. public.nm_asignar_doctor_paciente_v134() → cambia el doctor de un paciente en UNA transacción
--                                    (nunca queda sin doctor ni con dos doctores activos).
--
-- Seguridad (RLS):
--   · Pacientes: NO pueden leer ni escribir ninguna de estas tablas.
--   · nm_ajustes_clinica: lectura y escritura para personal clínico activo (admin, doctor, doctora,
--     nutricionista), porque los doctores también guardan plantillas de dietas.
--   · doctor_localidades: lectura para personal clínico activo; solo administración crea o cambia.
--   · La función de asignación solo la puede ejecutar administración.
--   · Un usuario desactivado (usuarios.activo = false) pierde el acceso a estas tablas.
--
-- ANTES de ejecutar, comprueba los tipos de ID (deben ser uuid):
--   select table_name, column_name, data_type from information_schema.columns
--   where table_schema='public' and ((table_name in ('usuarios','localidades','pacientes') and column_name='id')
--      or (table_name='asignaciones_pacientes' and column_name in ('paciente_id','especialista_id','asignado_por','activo')));
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Rol del usuario autenticado (solo si está activo). SECURITY DEFINER para no depender de las
-- políticas de la tabla usuarios dentro de otras políticas.
create or replace function public.nm_rol_activo_v134()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((
    select u.rol from public.usuarios u
    where u.id = auth.uid() and coalesce(u.activo, true)
    limit 1), ''));
$$;
revoke all on function public.nm_rol_activo_v134() from public;
grant execute on function public.nm_rol_activo_v134() to authenticated;

-- ── 1. Ajustes de la clínica ───────────────────────────────────────────────
create table if not exists public.nm_ajustes_clinica (
  clave           text primary key,
  valor           jsonb not null default '{}'::jsonb,
  actualizado_por uuid,
  actualizado_en  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table public.nm_ajustes_clinica enable row level security;

drop policy if exists nm_ajustes_select_v134 on public.nm_ajustes_clinica;
create policy nm_ajustes_select_v134 on public.nm_ajustes_clinica
  for select to authenticated
  using (public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm_ajustes_insert_v134 on public.nm_ajustes_clinica;
create policy nm_ajustes_insert_v134 on public.nm_ajustes_clinica
  for insert to authenticated
  with check (public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm_ajustes_update_v134 on public.nm_ajustes_clinica;
create policy nm_ajustes_update_v134 on public.nm_ajustes_clinica
  for update to authenticated
  using (public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'))
  with check (public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));
-- Sin política DELETE: los ajustes no se borran desde la aplicación.

-- ── 2. Doctores por localidad ──────────────────────────────────────────────
create table if not exists public.doctor_localidades (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  localidad_id  uuid not null references public.localidades(id) on delete cascade,
  activo        boolean not null default true,
  asignado_por  uuid,
  creado_en     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint doctor_localidades_unico unique (usuario_id, localidad_id)
);
create index if not exists nm_idx_doctor_localidades_localidad on public.doctor_localidades (localidad_id) where activo;
alter table public.doctor_localidades enable row level security;

drop policy if exists nm_doc_loc_select_v134 on public.doctor_localidades;
create policy nm_doc_loc_select_v134 on public.doctor_localidades
  for select to authenticated
  using (public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm_doc_loc_insert_v134 on public.doctor_localidades;
create policy nm_doc_loc_insert_v134 on public.doctor_localidades
  for insert to authenticated
  with check (public.nm_rol_activo_v134() = 'admin');

drop policy if exists nm_doc_loc_update_v134 on public.doctor_localidades;
create policy nm_doc_loc_update_v134 on public.doctor_localidades
  for update to authenticated
  using (public.nm_rol_activo_v134() = 'admin')
  with check (public.nm_rol_activo_v134() = 'admin');
-- Sin política DELETE: quitar una localidad la marca activo = false (queda historial).

-- ── 3. Asignación atómica paciente → doctor ────────────────────────────────
create or replace function public.nm_asignar_doctor_paciente_v134(
  p_paciente_id     uuid,
  p_especialista_id uuid default null
)
returns setof public.asignaciones_pacientes
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.nm_rol_activo_v134() <> 'admin' then
    raise exception 'Solo administración puede asignar doctores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pacientes where id = p_paciente_id) then
    raise exception 'El paciente no existe' using errcode = 'P0002';
  end if;
  if p_especialista_id is not null and not exists (
       select 1 from public.usuarios
       where id = p_especialista_id and coalesce(activo, true)
         and lower(rol) in ('admin','doctor','doctora','nutricionista')) then
    raise exception 'El doctor no existe o está inactivo' using errcode = 'P0002';
  end if;

  -- Bloquea las asignaciones del paciente mientras se cambia (evita dos cambios simultáneos).
  perform 1 from public.asignaciones_pacientes where paciente_id = p_paciente_id for update;

  -- Si ya está asignado a ese mismo doctor, no se hace nada.
  if p_especialista_id is not null and exists (
       select 1 from public.asignaciones_pacientes
       where paciente_id = p_paciente_id and especialista_id = p_especialista_id and activo) then
    update public.asignaciones_pacientes set activo = false
      where paciente_id = p_paciente_id and activo and especialista_id <> p_especialista_id;
    return query select * from public.asignaciones_pacientes
      where paciente_id = p_paciente_id and activo;
    return;
  end if;

  update public.asignaciones_pacientes set activo = false
    where paciente_id = p_paciente_id and activo;

  if p_especialista_id is not null then
    return query
      insert into public.asignaciones_pacientes (paciente_id, especialista_id, activo, asignado_por)
      values (p_paciente_id, p_especialista_id, true, auth.uid())
      returning *;
  end if;
end;
$$;
revoke all on function public.nm_asignar_doctor_paciente_v134(uuid, uuid) from public;
grant execute on function public.nm_asignar_doctor_paciente_v134(uuid, uuid) to authenticated;

-- Comprobación (solo lectura):
-- select clave, actualizado_en from public.nm_ajustes_clinica order by clave;
-- select u.nombre, l.nombre from public.doctor_localidades dl
--   join public.usuarios u on u.id = dl.usuario_id join public.localidades l on l.id = dl.localidad_id where dl.activo;

-- Permisos de tabla (Supabase suele darlos por defecto; se declaran explícitamente). RLS sigue decidiendo qué filas.
grant select, insert, update on public.nm_ajustes_clinica to authenticated;
grant select, insert, update on public.doctor_localidades to authenticated;
