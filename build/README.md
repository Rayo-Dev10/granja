# Paquetes de producción de la portada

La portada usa los archivos minificados de `assets/` para reducir solicitudes,
tiempo de análisis de JavaScript y bloqueos de renderizado. Los archivos de
`data/`, `js/` y `css/` continúan siendo la fuente editable.

Cuando cambie una fuente de la portada se debe volver a compilar con esbuild,
calcular los primeros 10 caracteres de su SHA-256 y actualizar el nombre
correspondiente en `index.html`. Los nombres con hash reciben caché inmutable
en `.htaccess`; el HTML continúa revalidándose en cada visita.

Entradas:

- `home-core.entry.js`: datos y utilidades compartidas del resumen.
- `home-css.entry.css`: estilos generales y skeletons.
- `js/dashboard.js`, `js/arranque.js` y `js/enlaces.js`: se minifican como
  archivos independientes porque el dashboard se carga después de sincronizar
  las correcciones guardadas por PHP.
