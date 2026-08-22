<?php
/*
 * correcciones.php — guardado COMPARTIDO de las correcciones del Libro diario.
 *
 *   GET  api/correcciones.php            -> devuelve todas las correcciones guardadas
 *   POST api/correcciones.php  (JSON)    -> guarda o borra una corrección
 *        { "accion":"guardar", "clave":"…", "id":"M104",
 *          "proyecto":"CONEJOS", "producto":"…", "nota":"…", "autor":"Elkin" }
 *        { "accion":"borrar",  "clave":"…", "id":"M104" }
 *
 * Los datos quedan en datos-servidor/correcciones.json y TODO cambio se anota
 * además en datos-servidor/historial.jsonl (nunca se pierde nada).
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$cfg = require __DIR__ . '/config.php';

function responder($datos, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function error($mensaje, $codigo = 400, $extra = []) {
    responder(array_merge(['ok' => false, 'mensaje' => $mensaje], $extra), $codigo);
}

$carpeta = $cfg['carpetaDatos'];
$archivo = $carpeta . '/correcciones.json';
$historial = $carpeta . '/historial.jsonl';

/* ---------- preparar la carpeta de datos ---------- */
if (!is_dir($carpeta)) { @mkdir($carpeta, 0755, true); }
if (!is_dir($carpeta)) {
    error('No existe la carpeta de datos del servidor y no se pudo crear: ' . basename($carpeta) .
          '. Créela por FTP junto a la carpeta api y déle permiso de escritura.', 500);
}

function leerTodo($archivo) {
    if (!is_readable($archivo)) return [];
    $txt = file_get_contents($archivo);
    if ($txt === false || $txt === '') return [];
    $datos = json_decode($txt, true);
    return is_array($datos) ? $datos : [];
}

/* ============================ LECTURA ============================ */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $correcciones = leerTodo($archivo);
    responder([
        'ok' => true,
        'correcciones' => (object) $correcciones,
        'total' => count($correcciones),
        'actualizado' => is_file($archivo) ? date('c', filemtime($archivo)) : null,
        'exigeClave' => (bool) $cfg['exigirClave'],
        'escribible' => is_writable($carpeta),
    ]);
}

/* ============================ ESCRITURA ============================ */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error('Método no permitido. Use GET para leer o POST para guardar.', 405);
}

$cuerpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($cuerpo)) error('No se recibieron datos válidos.');

/* --- contraseña de edición (se compara contra la huella bcrypt) --- */
if (!empty($cfg['exigirClave'])) {
    $clave = isset($cuerpo['clave']) ? (string) $cuerpo['clave'] : '';
    $registroIntentos = $carpeta . '/intentos.json';
    $ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'), 0, 45);
    $ahora = time();
    $ventana = max(1, (int) ($cfg['intentosPeriodoMinutos'] ?? 15)) * 60;
    $tope = max(1, (int) ($cfg['intentosMaximos'] ?? 10));

    // fallos recientes de esta conexión
    $intentos = is_readable($registroIntentos) ? json_decode(file_get_contents($registroIntentos), true) : [];
    if (!is_array($intentos)) $intentos = [];
    foreach ($intentos as $k => $lista) {                       // limpiar lo viejo
        $intentos[$k] = array_values(array_filter((array) $lista, function ($t) use ($ahora, $ventana) {
            return ($ahora - (int) $t) < $ventana;
        }));
        if (!$intentos[$k]) unset($intentos[$k]);
    }
    if (isset($intentos[$ip]) && count($intentos[$ip]) >= $tope) {
        @file_put_contents($registroIntentos, json_encode($intentos), LOCK_EX);
        error('Demasiados intentos fallidos. Espere unos minutos antes de volver a intentarlo.', 429, ['claveInvalida' => true]);
    }

    $valida = !empty($cfg['claveHash'])
        ? password_verify($clave, (string) $cfg['claveHash'])
        : (isset($cfg['clave']) && hash_equals((string) $cfg['clave'], $clave)); // compatibilidad

    if (!$valida) {
        $intentos[$ip][] = $ahora;
        @file_put_contents($registroIntentos, json_encode($intentos), LOCK_EX);
        $quedan = max(0, $tope - count($intentos[$ip]));
        error('La contraseña no es correcta. Le quedan ' . $quedan . ' intento(s) antes de una pausa de seguridad.',
              401, ['claveInvalida' => true, 'intentosRestantes' => $quedan]);
    }

    unset($intentos[$ip]);                                       // acertó: se borra su historial de fallos
    @file_put_contents($registroIntentos, json_encode($intentos), LOCK_EX);
}

