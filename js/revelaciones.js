/* revelaciones.js
   ─────────────────────────────────────────────────────────────────────────────
   PARTE 1 · MOTOR DE REVELACIONES (window.REVELACIONES)
     Una REVELACIÓN es una nota contable que explica una diferencia entre cifras.
     La conciliación de huevos es el ejemplo del director («produje 5.000 y vendí
     4.900»): PRODUCCIÓN − Vendido − Dañados − Autoconsumo − Donaciones ± Existencias
     = DIFERENCIA NO EXPLICADA. Los datos que la granja aún no lleva (autoconsumo,
     donaciones, existencias) se muestran como «sin registro»: eso es un hallazgo,
     no un defecto. Respeta el periodo activo (window.ESTADO).

   PARTE 2 · EDITOR de motivos de merma y notas (sección aislada en Controles).
     Se conserva intacto DEBAJO de las revelaciones globales. Se guarda en el
     servidor (api/revelaciones.php, pide contraseña). Si algo falla, no afecta al
     resto de la página de Controles.
   ───────────────────────────────────────────────────────────────────────────── */

/* ============================ PARTE 1 · MOTOR ============================ */
window.REVELACIONES = (function () {
  'use strict';

  var CODS_HUEVOS = ['GALLINAS_PONEDORAS', 'CODORNICES'];
  var NOMBRE = { GALLINAS_PONEDORAS: 'las gallinas ponedoras', CODORNICES: 'las codornices' };

  function G() { return window.GRANJA; }
  function AL() { return (window.COHERENCIA && window.COHERENCIA.ALIMENTO) ? window.COHERENCIA.ALIMENTO : null; }
  function num(v) { return G() ? G().num(v) : String(v); }
  function esc(v) { return G() ? G().esc(v) : String(v == null ? '' : v); }

  /* Periodo activo: el filtro global si existe; si no, todo el corte. */
  function periodoActivo() {
    if (window.ESTADO && typeof ESTADO.periodo === 'function') {
      var p = ESTADO.periodo();
      if (p && p.desde && p.hasta) return { desde: p.desde, hasta: p.hasta };
    }
    var corte = (window.DATA_CATALOGO && window.DATA_CATALOGO.corte) || '2026-07-31';
    return { desde: '2026-01-01', hasta: corte };
  }

  function pctTxt(p) {
    if (p == null) return '—';
    var v = Math.round(p * 1000) / 10; // un decimal
    return (Number.isInteger(v) ? v : v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + ' %';
  }

  /* Conciliación de huevos de un proyecto (GALLINAS_PONEDORAS | CODORNICES). */
  function conciliacionHuevos(cod) {
    var al = AL();
    if (!al) return null;
    var per = periodoActivo();
    var h = al.huevosEntre(cod, per.desde, per.hasta);
    var v = al.ventaHuevosEntre(cod, per.desde, per.hasta);
    var prod = h.unidades || 0;
    var danados = h.danados || 0;
    var vendido = v.huevos || 0;
    var residuo = prod - vendido - danados;      // >0 sobra sin explicar · <0 se vendió de más
    var pct = prod ? Math.abs(residuo) / prod : 0;
    var excede = residuo < 0;                     // vendido (+dañados) supera lo producido

    var nivel;
    if (excede) nivel = 'error';
    else if (pct <= 0.03) nivel = 'ok';
    else if (pct <= 0.10) nivel = 'alerta';
    else nivel = 'error';

    var lineas = [
      { etiqueta: 'Producción del periodo', valor: prod, sinRegistro: false },
      { etiqueta: '− Vendido (libro de caja · producto Huevos)', valor: vendido, sinRegistro: false },
      { etiqueta: '− Dañados / rotos (viene en producción)', valor: danados, sinRegistro: false },
      { etiqueta: '− Autoconsumo institucional', valor: null, sinRegistro: true },
      { etiqueta: '− Donaciones / muestras', valor: null, sinRegistro: true },
      { etiqueta: '± Variación de existencias', valor: null, sinRegistro: true },
      { etiqueta: '= Diferencia no explicada', valor: residuo, sinRegistro: false, esResiduo: true }
    ];

    var nom = NOMBRE[cod] || cod;
    var hecho = 'En ' + nom + ' se produjeron ' + num(prod) + ' huevos y se vendieron ' + num(vendido) +
      (danados ? ' (más ' + num(danados) + ' dañados)' : '') + ': la diferencia no explicada es de ' +
      num(Math.abs(residuo)) + ' huevos (' + pctTxt(pct) + ')' + (excede ? ', con las ventas por encima de lo producido' : '') + '.';

    var comoSeLee;
    if (excede) {
      comoSeLee = 'Se vendieron ' + num(-residuo) + ' huevos más de los que se recogieron en el periodo. No es necesariamente un error de digitación: lo más probable es que se hayan vendido existencias de periodos anteriores (huevos recogidos antes del tramo que se está viendo).';
    } else if (nivel === 'ok') {
      comoSeLee = 'La diferencia es pequeña (≤ 3 %): cabe dentro de la merma esperada del proceso (roturas menores, huevos usados en el momento). Las cuentas de huevos cuadran razonablemente.';
    } else if (nivel === 'alerta') {
      comoSeLee = 'La diferencia está entre el 3 % y el 10 %: conviene completar el registro para saber a dónde fueron esos ' + num(residuo) + ' huevos (autoconsumo del restaurante escolar, donaciones o existencias guardadas).';
    } else {
      comoSeLee = 'La diferencia supera el 10 %: hay algo que el registro no está captando. Faltan ' + num(residuo) + ' huevos por explicar y esa magnitud pide revisar cómo se anota la producción y la venta.';
    }

    var porQueNoCierra = 'La ecuación no cierra sola porque tres de sus líneas no tienen registro: la granja no lleva todavía el autoconsumo institucional (huevos que consume el propio colegio), ni las donaciones o muestras, ni la variación de existencias (huevos que quedan de un mes para otro). Mientras esos datos falten, cualquier huevo que salga por esas vías cae en la «diferencia no explicada».';

    var recomendacion = excede
      ? 'Anotar el inventario inicial de huevos de cada periodo (existencias que vienen de antes) para que la venta de esas existencias no aparezca como un descuadre.'
      : (nivel === 'ok'
        ? 'Mantener el registro como está; opcionalmente anotar el autoconsumo para dejar la diferencia en cero.'
        : 'Empezar a registrar el autoconsumo institucional, las donaciones y las existencias de fin de mes: son las tres líneas «sin registro» que hoy impiden que la cuenta cierre.');

    return {
      id: 'huevos-' + cod,
      cod: cod,
      titulo: 'Conciliación de huevos · ' + ((G() && G().proyecto(cod)) ? G().proyecto(cod).nombre : cod),
      hecho: hecho,
      lineas: lineas,
      prod: prod, vendido: vendido, danados: danados,
      residuo: residuo, pct: pct, nivel: nivel,
      comoSeLee: comoSeLee,
      porQueNoCierra: porQueNoCierra,
      recomendacion: recomendacion
    };
  }

  /* Revelaciones de un proyecto para el periodo activo. */
  function deProyecto(cod) {
    var out = [];
    if (CODS_HUEVOS.indexOf(cod) >= 0) {
      var r = conciliacionHuevos(cod);
      if (r) out.push(r);
    }
    return out;
  }

  /* Revelaciones de toda la granja. */
  function globales() {
    var out = [];
    for (var i = 0; i < CODS_HUEVOS.length; i++) {
      var r = conciliacionHuevos(CODS_HUEVOS[i]);
      if (r) out.push(r);
    }
    return out;
  }

  var CHIP = { ok: 'chip-ok', alerta: 'chip-alerta', error: 'chip-error' };
  var ICONO = { ok: '✔', alerta: '⚠', error: '✖' };
  var TEXTO_NIVEL = { ok: 'merma esperada', alerta: 'completar el registro', error: 'el registro no lo capta' };
  var VALCLASE = { ok: 'text-success-700', alerta: 'text-warning-700', error: 'text-danger-700' };

  /* HTML de UNA revelación. */
  function render(rev) {
    if (!rev) return '';
    var g = G();
    var cab = (g && g.cuadroControl) ? g.cuadroControl({
      icono: '📄', titulo: rev.titulo,
      queVes: 'una nota que explica, línea por línea, por qué la producción de huevos no coincide exactamente con lo vendido en el periodo.',
      deDondeSale: 'producción diaria + libro de caja (producto Huevos); las líneas «sin registro» son datos que la granja no lleva todavía',
      estado: { tipo: rev.nivel, icono: ICONO[rev.nivel], texto: TEXTO_NIVEL[rev.nivel] },
      ayudaHtml: '<p>Una <strong>revelación</strong> explica una diferencia entre cifras. Aquí: de los huevos producidos se restan los vendidos y los dañados; lo que queda sin explicar es la <em>diferencia no explicada</em>. Cuando un dato no se registra (autoconsumo, donaciones, existencias) se escribe «sin registro» — eso es un hallazgo, no un defecto.</p>'
    }) : ('<h3>' + esc(rev.titulo) + '</h3>');

    var filas = rev.lineas.map(function (l) {
      var val;
      if (l.sinRegistro) {
        val = '<span class="text-neutral-400 italic">sin registro</span>';
      } else if (l.esResiduo) {
        val = '<strong class="money ' + (VALCLASE[rev.nivel] || '') + '">' + num(l.valor) + '</strong>';
      } else {
        val = '<span class="money">' + num(l.valor) + '</span>';
      }
      var cls = l.esResiduo ? ' class="border-t-2 border-neutral-300 font-semibold"' : (l.sinRegistro ? ' class="text-neutral-500"' : '');
      var pctCell = l.esResiduo ? ('<td class="money ' + (VALCLASE[rev.nivel] || '') + '">' + pctTxt(rev.pct) + '</td>') : '<td></td>';
      return '<tr' + cls + '><td>' + esc(l.etiqueta) + '</td><td class="text-right">' + val + '</td>' + pctCell + '</tr>';
    }).join('');

    var tabla = '<div class="overflow-x-auto"><table>' +
      '<caption class="sr-only">Descomposición de la conciliación</caption>' +
      '<thead><tr><th scope="col">Concepto</th><th scope="col" class="text-right">Huevos</th><th scope="col" class="text-right">% sobre producción</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table></div>';

    var alertaCls = rev.nivel === 'ok' ? 'alerta-verde' : (rev.nivel === 'alerta' ? 'alerta-amarilla' : 'alerta-roja');

    return cab + '<div class="cuadro-cuerpo">' +
      '<p class="mb-3"><strong>El hecho:</strong> ' + esc(rev.hecho) + '</p>' +
      tabla +
      '<div class="' + alertaCls + ' mt-4"><p><strong>Cómo se lee:</strong> ' + esc(rev.comoSeLee) + '</p></div>' +
      '<p class="text-sm text-neutral-700 mt-3"><strong>Por qué no cierra:</strong> ' + esc(rev.porQueNoCierra) + '</p>' +
      '<p class="text-sm text-neutral-700 mt-2"><strong>Qué se recomienda:</strong> ' + esc(rev.recomendacion) + '</p>' +
      '</div>';
  }

  return { deProyecto: deProyecto, globales: globales, render: render, periodoActivo: periodoActivo };
})();

/* ============================ PARTE 2 · EDITOR ============================ */
/* Sección aislada en Controles para llevar, de forma sencilla:
   · motivos de merma (por si en la realidad ocurre algo no previsto)
   · notas que sirven de revelación (explican una diferencia entre cifras)
   Se guarda en el servidor (api/revelaciones.php, pide contraseña). Es autónomo:
   si algo falla, no afecta al resto de la página de Controles. */
(function () {
  'use strict';
  try {
    var cont = document.getElementById('seccion-revelaciones');
    if (!cont) return;
    var G = window.GRANJA;
    var MOTIVOS_DEFECTO = ['Vendido', 'Dañado / roto', 'Autoconsumo institucional', 'Donación / muestra', 'Variación de existencias'];
    var estado = { motivos: MOTIVOS_DEFECTO.slice(), notas: [], sinServidor: false, escribible: true };

    function esc(s) { return G ? G.esc(s) : String(s == null ? '' : s); }

    function cargar() {
      if (location.protocol === 'file:') { estado.sinServidor = true; return render(); }
      fetch('api/revelaciones.php', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.ok) {
            if (d.motivos && d.motivos.length) estado.motivos = d.motivos;
            estado.notas = d.notas || [];
            estado.escribible = d.escribible !== false;
          }
        })['catch'](function () { estado.sinServidor = true; })
        .finally(render);
    }

    function guardar(cb) {
      if (estado.sinServidor) { if (cb) cb(false, 'Sin servidor: se guardó solo en esta pantalla.'); return; }
      var clave = (G && G.claveEdicion) ? G.claveEdicion() : '';
      if (!clave) { clave = window.prompt('Escriba la contraseña para guardar:'); if (clave == null) { if (cb) cb(false, 'Cancelado.'); return; } if (G && G.recordarClave) G.recordarClave(clave, false); }
      fetch('api/revelaciones.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: clave, motivos: estado.motivos, notas: estado.notas }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) { estado.motivos = d.motivos; estado.notas = d.notas; if (cb) cb(true, 'Guardado en el servidor.'); }
          else if (d && d.claveInvalida) { if (cb) cb(false, 'Contraseña incorrecta.'); }
          else { if (cb) cb(false, (d && d.mensaje) || 'No se pudo guardar.'); }
        })['catch'](function () { if (cb) cb(false, 'Sin conexión con el servidor.'); });
    }

    /* Revelaciones automáticas de toda la granja, encima del editor. */
    function revelacionesGlobalesHtml() {
      try {
        if (!window.REVELACIONES) return '';
        var revs = REVELACIONES.globales();
        if (!revs || !revs.length) return '';
        var cuerpo = revs.map(function (r) { return '<div class="mb-8">' + REVELACIONES.render(r) + '</div>'; }).join('');
        return '<section aria-label="Revelaciones automáticas" class="mb-10">' +
          '<h2 class="!mb-1">📄 Revelaciones</h2>' +
          '<p class="text-neutral-600 text-sm mb-4 max-w-3xl">Notas contables que explican, cifra por cifra, por qué la producción de huevos no coincide con lo vendido. Cambian con el periodo elegido arriba.</p>' +
          cuerpo + '</section>';
      } catch (e) { return ''; }
    }

    function render() {
      var cab = (G && G.cuadroControl) ? G.cuadroControl({
        icono: '📄', titulo: 'Motivos de merma y notas de revelación',
        queVes: 'los motivos por los que la producción no siempre coincide con la venta (merma) y las notas que explican, en palabras, una diferencia entre cifras. Puede añadir los que hagan falta.',
        deDondeSale: 'lo que registre aquí (se guarda en el servidor; pide contraseña para guardar)',
        corte: 'editable en cualquier momento',
        estado: estado.sinServidor ? { tipo: 'alerta', icono: '📴', texto: 'sin servidor: los cambios no se guardan' } : { tipo: 'info', icono: '✏️', texto: 'añada motivos y notas con el botón +' },
        ayudaHtml: '<p>Una <strong>revelación</strong> es una nota que acompaña a una cifra para explicarla. Por ejemplo: «en julio se recogieron 5.000 huevos y se vendieron 4.900; la diferencia se explica por autoconsumo del restaurante escolar».</p><p class="mt-1">Los <strong>motivos de merma</strong> son las razones por las que algo producido no se vendió. Deje la lista lista para cuando aparezca un caso nuevo.</p>'
      }) : '<h2>Motivos de merma y notas de revelación</h2>';

      var chips = estado.motivos.map(function (m, i) {
        return '<span class="chip-neutro">' + esc(m) + ' <button type="button" class="rev-delmot ml-1 text-danger-700" data-i="' + i + '" title="Quitar" aria-label="Quitar">✕</button></span>';
      }).join(' ');

      var notasHtml = estado.notas.length ? estado.notas.map(function (n, i) {
        return '<tr><td class="whitespace-nowrap">' + esc(n.fecha || '') + '</td>' +
          '<td>' + esc(n.proyecto || '—') + '</td>' +
          '<td class="text-neutral-700">' + esc(n.texto || '') + '</td>' +
          '<td>' + esc(n.autor || '') + '</td>' +
          '<td><button type="button" class="btn-sec !px-2 !py-1 text-xs rev-delnota" data-i="' + i + '">🗑️</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="text-center text-neutral-500 py-4">Aún no hay notas de revelación. Añada la primera abajo.</td></tr>';

      cont.innerHTML = revelacionesGlobalesHtml() + cab + '<div class="cuadro-cuerpo">' +
        '<h3 class="!text-base mb-2">Motivos de merma</h3>' +
        '<div class="flex flex-wrap items-center gap-2 mb-2">' + (chips || '<span class="text-neutral-500 text-sm">Sin motivos.</span>') + '</div>' +
        '<div class="flex flex-wrap gap-2 items-end mb-6">' +
          '<label class="text-sm">Nuevo motivo<input id="rev-motivo" type="text" maxlength="60" class="mt-1 block border border-neutral-300 rounded-lg px-2 py-1.5" placeholder="Ej.: consumo del restaurante escolar"></label>' +
          '<button type="button" id="rev-addmot" class="btn-sec text-sm">➕ Añadir motivo</button>' +
          '<span id="rev-estmot" class="text-sm text-neutral-500"></span>' +
        '</div>' +
        '<h3 class="!text-base mb-2">Notas de revelación</h3>' +
        '<div class="overflow-x-auto"><table><caption class="sr-only">Notas de revelación</caption>' +
          '<thead><tr><th scope="col">Fecha</th><th scope="col">Proyecto</th><th scope="col">Nota</th><th scope="col">Quién</th><th scope="col"></th></tr></thead>' +
          '<tbody>' + notasHtml + '</tbody></table></div>' +
        '<div class="grid gap-2 sm:grid-cols-4 items-end mt-3">' +
          '<label class="text-sm">Proyecto (opcional)<select id="rev-nproy" class="mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5 bg-white"><option value="">(general)</option>' +
            ((G && G.proyectos) ? G.proyectos().map(function (p) { return '<option value="' + esc(p.nombre) + '">' + esc(p.nombre) + '</option>'; }).join('') : '') + '</select></label>' +
          '<label class="text-sm sm:col-span-2">Nota (la explicación)<input id="rev-ntexto" type="text" maxlength="240" class="mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5" placeholder="Ej.: la diferencia de 100 huevos se explica por autoconsumo interno"></label>' +
          '<label class="text-sm">Quién<input id="rev-nautor" type="text" maxlength="40" class="mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5" value="' + ((G && G.autor) ? esc(G.autor()) : '') + '"></label>' +
        '</div>' +
        '<div class="mt-2"><button type="button" id="rev-addnota" class="btn-sec text-sm">➕ Añadir nota</button> <span id="rev-estnota" class="text-sm text-neutral-500"></span></div>' +
        (estado.sinServidor ? '<p class="alerta-azul mt-3 text-sm">📴 Está sin servidor: puede probar el formulario, pero para guardar los cambios abra el sitio publicado.</p>' : '') +
      '</div>';

      conectar();
    }

    function hoy() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }

    function conectar() {
      var addMot = document.getElementById('rev-addmot');
      if (addMot) addMot.addEventListener('click', function () {
        var v = (document.getElementById('rev-motivo').value || '').trim();
        if (!v) return;
        estado.motivos.push(v);
        guardar(function (ok, msg) { var e = document.getElementById('rev-estmot'); render(); var e2 = document.getElementById('rev-estmot'); if (e2) e2.textContent = msg || ''; });
      });
      document.querySelectorAll('.rev-delmot').forEach(function (b) {
        b.addEventListener('click', function () { estado.motivos.splice(+b.dataset.i, 1); guardar(function () { render(); }); });
      });
      var addNota = document.getElementById('rev-addnota');
      if (addNota) addNota.addEventListener('click', function () {
        var texto = (document.getElementById('rev-ntexto').value || '').trim();
        if (!texto) { var e = document.getElementById('rev-estnota'); if (e) e.textContent = 'Escriba la nota.'; return; }
        estado.notas.unshift({ fecha: hoy(), proyecto: document.getElementById('rev-nproy').value || '', texto: texto, autor: (document.getElementById('rev-nautor').value || '').trim() });
        if (G && G.recordarAutor) G.recordarAutor((document.getElementById('rev-nautor').value || '').trim());
        guardar(function (ok, msg) { render(); var e2 = document.getElementById('rev-estnota'); if (e2) e2.textContent = msg || ''; });
      });
      document.querySelectorAll('.rev-delnota').forEach(function (b) {
        b.addEventListener('click', function () { estado.notas.splice(+b.dataset.i, 1); guardar(function () { render(); }); });
      });
    }

    if (window.ESTADO && typeof ESTADO.alCambiar === 'function') {
      ESTADO.alCambiar(function () { try { render(); } catch (e) {} });
    }
    cargar();
  } catch (e) { /* no romper la página de controles pase lo que pase */ }
})();
