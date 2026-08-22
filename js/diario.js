/* diario.js — libro caja diario: filtros, totales vivos, alertas y correcciones. */
(function () {
  'use strict';
  const G = window.GRANJA;
  const dlg = document.getElementById('dlg-correccion');
  let movActual = null;
  const filtros = { proyecto: '', producto: '', mes: '', texto: '' };

  function filtrar() {
    // El periodo global acota; los filtros internos (incl. el de mes) operan dentro de eso.
    return G.movimientosDelPeriodo().filter(m =>
      (!filtros.proyecto || m.proyecto === filtros.proyecto) &&
      (!filtros.producto || (m.producto || '(sin categoría)') === filtros.producto) &&
      (!filtros.mes || (m.fecha || '').startsWith(filtros.mes)) &&
      (!filtros.texto || JSON.stringify([m.detalle, m.obs, m.producto]).toLowerCase().includes(filtros.texto.toLowerCase())));
  }

  function marcaFila(m) {
    const marcas = [];
    if (m.correccionUsuario) {
      const enServidor = m.correccionUsuario.origen === 'servidor';
      marcas.push(enServidor
        ? `<span class="chip-info" title="Corregido y guardado en el servidor: lo ve todo el mundo. ${G.esc(m.correccionUsuario.nota || '')}">✏️ corregido (compartido)</span>`
        : `<span class="chip-alerta" title="Corrección guardada solo en este navegador: todavía no la ve nadie más. ${G.esc(m.correccionUsuario.motivoPendiente || '')}">✏️ corregido (sin enviar)</span>`);
    }
    if (m.correcciones.length) marcas.push(`<span class="chip-alerta" title="${G.esc(m.correcciones.join(' · '))}">🛠 dato normalizado</span>`);
    if (m.alertas.length) marcas.push(`<span class="chip-error" title="${G.esc(m.alertas.join(' · '))}">⚠ revisar</span>`);
    return marcas.join(' ');
  }

  function render() {
    const enPeriodo = G.movimientosDelPeriodo();
    const productos = [...new Set(enPeriodo.map(m => m.producto || '(sin categoría)'))].sort();
    const meses = [...new Set(enPeriodo.map(m => (m.fecha || '').slice(0, 7)).filter(Boolean))].sort();
    if (filtros.mes && meses.indexOf(filtros.mes) < 0) filtros.mes = '';   // el mes elegido quedó fuera del periodo
    const movs = filtrar();
    const t = G.totales(movs);
    const proys = G.proyectos();
    const nCorr = Object.keys(G.correccionesUsuario()).length;

    const filas = movs.map(m => `<tr id="${m.id}">
      <td class="whitespace-nowrap">${G.fecha(m.fecha)}${m.fechaTexto ? ` <span class="ayuda !cursor-default" title="Fecha original escrita como texto: «${G.esc(m.fechaTexto)}». Se interpretó como se muestra.">✱</span>` : ''}</td>
      <td class="max-w-[22rem]">${G.esc(m.detalle || '(sin detalle en el libro)')}${m.obs ? `<span class="block text-xs text-neutral-500">${G.esc(m.obs)}</span>` : ''}</td>
      <td><a href="proyecto?p=${m.proyecto}">${G.esc((G.proyecto(m.proyecto) || {}).nombre || m.proyecto || '—')}</a>${m.correccionUsuario && m.correccionUsuario.proyecto ? `<span class="block text-xs text-info-700">antes: ${G.esc(m.proyectoCrudo || '')}</span>` : ''}</td>
      <td>${G.esc(m.producto || '—')}</td>
      <td class="money">${m.cantidad != null ? G.num(m.cantidad) : ''}</td>
      <td class="money text-success-700">${m.ingresos ? G.cop(m.ingresos) : ''}</td>
      <td class="money text-danger-700">${m.egresos ? G.cop(m.egresos) : ''}</td>
      <td>${marcaFila(m)}</td>
      <td><button type="button" class="btn-sec !px-2 !py-1 text-xs btn-corregir" data-id="${m.id}" title="Guardar una corrección para este movimiento">✏️</button></td>
    </tr>`).join('');

    document.getElementById('seccion-diario').innerHTML =
      `<div class="grid gap-4 sm:grid-cols-3 mb-6" role="status" aria-live="polite">
        <div class="kpi"><span class="titulo">💰 Ingresos (de lo filtrado) ${G.ayuda('Ingresos', '<p>Suma de la columna INGRESOS de los movimientos que están visibles con los filtros actuales. Si no hay ningún filtro, es el total de la granja en 2026.</p>')}</span><span class="valor text-success-700">${G.cop(t.ingresos)}</span><span class="lectura">${t.n} movimientos visibles</span></div>
        <div class="kpi"><span class="titulo">💸 Egresos (de lo filtrado)</span><span class="valor text-danger-700">${G.cop(t.egresos)}</span><span class="lectura">lo que la granja gastó</span></div>
        <div class="kpi"><span class="titulo">⚖️ Balance</span><span class="valor ${t.balance >= 0 ? 'text-success-700' : 'text-danger-700'}">${(t.balance >= 0 ? '+' : '−')}${G.cop(Math.abs(t.balance)).replace('$', '$ ')}</span><span class="lectura">ingresos menos egresos</span></div>
      </div>` +
      (function () {
        const fuera = movs.filter(G.esFueraDeGranja);
        if (!fuera.length) return '';
        const suma = fuera.reduce((a, m) => a + (m.egresos || 0) + (m.ingresos || 0), 0);
        return `<div class="alerta-azul">ℹ️ <strong>${fuera.length} movimiento(s) por ${G.cop(suma)} están marcados como «no pertenecen a la granja».</strong>
          Siguen apareciendo en la lista de abajo, con su nota de corrección, pero ya no se suman en los totales ni en los gráficos.</div>`;
      })() +
      G.cuadroControl({
        icono: '📒', titulo: `Movimientos del libro diario (${movs.length} de ${G.movimientos().length})`,
        queVes: 'cada ingreso y cada gasto registrado por la granja en 2026, uno por fila, con marcas cuando el dato crudo tuvo que normalizarse o merece revisión.',
        deDondeSale: 'hoja CAJA DIARIO del libro de control (filas 5 a 112)',
        estado: (function () {
          const est = G.estadoServidor();
          if (est.estado !== 'conectado') return { tipo: 'alerta', icono: '📴', texto: `sin conexión con el servidor · ${nCorr} corrección(es) solo en este navegador` };
          return nCorr
            ? { tipo: 'info', icono: '✏️', texto: `${nCorr} corrección(es) · ${est.total} compartida(s) con todos` }
            : { tipo: 'ok', icono: '🌐', texto: 'conectado al servidor · sin correcciones registradas' };
        })(),
        ayudaHtml: `<p>Significado de las marcas de la columna «Marcas»:</p>
          <ul class="list-disc ml-4 mt-1 space-y-1">
            <li><span class="chip-alerta">🛠 dato normalizado</span>: el dato venía con un error evidente en el libro (por ejemplo, un monto truncado o una categoría en minúsculas) y se corrigió; pase el cursor por la marca para leer exactamente qué se cambió.</li>
            <li><span class="chip-error">⚠ revisar</span>: el movimiento tiene un problema de origen que no se puede corregir automáticamente (sin monto, gasto compartido, fecha de periodo…).</li>
            <li><span class="chip-info">✏️ corregido</span>: usted (u otra persona en este navegador) guardó una corrección manual.</li>
            <li>El símbolo ✱ junto a una fecha indica que en el libro estaba escrita como texto y fue interpretada.</li></ul>
          <p class="mt-1">Con el botón ✏️ de cada fila puede reclasificar un movimiento y explicar por qué.</p>`,
      }) +
      `<div class="cuadro-cuerpo">
        <form class="flex flex-wrap gap-3 mb-4 text-sm items-end" aria-label="Filtros del libro diario">
          <label class="flex flex-col gap-1">Proyecto
            <select id="fd-proyecto" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white"><option value="">Todos</option>
            ${proys.map(p => `<option value="${p.codigo}" ${filtros.proyecto === p.codigo ? 'selected' : ''}>${G.esc(p.nombre)}</option>`).join('')}</select></label>
          <label class="flex flex-col gap-1">Categoría / producto
            <select id="fd-producto" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white"><option value="">Todas</option>
            ${productos.map(p => `<option ${filtros.producto === p ? 'selected' : ''}>${G.esc(p)}</option>`).join('')}</select></label>
          <label class="flex flex-col gap-1">Mes
            <select id="fd-mes" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white"><option value="">Todos</option>
            ${meses.map(m => `<option value="${m}" ${filtros.mes === m ? 'selected' : ''}>${G.mesLabel(m)}</option>`).join('')}</select></label>
          <label class="flex flex-col gap-1 grow max-w-xs">Buscar en el detalle
            <input id="fd-texto" type="search" value="${G.esc(filtros.texto)}" placeholder="Ej.: concentrado, cubetas…" class="border border-neutral-300 rounded-lg px-2 py-1.5"></label>
          <button type="button" id="btn-exportar" class="btn-sec text-sm" title="Descarga un archivo JSON con las correcciones guardadas en este navegador">⬇️ Exportar correcciones (${nCorr})</button>
          <button type="button" id="btn-excel" class="btn-sec text-sm" title="Descargar los movimientos visibles en un archivo de Excel">⬇️ Excel</button>
        </form>
        <table>
          <caption class="sr-only">Movimientos del libro caja diario</caption>
          <thead><tr><th scope="col">Fecha</th><th scope="col">Detalle</th><th scope="col">Proyecto</th><th scope="col">Categoría</th><th scope="col" class="text-right">Cant.</th><th scope="col" class="text-right">Ingreso</th><th scope="col" class="text-right">Egreso</th><th scope="col">Marcas</th><th scope="col"><span class="sr-only">Corregir</span></th></tr></thead>
          <tbody>${filas || '<tr><td colspan="9" class="text-center text-neutral-500 py-6">Ningún movimiento coincide con los filtros. Pruebe quitando alguno.</td></tr>'}</tbody>
        </table>
      </div>`;

    document.getElementById('fd-proyecto').addEventListener('change', e => { filtros.proyecto = e.target.value; render(); });
    document.getElementById('fd-producto').addEventListener('change', e => { filtros.producto = e.target.value; render(); });
    document.getElementById('fd-mes').addEventListener('change', e => { filtros.mes = e.target.value; render(); });
    document.getElementById('fd-texto').addEventListener('input', e => { filtros.texto = e.target.value; render(); });
    document.getElementById('btn-exportar').addEventListener('click', G.exportarCorrecciones);
    var bx = document.getElementById('btn-excel');
    if (bx && window.EXPORTA) bx.addEventListener('click', function () {
      var tabla = document.querySelector('#seccion-diario table');
      if (tabla) EXPORTA.tabla(tabla, 'Libro diario', 'granja_libro-diario');
    });
    document.querySelectorAll('.btn-corregir').forEach(b => b.addEventListener('click', () => abrirCorreccion(b.dataset.id)));
  }

  function abrirCorreccion(id) {
    movActual = G.movimientosEfectivos().find(m => m.id === id);
    const c = G.correccionesUsuario()[id] || {};
    const est = G.estadoServidor();
    document.getElementById('corr-estado').innerHTML = est.estado === 'conectado'
      ? '<span class="chip-ok">🌐 Conectado al servidor</span> Lo que guarde aquí quedará visible para <strong>todas</strong> las personas que abran el sitio, desde cualquier computador.'
      : '<span class="chip-alerta">📴 Sin conexión con el servidor</span> La corrección se guardará solo en este navegador y podrá enviarla más tarde.';
    document.getElementById('corr-autor').value = G.autor();
    document.getElementById('corr-clave').value = G.claveEdicion();
    document.getElementById('corr-recordar').checked = G.claveRecordada();
    document.getElementById('corr-bloque-clave').hidden = !(est.estado === 'conectado' && est.exigeClave);
    document.getElementById('corr-resultado').hidden = true;
    document.getElementById('corr-mov-info').innerHTML =
      `<strong>${G.fecha(movActual.fecha)}</strong> · ${G.esc(movActual.detalle || '')} · ${G.esc((G.proyecto(movActual.proyecto) || {}).nombre || movActual.proyecto)} · ` +
      (movActual.ingresos ? 'ingreso ' + G.cop(movActual.ingresos) : 'egreso ' + G.cop(movActual.egresos));
    document.getElementById('corr-proyecto').innerHTML =
      `<option value="">(dejar el proyecto como está)</option>` +
      G.proyectos().map(p => `<option value="${p.codigo}" ${c.proyecto === p.codigo ? 'selected' : ''}>${G.esc(p.nombre)}</option>`).join('') +
      `<option value="FUERA_DE_GRANJA" ${c.proyecto === 'FUERA_DE_GRANJA' ? 'selected' : ''}>⚠ No pertenece a la granja (gasto ajeno)</option>`;
    document.getElementById('corr-producto').value = c.producto || '';
    document.getElementById('corr-nota').value = c.nota || '';
    dlg.showModal();
  }

  document.getElementById('form-correccion').addEventListener('submit', e => {
    e.preventDefault();                       // el diálogo se cierra al confirmar el guardado
    if (!movActual) return;
    const btn = document.getElementById('corr-guardar');
    const salida = document.getElementById('corr-resultado');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const est = G.estadoServidor();
    const clave = document.getElementById('corr-clave').value;
    const salidaPrevia = document.getElementById('corr-resultado');
    if (est.estado === 'conectado' && est.exigeClave && !clave) {
      btn.disabled = false; btn.textContent = 'Guardar corrección';
      salidaPrevia.hidden = false;
      salidaPrevia.className = 'alerta-amarilla text-sm mt-3';
      salidaPrevia.innerHTML = '🔒 <strong>Escriba la contraseña</strong> para poder guardar la corrección en el servidor.';
      document.getElementById('corr-clave').focus();
      return;
    }
    G.recordarAutor(document.getElementById('corr-autor').value.trim());
    G.recordarClave(clave, document.getElementById('corr-recordar').checked);

    G.guardarCorreccion(movActual.id, {
      proyecto: document.getElementById('corr-proyecto').value || null,
      producto: document.getElementById('corr-producto').value || null,
      nota: document.getElementById('corr-nota').value,
    }).then(res => {
      btn.disabled = false; btn.textContent = 'Guardar corrección';
      salida.hidden = false;
      if (res.claveInvalida) {
        salida.className = 'alerta-roja text-sm mt-3';
        salida.innerHTML = '🔒 <strong>' + G.esc(res.mensaje || 'La contraseña no es correcta.') + '</strong> Escríbala de nuevo; si no la tiene, pídala al responsable del sitio.';
        document.getElementById('corr-clave').focus();
        return;
      }
      if (res.enServidor) {
        salida.className = 'alerta-verde text-sm mt-3';
        salida.innerHTML = '✔ <strong>Guardada en el servidor.</strong> ' + G.esc(res.mensaje || '');
        render();
        setTimeout(() => dlg.close(), 1200);
      } else {
        salida.className = 'alerta-amarilla text-sm mt-3';
        salida.innerHTML = '⚠ <strong>Guardada solo en este navegador.</strong> ' + G.esc(res.mensaje || '');
        render();
      }
    });
  });
  document.getElementById('corr-cancelar').addEventListener('click', () => dlg.close());

  render();
  if (window.ESTADO && ESTADO.alCambiar) ESTADO.alCambiar(render);
})();
