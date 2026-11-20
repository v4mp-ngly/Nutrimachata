-- ============================================================================
-- NutriMachata v137 · 09b · Cada doctor ve SOLO sus pacientes (RLS)
-- ----------------------------------------------------------------------------
-- Regla aprobada: "Asignados + su localidad + nuevos".
--   • admin ............................ ve todo (sin cambios).
--   • doctor / doctora / nutricionista . ve un paciente si:
--        a) lo tiene asignado (asignaciones_pacientes activa), o
--        b) el paciente pertenece a una de SUS localidades (doctor_localidades), o
--        c) el paciente es NUEVO: sin doctor asignado y sin localidad.
--   • paciente (portal) ................ sin cambios: sigue viendo solo lo suyo.
--
-- Cómo funciona (no borra datos ni cambia tablas/columnas):
--   Crea la función nm_puede_ver_paciente_v137(paciente) y agrega políticas
--   RESTRICTIVAS. Una política restrictiva se SUMA como condición a las políticas
--   que ya tienes: nunca da más acceso del que existe hoy, solo lo limita para
--   los doctores. Se aplica a lectura y escritura de las tablas clínicas:
--     pacientes, evaluaciones, dietas, historias_clinicas, citas,
--     seguimiento_paciente, lab_notes, notas_clinicas, consentimientos_pacientes,
--     glp1_tratamientos, glp1_aplicaciones (solo las que existan).
--   Facturación (facturas, pagos, etc.) NO cambia.
--
-- Consecuencias que debes conocer:
--   1. Un doctor sin localidades ni asignaciones solo verá los pacientes nuevos.
--      Revisa antes 09a_vista_previa_visibilidad_doctores_v137.sql.
--   2. Si un doctor pone a un paciente en una localidad que NO es suya y no lo
--      tiene asignado, ese paciente deja de aparecerle (pasa a esa localidad).
--   3. Las citas y la agenda de un doctor solo mostrarán pacientes visibles para él.
--   4. Las funciones del servidor (RPC security definer) no cambian.
--
-- Se puede ejecutar varias veces. Para deshacer: ver "REVERTIR" al final.
-- Requisito: 04_guardado_ajustes_doctores_localidades_v134.sql y 10_permisos_admin_equipo_v137.sql ya ejecutados.
-- ============================================================================
begin;

create or replace function public.nm_puede_ver_paciente_v137(p_paciente_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := public.nm_rol_activo_v134();
  v_uid uuid := public.nm_mi_usuario_id_v137();
  v_loc uuid;
begin
  -- Solo se limita al personal clínico que no es admin. El resto lo deciden las políticas existentes.
  if v_rol not in ('doctor','doctora','nutricionista') then return true; end if;
  if p_paciente_id is null then return true; end if;

  -- a) asignado a este doctor
  if exists (select 1 from public.asignaciones_pacientes a
             where a.paciente_id = p_paciente_id and a.especialista_id = v_uid and coalesce(a.activo, true)) then
    return true;
  end if;

  select p.localidad_id into v_loc from public.pacientes p where p.id = p_paciente_id;

  -- b) paciente de una de sus localidades
  if v_loc is not null and exists (select 1 from public.doctor_localidades d
             where d.usuario_id = v_uid and d.localidad_id = v_loc and coalesce(d.activo, true)) then
    return true;
  end if;

  -- c) paciente nuevo: sin localidad y sin ningún doctor asignado
  --    (también cubre el paciente que se está creando en este momento)
  if v_loc is null and not exists (select 1 from public.asignaciones_pacientes a
             where a.paciente_id = p_paciente_id and coalesce(a.activo, true)) then
    return true;
  end if;

  return false;
end;
$$;
revoke all on function public.nm_puede_ver_paciente_v137(uuid) from public, anon;
grant execute on function public.nm_puede_ver_paciente_v137(uuid) to authenticated;

-- Versión para la fila de pacientes que se está insertando (aún no existe en la tabla).
create or replace function public.nm_puede_ver_paciente_fila_v137(p_id uuid, p_localidad uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rol text := public.nm_rol_activo_v134(); v_uid uuid := public.nm_mi_usuario_id_v137();
begin
  if v_rol not in ('doctor','doctora','nutricionista') then return true; end if;
  if exists (select 1 from public.asignaciones_pacientes a
             where a.paciente_id = p_id and a.especialista_id = v_uid and coalesce(a.activo, true)) then return true; end if;
  if p_localidad is not null then
    return exists (select 1 from public.doctor_localidades d
                   where d.usuario_id = v_uid and d.localidad_id = p_localidad and coalesce(d.activo, true));
  end if;
  return not exists (select 1 from public.asignaciones_pacientes a where a.paciente_id = p_id and coalesce(a.activo, true));
end;
$$;
revoke all on function public.nm_puede_ver_paciente_fila_v137(uuid, uuid) from public, anon;
grant execute on function public.nm_puede_ver_paciente_fila_v137(uuid, uuid) to authenticated;

-- pacientes: se evalúa con los valores de la propia fila
drop policy if exists nm137_doctor_ve_paciente on public.pacientes;
create policy nm137_doctor_ve_paciente on public.pacientes
  as restrictive for all to authenticated
  using (public.nm_puede_ver_paciente_fila_v137(id, localidad_id))
  with check (public.nm_puede_ver_paciente_fila_v137(id, localidad_id));

-- tablas clínicas con paciente_id
do $$
declare t text;
begin
  foreach t in array array['evaluaciones','dietas','historias_clinicas','citas','seguimiento_paciente','lab_notes',
                           'notas_clinicas','consentimientos_pacientes','glp1_tratamientos','glp1_aplicaciones'] loop
    if to_regclass('public.'||t) is null then
      raise notice 'Tabla % no existe: se omite', t; continue;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='paciente_id') then
      raise notice 'Tabla % no tiene paciente_id: se omite', t; continue;
    end if;
    execute format('drop policy if exists nm137_doctor_ve_paciente on public.%I', t);
    execute format('create policy nm137_doctor_ve_paciente on public.%I as restrictive for all to authenticated
                    using (public.nm_puede_ver_paciente_v137(paciente_id))
                    with check (public.nm_puede_ver_paciente_v137(paciente_id))', t);
    raise notice 'Política aplicada en %', t;
  end loop;
end $$;

commit;

-- Verificación: tablas protegidas
select tablename, policyname, permissive from pg_policies
where schemaname='public' and policyname='nm137_doctor_ve_paciente' order by 1;

-- ── REVERTIR (vuelve exactamente al estado anterior) ──────────────────────
-- do $$ declare t text; begin
--   foreach t in array array['pacientes','evaluaciones','dietas','historias_clinicas','citas','seguimiento_paciente','lab_notes',
--                            'notas_clinicas','consentimientos_pacientes','glp1_tratamientos','glp1_aplicaciones'] loop
--     if to_regclass('public.'||t) is not null then execute format('drop policy if exists nm137_doctor_ve_paciente on public.%I', t); end if;
--   end loop; end $$;
