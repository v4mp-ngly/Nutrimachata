-- ═══════════════════════════════════════════════════════════════════════════
-- NutriMachata v137 · PASO 2 de 2 · APLICAR (ejecútalo solo después de revisar el PASO 1)
-- Asigna a cada factura "Sin localidad" la localidad que su paciente tiene HOY.
--
-- Seguridad:
--   • Antes de cambiar, guarda una copia de cada factura afectada en
--     public.nm_respaldo_localidad_facturas_v137 (id, localidad anterior, fecha del cambio).
--   • Solo toca facturas con localidad vacía; nunca cambia una localidad ya guardada.
--   • No cambia montos, pagos, estados ni ningún otro campo.
--   • Se puede ejecutar más de una vez: la segunda vez no encuentra nada que cambiar.
--   • Para EXCLUIR facturas concretas, escribe sus números en la lista "excluir" de abajo.
--
-- Deshacer (si fuera necesario):
--   update public.facturas f set localidad_id = null, localidad_nombre_snapshot = null
--     from public.nm_respaldo_localidad_facturas_v137 r
--    where r.factura_id = f.id and r.revertido is not true;
--   update public.nm_respaldo_localidad_facturas_v137 set revertido = true;
-- ═══════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.nm_respaldo_localidad_facturas_v137 (
  factura_id           uuid primary key,
  numero_factura       text,
  localidad_anterior   uuid,
  snapshot_anterior    text,
  localidad_asignada   uuid,
  snapshot_asignado    text,
  aplicado_en          timestamptz not null default now(),
  revertido            boolean not null default false
);
alter table public.nm_respaldo_localidad_facturas_v137 enable row level security;  -- sin políticas: solo visible desde el SQL Editor
revoke all on public.nm_respaldo_localidad_facturas_v137 from anon, authenticated;

with excluir(numero) as (
  values ('__ninguna__')            -- ej.: ('FAC-000123'), ('FAC-000124')
), objetivo as (
  select f.id, f.numero_factura, f.localidad_id, f.localidad_nombre_snapshot, p.localidad_id as nueva, l.nombre as nombre_nuevo
    from public.facturas f
    join public.pacientes p   on p.id = f.paciente_id
    join public.localidades l on l.id = p.localidad_id
   where f.localidad_id is null
     and p.localidad_id is not null
     and coalesce(lower(f.estado),'') not in ('anulada','archivada')
     and f.numero_factura not in (select numero from excluir)
), respaldo as (
  insert into public.nm_respaldo_localidad_facturas_v137 (factura_id, numero_factura, localidad_anterior, snapshot_anterior, localidad_asignada, snapshot_asignado)
  select id, numero_factura, localidad_id, localidad_nombre_snapshot, nueva, nombre_nuevo from objetivo
  on conflict (factura_id) do update set localidad_asignada = excluded.localidad_asignada, snapshot_asignado = excluded.snapshot_asignado,
                                       aplicado_en = now(), revertido = false
  returning factura_id
)
update public.facturas f
   set localidad_id = o.nueva,
       localidad_nombre_snapshot = o.nombre_nuevo
  from objetivo o
 where f.id = o.id
   and f.localidad_id is null
   and exists (select 1 from respaldo r where r.factura_id = o.id);

commit;

-- Comprobación
select coalesce(localidad_nombre_snapshot, 'Sin localidad') as localidad, count(*) as facturas, sum(total) as total
  from public.facturas
 where coalesce(lower(estado),'') not in ('anulada','archivada')
 group by 1 order by 2 desc;
