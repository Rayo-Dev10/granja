<?php
/*
 * plantillas.php — repositorio COMPARTIDO de plantillas descargables.
 *   GET  api/plantillas.php               -> lista todas las plantillas (semilla + cargadas)
 *   GET  api/plantillas.php?descargar=ID  -> descarga el archivo de una plantilla cargada
 *   POST api/plantillas.php  (JSON)
 *        { "accion":"guardar","clave":"…","titulo":"…","descripcion":"…","autor":"…",
 *          "archivoNombre":"x.xlsx","archivoBase64":"…" }
 *        { "accion":"borrar","clave":"…","id":"…" }
 *
 * Las plantillas de EJEMPLO viajan en la carpeta plantillas/ (del sitio).
 * Las que se CARGAN quedan en datos-servidor/plantillas/ (con permiso de escritura,
 * y nunca se borran al volver a subir el sitio). El índice de las cargadas está en
 * datos-servidor/plantillas.json.  Descargar es público; cargar/borrar pide contraseña.
 */
header('Cache-Control: no-store');
$cfg = require __DIR__ . '/config.php';

$carpeta     = $cfg['carpetaDatos'];
$carpetaFich = $carpeta . '/plantillas';
$indice      = $carpeta . '/plantillas.json';
$semillaDir  = __DIR__ . '/../formatos-plantillas';
$semillaIdx  = $semillaDir . '/plantillas.index.json';

$EXT_OK = ['xlsx','xls','xlsm','xlsb','csv','ods','docx','pdf'];
$MAX = 8 * 1024 * 1024;   // 8 MB por archivo

function jout($d, $c = 200) { header('Content-Type: application/json; charset=UTF-8'); http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function jfail($m, $c = 400, $x = []) { jout(array_merge(['ok' => false, 'mensaje' => $m], $x), $c); }
function leerJson($f) { if (!is_readable($f)) return []; $t = file_get_contents($f); $d = json_decode($t, true); return is_array($d) ? $d : []; }

function listaCompleta($semillaIdx, $indice) {
    $out = [];
    $sem = leerJson($semillaIdx);
    if (isset($sem['plantillas'])) foreach ($sem['plantillas'] as $p) {
        $p['origen'] = 'semilla';
        $p['descargaUrl'] = 'formatos-plantillas/' . rawurlencode($p['archivo']);
        $out[] = $p;
    }
    $srv = leerJson($indice);
    foreach ($srv as $p) {
        $p['origen'] = 'cargada';
        $p['descargaUrl'] = 'api/plantillas.php?descargar=' . rawurlencode($p['id']);
        $out[] = $p;
    }
    return $out;
}

/* ---------------- descarga de una plantilla cargada ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['descargar'])) {
    $id = (string) $_GET['descargar'];
    foreach (leerJson($indice) as $p) {
        if ($p['id'] === $id) {
            $ruta = $carpetaFich . '/' . $p['archivo'];
            if (!is_readable($ruta)) jfail('El archivo de la plantilla no está en el servidor.', 404);
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . basename($p['archivo']) . '"');
            header('Content-Length: ' . filesize($ruta));
            readfile($ruta); exit;
        }
    }
    jfail('No se encontró esa plantilla.', 404);
}

/* ---------------- lista pública ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jout(['ok' => true, 'plantillas' => listaCompleta($semillaIdx, $indice),
          'exigeClave' => (bool) $cfg['exigirClave'], 'escribible' => is_writable($carpeta)]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jfail('Método no permitido.', 405);

/* ---------------- carga / borrado (pide contraseña) ---------------- */
$cuerpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($cuerpo)) jfail('No se recibieron datos válidos.');
if (!empty($cfg['exigirClave'])) {
    $clave = isset($cuerpo['clave']) ? (string) $cuerpo['clave'] : '';
    $ok = !empty($cfg['claveHash']) ? password_verify($clave, (string) $cfg['claveHash'])
        : (isset($cfg['clave']) && hash_equals((string) $cfg['clave'], $clave));
    if (!$ok) jfail('La contraseña no es correcta.', 401, ['claveInvalida' => true]);
}
if (!is_dir($carpetaFich)) @mkdir($carpetaFich, 0755, true);
if (!is_writable($carpeta) || !is_dir($carpetaFich)) jfail('La carpeta datos-servidor/plantillas no tiene permiso de escritura.', 500);

