# Pruebas automatizadas (v131)

Prueban la aplicación real (`index.html` + bundles) en Chromium contra un **Supabase simulado en memoria**
(`mock-supabase.js`). No se conectan a producción ni crean datos reales.

```
cd tests
npm install
npx playwright install chromium
npm test                 # 28 pruebas; resultado en tests/resultados.json
node run-all.js .. T13   # una prueba concreta
```

Las pruebas cubren navegación por rol, desconexión y reconexión, sesiones, carga parcial, sincronizaciones
duplicadas, CRUD clínico, facturas (descuentos, inventario, doble clic, reanudación), pagos (doble envío y
respuesta perdida), cálculos de cierre y reportes, paginación >1000 filas, GLP-1, cierre de sesión y alertas.
Lo que el simulador no puede comprobar (RLS real, SQL de las RPC existentes) está listado en
`../INFORME_CORRECCIONES_v131.md`, sección 6.
