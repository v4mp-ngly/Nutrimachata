-- =====================================================================
-- NutriMachata v131 · Índices de rendimiento e integridad (OPCIONAL, NO DESTRUCTIVO)
-- Solo crea índices si no existen. No borra ni modifica datos.
-- Ejecutar primero sql/01_diagnostico_solo_lectura_v131.sql (consulta 6).
-- =====================================================================

-- Rendimiento: búsquedas por factura (detalles, pagos, inventario) y por fecha (reportes/cierres).
create index if not exists nm_idx_factura_detalles_factura on public.factura_detalles (factura_id);
create index if not exists nm_idx_pagos_factura on public.pagos (factura_id);
create index if not exists nm_idx_pagos_fecha on public.pagos (fecha_pago);
create index if not exists nm_idx_facturas_fecha on public.facturas (fecha);
create index if not exists nm_idx_gastos_fecha on public.gastos (fecha);
create index if not exists nm_idx_evaluaciones_paciente on public.evaluaciones (paciente_id);
create index if not exists nm_idx_citas_fecha on public.citas (fecha);

-- Integridad: número de factura único. Solo se crea si NO hay duplicados actuales
-- y si todavía no existe una restricción/índice único sobre numero_factura.
do $$
begin
  if exists (select 1 from public.facturas group by numero_factura having count(*) > 1) then
    raise notice 'Hay números de factura duplicados: revíselos antes (consulta 6 del diagnóstico). No se creó el índice único.';
  elsif exists (
    select 1 from pg_index i
    join pg_class t on t.oid = i.indrelid and t.relname = 'facturas'
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey) and a.attname = 'numero_factura'
    where i.indisunique and array_length(i.indkey::int2[],1) = 1
  ) then
    raise notice 'Ya existe un índice único sobre facturas.numero_factura.';
  else
    create unique index nm_uq_facturas_numero on public.facturas (numero_factura);
    raise notice 'Índice único nm_uq_facturas_numero creado.';
  end if;
end $$;