/* --- permisos de escritura --- */
if (!is_writable($carpeta)) {
    error('La carpeta datos-servidor no tiene permiso de escritura. En el administrador de archivos '
        . 'del hosting, déle permisos 755 (o 775) a la carpeta datos-servidor.', 500);
}

$accion = isset($cuerpo['accion']) ? $cuerpo['accion'] : 'guardar';
$id = isset($cuerpo['id']) ? trim((string) $cuerpo['id']) : '';
if (!preg_match('/^M[0-9]{1,6}$/', $id)) {
    error('El identificador del movimiento no tiene el formato esperado (ejemplo: M104).');
}

$limpiar = function ($v, $max) {
    $v = trim((string) $v);
    $v = str_replace(["\r", "\n", "\t"], ' ', $v);
    return mb_substr($v, 0, $max, 'UTF-8');
};

/* --- abrir con bloqueo para que dos personas no se pisen --- */
$fp = fopen($archivo, file_exists($archivo) ? 'r+' : 'w+');
if (!$fp) error('No se pudo abrir el archivo de correcciones para escribir.', 500);
flock($fp, LOCK_EX);
$txt = stream_get_contents($fp);
$correcciones = $txt ? json_decode($txt, true) : [];
if (!is_array($correcciones)) $correcciones = [];

if ($accion === 'borrar') {
    unset($correcciones[$id]);
    $registro = ['accion' => 'borrar', 'id' => $id];
} else {
    if (count($correcciones) >= (int) $cfg['maximoCorrecciones'] && !isset($correcciones[$id])) {
        flock($fp, LOCK_UN); fclose($fp);
        error('Se alcanzó el máximo de correcciones guardadas.', 429);
    }
    $nota = $limpiar(isset($cuerpo['nota']) ? $cuerpo['nota'] : '', 600);
    if ($nota === '') { flock($fp, LOCK_UN); fclose($fp); error('Escriba la explicación de por qué se corrige.'); }

    $registro = [
        'proyecto' => $limpiar(isset($cuerpo['proyecto']) ? $cuerpo['proyecto'] : '', 60) ?: null,
        'producto' => $limpiar(isset($cuerpo['producto']) ? $cuerpo['producto'] : '', 120) ?: null,
        'nota'     => $nota,
        'autor'    => $limpiar(isset($cuerpo['autor']) ? $cuerpo['autor'] : '', 80) ?: 'Anónimo',
        'fecha'    => date('Y-m-d'),
        'momento'  => date('c'),
        'origen'   => 'servidor',
    ];
    $correcciones[$id] = $registro;
    $registro['accion'] = 'guardar';
    $registro['id'] = $id;
}

/* --- escribir --- */
$nuevo = json_encode($correcciones, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
ftruncate($fp, 0);
rewind($fp);
$escrito = fwrite($fp, $nuevo);
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

if ($escrito === false) error('No se pudo escribir el archivo de correcciones.', 500);

/* --- historial: nunca se pierde nada --- */
@file_put_contents(
    $historial,
    json_encode($registro + ['ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)],
                JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX
);

responder([
    'ok' => true,
    'mensaje' => $accion === 'borrar'
        ? 'Corrección eliminada del servidor: ya no la verá nadie.'
        : 'Corrección guardada en el servidor: ahora la ve cualquier persona, desde cualquier computador.',
    'correcciones' => (object) $correcciones,
    'total' => count($correcciones),
]);
