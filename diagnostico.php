<?php
/*
 * diagnostico.php — página de verificación de la instalación.
 * Abrir en el navegador: https://granja.rayogestion.com/diagnostico.php
 * Dice exactamente qué archivos llegaron bien y cuáles faltan.
 * Cuando el sitio ya funcione, este archivo se puede borrar.
 */
$requeridos = [
  'Páginas' => ['index.html','proyectos.html','proyecto.html','diario.html','controles.html','mano-obra.html','plantillas.html','hojas-vida.html','ayuda.html','404.html'],
  'Estilos' => ['css/granja.css','css/print.css'],
  'Programas (JS)' => ['js/util.js','js/exporta.js','js/charts.js','js/proyectos.js','js/proyecto.js','js/diario.js','js/controles.js','js/coherencia.js','js/dashboard.js','js/hojasvida.js','js/manoobra.js','js/manoobra-core.js','js/plantillas.js','js/cobertura.js','js/revelaciones.js','js/enlaces.js','js/arranque.js','js/estado.js'],
  'Datos' => ['data/catalogo.js','data/movimientos.js','data/produccion.js','data/inventarios.js','data/sanitario.js','data/alimento.js','data/suministros.js','data/manoobra.js'],
  'Guardado compartido' => ['api/config.php','api/correcciones.php','api/alimentacion.php','api/manoobra.php','api/plantillas.php','api/revelaciones.php'],
  'Plantillas de ejemplo' => ['formatos-plantillas/plantillas.index.json','formatos-plantillas/plantillas.index.js','formatos-plantillas/dedicacion-horas-personal.xlsx','formatos-plantillas/registro-alimentacion.xlsx','formatos-plantillas/recoleccion-huevos.xlsx','formatos-plantillas/donacion-servicios.xlsx','formatos-plantillas/inventario-animales.xlsx'],
  'Otros' => ['favicon.svg','.htaccess','comprobacion-url.html'],
];
$faltan = 0; $vacios = 0; $total = 0;
foreach ($requeridos as $archivos) foreach ($archivos as $a) {
  $total++;
  $ruta = __DIR__ . '/' . $a;
  if (!is_readable($ruta)) { $faltan++; }
  elseif (filesize($ruta) < 100) { $vacios++; }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnóstico de la instalación · Granja San José</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #0f172a; line-height: 1.5; }
  h1 { color: #0a3568; } h2 { color: #0a3568; margin-top: 2rem; font-size: 1.1rem; }
  code { background: #f1f5f9; padding: .1rem .35rem; border-radius: .25rem; font-size: .9em; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th { background: #1e293b; color: #fff; text-align: left; padding: .4rem .6rem; }
  td { border-bottom: 1px solid #e2e8f0; padding: .35rem .6rem; }
  .ok { color: #137a4f; font-weight: 600; } .mal { color: #b52f47; font-weight: 600; } .aviso { color: #a96f00; font-weight: 600; }
  .caja { border-left: 4px solid #0b67d0; background: #eff6ff; padding: 1rem; border-radius: .5rem; margin: 1rem 0; }
  .caja-ok { border-left-color: #16965c; background: #f0fbf5; }
  .caja-mal { border-left-color: #d6455d; background: #fff2f4; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>🔎 Diagnóstico de la instalación</h1>
<p>Esta página comprueba que todos los archivos del sitio hayan llegado al servidor.
   Cuando el sitio ya funcione bien, puede borrar este archivo.</p>

<?php if ($faltan === 0 && $vacios === 0): ?>
  <div class="caja caja-ok"><strong>✔ Todo está en su lugar.</strong> Los <?php echo $total; ?> archivos necesarios están en el servidor.
  Abra <a href="index.html">index.html</a> o la <a href="./">raíz del sitio</a>. Si aun así no ve el sitio, revise más abajo la sección «Rutas del servidor».</div>
<?php else: ?>
  <div class="caja caja-mal"><strong>✖ Faltan archivos.</strong>
  <?php echo $faltan; ?> archivo(s) no están en el servidor<?php if ($vacios) echo " y $vacios llegaron incompletos (menos de 100 bytes)"; ?>.
  Revise la tabla: suba los que aparecen en rojo <strong>respetando las carpetas</strong> (<code>css/</code>, <code>js/</code>, <code>data/</code>).
  Un error común es subir los archivos sueltos, sin sus carpetas.</div>
<?php endif; ?>

<?php foreach ($requeridos as $grupo => $archivos): ?>
<h2><?php echo htmlspecialchars($grupo, ENT_QUOTES, 'UTF-8'); ?></h2>
<table>
  <thead><tr><th>Archivo</th><th>Estado</th><th class="num">Tamaño</th></tr></thead>
  <tbody>
  <?php foreach ($archivos as $a):
    $ruta = __DIR__ . '/' . $a;
    $existe = is_readable($ruta);
    $tam = $existe ? filesize($ruta) : 0; ?>
    <tr>
      <td><code><?php echo htmlspecialchars($a, ENT_QUOTES, 'UTF-8'); ?></code></td>
      <td><?php
        if (!$existe) echo '<span class="mal">✖ NO ESTÁ — súbalo</span>';
        elseif ($tam < 100) echo '<span class="aviso">⚠ llegó incompleto — vuelva a subirlo</span>';
        else echo '<span class="ok">✔ correcto</span>';
      ?></td>
      <td class="num"><?php echo $existe ? number_format($tam / 1024, 1, ',', '.') . ' KB' : '—'; ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
<?php endforeach; ?>

<h2>Rutas del servidor (para ubicar dónde quedaron los archivos)</h2>
<table>
  <tbody>
    <tr><td>Carpeta real donde está este archivo</td><td><code><?php echo htmlspecialchars(__DIR__, ENT_QUOTES, 'UTF-8'); ?></code></td></tr>
    <tr><td>Raíz del sitio según el servidor</td><td><code><?php echo htmlspecialchars($_SERVER['DOCUMENT_ROOT'] ?? '(no informada)', ENT_QUOTES, 'UTF-8'); ?></code></td></tr>
    <tr><td>Dirección con la que llegó usted</td><td><code><?php echo htmlspecialchars(($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? ''), ENT_QUOTES, 'UTF-8'); ?></code></td></tr>
    <tr><td>Versión de PHP</td><td><code><?php echo PHP_VERSION; ?></code></td></tr>
  </tbody>
</table>
<p style="margin-top:.5rem">Si la «carpeta real» termina en algo distinto de lo que esperaba (por ejemplo <code>/public_html/granja</code> cuando el subdominio apunta a <code>/public_html</code>), los archivos están en el lugar equivocado: muévalos a la carpeta que aparece como «raíz del sitio».</p>

<h2>Enlaces de prueba</h2>
<ul>
  <li><a href="index.html">index.html</a> — la portada (debe verse con colores y gráficos)</li>
  <li><a href="css/granja.css">css/granja.css</a> — debe mostrar texto de estilos, no un error 404</li>
  <li><a href="data/catalogo.js">data/catalogo.js</a> — debe mostrar los 17 proyectos, no un error 404</li>
</ul>
<p>Si <code>index.html</code> se ve <strong>sin colores</strong>, falta <code>css/granja.css</code>.
   Si se ve con colores pero <strong>sin datos ni gráficos</strong>, faltan archivos de <code>data/</code> o <code>js/</code>.</p>


<h2>Guardado compartido de correcciones</h2>
<?php
$carpetaDatos = __DIR__ . '/datos-servidor';
$existeCarpeta = is_dir($carpetaDatos);
$escribible = $existeCarpeta && is_writable($carpetaDatos);
?>
<?php if ($escribible): ?>
  <div class="caja caja-ok"><strong>✔ La carpeta <code>datos-servidor</code> existe y se puede escribir.</strong>
  Las correcciones que guarde el director quedarán en el servidor y se verán desde cualquier computador.</div>
<?php elseif ($existeCarpeta): ?>
  <div class="caja caja-mal"><strong>✖ La carpeta <code>datos-servidor</code> existe pero NO se puede escribir.</strong>
  En el administrador de archivos del hosting, déle permisos <code>755</code> (o <code>775</code> si 755 no basta).
  Sin esto, las correcciones se guardarán solo en el navegador de cada persona.</div>
<?php else: ?>
  <div class="caja caja-mal"><strong>✖ No existe la carpeta <code>datos-servidor</code>.</strong>
  Créela por FTP al lado de <code>api</code> y déle permiso de escritura. También puede subir la que viene en el proyecto
  (trae dentro <code>correcciones.json</code> y un <code>.htaccess</code>).</div>
<?php endif; ?>
<div id="prueba-api" class="caja">Comprobando que <code>api/correcciones.php</code> responda…</div>
<script>
(function () {
  var caja = document.getElementById('prueba-api');
  function pinta(c, h) { caja.className = 'caja ' + c; caja.innerHTML = h; }
  fetch('api/correcciones.php', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok) {
      pinta('caja-ok', '<strong>\u2714 La API responde correctamente.</strong> Correcciones guardadas ahora mismo en el servidor: <strong>' +
        d.total + '</strong>. Clave de edición exigida: <strong>' + (d.exigeClave ? 'sí' : 'NO — cualquiera podría corregir') + '</strong>.' +
        (d.escribible ? '' : '<br>\u26a0 Pero la carpeta de datos no es escribible: no se podrá guardar nada.'));
    } else {
      pinta('caja-mal', '<strong>\u2716 La API respondió con un error:</strong> ' + ((d && d.mensaje) || 'sin detalle'));
    }
  })['catch'](function () {
    pinta('caja-mal', '<strong>\u2716 No se pudo contactar <code>api/correcciones.php</code>.</strong> Verifique que subió la carpeta <code>api</code> completa y que el hosting ejecuta PHP.');
  });
})();
</script>

<h2>Direcciones limpias (sin .html)</h2>
<div id="prueba-limpias" class="caja">Comprobando si el servidor entiende <code>/proyectos</code> sin la extensión…</div>
<script>
(function () {
  var caja = document.getElementById('prueba-limpias');
  function pinta(clase, html) { caja.className = 'caja ' + clase; caja.innerHTML = html; }
  fetch('comprobacion-url', { cache: 'no-store' }).then(function (r) {
    return r.ok ? r.text() : '';
  }).then(function (t) {
    if (t.indexOf('URL-LIMPIA-OK') !== -1) {
      pinta('caja-ok', '<strong>\u2714 Las direcciones limpias funcionan.</strong> El servidor entrega <code>proyectos.html</code> cuando se pide <code>/proyectos</code>. El archivo <code>.htaccess</code> está bien subido y mod_rewrite está activo.');
    } else {
      pinta('caja-mal', '<strong>\u2716 Las direcciones limpias NO funcionan.</strong><br>Causas probables: no se subió el archivo <code>.htaccess</code> (es un archivo <em>oculto</em>: active «mostrar archivos ocultos» en el FTP), o el hosting tiene desactivado <code>mod_rewrite</code>.<br><strong>El sitio sigue funcionando igual:</strong> lleva una red de seguridad que añade <code>.html</code> automáticamente al hacer clic. Solo las direcciones se verán con extensión.');
    }
  })['catch'](function () {
    pinta('caja-mal', '<strong>\u2716 No se pudo comprobar.</strong> Abra <a href="proyectos">/proyectos</a> a mano: si muestra la lista de proyectos, todo está bien; si da «no encontrado», falta subir el <code>.htaccess</code>.');
  });
})();
</script>
</body>
</html>
