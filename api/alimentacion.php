<?php
/*
 * alimentacion.php — trae el registro diario de alimentacion desde la hoja de
 * calculo de Google y lo deja guardado en el servidor.
 *
 *   GET  api/alimentacion.php                -> devuelve lo ultimo guardado (publico)
 *   POST api/alimentacion.php  {"clave":"…"} -> CONSULTA la hoja y actualiza (pide contrasena)
 *
 * La hoja debe estar compartida como "cualquier persona con el enlace puede ver".
 * Encabezados esperados en la fila 1:  Fecha | Proyecto | Kilos | Subproyecto_Unidad
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$cfg = require __DIR__ . '/config.php';

/* Identificador y pestaña de la hoja de calculo. Si algun dia cambia la hoja,
   esto es lo unico que hay que tocar. */
$HOJA_ID  = '1EiafwyOEXZ3ZjIEpjjVXI9FckBylDdJqIivk_NtKnu0';
$HOJA_GID = '1902869706';
$URL_CSV  = isset($cfg['urlCsvAlimentacion']) && $cfg['urlCsvAlimentacion']
    ? $cfg['urlCsvAlimentacion']
    : "https://docs.google.com/spreadsheets/d/$HOJA_ID/export?format=csv&gid=$HOJA_GID";

$carpeta = $cfg['carpetaDatos'];
$archivo = $carpeta . '/suministros.json';

function responder($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fallo($m, $c = 400, $x = []) { responder(array_merge(['ok' => false, 'mensaje' => $m], $x), $c); }

/* ---------------- normalizacion (misma que tools/importar_alimentacion.py) --------- */
function sinTildes($s) {
    $de = ['á','é','í','ó','ú','Á','É','Í','Ó','Ú','ñ','Ñ','ü','Ü'];
    $a  = ['a','e','i','o','u','A','E','I','O','U','n','N','u','U'];
    return str_replace($de, $a, $s);
}
function codigoProyecto($nombre) {
    $mapa = [
        'CERDOS' => 'CERDOS', 'PORCICOLA' => 'CERDOS',
        'CODORNICES' => 'CODORNICES', 'CONEJOS' => 'CONEJOS',
        'GALLINAS' => 'GALLINAS_PONEDORAS', 'GALLINAS PONEDORAS' => 'GALLINAS_PONEDORAS',
        'OVINOS' => 'OVINOS', 'OVEJOS' => 'OVINOS', 'POLLOS' => 'POLLOS',
        'PISCICOLA' => 'PISCICOLA', 'PECES' => 'PISCICOLA',
        'GANADO BOVINO' => 'GANADO_BOVINO', 'BOVINOS' => 'GANADO_BOVINO',
    ];
    $c = preg_replace('/\s+/', ' ', trim(strtoupper(sinTildes($nombre))));
    return isset($mapa[$c]) ? $mapa[$c] : null;
}
function aFecha($v) {
    $v = trim($v);
    foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'd/m/y'] as $f) {
        $d = DateTime::createFromFormat($f, $v);
        if ($d && $d->format($f) === $v) return $d->format('Y-m-d');
    }
    return null;
}
function aKilos($v) {
    $v = trim($v);
    if ($v === '') return null;
    if (strpos($v, ',') !== false) $v = str_replace(['.', ','], ['', '.'], $v);
    return is_numeric($v) ? (float) $v : null;
}

/* ---------------- lectura publica ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_readable($archivo)) {
        responder(['ok' => true, 'hayDatos' => false,
                   'mensaje' => 'Todavia no se ha consultado la hoja: el sitio esta usando el registro incluido en data/suministros.js.']);
    }
    $d = json_decode(file_get_contents($archivo), true);
    responder(['ok' => true, 'hayDatos' => true] + (is_array($d) ? $d : []));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fallo('Metodo no permitido.', 405);

/* ---------------- actualizacion (pide contrasena) ---------------- */
$cuerpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($cuerpo)) $cuerpo = [];
if (!empty($cfg['exigirClave'])) {
    $clave = isset($cuerpo['clave']) ? (string) $cuerpo['clave'] : '';
    $ok = !empty($cfg['claveHash'])
        ? password_verify($clave, (string) $cfg['claveHash'])
        : (isset($cfg['clave']) && hash_equals((string) $cfg['clave'], $clave));
    if (!$ok) fallo('La contrasena no es correcta.', 401, ['claveInvalida' => true]);
}
if (!is_dir($carpeta)) @mkdir($carpeta, 0755, true);
if (!is_writable($carpeta)) fallo('La carpeta datos-servidor no tiene permiso de escritura.', 500);

