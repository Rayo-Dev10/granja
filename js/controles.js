/* controles.js — página "🚦 Controles": semáforo general, controles globales,
   una sección por proyecto y las correcciones guardadas en este navegador. */
(function () {
  'use strict';
  const G = window.GRANJA, C = window.COHERENCIA;

  const ICONO_TEMA = { sanitario: '🩺', alimentacion: '🌾', produccion: '🥚', inventario: '🐾', trazabilidad: '🔎' };
  const ESTADO_CHIP = {
    ok: { tipo: 'ok', icono: '✔', texto: 'cuadra' },
    alerta: { tipo: 'alerta', icono: '⚠', texto: 'para revisar' },
    error: { tipo: 'error', icono: '✖', texto: 'no cuadra' },
    info: { tipo: 'info', icono: 'ℹ', texto: 'nota informativa' },
  };
  const CLASE_ALERTA = { ok: 'alerta-verde', alerta: 'alerta-amarilla', error: 'alerta-roja', info: 'alerta-azul' };

  /* Botón "?" general con la explicación de los niveles del semáforo. */
  document.getElementById('ayuda-niveles').innerHTML = G.ayuda('Qué significa cada color',
    `<p>Cada control termina en uno de cuatro niveles. El color NUNCA va solo: siempre lo acompañan un icono y una palabra.</p>
     <ul class="list-disc ml-4 mt-1 space-y-1">
       <li><span class="chip-ok">✔ cuadra</span> (verde): la cuenta revisada cierra bien.</li>
       <li><span class="chip-alerta">⚠ para revisar</span> (amarillo): falta información o hay un descuadre menor que conviene completar.</li>
       <li><span class="chip-error">✖ no cuadra</span> (rojo): hay un descuadre que exige revisión con el responsable.</li>
       <li><span class="chip-info">ℹ nota informativa</span> (azul): no es un problema; es algo que conviene saber (por ejemplo, un prorrateo o una corrección documentada).</li>
     </ul>`);

  function renderControl(c) {
    const est = ESTADO_CHIP[c.nivel];
    const idAccion = 'accion-' + String(c.id || c.titulo).replace(/[^A-Za-z0-9_-]+/g, '-');
    let cuerpo = `<div class="${CLASE_ALERTA[c.nivel]}"><p><strong>Hallazgo:</strong> ${G.esc(c.hallazgo)}</p></div>`;
    if (c.nivel === 'alerta' || c.nivel === 'error') {
      cuerpo += `<p class="mt-3"><a href="#${idAccion}" class="ctrl-que-hacer font-semibold" aria-controls="${idAccion}" aria-expanded="false">¿Qué hacer?</a></p>` +
        `<div id="${idAccion}" class="mt-2 alerta-azul" hidden><p><strong>Acciones recomendadas:</strong> ${G.esc(c.recomendacion)}</p></div>`;
    } else {
      cuerpo += `<p class="mt-2 text-sm text-neutral-600"><strong>Recomendación:</strong> ${G.esc(c.recomendacion)}</p>`;
    }
    if (c.detalleHtml) {
      cuerpo += `<details class="mt-3"><summary class="cursor-pointer text-sm font-medium text-primary-800">🔍 Ver el detalle, cifra por cifra</summary>
        <div class="mt-2 overflow-x-auto">${c.detalleHtml}</div></details>`;
    }
    if (c.nivel !== 'ok' && c.nivel !== 'info') {
      cuerpo += `<p class="mt-3"><a class="btn-sec text-sm" href="diario" title="Abre el Libro diario, donde cada movimiento tiene un botón ✏️ para anotar una corrección">✏️ Corregir en el Libro diario</a></p>`;
    }
    return G.cuadroControl({
      icono: ICONO_TEMA[c.tema] || '📋',
      titulo: c.titulo,
      queVes: c.queRevisa,
      deDondeSale: 'cálculo automático de este sitio sobre los datos del libro (nada se digitó a mano)',
      corte: '31 de julio de 2026',   // los controles SIEMPRE se evalúan sobre todo el corte, no sobre el tramo
      estado: { tipo: est.tipo, icono: est.icono, texto: est.texto },
      ayudaHtml: `<p>Este control se evalúa solo, cada vez que usted abre la página, con los datos publicados. <strong>Qué revisa:</strong> ${G.esc(c.queRevisa)}</p>`,
    }) + `<div class="cuadro-cuerpo">${cuerpo}</div>`;
  }

  /* Control propio de MANO DE OBRA: proyectos con actividad pero SIN dedicación de horas registrada. */
  function controlManoObra() {
    const MO = window.MANOOBRA;
    if (!MO) return '';
    const movs = G.movimientosEfectivos();
    const conActividad = G.proyectos().filter(p =>
      p.estado === 'Activo' || movs.some(m => m.proyecto === p.codigo));
    const conMO = conActividad.filter(p => MO.costoManoObraProyecto(p.codigo).hayDatos);
    const sinMO = conActividad.filter(p => !MO.costoManoObraProyecto(p.codigo).hayDatos);
    const costoHoraOp = Math.round(MO.costoHoraOperador());

    let nivel, hallazgo, recomendacion;
    if (!conActividad.length) {
      nivel = 'info'; hallazgo = 'no hay proyectos con actividad para evaluar.'; recomendacion = 'sin acción.';
    } else if (!conMO.length) {
      nivel = 'alerta';
      hallazgo = `ningún proyecto tiene dedicación de horas registrada: el costo de mano de obra no se está imputando. Hay ${G.num(conActividad.length)} proyecto(s) con actividad y ninguno tiene horas registradas. El costo por hora de referencia (operador de granja) es ${G.cop(costoHoraOp)}, pero sin horas no se puede repartir entre proyectos.`;
      recomendacion = 'empezar a llevar la hoja de dedicación de horas (Diana eligió porcentajes) e importarla. Mientras tanto, use la simulación en 👷 Mano de obra.';
    } else if (sinMO.length) {
      nivel = 'alerta';
      hallazgo = `${G.num(sinMO.length)} de ${G.num(conActividad.length)} proyecto(s) con actividad no tienen dedicación de horas registrada: ${sinMO.map(p => G.esc(p.nombre)).join(', ')}.`;
      recomendacion = 'completar la hoja de dedicación de horas para esos proyectos.';
    } else {
      nivel = 'ok';
      hallazgo = 'todos los proyectos con actividad tienen dedicación de horas registrada.';
      recomendacion = 'mantener el registro al día.';
    }

    const est = ESTADO_CHIP[nivel];
    let cuerpo = `<div class="${CLASE_ALERTA[nivel]}"><p><strong>Hallazgo:</strong> ${G.esc(hallazgo)}</p></div>`;
    if (nivel === 'alerta' || nivel === 'error') {
      cuerpo += `<p class="mt-3"><a href="#accion-mano-obra" class="ctrl-que-hacer font-semibold" aria-controls="accion-mano-obra" aria-expanded="false">¿Qué hacer?</a></p>` +
        `<div id="accion-mano-obra" class="mt-2 alerta-azul" hidden><p><strong>Acciones recomendadas:</strong> ${G.esc(recomendacion)}</p>` +
        `<p class="mt-2"><a class="btn-sec text-sm" href="mano-obra">👷 Ir a Mano de obra</a></p></div>`;
    } else {
      cuerpo += `<p class="mt-2 text-sm text-neutral-600"><strong>Recomendación:</strong> ${G.esc(recomendacion)}</p>`;
    }
    return G.cuadroControl({
      icono: '👷', titulo: 'Mano de obra imputada a los proyectos',
      queVes: 'si el trabajo de las personas se está repartiendo entre los proyectos. Sin ese registro, el costo de cada proyecto queda incompleto (falta el costo del tiempo humano).',
      deDondeSale: 'cálculo automático de este sitio: proyectos con actividad cruzados con la hoja de dedicación de horas de mano de obra',
      corte: '31 de julio de 2026',
      estado: { tipo: est.tipo, icono: est.icono, texto: est.texto },
      ayudaHtml: '<p>Este control avisa cuando hay proyectos activos o con movimientos de caja pero sin horas de trabajo registradas. El costo por hora sí es real (ley vigente a agosto de 2026); lo que falta es la dedicación de horas. No se inventa ningún dato.</p>',
    }) + `<div class="cuadro-cuerpo">${cuerpo}</div>`;
  }

  function render() {
    const controles = C.controles();
    const n = { ok: 0, alerta: 0, error: 0, info: 0 };
    for (const c of controles) n[c.nivel]++;

    /* ---- KPIs semáforo ---- */
    document.getElementById('seccion-kpis').innerHTML =
      `<div class="grid gap-4 sm:grid-cols-4 mb-8">
        <div class="kpi"><span class="titulo">🟢 En verde</span><span class="valor text-success-700">${G.num(n.ok)}</span><span class="lectura">controles que cuadran</span></div>
        <div class="kpi"><span class="titulo">🟡 En amarillo</span><span class="valor text-warning-700">${G.num(n.alerta)}</span><span class="lectura">falta información o descuadre menor</span></div>
        <div class="kpi"><span class="titulo">🔴 En rojo</span><span class="valor text-danger-700">${G.num(n.error)}</span><span class="lectura">descuadres que exigen revisión</span></div>
        <div class="kpi"><span class="titulo">🔵 Notas</span><span class="valor text-info-700">${G.num(n.info)}</span><span class="lectura">informativas, sin acción urgente</span></div>
      </div>`;

    var barra = document.createElement('div');
    barra.className = 'mb-6 no-imprimir';
    barra.innerHTML = '<button type="button" id="ctrl-excel" class="btn-sec text-sm" title="Descargar la lista de controles en Excel">⬇️ Descargar los controles en Excel</button>';
    document.getElementById('seccion-kpis').appendChild(barra);
    var bx = document.getElementById('ctrl-excel');
    if (bx && window.EXPORTA) bx.addEventListener('click', function () {
      var filas = [['Proyecto', 'Tema', 'Nivel', 'Control', 'Hallazgo', 'Recomendación']];
      controles.forEach(function (c) {
        filas.push([ (G.proyecto(c.proyecto) || {}).nombre || c.proyecto || 'General', c.tema || '', c.nivel || '', c.titulo || '', c.hallazgo || '', c.recomendacion || '' ]);
      });
      var hojas = [{ nombre: 'Controles', filas: filas }];
      /* Segunda hoja: las revelaciones automáticas del periodo activo. */
      try {
        if (window.REVELACIONES && typeof REVELACIONES.globales === 'function') {
          var revs = REVELACIONES.globales();
          var fr = [['Proyecto', 'Revelación', 'Producción', 'Vendido', 'Dañados', 'Residuo', '%', 'Nivel']];
          revs.forEach(function (r) {
            fr.push([ (G.proyecto(r.cod) || {}).nombre || r.cod || '',
              r.titulo || '', r.prod, r.vendido, r.danados, r.residuo,
              (r.pct != null ? Math.round(r.pct * 1000) / 10 : ''), r.nivel || '' ]);
          });
          hojas.push({ nombre: 'Revelaciones', filas: fr });
        }
      } catch (e) { /* si algo falla, se exporta al menos la hoja de Controles */ }
      EXPORTA.descargar('granja_controles', hojas);
    });

    /* ---- Aviso cuando hay un periodo PARCIAL activo ----
       Los controles NO se filtran por periodo (evitar «falsos verdes»): siempre
       se calculan sobre TODO el corte. Se avisa con claridad. */
    let html = '';
    if (window.ESTADO && typeof ESTADO.esPeriodoCompleto === 'function' && !ESTADO.esPeriodoCompleto()) {
      html += `<div class="alerta-amarilla mb-6">⚠️ <strong>Está viendo el periodo «${G.esc(ESTADO.etiquetaPeriodo())}», pero los controles de coherencia se calculan sobre TODO el corte (enero–julio 2026), no sobre ese tramo.</strong>
        Filtrar los controles por un pedazo del corte produciría «falsos verdes» (cuentas que parecen cuadrar solo porque falta parte de la información). Por eso aquí las cifras no cambian con el periodo elegido.</div>`;
    }

    /* ---- Sección GLOBAL ---- */
    const globales = controles.filter(c => c.proyecto === null);
    html += `<section aria-labelledby="titulo-global" class="mb-10">
      <h2 id="titulo-global">🌐 Controles de toda la granja</h2>
      <p class="text-neutral-600 text-sm mt-1 mb-4 max-w-3xl">Estos controles miran la granja completa, no un proyecto en particular.</p>
      ${globales.map(renderControl).join('')}
      ${controlManoObra()}
    </section>`;

    /* ---- Una sección por proyecto (solo los que tienen controles) ---- */
    for (const p of G.proyectos()) {
      const propios = controles.filter(c => c.proyecto === p.codigo);
      if (!propios.length) continue;
      const peor = C.peorNivel(propios.map(c => c.nivel));
      const est = ESTADO_CHIP[peor];
      html += `<section id="${p.codigo}" aria-labelledby="titulo-${p.codigo}" class="mb-10 scroll-mt-4">
        <h2 id="titulo-${p.codigo}" class="flex flex-wrap items-center gap-2">${G.esc(p.nombre)}
          <span class="chip-${est.tipo}">${est.icono} ${G.esc(propios.length + ' control(es) · el peor está: ' + est.texto)}</span>
          <a class="text-sm font-normal" href="proyecto?p=${p.codigo}">→ ver el proyecto</a></h2>
        ${C.resumenProyecto(p.codigo)}
        ${propios.map(renderControl).join('')}
      </section>`;
    }
    document.getElementById('seccion-controles').innerHTML = html;

    /* ---- Panel: consultar la hoja de alimentacion ---- */
    (function panelAlimentacion() {
      const cont = document.getElementById('seccion-alimentacion');
      if (!cont || !window.DATA_SUMINISTROS) return;
      const S = window.DATA_SUMINISTROS;
      const kg = S.registros.reduce((a, r) => a + (r.kg || 0), 0);
      const dias = new Set(S.registros.map(r => r.fecha)).size;
      const delServidor = typeof G.alimentacionDelServidor === 'function' && G.alimentacionDelServidor();
      cont.innerHTML =
        G.cuadroControl({
          icono: '🌾', titulo: 'Registro diario de alimentación',
          queVes: `cuántos kilos de concentrado se le dieron a los animales cada día: ${G.num(S.registros.length)} anotaciones en ${G.num(dias)} días, ${G.num(kg)} kg en total.`,
          deDondeSale: 'hoja de cálculo de alimentación que llena la granja',
          corte: (S.periodo && S.periodo.desde ? G.fecha(S.periodo.desde) + ' al ' + G.fecha(S.periodo.hasta) : '—'),
          estado: delServidor
            ? { tipo: 'ok', icono: '🔄', texto: 'actualizado desde la hoja' }
            : { tipo: 'info', icono: '📋', texto: 'usando el registro incluido en el sitio' },
          ayudaHtml: `<p>Este es el dato que faltaba para saber cuánto cuesta de verdad producir en la granja:
            sin saber cuánto alimento se entrega, no se puede calcular el costo de un huevo ni comprobar si el
            concentrado comprado alcanzó.</p>
            <p class="mt-1">El botón <strong>«Consultar la hoja»</strong> le pide al servidor que vuelva a leer la hoja de
            cálculo y se quede con la versión más reciente. Como eso cambia lo que ve todo el mundo, pide la misma
            contraseña que las correcciones.</p>
            <p class="mt-1">Si nunca se ha consultado, el sitio usa el registro que trae incorporado, que también es válido:
            simplemente puede estar desactualizado.</p>`,
        }) +
        `<div class="cuadro-cuerpo">
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1 text-sm">🔒 Contraseña
              <input id="alim-clave" type="password" class="border border-neutral-300 rounded-lg px-2 py-1.5" placeholder="Para poder actualizar" autocomplete="current-password">
            </label>
            <button type="button" id="alim-consultar" class="btn">🔄 Consultar la hoja</button>
            ${S.urlHoja ? `<a class="btn-sec text-sm" href="${G.esc(S.urlHoja)}" target="_blank" rel="noopener">📄 Abrir la hoja de cálculo</a>` : ''}
          </div>
          <p id="alim-resultado" class="mt-3" hidden></p>
          <p class="text-xs text-neutral-500 mt-3">Consultar la hoja no borra nada: solo reemplaza el registro de
            alimentación por el que esté en ese momento en la hoja de cálculo. Si la hoja no se puede leer, el sitio sigue
            mostrando el registro anterior.</p>
        </div>`;

      document.getElementById('alim-consultar').addEventListener('click', function () {
        const btn = this, salida = document.getElementById('alim-resultado');
        const clave = document.getElementById('alim-clave').value;
        if (!clave) {
          salida.hidden = false; salida.className = 'alerta-amarilla text-sm';
          salida.innerHTML = '🔒 <strong>Escriba la contraseña</strong> para poder consultar la hoja.';
          return;
        }
        btn.disabled = true; btn.textContent = 'Consultando…';
        G.consultarHojaAlimentacion(clave).then(function (d) {
          btn.disabled = false; btn.textContent = '🔄 Consultar la hoja';
          salida.hidden = false;
          if (d && d.ok) {
            salida.className = 'alerta-verde text-sm';
            salida.innerHTML = '✔ <strong>' + G.esc(d.mensaje || 'Hoja consultada.') + '</strong> Recargando la página para recalcularlo todo…';
            setTimeout(function () { location.reload(); }, 1400);
          } else {
            salida.className = 'alerta-roja text-sm';
            salida.innerHTML = '✖ ' + G.esc((d && d.mensaje) || 'No se pudo consultar la hoja.');
          }
        });
      });
    })();

    /* ---- Correcciones guardadas en este navegador ---- */
    const corr = G.correccionesUsuario();
    const ids = Object.keys(corr);
    const movs = G.movimientosEfectivos();
    const filas = ids.map(id => {
      const m = movs.find(x => x.id === id) || {};
      const c = corr[id];
      return `<tr>
        <td><a href="diario#${id}">${id}</a></td>
        <td>${G.esc(G.fecha(m.fecha))}</td>
        <td class="max-w-[18rem]">${G.esc((m.detalle || '(sin detalle)').split('\n')[0])}</td>
        <td>${G.esc(m.proyectoCrudo || '—')}</td>
        <td>${c.proyecto === 'FUERA_DE_GRANJA' ? '⚠ Fuera de la granja' : G.esc(c.proyecto ? C.nombreP(c.proyecto) : '(sin cambio)')}${c.producto ? `<span class="block text-xs text-neutral-500">categoría: ${G.esc(c.producto)}</span>` : ''}</td>
        <td class="money">${G.cop(m.egresos || m.ingresos)}</td>
        <td class="max-w-[16rem] text-sm">${G.esc(c.nota || '—')}${c.autor ? `<span class="block text-xs text-neutral-500">— ${G.esc(c.autor)}</span>` : ''}</td>
        <td>${G.esc(G.fecha(c.fecha))}</td>
        <td>${c.origen === 'servidor'
          ? '<span class="chip-ok">🌐 compartida</span>'
          : '<span class="chip-alerta">📴 solo en este navegador</span>'}</td>
      </tr>`;
    }).join('');

    document.getElementById('seccion-correcciones').innerHTML =
      `<h2 id="titulo-correcciones">✏️ Correcciones registradas ${(function () {
        const est = G.estadoServidor();
        return est.estado === 'conectado'
          ? `<span class="chip-ok">🌐 ${est.total} compartida(s) con todos</span>`
          : '<span class="chip-alerta">📴 sin conexión con el servidor</span>';
      })()} ${G.ayuda('¿Qué son estas correcciones?',
        `<p>Son notas que explican que un movimiento quedó mal registrado en el libro. <strong>No borran el dato original</strong>:
         se guardan aparte y el sitio recalcula con ellas los totales, los proyectos y los controles.</p>
         <p class="mt-1">El ejemplo típico: un gasto anotado en CONEJOS que en realidad era concentrado para un perro doméstico —
         se reclasifica como «fuera de la granja» y deja de contarse en el proyecto.</p>
         <p class="mt-1"><strong>Dónde quedan guardadas:</strong> en el servidor del sitio, así que las ve cualquier persona desde
         cualquier computador. Si en el momento de guardar no hubo conexión, la corrección queda marcada como
         «solo en este navegador» y puede volver a enviarse después.</p>`)}</h2>
      <p class="text-neutral-600 text-sm mt-1 mb-4 max-w-3xl">Estas notas las escribió alguien usando el botón ✏️ del <a href="diario">Libro diario</a>.
        Las que aparecen como <strong>compartidas</strong> están guardadas en el servidor y las ve todo el mundo; las marcadas como
        «solo en este navegador» todavía no se enviaron. Ninguna modifica el libro oficial de la granja.</p>
      <div class="cuadro-cuerpo">
        ${ids.length ? `<div class="overflow-x-auto"><table>
          <caption class="sr-only">Correcciones guardadas en este navegador</caption>
          <thead><tr><th scope="col">Movimiento</th><th scope="col">Fecha</th><th scope="col">Detalle</th><th scope="col">Proyecto original</th><th scope="col">Corregido a</th><th scope="col" class="text-right">Valor</th><th scope="col">Nota de quien corrigió</th><th scope="col">Corregido el</th><th scope="col">Dónde está guardada</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>` :
        `<p class="text-neutral-500 text-sm">Todavía no hay ninguna corrección registrada. Si encuentra un movimiento mal clasificado,
         ábralo en el <a href="diario">Libro diario</a> y use su botón ✏️ para anotar la corrección con su explicación.</p>`}
        <p class="mt-4 flex flex-wrap gap-3">
          <button type="button" id="btn-exportar-corr" class="btn-sec text-sm" ${ids.length ? '' : 'disabled'} title="Descarga un archivo JSON con las correcciones guardadas en este navegador">⬇️ Exportar correcciones (${G.num(ids.length)})</button>
          <a class="btn text-sm" href="diario">✏️ Anotar una corrección en el Libro diario</a>
        </p>
      </div>`;

    document.getElementById('btn-exportar-corr').addEventListener('click', G.exportarCorrecciones);

    /* Si llegaron con ancla (#CODIGO), desplazar a esa sección una vez pintado todo. */
    if (location.hash) {
      const destino = document.getElementById(location.hash.slice(1));
      if (destino) destino.scrollIntoView();
    }
  }

  document.addEventListener('click', function abrirAcciones(e) {
    const enlace = e.target.closest('.ctrl-que-hacer');
    if (!enlace) return;
    e.preventDefault();
    const panel = document.getElementById(enlace.getAttribute('aria-controls'));
    if (!panel) return;
    const abrir = panel.hidden;
    panel.hidden = !abrir;
    enlace.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });

  render();
  // El periodo no cambia los controles, pero sí el aviso de arriba: re-renderizar.
  if (window.ESTADO && ESTADO.alCambiar) ESTADO.alCambiar(render);
})();
