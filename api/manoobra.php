<?php
/*
 * manoobra.php — guardado COMPARTIDO de los parámetros de mano de obra.
 *   GET  api/manoobra.php            -> devuelve lo guardado (público)
 *   POST api/manoobra.php  (JSON)    -> guarda { "clave":"…", "datos":{…} }  (pide contraseña)
 * Los datos quedan en datos-servidor/manoobra.json.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
$cfg = require __DIR__ . '/config.php';

function responder($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fallo($m, $c = 400, $x = []) { responder(array_merge(['ok' => false, 'mensaje' => $m], $x), $c); }

$carpeta = $cfg['carpetaDatos'];
$archivo = $carpeta . '/manoobra.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_readable($archivo)) responder(['ok' => true, 'datos' => null, 'mensaje' => 'Sin valores guardados: se usan los de ejemplo.']);
    $d = json_decode(file_get_contents($archivo), true);
    responder(['ok' => true, 'datos' => is_array($d) ? $d : null, 'actualizado' => date('c', filemtime($archivo))]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fallo('Método no permitido.', 405);

$cuerpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($cuerpo)) fallo('No se recibieron datos válidos.');

if (!empty($cfg['exigirClave'])) {
    $clave = isset($cuerpo['clave']) ? (string) $cuerpo['clave'] : '';
    $ok = !empty($cfg['claveHash']) ? password_verify($clave, (string) $cfg['claveHash'])
        : (isset($cfg['clave']) && hash_equals((string) $cfg['clave'], $clave));
    if (!$ok) fallo('La contraseña no es correcta.', 401, ['claveInvalida' => true]);
}
if (!is_dir($carpeta)) @mkdir($carpeta, 0755, true);
if (!is_writable($carpeta)) fallo('La carpeta datos-servidor no tiene permiso de escritura.', 500);

$datos = isset($cuerpo['datos']) && is_array($cuerpo['datos']) ? $cuerpo['datos'] : null;
if ($datos === null) fallo('Faltan los datos a guardar.');
$datos['_actualizado'] = date('c');
file_put_contents($archivo, json_encode($datos, JSON_UNESCAPED_UNICODE), LOCK_EX);
responder(['ok' => true, 'mensaje' => 'Parámetros de mano de obra guardados.']);
