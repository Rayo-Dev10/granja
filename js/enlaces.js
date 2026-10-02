/* enlaces.js — compatibilidad de las direcciones "limpias" (sin .html).
 *
 * El sitio usa direcciones limpias: /proyectos, /diario, /controles…
 * En el hosting eso lo resuelve el archivo .htaccess.
 *
 * Este archivo es solo una RED DE SEGURIDAD para dos casos:
 *   1) Cuando el sitio se abre por doble clic desde el computador (file://),
 *      donde no hay servidor que traduzca las direcciones.
 *   2) Cuando el servidor no tiene activado mod_rewrite y las direcciones
 *      limpias devolverían "página no encontrada".
 * En ambos casos, al hacer clic se añade ".html" automáticamente y el sitio
 * navega igual. Si todo funciona bien, este archivo no hace absolutamente nada.
 */
(function () {
  'use strict';
  var CLAVE = 'granja.direccionesLimpias';
  var activado = false;

  function activar() {
    if (activado) return;
    activado = true;
    document.addEventListener('click', function (e) {
      var destino = e.target;
      var a = destino && destino.closest ? destino.closest('a[href]') : null;
      if (!a || a.hasAttribute('download')) return;
      if (typeof a.target === 'string' && a.target && a.target !== '_self') return;

      var href = a.getAttribute('href');
      if (!href) return;
      if (/^([a-z]+:|\/\/|#)/i.test(href)) return;          // externo, mailto, ancla…

      var partes = href.match(/^([^?#]*)([\s\S]*)$/);
      var ruta = partes[1], resto = partes[2];
      if (!ruta) return;                                     // solo ?query o #ancla
      if (ruta === './' || ruta === '.' || ruta === '/') ruta = 'index';
      if (/\.[a-z0-9]{2,5}$/i.test(ruta)) return;            // ya tiene extensión (.css, .svg, .pdf…)

      e.preventDefault();
      window.location.href = ruta + '.html' + resto;
    }, true);
  }

  // Caso 1: abierto por doble clic desde el computador.
  if (window.location.protocol === 'file:') { activar(); return; }

  // Caso 2: comprobar UNA sola vez si el servidor entiende las direcciones limpias.
  try {
    var guardado = sessionStorage.getItem(CLAVE);
    if (guardado === 'no') { activar(); return; }
    if (guardado === 'si') return;
  } catch (e) { /* sessionStorage bloqueado: se comprueba igual */ }

  // Se pide el archivo de sonda SIN extensión y se comprueba su contenido exacto.
  // (No basta con mirar el código 200: algunos servidores devuelven la portada
  //  para cualquier dirección desconocida, lo que daría un falso "sí funciona".)
  try {
    fetch('comprobacion-url', { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.text() : '';
    }).then(function (texto) {
      var funciona = texto.indexOf('URL-LIMPIA-OK') !== -1;
      try { sessionStorage.setItem(CLAVE, funciona ? 'si' : 'no'); } catch (e) {}
      if (!funciona) activar();
    })['catch'](function () { activar(); });
  } catch (e) { activar(); }
})();
