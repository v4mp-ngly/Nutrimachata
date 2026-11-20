-- ============================================================================
-- NutriMachata v137 · 08 · Almacenamiento real de PLANTILLAS PDF de dietas
-- ----------------------------------------------------------------------------
-- Qué hace (no borra ni modifica ningún dato existente):
--   1. Crea el bucket PRIVADO "plantillas-dietas" en Supabase Storage
--      (máx. 10 MB por archivo, solo application/pdf).
--   2. Crea 4 políticas sobre storage.objects limitadas a ESE bucket:
--      solo el personal clínico activo (admin, doctor, doctora, nutricionista
--      en public.usuarios) puede listar, ver, subir y eliminar plantillas.
--      Los pacientes y los visitantes anónimos NO tienen acceso.
--   Las políticas de otros buckets no se tocan.
-- Requisito: haber ejecutado 04_guardado_ajustes_doctores_localidades_v134.sql
--            (crea public.nm_rol_activo_v134()).
-- Se puede ejecutar varias veces.
-- Para deshacer: ver el bloque "REVERTIR" al final.
-- ============================================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plantillas-dietas', 'plantillas-dietas', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists nm137_plantillas_select on storage.objects;
create policy nm137_plantillas_select on storage.objects
  for select to authenticated
  using (bucket_id = 'plantillas-dietas'
         and public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm137_plantillas_insert on storage.objects;
create policy nm137_plantillas_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plantillas-dietas'
              and public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm137_plantillas_update on storage.objects;
create policy nm137_plantillas_update on storage.objects
  for update to authenticated
  using (bucket_id = 'plantillas-dietas'
         and public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'))
  with check (bucket_id = 'plantillas-dietas'
              and public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

drop policy if exists nm137_plantillas_delete on storage.objects;
create policy nm137_plantillas_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'plantillas-dietas'
         and public.nm_rol_activo_v134() in ('admin','doctor','doctora','nutricionista'));

commit;

-- Verificación (debe devolver 1 fila con public = false y 4 políticas):
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plantillas-dietas';
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'nm137_plantillas_%' order by 1;

-- ── REVERTIR (solo si lo necesitas; los PDF subidos quedan en el bucket) ──
-- drop policy if exists nm137_plantillas_select on storage.objects;
-- drop policy if exists nm137_plantillas_insert on storage.objects;
-- drop policy if exists nm137_plantillas_update on storage.objects;
-- drop policy if exists nm137_plantillas_delete on storage.objects;
