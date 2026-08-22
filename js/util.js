/* util.js — utilidades compartidas. JS vanilla, sin dependencias. */
window.GRANJA = (function () {
  'use strict';

  const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const fmtNum = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function cop(v) { return v == null ? '—' : fmtCOP.format(v); }
  function num(v) { return v == null ? '—' : fmtNum.format(v); }
  function fecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00Z');
    return isNaN(d) ? iso : fmtFecha.format(d);
  }
  function mesLabel(ym) { // '2026-03' -> 'mar 2026'
    const [y, m] = ym.split('-');
    return MESES[+m - 1] + ' ' + y;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------- acceso a datos ------- */
  function proyectos() { return window.DATA_CATALOGO.proyectos; }
  function proyecto(codigo) { return proyectos().find(p => p.codigo === codigo); }
  function movimientos() { return window.DATA_MOVIMIENTOS.movimientos; }

  /* ============================================================
     CORRECCIONES  (p. ej. "este gasto de CONEJOS era concentrado del perro")
     ------------------------------------------------------------
     Se guardan en EL SERVIDOR (api/correcciones.php), así que quedan
     visibles para cualquier persona, desde cualquier computador.
     El navegador guarda además una copia local que sirve para:
       · mostrar la información al instante, sin esperar al servidor;
       · no perder nada si el guardado en el servidor falla (queda "pendiente").
     ============================================================ */
  const LS_KEY = 'granja.correcciones.v1';     // copia local
  const LS_CLAVE = 'granja.claveEdicion';      // clave de edición recordada
  const LS_AUTOR = 'granja.autor';             // nombre de quien corrige
  const API = 'api/correcciones.php';

  var _servidor = {};        // lo que hay guardado en el servidor
  var _estado = 'sin-probar';// 'conectado' | 'sin-servidor' | 'sin-probar'
  var _exigeClave = true;

  function _local() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function _guardarLocal(todo) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(todo)); } catch (e) {}
  }

  /* Todas las correcciones vigentes: las del servidor mandan; las locales
     que aún no llegaron al servidor se conservan marcadas como pendientes. */
  function correccionesUsuario() {
    const todo = {};
    const loc = _local();
    for (const id in loc) todo[id] = loc[id];
    for (const id in _servidor) todo[id] = Object.assign({}, _servidor[id], { origen: 'servidor' });
    return todo;
  }

  function estadoServidor() { return { estado: _estado, exigeClave: _exigeClave, total: Object.keys(_servidor).length }; }
  /* La contraseña de edición se conserva en memoria mientras la pestaña esté
     abierta (así no hay que repetirla en cada corrección) y SOLO se guarda en
     el computador si la persona marca «recordar»: en un equipo compartido
     conviene no dejarla escrita. */
  var _claveMemoria = '';
  function claveEdicion() {
    if (_claveMemoria) return _claveMemoria;
    try { return localStorage.getItem(LS_CLAVE) || ''; } catch (e) { return ''; }
  }
  function recordarClave(c, persistir) {
    _claveMemoria = c || '';
    try {
      if (persistir && c) localStorage.setItem(LS_CLAVE, c);
      else localStorage.removeItem(LS_CLAVE);
    } catch (e) {}
  }
  function claveRecordada() { try { return !!localStorage.getItem(LS_CLAVE); } catch (e) { return false; } }
  function olvidarClave() { _claveMemoria = ''; try { localStorage.removeItem(LS_CLAVE); } catch (e) {} }
  function autor() { try { return localStorage.getItem(LS_AUTOR) || ''; } catch (e) { return ''; } }
  function recordarAutor(a) { try { localStorage.setItem(LS_AUTOR, a || ''); } catch (e) {} }

  /* Trae del servidor lo guardado. Se llama UNA vez, antes de dibujar la página. */
  function sincronizar() {
    if (location.protocol === 'file:') { _estado = 'sin-servidor'; return Promise.resolve(false); }
    return fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.ok) {
          _servidor = d.correcciones || {};
          _exigeClave = d.exigeClave !== false;
          _estado = 'conectado';
          // las locales que ya están en el servidor dejan de ser pendientes
          const loc = _local(); let cambio = false;
          for (const id in _servidor) if (loc[id]) { delete loc[id]; cambio = true; }
          if (cambio) _guardarLocal(loc);
          return true;
        }
        _estado = 'sin-servidor';
        return false;
      })
      ['catch'](function () { _estado = 'sin-servidor'; return false; });
  }

  /* ---------- registro de alimentación ----------
     El sitio trae incluido el registro en data/suministros.js. Si en el servidor
     hay uno más reciente (porque alguien pulsó «Consultar la hoja»), se usa ese. */
  var _alimentacionServidor = null;
  function sincronizarAlimentacion() {
    if (location.protocol === 'file:') return Promise.resolve(false);
    return fetch('api/alimentacion.php', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.ok && d.hayDatos && d.registros && d.registros.length) {
          _alimentacionServidor = d;
          window.DATA_SUMINISTROS = {
            fuente: d.fuente, urlHoja: d.urlHoja, bultoKg: d.bultoKg || 40,
            periodo: d.periodo, generado: d.generado, registros: d.registros,
          };
          return true;
        }
        return false;
      })['catch'](function () { return false; });
  }
  function alimentacionDelServidor() { return _alimentacionServidor; }

  /* Pide al servidor que vuelva a leer la hoja de cálculo. Requiere la contraseña. */
  function consultarHojaAlimentacion(clave) {
    return fetch('api/alimentacion.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: clave || claveEdicion() }),
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.registros) {
          window.DATA_SUMINISTROS = {
            fuente: d.fuente, urlHoja: d.urlHoja, bultoKg: d.bultoKg || 40,
            periodo: d.periodo, generado: d.generado, registros: d.registros,
          };
        }
        return d;
      })['catch'](function () {
        return { ok: false, mensaje: 'No se pudo contactar el servidor para consultar la hoja.' };
      });
  }

  /* Guarda una corrección. Devuelve una promesa con {ok, mensaje, enServidor}. */
  function guardarCorreccion(movId, obj) {
    const registro = Object.assign({ fecha: new Date().toISOString().slice(0, 10) }, obj);

    function guardarSoloAqui(motivo) {
      const loc = _local();
      loc[movId] = Object.assign({}, registro, { origen: 'local', motivoPendiente: motivo });
      _guardarLocal(loc);
      return { ok: true, enServidor: false, mensaje: motivo };
    }

    if (_estado !== 'conectado') {
      return Promise.resolve(guardarSoloAqui(
        'Guardada solo en este navegador: no se pudo contactar el servidor. Vuelva a intentarlo cuando haya conexión.'));
    }

    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ accion: 'guardar', id: movId, clave: claveEdicion(), autor: autor() }, obj)),
    }).then(function (r) { return r.json().then(function (d) { return { http: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) {
          _servidor = res.d.correcciones || _servidor;
          const loc = _local(); delete loc[movId]; _guardarLocal(loc);
          return { ok: true, enServidor: true, mensaje: res.d.mensaje };
        }
        if (res.d && res.d.claveInvalida) {
          return { ok: false, enServidor: false, claveInvalida: true, mensaje: res.d.mensaje };
        }
        return Object.assign(guardarSoloAqui(
          (res.d && res.d.mensaje ? res.d.mensaje : 'El servidor no aceptó el cambio.') +
          ' La corrección quedó guardada solo en este navegador.'), { ok: false });
      })['catch'](function () {
        return Object.assign(guardarSoloAqui(
          'No se pudo contactar el servidor. La corrección quedó guardada solo en este navegador.'), { ok: false });
      });
  }

  function borrarCorreccion(movId) {
    const loc = _local(); delete loc[movId]; _guardarLocal(loc);
    if (_estado !== 'conectado' || !_servidor[movId]) return Promise.resolve({ ok: true, enServidor: false });
    return fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'borrar', id: movId, clave: claveEdicion() }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) { _servidor = d.correcciones || {}; return { ok: true, enServidor: true, mensaje: d.mensaje }; }
      return { ok: false, mensaje: (d && d.mensaje) || 'No se pudo borrar en el servidor.' };
    })['catch'](function () { return { ok: false, mensaje: 'No se pudo contactar el servidor.' }; });
  }
  function exportarCorrecciones() {
    const blob = new Blob([JSON.stringify(correccionesUsuario(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'correcciones-granja-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* Movimientos "efectivos": crudo + correcciones automáticas del exportador
     + reclasificaciones guardadas por el usuario en este navegador. */
  function movimientosEfectivos() {
    const corr = correccionesUsuario();
    return movimientos().map(m => {
      const c = corr[m.id];
      if (!c) return m;
      return Object.assign({}, m, {
        proyecto: c.proyecto || m.proyecto,
        producto: c.producto || m.producto,
        correccionUsuario: c,
      });
    });
  }

  /* Un movimiento reclasificado como "no pertenece a la granja" se sigue MOSTRANDO
     en el libro (con su nota), pero deja de sumar en los totales, en los proyectos
     y en los gráficos: por eso se corrigió. */
  const FUERA = 'FUERA_DE_GRANJA';
  function esFueraDeGranja(m) { return m.proyecto === FUERA; }
  function soloDeLaGranja(movs) { return (movs || movimientosEfectivos()).filter(m => !esFueraDeGranja(m)); }

  /* ------- filtro por periodo (FLUJO) -------
     Devuelve solo las filas cuyo campo de fecha cae dentro del periodo activo
     (window.ESTADO). Si ESTADO no existe o el periodo abarca todo el corte,
     devuelve la lista completa. Las filas sin fecha se excluyen cuando el
     periodo es parcial (no se pueden ubicar en el tramo). */
  function enPeriodo(filas, campoFecha) {
    filas = filas || [];
    if (!window.ESTADO || typeof ESTADO.periodo !== 'function') return filas;
    if (ESTADO.esPeriodoCompleto()) return filas;
    const p = ESTADO.periodo();
    const campo = campoFecha || 'fecha';
    return filas.filter(f => { const v = f[campo]; return v && v >= p.desde && v <= p.hasta; });
  }
  function movimientosDelPeriodo() { return enPeriodo(movimientosEfectivos()); }
  function etiquetaPeriodo() { return (window.ESTADO && ESTADO.etiquetaPeriodo) ? ESTADO.etiquetaPeriodo() : ''; }

  function totales(movs) {
    movs = soloDeLaGranja(movs);
    let ing = 0, egr = 0;
    for (const m of movs) { ing += m.ingresos || 0; egr += m.egresos || 0; }
    return { ingresos: ing, egresos: egr, balance: ing - egr, n: movs.length };
  }
  function porProyecto(movs) {
    const map = {};
    for (const m of soloDeLaGranja(movs)) {
      const k = m.proyecto || '(sin proyecto)';
      map[k] = map[k] || { proyecto: k, ingresos: 0, egresos: 0 };
      map[k].ingresos += m.ingresos || 0;
      map[k].egresos += m.egresos || 0;
    }
    return Object.values(map).map(x => (x.balance = x.ingresos - x.egresos, x));
  }
  function porMes(movs) {
    const map = {};
    for (const m of soloDeLaGranja(movs)) {
      if (!m.fecha) continue;
      const k = m.fecha.slice(0, 7);
      map[k] = map[k] || { mes: k, ingresos: 0, egresos: 0 };
      map[k].ingresos += m.ingresos || 0;
      map[k].egresos += m.egresos || 0;
    }
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
  }
  function produccionMensual(codigo) {
    const rows = (window.DATA_PRODUCCION.produccion[codigo] || []);
    const map = {};
    for (const r of rows) {
      if (!r.fecha) continue;
      const k = r.fecha.slice(0, 7);
      map[k] = map[k] || { mes: k, unidades: 0, danados: 0 };
      map[k].unidades += r.unidades || 0;
      map[k].danados += r.danados || 0;
    }
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
  }

  /* ------- componentes HTML ------- */
  let ayudaSeq = 0;
  /* Botón "?" superíndice + panel popover nativo (sin JS). */
  function ayuda(titulo, html) {
    const id = 'ayuda-' + (++ayudaSeq);
    return `<button type="button" class="ayuda" popovertarget="${id}" aria-label="Ayuda: ${esc(titulo)}">?</button>` +
      `<div id="${id}" popover class="panel-ayuda"><h4>${esc(titulo)}</h4>${html}</div>`;
  }
  /* Cuadro de control: franja que explica QUÉ se ve, DE DÓNDE sale y su estado. */
  function cuadroControl(o) {
    // o: {icono, titulo, queVes, deDondeSale, corte, estado: {tipo:'ok|alerta|error|info|neutro', texto}, ayudaHtml, extraMeta}
    const chip = o.estado ? `<span class="chip-${o.estado.tipo}">${o.estado.icono || ''} ${esc(o.estado.texto)}</span>` : '';
    // Si hay un periodo PARCIAL activo y el llamador no fijó un «corte» propio,
    // la cabecera refleja el tramo que se está viendo (p. ej. «julio de 2026 (tramo del corte)»).
    let corte = o.corte;
    if (!corte) {
      if (window.ESTADO && typeof ESTADO.esPeriodoCompleto === 'function' && !ESTADO.esPeriodoCompleto()) {
        corte = ESTADO.etiquetaPeriodo() + ' (tramo del corte)';
      } else {
        corte = '31 de julio de 2026';
      }
    }
    return `<header class="cuadro-control">
      <h3><span aria-hidden="true">${o.icono || '📋'}</span> ${esc(o.titulo)} ${o.ayudaHtml ? ayuda(o.titulo, o.ayudaHtml) : ''} ${chip}</h3>
      <p class="descripcion"><strong>Qué estás viendo:</strong> ${esc(o.queVes)}</p>
      <p class="meta"><span><strong>De dónde sale:</strong> ${esc(o.deDondeSale)}</span><span><strong>Corte:</strong> ${esc(corte)}</span>${o.extraMeta || ''}</p>
    </header>`;
  }

  function qs(name) { return new URLSearchParams(location.search).get(name); }

  return { cop, num, fecha, mesLabel, esc, proyectos, proyecto, movimientos, movimientosEfectivos,
           correccionesUsuario, guardarCorreccion, borrarCorreccion, exportarCorrecciones,
           sincronizar, sincronizarAlimentacion, consultarHojaAlimentacion, alimentacionDelServidor, estadoServidor, claveEdicion, recordarClave, claveRecordada, olvidarClave, autor, recordarAutor,
           totales, porProyecto, porMes, produccionMensual, esFueraDeGranja, soloDeLaGranja, enPeriodo, movimientosDelPeriodo, etiquetaPeriodo, ayuda, cuadroControl, qs, MESES };
})();
