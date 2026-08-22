<?php
/*
 * revelaciones.php — guardado COMPARTIDO de:
 *   · motivos de merma (por si en la realidad pasa algo que no se había previsto)
 *   · notas para las revelaciones (explicaciones que acompañan a las cifras)
 *
 *   GET  api/revelaciones.php            -> devuelve { motivos:[…], notas:[…] }
 *   POST api/revelaciones.php  (JSON)    -> { "clave":"…", "motivos":[…], "notas":[…] }  (pide contraseña)
 * Se guarda en datos-servidor/revelaciones.json.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
$cfg = require __DIR__ . '/config.php';
$carpeta = $cfg['carpetaDatos'];
$archivo = $carpeta . '/revelaciones.json';

function rout($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function rfail($m, $c = 400, $x = []) { rout(array_merge(['ok' => false, 'mensaje' => $m], $x), $c); }

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $d = is_readable($archivo) ? json_decode(file_get_contents($archivo), true) : null;
    if (!is_array($d)) $d = ['motivos' => [], 'notas' => []];
    rout(['ok' => true, 'motivos' => $d['motivos'] ?? [], 'notas' => $d['notas'] ?? [],
          'exigeClave' => (bool) $cfg['exigirClave'], 'escribible' => is_writable($carpeta)]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') rfail('Método no permitido.', 405);

$cuerpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($cuerpo)) rfail('No se recibieron datos válidos.');
if (!empty($cfg['exigirClave'])) {
    $clave = isset($cuerpo['clave']) ? (string) $cuerpo['clave'] : '';
    $ok = !empty($cfg['claveHash']) ? password_verify($clave, (string) $cfg['claveHash'])
        : (isset($cfg['clave']) && hash_equals((string) $cfg['clave'], $clave));
    if (!$ok) rfail('La contraseña no es correcta.', 401, ['claveInvalida' => true]);
}
if (!is_dir($carpeta)) @mkdir($carpeta, 0755, true);
if (!is_writable($carpeta)) rfail('La carpeta datos-servidor no tiene permiso de escritura.', 500);

$motivos = isset($cuerpo['motivos']) && is_array($cuerpo['motivos']) ? array_values($cuerpo['motivos']) : [];
$notas   = isset($cuerpo['notas']) && is_array($cuerpo['notas']) ? array_values($cuerpo['notas']) : [];
// límites de sanidad
$motivos = array_slice($motivos, 0, 100);
$notas   = array_slice($notas, 0, 500);
file_put_contents($archivo, json_encode(['motivos' => $motivos, 'notas' => $notas, '_actualizado' => date('c')], JSON_UNESCAPED_UNICODE), LOCK_EX);
rout(['ok' => true, 'mensaje' => 'Guardado.', 'motivos' => $motivos, 'notas' => $notas]);
