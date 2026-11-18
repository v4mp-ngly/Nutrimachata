-- =====================================================================
-- NutriMachata v131 · Ajuste de inventario atómico (OPCIONAL, NO DESTRUCTIVO)
-- ---------------------------------------------------------------------
-- Qué hace: crea la función nm_ajustar_stock_v131. La aplicación v131 la usa
-- automáticamente si existe; si no existe, sigue funcionando con el método anterior.
--
-- Problema que resuelve: antes el stock se actualizaba leyendo el valor, sumando
-- en el navegador y escribiendo el resultado (lectura-modificación-escritura).
-- Dos usuarios facturando el mismo producto a la vez podían perder un descuento
-- de inventario, y el movimiento podía quedar sin registrar si fallaba la red
-- entre ambos pasos. Aquí ambos pasos ocurren en UNA transacción y el cálculo
-- se hace en la base de datos (stock = stock + delta).
--
-- Seguridad: SECURITY INVOKER -> se aplican las mismas políticas RLS del usuario.
-- No cambia tablas, columnas, datos ni políticas existentes.
-- Regla contable conservada: la v85 permite stock negativo (facturar sin
-- existencias); esta función NO cambia esa regla.
-- Para revertir: drop function if exists public.nm_ajustar_stock_v131(uuid,integer,uuid,text,text);
-- =====================================================================
create or replace function public.nm_ajustar_stock_v131(
  p_producto_id uuid,
  p_delta integer,
  p_factura_id uuid default null,
  p_tipo text default 'ajuste',
  p_motivo text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tipo_producto text;
  v_antes integer;
  v_despues integer;
begin
  if p_producto_id is null or coalesce(p_delta,0) = 0 then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;

  select lower(coalesce(tipo,'producto')), coalesce(stock,0)::integer
    into v_tipo_producto, v_antes
    from public.productos_servicios
   where id = p_producto_id
   for update;                       -- bloquea la fila hasta terminar la transacción

  if not found then
    raise exception 'Producto % no encontrado o sin permiso', p_producto_id using errcode = 'P0002';
  end if;
  if v_tipo_producto = 'servicio' then
    return jsonb_build_object('ok', true, 'servicio', true);
  end if;

  update public.productos_servicios
     set stock = coalesce(stock,0) + p_delta
   where id = p_producto_id
  returning stock::integer into v_despues;

  insert into public.movimientos_inventario
    (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, factura_id, motivo, created_by)
  values
    (p_producto_id, p_tipo, abs(p_delta), v_antes, v_despues, p_factura_id, p_motivo, auth.uid());

  return jsonb_build_object('ok', true, 'stock_anterior', v_antes, 'stock_nuevo', v_despues);
end;
$$;

revoke all on function public.nm_ajustar_stock_v131(uuid,integer,uuid,text,text) from public, anon;
grant execute on function public.nm_ajustar_stock_v131(uuid,integer,uuid,text,text) to authenticated;

-- Recargar el caché de esquema de PostgREST para que la función quede disponible de inmediato.
notify pgrst, 'reload schema';