$accion = isset($cuerpo['accion']) ? $cuerpo['accion'] : 'guardar';
$idx = leerJson($indice);

if ($accion === 'borrar') {
    $id = isset($cuerpo['id']) ? (string) $cuerpo['id'] : '';
    $nuevo = [];
    foreach ($idx as $p) {
        if ($p['id'] === $id) { @unlink($carpetaFich . '/' . $p['archivo']); continue; }
        $nuevo[] = $p;
    }
    file_put_contents($indice, json_encode($nuevo, JSON_UNESCAPED_UNICODE), LOCK_EX);
    jout(['ok' => true, 'mensaje' => 'Plantilla eliminada.', 'plantillas' => listaCompleta($semillaIdx, $indice)]);
}

// guardar
$titulo = trim((string) ($cuerpo['titulo'] ?? ''));
$desc   = trim((string) ($cuerpo['descripcion'] ?? ''));
$autor  = trim((string) ($cuerpo['autor'] ?? ''));
$nombre = trim((string) ($cuerpo['archivoNombre'] ?? ''));
$b64    = (string) ($cuerpo['archivoBase64'] ?? '');
if ($titulo === '' || $nombre === '' || $b64 === '') jfail('Faltan datos: título y archivo.');
if (mb_strlen($desc, 'UTF-8') < 10) jfail('La descripción es obligatoria y debe tener al menos 10 caracteres. El archivo fue descartado.');
if ($autor === '') jfail('Escriba quién carga la plantilla.');

$ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
if (!in_array($ext, $GLOBALS['EXT_OK'], true)) jfail('Tipo de archivo no permitido. Use Excel (.xlsx, .xls, .csv, .ods), Word (.docx) o PDF.');

if (strpos($b64, ',') !== false) $b64 = substr($b64, strpos($b64, ',') + 1);
$bin = base64_decode($b64, true);
if ($bin === false) jfail('El archivo llegó dañado.');
if (strlen($bin) > $GLOBALS['MAX']) jfail('El archivo pesa más de 8 MB.');

// nombre seguro y único
$baseSeguro = preg_replace('/[^A-Za-z0-9._-]+/', '-', $nombre);
$baseSeguro = trim($baseSeguro, '-._'); if ($baseSeguro === '') $baseSeguro = 'plantilla.' . $ext;
$destino = $baseSeguro; $i = 1;
while (is_file($carpetaFich . '/' . $destino)) { $destino = pathinfo($baseSeguro, PATHINFO_FILENAME) . '-' . $i . '.' . $ext; $i++; }
if (file_put_contents($carpetaFich . '/' . $destino, $bin, LOCK_EX) === false) jfail('No se pudo guardar el archivo.', 500);

$id = 'u' . substr(md5($destino . microtime()), 0, 10);
$idx[] = ['id' => $id, 'archivo' => $destino, 'titulo' => $titulo, 'descripcion' => $desc,
          'autor' => $autor, 'fecha' => date('Y-m-d'), 'tamano' => strlen($bin)];
$indiceGuardado = file_put_contents($indice, json_encode($idx, JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($indiceGuardado === false) {
    @unlink($carpetaFich . '/' . $destino);
    jfail('No se pudo guardar la descripción; por seguridad, el archivo fue descartado.', 500);
}
jout(['ok' => true, 'mensaje' => 'Plantilla cargada y disponible para todos.', 'plantillas' => listaCompleta($semillaIdx, $indice)]);
