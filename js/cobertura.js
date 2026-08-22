/* cobertura.js — ¿de qué proyectos tenemos información y de cuáles no?
   Se calcula solo, sobre los datos publicados. La ausencia de dato TAMBIÉN es un dato:
   este cuadro la vuelve medible. No lee nada escrito a mano salvo la tabla APLICA,
   que dice qué tipo de registro le corresponde a cada proyecto (un pino no come concentrado). */
window.COBERTURA = (function () {
  'use strict';
  const G = window.GRANJA;

  const FUENTES = [
    { id: 'mov', icono: '💰', nombre: 'Movimientos' },
    { id: 'prod', icono: '🥚', nombre: 'Producción' },
    { id: 'inv', icono: '🐾', nombre: 'Inventario' },
    { id: 'san', icono: '🩺', nombre: 'Sanitario' },
    { id: 'ali', icono: '🌾', nombre: 'Alimento entregado' },
    { id: 'mo', icono: '👷', nombre: 'Mano de obra' },
  ];

  // Qué fuente le corresponde a cada proyecto (1 = aplica). Criterio documentado.
  const APLICA = {
    GALLINAS_PONEDORAS: { mov: 1, prod: 1, inv: 1, san: 1, ali: 1, mo: 1 },
    CODORNICES: { mov: 1, prod: 1, inv: 1, san: 1, ali: 1, mo: 1 },
    GANADO_BOVINO: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    CONEJOS: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    POLLOS: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    CERDOS: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    OVINOS: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    PISCICOLA: { mov: 1, prod: 0, inv: 1, san: 1, ali: 1, mo: 1 },
    APICOLA: { mov: 1, prod: 0, inv: 1, san: 1, ali: 0, mo: 1 },
    HUERTA: { mov: 1, prod: 1, inv: 0, san: 0, ali: 0, mo: 1 },
    CAFE_CENICAFE_I: { mov: 1, prod: 1, inv: 0, san: 0, ali: 0, mo: 1 },
    BIOINSUMOS: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
    PINO_ROMERON: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
    AMBIENTE_CREATIVO: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
    PINO_PATULA: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
    OTRO_MADERAS: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
    OTROS_GRANJA: { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 },
  };
  const APLICA_DEFECTO = { mov: 1, prod: 0, inv: 0, san: 0, ali: 0, mo: 1 };

  function tieneDato(cod, fuente) {
    switch (fuente) {
      case 'mov': return (G.movimientos() || []).some(m => m.proyecto === cod && (m.ingresos || m.egresos));
      case 'prod': return (((window.DATA_PRODUCCION || {}).produccion || {})[cod] || []).length > 0;
      case 'inv': return (((window.DATA_INVENTARIOS || {}).eventos) || []).some(e => e.proyecto === cod);
      case 'san': return (((window.DATA_SANITARIO || {}).eventos) || []).some(e => e.proyecto === cod);
      case 'ali': return (((window.DATA_SUMINISTROS || {}).registros) || []).some(r => r.proyecto === cod);
      case 'mo': return (((window.DATA_MANOOBRA || {}).imputaciones) || []).some(i => i.proyecto === cod);
      default: return false;
    }
  }

  function matriz() {
    return (G.proyectos() || []).map(p => {
      const aplica = APLICA[p.codigo] || APLICA_DEFECTO;
      const celdas = {}; let aplicables = 0, conDato = 0; const faltan = [];
      for (const f of FUENTES) {
        if (!aplica[f.id]) { celdas[f.id] = 'na'; continue; }
        aplicables++;
        const hay = tieneDato(p.codigo, f.id);
        celdas[f.id] = hay ? 'ok' : 'falta';
        if (hay) conDato++; else faltan.push(f.nombre.toLowerCase());
      }
      return { codigo: p.codigo, nombre: p.nombre, celdas, aplicables, conDato, faltan, pct: aplicables ? Math.round(100 * conDato / aplicables) : 0 };
    });
  }

  function resumen() {
    const m = matriz();
    const total = m.length;
    const completos = m.filter(x => x.pct === 100).length;
    const incompletos = m.filter(x => x.pct < 100).length;
    const sinNada = m.filter(x => x.conDato === 0).length;
    const pctGlobal = Math.round(m.reduce((a, x) => a + x.pct, 0) / (total || 1));
    return { total, completos, incompletos, sinNada, pctGlobal };
  }

  function faltantesDe(cod) {
    const x = matriz().find(m => m.codigo === cod);
    if (!x) return '';
    if (!x.faltan.length) return 'Tiene registrado todo lo que le corresponde.';
    return 'Le falta: ' + x.faltan.join(', ') + '.';
  }

  const ICONO_CELDA = { ok: '✅', falta: '⚠️', na: '⬜' };
  const TIT_CELDA = { ok: 'con dato', falta: 'falta registro', na: 'no aplica a este proyecto' };

  function seccionHTML() {
    const m = matriz().slice().sort((a, b) => a.pct - b.pct);
    const r = resumen();
    const encabezados = FUENTES.map(f => `<th scope="col" class="text-center" title="${G.esc(f.nombre)}">${f.icono}<span class="block text-[10px] font-normal">${G.esc(f.nombre.split(' ')[0])}</span></th>`).join('');
    const filas = m.map(x => `<tr>
      <td class="font-medium whitespace-nowrap"><a href="proyecto?p=${x.codigo}">${G.esc(x.nombre)}</a></td>
      ${FUENTES.map(f => `<td class="text-center" title="${G.esc(f.nombre)}: ${TIT_CELDA[x.celdas[f.id]]}"><span aria-label="${TIT_CELDA[x.celdas[f.id]]}">${ICONO_CELDA[x.celdas[f.id]]}</span></td>`).join('')}
      <td class="text-right font-semibold ${x.pct === 100 ? 'text-success-700' : x.pct === 0 ? 'text-danger-700' : 'text-warning-700'}">${x.pct} %</td>
    </tr>`).join('');
    const detalle = m.filter(x => x.faltan.length).map(x => `<li><strong>${G.esc(x.nombre)}:</strong> ${G.esc(x.faltan.join(', '))}.</li>`).join('');

    return G.cuadroControl({
      icono: '📋', titulo: '¿De qué proyectos tenemos información, y de cuáles no?',
      queVes: 'los 17 proyectos y qué tipo de registro tiene cada uno. Una casilla en gris (⬜) significa que ese registro no le corresponde a ese proyecto (un pino no come concentrado). Verde (✅) es que hay dato; amarillo (⚠️), que corresponde y falta.',
      deDondeSale: 'cálculo automático sobre los datos publicados (nada se digitó a mano)',
      corte: 'todo el corte (ene–jul 2026)',
      estado: r.incompletos ? { tipo: 'alerta', icono: '⚠', texto: `${r.incompletos} proyecto(s) con información incompleta` } : { tipo: 'ok', icono: '✔', texto: 'todos completos' },
      ayudaHtml: `<p>La <strong>ausencia de dato también es un dato</strong>: este cuadro la vuelve medible. La columna «Cobertura» dice, de lo que le corresponde a cada proyecto, cuánto está registrado.</p>
        <p class="mt-1">Cada fuente se marca como aplicable según el tipo de proyecto (animales, cultivos, forestales, apoyo). El porcentaje se calcula solo sobre lo aplicable, para no penalizar a un proyecto por algo que no le toca.</p>
        <p class="mt-1">La columna 👷 <strong>Mano de obra</strong> está en amarillo en todos: la granja aún no registra la dedicación de horas. Es coherente con la página <a href="mano-obra">Mano de obra</a>.</p>`,
    }) + `<div class="cuadro-cuerpo">
      <div class="alerta-azul">ℹ️ <strong>La cobertura se calcula sobre todo el corte, no sobre el periodo seleccionado.</strong>
        Es un dato histórico (qué registros existen y cuáles faltan), así que sus números no cambian aunque filtre el resumen por un periodo.</div>
      <div class="grid gap-4 sm:grid-cols-4 mb-4">
        <div class="kpi"><span class="titulo">Cobertura de información</span><span class="valor ${r.pctGlobal >= 60 ? 'text-success-700' : 'text-warning-700'}">${r.pctGlobal} %</span><span class="lectura">promedio de todos los proyectos</span></div>
        <div class="kpi"><span class="titulo">Proyectos completos</span><span class="valor text-success-700">${r.completos}</span><span class="lectura">tienen todo lo que les corresponde</span></div>
        <div class="kpi"><span class="titulo">Con información parcial</span><span class="valor text-warning-700">${r.incompletos}</span><span class="lectura">les falta algún registro</span></div>
        <div class="kpi"><span class="titulo">Sin ningún registro propio</span><span class="valor text-danger-700">${r.sinNada}</span><span class="lectura">solo aparecen en el catálogo</span></div>
      </div>
      <div class="mb-2"><button type="button" id="cob-excel" class="btn-sec text-sm" title="Descargar esta tabla en Excel">⬇️ Excel</button></div>
      <div class="overflow-x-auto"><table id="tabla-cobertura">
        <caption class="sr-only">Cobertura de información por proyecto</caption>
        <thead><tr><th scope="col">Proyecto</th>${encabezados}<th scope="col" class="text-right">Cobertura</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
      <details class="mt-3 text-sm"><summary class="cursor-pointer text-primary-800 font-medium">Ver qué le falta exactamente a cada proyecto</summary>
        <ul class="list-disc ml-5 mt-2 space-y-1 text-neutral-700">${detalle || '<li>Todos los proyectos tienen su información completa.</li>'}</ul>
        <p class="text-xs text-neutral-500 mt-2">Leyenda: ✅ con dato · ⚠️ falta registro · ⬜ no aplica a ese proyecto.</p>
      </details>
    </div>`;
  }

  function conectarExport() {
    var b = document.getElementById('cob-excel');
    if (b && window.EXPORTA) b.addEventListener('click', function () {
      var tabla = document.getElementById('tabla-cobertura');
      if (tabla) EXPORTA.tabla(tabla, 'Cobertura', 'granja_cobertura-informacion');
    });
  }
  return { FUENTES, APLICA, matriz, resumen, faltantesDe, seccionHTML, conectarExport };
})();
