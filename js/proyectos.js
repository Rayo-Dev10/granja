/* proyectos.js — lista de proyectos con filtros y balance. */
(function () {
  'use strict';
  const G = window.GRANJA;
  const proys = G.proyectos();

  const AREA_ICONO = { AGROPECUARIA: '🐄', FORESTAL: '🌲', 'ADMINISTRACIÓN': '🏛️' };
  const ICONO = { BIOINSUMOS:'🧪', HUERTA:'🥬', CAFE_CENICAFE_I:'☕', GANADO_BOVINO:'🐄', CODORNICES:'🥚',
    GALLINAS_PONEDORAS:'🐔', CONEJOS:'🐰', POLLOS:'🐤', APICOLA:'🐝', CERDOS:'🐷', OVINOS:'🐑',
    PISCICOLA:'🐟', PINO_ROMERON:'🌲', AMBIENTE_CREATIVO:'🌳', PINO_PATULA:'🌲', OTRO_MADERAS:'🪵', OTROS_GRANJA:'🏡' };
  window.ICONO_PROYECTO = ICONO;

  function chipEstado(p) {
    return p.estado === 'Activo'
      ? '<span class="chip-ok">✔ Activo (con movimientos)</span>'
      : '<span class="chip-neutro">⏸ Sin movimientos en 2026</span>';
  }

  function render() {
    // balance del periodo activo (FLUJO): se recalcula en cada render
    const bal = Object.fromEntries(G.porProyecto(G.movimientosDelPeriodo()).map(x => [x.proyecto, x]));
    const fArea = document.getElementById('f-area')?.value || '';
    const fResp = document.getElementById('f-resp')?.value || '';
    const fEstado = document.getElementById('f-estado')?.value || '';
    const lista = proys.filter(p =>
      (!fArea || p.area === fArea) && (!fResp || p.responsable === fResp) && (!fEstado || p.estado === fEstado));

    const filas = lista.map(p => {
      const b = bal[p.codigo];
      const balHtml = b
        ? `<td class="money ${b.balance >= 0 ? 'text-success-700' : 'text-danger-700'}">${(b.balance >= 0 ? '+' : '−') + G.cop(Math.abs(b.balance)).replace('$', '$ ')}</td>`
        : '<td class="text-neutral-400 text-right">sin registro</td>';
      return `<tr>
        <td class="text-neutral-400">${p.no}</td>
        <th scope="row" class="font-medium"><a href="proyecto?p=${p.codigo}">${ICONO[p.codigo] || '📌'} ${G.esc(p.nombre)}</a></th>
        <td>${AREA_ICONO[p.area] || ''} ${G.esc(p.area)}</td>
        <td class="text-neutral-600">${G.esc(p.tipo)}</td>
        <td class="text-neutral-600">${G.esc(p.responsable)}</td>
        <td>${chipEstado(p)}</td>
        ${balHtml}
      </tr>`;
    }).join('');

    const activos = proys.filter(p => p.estado === 'Activo').length;
    document.getElementById('seccion-lista').innerHTML =
      G.cuadroControl({
        icono: '🗂️', titulo: `Lista de proyectos (${lista.length} de ${proys.length})`,
        queVes: 'todos los proyectos de la granja con su área, tipo, responsable, estado y el balance económico (lo que ha recibido menos lo que ha gastado en 2026).',
        deDondeSale: 'hoja PROYECTOS del libro de control + suma de sus movimientos del Libro caja diario',
        estado: { tipo: 'info', icono: 'ℹ', texto: `${activos} activos · ${proys.length - activos} sin movimientos` },
        ayudaHtml: `<p>Cada fila es un proyecto de la granja.</p>
          <ul class="list-disc ml-4 mt-1 space-y-1">
            <li><strong>Estado:</strong> «Activo» significa que registró ingresos o gastos en 2026; «Sin movimientos» significa que no aparece ni una vez en el libro diario.</li>
            <li><strong>Balance:</strong> verde = el proyecto aporta más de lo que gasta; rojo = gasta más de lo que aporta.</li>
            <li>Use los filtros para ver solo un área, un responsable o un estado.</li>
            <li>Toque el <strong>nombre del proyecto</strong> para abrir su página con todo el detalle.</li></ul>`,
      }) +
      `<div class="cuadro-cuerpo">
        <form class="flex flex-wrap gap-3 mb-4 text-sm" aria-label="Filtros de la lista">
          <label class="flex items-center gap-2">Área
            <select id="f-area" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Todas</option>${[...new Set(proys.map(p => p.area))].map(a => `<option ${a === fArea ? 'selected' : ''}>${G.esc(a)}</option>`).join('')}
            </select></label>
          <label class="flex items-center gap-2">Responsable
            <select id="f-resp" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Todos</option>${[...new Set(proys.map(p => p.responsable))].map(a => `<option ${a === fResp ? 'selected' : ''}>${G.esc(a)}</option>`).join('')}
            </select></label>
          <label class="flex items-center gap-2">Estado
            <select id="f-estado" class="border border-neutral-300 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Todos</option><option ${fEstado === 'Activo' ? 'selected' : ''}>Activo</option><option ${fEstado === 'Sin movimientos' ? 'selected' : ''}>Sin movimientos</option>
            </select></label>
        </form>
        <table>
          <caption class="sr-only">Lista de proyectos de la granja</caption>
          <thead><tr><th scope="col">N.º</th><th scope="col">Proyecto</th><th scope="col">Área</th><th scope="col">Tipo</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col" class="text-right">Balance 2026</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <p class="text-xs text-neutral-500 mt-3">💡 Un proyecto «Sin movimientos» no es un error del sitio: significa que en el libro de la granja no se registró ningún ingreso ni gasto para él en 2026 (BIOINSUMOS, APICOLA, OTRO MADERAS y OTROS GRANJA están en ese caso).</p>
      </div>`;

    for (const id of ['f-area', 'f-resp', 'f-estado'])
      document.getElementById(id).addEventListener('change', render);
  }
  render();
  if (window.ESTADO && ESTADO.alCambiar) ESTADO.alCambiar(render);
})();
