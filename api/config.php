<?php
/*
 * config.php — ajustes del guardado compartido de correcciones.
 *
 * QUÉ ES: cuando alguien (por ejemplo el director de pasantía) corrige un
 * movimiento en el Libro diario, el sitio le pide una CONTRASEÑA y, si es
 * correcta, guarda la corrección EN EL SERVIDOR, de modo que se vea desde
 * cualquier computador y cualquier navegador.
 *
 * CONSULTAR EL SITIO SIGUE SIENDO PÚBLICO Y SIN CONTRASEÑA. La contraseña
 * protege únicamente el GUARDADO, para que nadie de paso altere los libros
 * ni las correcciones.
 *
 * LA CONTRASEÑA NO SE GUARDA AQUÍ EN TEXTO PLANO: abajo hay solo su huella
 * criptográfica (bcrypt). A partir de esa huella no se puede reconstruir la
 * contraseña; el servidor solo puede comprobar si la que escribieron coincide.
 *
 * PARA CAMBIAR LA CONTRASEÑA:
 *   1. Genere la huella de la contraseña nueva. Puede hacerlo con el archivo
 *      tools/generar-clave.php que viene en el proyecto (se ejecuta en su
 *      computador, NO se sube al servidor):
 *          php tools/generar-clave.php "su-contraseña-nueva"
 *   2. Pegue la huella resultante en 'claveHash' y vuelva a subir este archivo.
 */
return [

  // Huella (bcrypt) de la contraseña de edición. La contraseña actual es la que
  // se le entregó al director de pasantía. No escriba aquí la contraseña en claro.
  'claveHash' => '$2y$12$/GZhqW.ZKbqs93fbziV/6.YrQjceZ4nOZpLShl3mkyKIGU/NGVsMe',

  // ¿Se exige la contraseña para guardar?
  //   true  = solo quien la tenga puede corregir   (RECOMENDADO)
  //   false = cualquier visitante podría corregir  (no recomendado en internet)
  'exigirClave' => true,

  // Carpeta donde se guardan los datos. Debe tener permiso de escritura (755 suele bastar).
  'carpetaDatos' => __DIR__ . '/../datos-servidor',

  // Tope de correcciones guardadas, como protección ante un uso indebido.
  'maximoCorrecciones' => 2000,

  // Solo para pruebas locales: si se deja vacio se usa la hoja de Google real.
  'urlCsvAlimentacion' => '',

  // Protección contra intentos a ciegas: nº máximo de contraseñas fallidas
  // desde una misma conexión dentro del periodo indicado.
  'intentosMaximos' => 10,
  'intentosPeriodoMinutos' => 15,
];
