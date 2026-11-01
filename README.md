# NutriMachata v126 - Proyecto organizado

Esta carpeta es una reorganizacion conservadora de la v126 completa.

## Estructura
- `index.html`: entrada principal.
- `css/`: 49 bloques de estilos extraidos, manteniendo su posicion relativa mediante links.
- `js/`: 61 bloques JavaScript propios extraidos, manteniendo el orden original.
- `backup/`: HTML monolitico original v126.

## Importante
- No se modifico Supabase ni se incluyen credenciales nuevas.
- Las librerias externas siguen cargandose desde sus CDN originales.
- Para publicar en GitHub Pages, sube todo el contenido conservando las carpetas `css` y `js`.
- Abre/publica `index.html`; no abras archivos JS individualmente.

## GLP-1
El modulo GLP-1 sigue usando las tablas ya creadas en Supabase. No vuelvas a ejecutar el SQL solo por usar esta version organizada.

## v127 - Correccion contable de Facturacion
- Reportes de caja ya no suman cierres solapados.
- Facturado: facturas reales del rango.
- Cobrado: dinero realmente recibido del rango (`monto_recibido`, con fallback a `monto`).
- Saldo a favor usado no se cuenta como nuevo ingreso de caja.
- Gastos: gastos reales no anulados del rango.
- Neto: cobrado real - gastos.
- Pendiente: saldo actual de las facturas del rango.
- Historial de cierres se conserva solo como referencia.
- PDF del periodo usa los totales reales, no la suma de cierres.
