/* arranque.js — pone en marcha la página DESPUÉS de traer del servidor las
   correcciones guardadas, para que todas las cifras se dibujen ya corregidas.
   Se usa así:  <script src="js/arranque.js" data-modulo="js/diario.js"></script>
   Si el servidor no responde, la página se dibuja igual con los datos del corte. */
(function () {
  'use strict';
  var VERSION = '20260831-5';
  var etiqueta = document.currentScript;
  var modulo = etiqueta ? etiqueta.getAttribute('data-modulo') : null;
  if (!modulo) return;

  function cargarModulo() {
    var s = document.createElement('script');
    s.src = modulo + (modulo.indexOf('?') === -1 ? '?v=' + VERSION : '&v=' + VERSION);
    s.onerror = function () { mostrarFallo('No fue posible cargar ' + modulo + '.'); };
    document.body.appendChild(s);
  }

  function mostrarFallo(detalle) {
    var esqueletos = document.querySelectorAll('.skeleton-shell');
    for (var i = 0; i < esqueletos.length; i++) {
      esqueletos[i].innerHTML = '<div class="alerta-roja"><strong>No se pudo completar la carga.</strong> ' +
        detalle + ' Recargue la página; si continúa, vuelva a subir todos los archivos del paquete.</div>';
      esqueletos[i].className = '';
    }
  }

  /* Un error del módulo ya no deja animaciones infinitas sin explicación. */
  window.addEventListener('error', function (e) {
    if (e && e.filename && /\/(js|data)\//.test(e.filename)) mostrarFallo('Se detectó un archivo incompatible o incompleto.');
  });
  setTimeout(function () {
    if (document.querySelector('.skeleton-shell')) mostrarFallo('El módulo tardó más de lo esperado.');
  }, 9000);

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
