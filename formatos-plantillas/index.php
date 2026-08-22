<?php
// Redirige el acceso a la CARPETA /plantillas/ (con barra final) hacia la
// PAGINA interactiva real plantillas.html del directorio padre.
//
// IMPORTANTE: el destino es el ARCHIVO real "../plantillas.html", NO la URL
// limpia "/plantillas". Si redirigieramos a "/plantillas", Apache volveria a
// anadir la barra final al ser una carpeta real y entrariamos en un BUCLE.
header('Location: ../plantillas.html', true, 302);
exit;
