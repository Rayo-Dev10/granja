/* estado.js — FILTRO POR PERIODO (estado global de la vista).
   Se carga ANTES de js/util.js. No depende de GRANJA para arrancar.
   El periodo vive en la URL (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD) y se ve
   siempre en una franja debajo del encabezado. Arranque limpio = «todo». */
window.ESTADO = (function () {
  'use strict';

  const CORTE = '2026-07-31';                 // corte oficial de los datos
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const subs = [];
  let P = null;                               // {desde, hasta, preset}

  /* ---------- rango real de los datos ---------- */
  let _rango = null;
  function rangoDatos() {
    if (_rango) return _rango;
    let min = '2026-01-01', max = CORTE;
    try {
      const movs = (window.DATA_MOVIMIENTOS && window.DATA_MOVIMIENTOS.movimientos) || [];
      const fechas = movs.map(m => m.fecha).filter(Boolean).sort();
      if (fechas.length) {
        min = fechas[0];
        max = fechas[fechas.length - 1] > CORTE ? fechas[fechas.length - 1] : CORTE;
      }
    } catch (e) {}
    _rango = { desde: min, hasta: max };
    return _rango;
  }

  /* ---------- presets ---------- */
  function presets() {
    const r = rangoDatos();
    return [
      { id: 'todo', label: 'Todo', desde: r.desde, hasta: r.hasta },
      { id: 'julio', label: 'Julio 2026', desde: '2026-07-01', hasta: '2026-07-31' },
      { id: 'trimestre', label: 'Último trimestre (may–jul)', desde: '2026-05-01', hasta: '2026-07-31' },
      { id: 'semestre', label: 'Primer semestre (ene–jun)', desde: '2026-01-01', hasta: '2026-06-30' },
      { id: 'desde-mayo', label: 'Desde mayo (registro de alimentación)', desde: '2026-05-01', hasta: '2026-07-31' },
    ];
  }

  /* ---------- utilidades de fecha ---------- */
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function valida(f) { return typeof f === 'string' && ISO.test(f); }
  function finDeMes(iso) { const d = new Date(iso + 'T00:00:00Z'); const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); return n.toISOString().slice(0, 10); }
  function esPrimeroDeMes(iso) { return /-01$/.test(iso); }
  function esFinDeMes(iso) { return finDeMes(iso) === iso; }

  function esPeriodoCompleto() {
    const r = rangoDatos();
    return P.desde <= r.desde && P.hasta >= r.hasta;
  }

  function presetDe(desde, hasta) {
    const m = presets().find(p => p.desde === desde && p.hasta === hasta);
    if (m) return m.id;
    const r = rangoDatos();
    return (desde <= r.desde && hasta >= r.hasta) ? 'todo' : 'personalizado';
  }

  /* ---------- etiqueta legible del periodo ---------- */
  function etiquetaRango(desde, hasta) {
    const [ya, ma] = desde.split('-'), [yb, mb] = hasta.split('-');
    // un solo mes completo → «julio de 2026»
    if (ya === yb && ma === mb && esPrimeroDeMes(desde) && esFinDeMes(hasta)) {
      return MESES_LARGO[+ma - 1] + ' de ' + ya;
    }
    // meses completos dentro del mismo año → «may–jul 2026»
    if (ya === yb && esPrimeroDeMes(desde) && esFinDeMes(hasta)) {
      return MESES[+ma - 1] + '–' + MESES[+mb - 1] + ' ' + ya;
    }
    // rango arbitrario → «del 5 may al 20 jul de 2026»
    const d = new Date(desde + 'T00:00:00Z'), h = new Date(hasta + 'T00:00:00Z');
    return 'del ' + d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' al ' + h.getUTCDate() + ' ' + MESES[h.getUTCMonth()] + ' de ' + h.getUTCFullYear();
  }

  function etiquetaPeriodo() {
    if (esPeriodoCompleto()) {
      const r = rangoDatos();
      return 'todo el corte (' + MESES[+r.desde.split('-')[1] - 1] + '–' + MESES[+r.hasta.split('-')[1] - 1] + ' ' + r.hasta.split('-')[0] + ')';
    }
    return etiquetaRango(P.desde, P.hasta);
  }

  /* ---------- API principal ---------- */
  function periodo() { return { desde: P.desde, hasta: P.hasta, preset: P.preset }; }

  function fijarPeriodo(o) {
    o = o || {};
    let desde = o.desde, hasta = o.hasta;
    // permitir fijar por id de preset
    if (o.preset && (!desde || !hasta)) {
      const pr = presets().find(p => p.id === o.preset);
      if (pr) { desde = pr.desde; hasta = pr.hasta; }
    }
    const r = rangoDatos();
    if (!valida(desde)) desde = r.desde;
    if (!valida(hasta)) hasta = r.hasta;
    if (desde > hasta) { const t = desde; desde = hasta; hasta = t; }   // por si llegan al revés
    P = { desde: desde, hasta: hasta, preset: presetDe(desde, hasta) };
    _sincronizarURL();
    notify();
    return periodo();
  }

  function _sincronizarURL() {
    try {
      const url = new URL(location.href);
      if (esPeriodoCompleto()) {
        url.searchParams.delete('desde');
        url.searchParams.delete('hasta');
      } else {
        url.searchParams.set('desde', P.desde);
        url.searchParams.set('hasta', P.hasta);
      }
      history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (e) { /* file:// muy antiguo: seguir sin tocar la URL */ }
  }

  function alCambiar(fn) {
    if (typeof fn !== 'function') return function () {};
    subs.push(fn);
    return function () { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
  }
  function notify() {
    renderFranja();
    for (const fn of subs.slice()) { try { fn(periodo()); } catch (e) { console.error(e); } }
  }

  /* ---------- conteo de movimientos del periodo (sin depender de GRANJA) ---------- */
  function _contar() {
    try {
      const movs = (window.DATA_MOVIMIENTOS && window.DATA_MOVIMIENTOS.movimientos) || [];
      const dentro = movs.filter(m => m.proyecto !== 'FUERA_DE_GRANJA' && m.fecha && m.fecha >= P.desde && m.fecha <= P.hasta);
      return dentro.length;
    } catch (e) { return 0; }
  }

  /* ---------- franja visible ---------- */
  function renderFranja() {
    const cont = document.getElementById('franja-periodo');
    if (!cont) return;
    const completo = esPeriodoCompleto();
    const botones = presets().map(function (pr) {
      const activo = pr.id === P.preset;
      return '<button type="button" class="franja-preset' + (activo ? ' is-active' : '') +
        '" data-preset="' + pr.id + '" aria-pressed="' + (activo ? 'true' : 'false') + '">' + pr.label + '</button>';
    }).join('');
    cont.innerHTML =
      '<div class="franja-wrap no-imprimir">' +
        '<div class="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">' +
          '<span class="franja-label">📅 Viendo: <strong>' + etiquetaPeriodo() + '</strong> · ' + _contar() + ' movimientos</span>' +
          '<span class="franja-presets flex flex-wrap gap-1" role="group" aria-label="Elegir el periodo">' + botones + '</span>' +
          (completo ? '' : '<button type="button" class="franja-vertodo" data-preset="todo">✕ ver todo</button>') +
        '</div>' +
      '</div>';
    cont.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { fijarPeriodo({ preset: b.getAttribute('data-preset') }); });
    });
  }

  /* ---------- lectura inicial de la URL ---------- */
  function _leerURL() {
    const r = rangoDatos();
    let desde, hasta;
    try {
      const q = new URLSearchParams(location.search);
      desde = q.get('desde'); hasta = q.get('hasta');
    } catch (e) {}
    if (!valida(desde) || !valida(hasta)) { desde = r.desde; hasta = r.hasta; }   // arranque limpio = todo
    if (desde > hasta) { const t = desde; desde = hasta; hasta = t; }
    P = { desde: desde, hasta: hasta, preset: presetDe(desde, hasta) };
  }

  _leerURL();
  // pintar la franja en cuanto el DOM esté disponible
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderFranja);
  else renderFranja();

  return { periodo, fijarPeriodo, presets, alCambiar, esPeriodoCompleto, etiquetaPeriodo, rangoDatos, renderFranja };
})();
