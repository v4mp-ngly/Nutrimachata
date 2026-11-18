# NutriMachata v133 · Guía rápida de publicación

1. **Respaldo:** descarga una copia de tu repositorio actual de GitHub (botón *Code > Download ZIP*).
2. **Reemplazo:** sube TODO el contenido de esta carpeta al repositorio, conservando la estructura
   (`index.html`, `css/`, `js/` con `js/vendor/`, `build/`, `sql/`, `tests/` y los documentos).
   No subas solo `index.html`.
3. **Espera** a que GitHub Pages termine de publicar (pestaña *Actions*, círculo verde).
4. **Recarga a fondo** el navegador: Cmd+Shift+R (Mac) o Ctrl+Shift+R (Windows).
5. **Comprueba** con una cuenta de prueba: iniciar sesión, abrir Dashboard, Pacientes, Facturación,
   Agenda y GLP-1, y descargar un PDF de factura.

## Supabase (opcional, recomendado)
- `sql/01_diagnostico_solo_lectura_v131.sql`: revisión de seguridad (RLS) e integridad. No modifica nada.
- `sql/02_funcion_ajuste_stock_atomico_v131.sql`: inventario en una sola transacción.
- `sql/03_indices_rendimiento_integridad_opcional_v131.sql`: índices de velocidad.
Ninguno es obligatorio para que la app funcione.

## Si necesitas volver al diseño anterior
En `index.html` cambia `<body class="nm-bento">` por `<body>`.

## Si modificas código
Edita los archivos numerados de `js/` o `css/` y ejecuta `node build/build-bundle.mjs`.
Después sube el número `?v=` en `index.html`.
