/* arranque.js — pone en marcha la página DESPUÉS de traer del servidor las
   correcciones guardadas, para que todas las cifras se dibujen ya corregidas.
   Se usa así:  <script src="js/arranque.js" data-modulo="js/diario.js"></script>
   Si el servidor no responde, la página se dibuja igual con los datos del corte. */
(function () {
  'use strict';
  var etiqueta = document.currentScript;
  var modulo = etiqueta ? etiqueta.getAttribute('data-modulo') : null;
  if (!modulo) return;

  function cargarModulo() {
    var s = document.createElement('script');
    s.src = modulo;
    document.body.appendChild(s);
  }

  if (window.GRANJA && typeof GRANJA.sincronizar === 'function') {
    var listo = false;
    var seguir = function () { if (!listo) { listo = true; cargarModulo(); } };
    // Si el servidor tardara demasiado, se dibuja igual a los 4 segundos.
    setTimeout(seguir, 4000);
    var tareas = [GRANJA.sincronizar()];
    if (typeof GRANJA.sincronizarAlimentacion === 'function' && window.DATA_SUMINISTROS) {
      tareas.push(GRANJA.sincronizarAlimentacion());
    }
    Promise.all(tareas).then(seguir, seguir);
  } else {
    cargarModulo();
  }
})();
