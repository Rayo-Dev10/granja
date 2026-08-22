<?php
/*
 * index.php — puente para hostings cuyo archivo por defecto es index.php.
 *
 * Este archivo NO cambia el sitio: simplemente entrega el contenido de index.html
 * cuando el servidor busca un index.php. Todo el sitio sigue siendo HTML+CSS+JS.
 *
 * Si algún día el hosting sí abre index.html por defecto, este archivo puede borrarse
 * sin ningún efecto.
 */

$pagina = __DIR__ . '/index.html';

if (is_readable($pagina)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($pagina);
    exit;
}

// Si index.html no está donde debería, mostramos un aviso claro en lugar de una página en blanco.
http_response_code(500);
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Falta el archivo index.html</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #0f172a; line-height: 1.5; }
  h1 { color: #0a3568; }
  code { background: #f1f5f9; padding: .1rem .35rem; border-radius: .25rem; }
  .caja { border-left: 4px solid #f4b400; background: #fff9e6; padding: 1rem; border-radius: .5rem; }
</style>
</head>
<body>
  <h1>No se encontró <code>index.html</code></h1>
  <div class="caja">
    <p>Este archivo <code>index.php</code> se ejecutó correctamente (el servidor sí funciona),
       pero no encontró <code>index.html</code> en la misma carpeta.</p>
    <p><strong>Carpeta donde está buscando:</strong><br><code><?php echo htmlspecialchars(__DIR__, ENT_QUOTES, 'UTF-8'); ?></code></p>
  </div>
  <p>Suba <code>index.html</code> (y las carpetas <code>css</code>, <code>js</code> y <code>data</code>)
     a esa misma carpeta, o abra <a href="diagnostico.php">diagnostico.php</a> para ver qué archivos faltan.</p>
</body>
</html>