/* --- traer el CSV --- */
$csv = null; $motivo = '';
if (function_exists('curl_init')) {
    $ch = curl_init($URL_CSV);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_USERAGENT => 'GranjaSanJose/1.0',
    ]);
    $csv = curl_exec($ch);
    if ($csv === false) { $motivo = curl_error($ch); $csv = null; }
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($csv !== null && $http >= 400) { $motivo = 'el servidor de Google respondio ' . $http; $csv = null; }
} 
if ($csv === null && ini_get('allow_url_fopen')) {
    $ctx = stream_context_create(['http' => ['timeout' => 25, 'follow_location' => 1]]);
    $csv = @file_get_contents($URL_CSV, false, $ctx);
    if ($csv === false) { $csv = null; $motivo = $motivo ?: 'no se pudo abrir la direccion'; }
}
if ($csv === null || trim($csv) === '') {
    fallo('No se pudo leer la hoja de calculo. ' . ($motivo ? "Detalle: $motivo. " : '') .
          'Compruebe que la hoja este compartida como "cualquier persona con el enlace puede ver".', 502);
}
if (stripos($csv, '<html') !== false) {
    fallo('Google devolvio una pagina web en vez de los datos: casi seguro la hoja NO esta compartida publicamente. '
        . 'Abrala, pulse Compartir y elija "cualquier persona con el enlace - Lector".', 502);
}

/* --- interpretar el CSV --- */
$lineas = preg_split("/\r\n|\n|\r/", trim($csv));
$cab = str_getcsv(array_shift($lineas));
$cab = array_map(function ($c) { return strtolower(trim(sinTildes($c))); }, $cab);
$col = function ($nombres) use ($cab) {
    foreach ($nombres as $n) { $i = array_search($n, $cab, true); if ($i !== false) return $i; }
    return null;
};
$iF = $col(['fecha']); $iP = $col(['proyecto']); $iK = $col(['kilos', 'kg']);
$iS = $col(['subproyecto_unidad', 'subproyecto', 'unidad']);
if ($iF === null || $iP === null || $iK === null) {
    fallo('La hoja no tiene los encabezados esperados en la fila 1: Fecha, Proyecto, Kilos, Subproyecto_Unidad.', 422,
          ['encabezadosLeidos' => $cab]);
}

$registros = []; $rechazadas = 0;
foreach ($lineas as $linea) {
    if (trim($linea) === '') continue;
    $c = str_getcsv($linea);
    $f = isset($c[$iF]) ? aFecha($c[$iF]) : null;
    $p = isset($c[$iP]) ? codigoProyecto($c[$iP]) : null;
    $k = isset($c[$iK]) ? aKilos($c[$iK]) : null;
    if ($f === null || $p === null || $k === null) { $rechazadas++; continue; }
    $registros[] = ['fecha' => $f, 'proyecto' => $p, 'kg' => round($k, 3),
                    'subproyecto' => $iS !== null && isset($c[$iS]) ? strtoupper(trim($c[$iS])) : 'GENERAL'];
}
if (!count($registros)) {
    fallo('La hoja se leyo pero no tenia ninguna fila valida. No se toco lo que ya estaba guardado.', 422,
          ['filasRechazadas' => $rechazadas]);
}

usort($registros, function ($a, $b) {
    return [$a['fecha'], $a['proyecto'], $a['subproyecto']] <=> [$b['fecha'], $b['proyecto'], $b['subproyecto']];
});
$fechas = array_column($registros, 'fecha');
$totales = [];
foreach ($registros as $r) {
    if (!isset($totales[$r['proyecto']])) $totales[$r['proyecto']] = 0;
    $totales[$r['proyecto']] += $r['kg'];
}

$salida = [
    'fuente' => 'Hoja de calculo de alimentacion (consultada por el sitio)',
    'urlHoja' => "https://docs.google.com/spreadsheets/d/$HOJA_ID/edit?gid=$HOJA_GID",
    'bultoKg' => 40,
    'periodo' => ['desde' => min($fechas), 'hasta' => max($fechas)],
    'generado' => date('c'),
    'totalesKg' => $totales,
    'filasRechazadas' => $rechazadas,
    'registros' => $registros,
];
file_put_contents($archivo, json_encode($salida, JSON_UNESCAPED_UNICODE), LOCK_EX);

responder(['ok' => true, 'hayDatos' => true,
           'mensaje' => 'Hoja consultada: ' . count($registros) . ' registros del ' . min($fechas) . ' al ' . max($fechas)
                      . ($rechazadas ? " (se descartaron $rechazadas filas incompletas)" : '') . '.'] + $salida);
