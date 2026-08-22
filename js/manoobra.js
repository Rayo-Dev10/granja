/* manoobra.js — página "👷 Mano de obra".
   Calcula el COSTO REAL de una hora de trabajo (salario + todas las prestaciones y
   aportes de ley vigentes a agosto de 2026), con dos roles conocidos y la posibilidad
   de simular la imputación de horas por proyecto. Nada de imputación real se inventa:
   la tabla real arranca en blanco. La simulación siempre se rotula como simulación. */
(function () {
  'use strict';
  const G = window.GRANJA;
  const D = window.DATA_MANOOBRA;
  const cont = document.getElementById('contenido-mo');

  /* ------- configuración viva: por defecto + lo guardado en el servidor/navegador ------- */
  let cfg = clon(D);
  const simulacion = { activo: false, roles: {} };   // roles[id] = {incluir, dist:{proyecto:pct}}

  function clon(o) { return JSON.parse(JSON.stringify(o)); }
  function pct(x, dec) { return (x * 100).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 3 : dec }) + ' %'; }
  function kg() {}

  /* ------------------- cálculo del costo del empleador por rol ------------------- */
  function calcularRol(rol) {
    const smmlv = cfg.smmlv;
    const salario = rol.usaSmmlv ? smmlv : Math.max(0, +rol.salarioBruto || 0);
    const aplicaAux = salario > 0 && salario <= cfg.topeAuxilioSmmlv * smmlv;
    const auxilio = aplicaAux ? cfg.auxilioTransporte : 0;
    const clase = cfg.clasesARL.find(c => c.clase === rol.claseARL) || cfg.clasesARL[0];
    const lineas = []; let totalConceptos = 0;
    for (const c of cfg.conceptos) {
      const tarifa = c.porRol ? clase.tarifa : c.tarifa;
      const exonerado = c.exonerable && !cfg.empleadorEntidadPublica && salario < 10 * smmlv;
      const baseMonto = c.base === 'salario+auxilio' ? salario + auxilio : salario;
      const monto = exonerado ? 0 : Math.round(baseMonto * tarifa);
      lineas.push({ id: c.id, nombre: c.nombre, grupo: c.grupo, tarifa, base: c.base, baseMonto, monto, exonerado, nota: c.nota, clase: c.porRol ? clase.clase : null });
      totalConceptos += monto;
    }
    const costoTotalMes = salario + auxilio + totalConceptos;
    const horasSemana = +rol.horasSemana || cfg.horasSemanaTiempoCompleto;
    const horasMes = horasSemana * 52 / 12;
    const costoHora = horasMes ? costoTotalMes / horasMes : 0;
    const factor = salario ? costoTotalMes / salario : 0;
    return { salario, auxilio, aplicaAux, lineas, totalConceptos, costoTotalMes, horasSemana, horasMes, costoHora, factor, clase };
  }

  /* =============================== RENDER =============================== */
  function render() {
    let h = `
    <nav aria-label="Ruta" class="text-sm text-neutral-500 mb-3"><a href="./">Inicio</a> › Mano de obra</nav>
    <h1>👷 Mano de obra: ¿cuánto cuesta el trabajo en la granja?</h1>
    <p class="text-neutral-600 mt-2 mb-6 max-w-3xl">Hasta ahora el sitio mostraba lo que la granja <strong>paga con su plata</strong> (el libro de caja).
      Pero buena parte del trabajo no sale de esa caja: lo pagan la universidad o, a veces, profesionales que
      atienden la granja sin cobrar. Esta página calcula, con la ley vigente a <strong>agosto de 2026</strong>, cuánto
      cuesta <strong>realmente</strong> una hora de trabajo, para poder sumarla al costo de cada proyecto.
      ${G.ayuda('¿Por qué esto importa?', '<p>El objeto de la pasantía es un <strong>modelo de costos</strong>. Un modelo que solo cuenta el dinero de la caja está incompleto: ignora el tiempo de las personas, que es el recurso más grande de cualquier granja. Aquí se pone precio a ese tiempo, con total transparencia y sin inventar cifras que la granja todavía no registra.</p>')}
    </p>`;

    h += avisoDatos();
    h += bloqueRoles();
    h += bloqueSimulacion();
    h += bloqueImputacionReal();
    h += bloqueRolesPrevistos();
    h += bloqueDonaciones();

    cont.innerHTML = h;
    conectar();
  }

  /* ---- aviso honesto sobre el estado de los datos ---- */
  function avisoDatos() {
    return `<div class="alerta-azul mb-6">ℹ️ <strong>Cómo leer esta página.</strong> Los <em>costos por hora</em> de más abajo son
      reales: se calculan con las tarifas de ley. Lo que <strong>todavía no existe</strong> es el registro de cuántas horas dedica
      cada persona a cada proyecto: por eso la tabla de imputación está en blanco. Mientras la granja no lleve ese registro,
      use el botón <strong>«Ver con datos simulados»</strong> para ver cómo quedaría el costeo — entendiendo que es una simulación.</div>`;
  }

  /* ============================ ROLES + CALCULADORA ============================ */
  function bloqueRoles() {
    const est = G.estadoServidor ? G.estadoServidor() : { estado: 'desconectado' };
    let h = G.cuadroControl({
      icono: '💵', titulo: 'Costo real de una hora de trabajo, por rol',
      queVes: 'los dos roles que hoy tiene la granja. Para cada uno: el salario que se le paga, todo lo que además cuesta por ley (prestaciones y aportes) y, al final, cuánto cuesta una hora de su trabajo.',
      deDondeSale: 'cálculo automático con la legislación laboral vigente a agosto de 2026 (SMMLV $1.750.905, auxilio $249.095)',
      corte: 'parámetros de agosto de 2026',
      estado: { tipo: 'info', icono: '✏️', texto: 'cifras de ejemplo: cambie el salario bruto y todo se recalcula' },
      ayudaHtml: `<p>Cada rol muestra su <strong>salario bruto</strong> (lo que se le paga en la quincena, al mes) y encima el <strong>factor prestacional</strong>:
        por cada $100 de salario, cuánto cuesta en total el empleado ya con prestaciones y aportes.</p>
        <p class="mt-1">Para actualizar, cambie solo el <strong>salario bruto</strong>. Lo demás se calcula solo.
        La <strong>clase de riesgo (ARL)</strong> se puede ajustar según el cargo: administrativo es clase I, labor de campo es clase V.</p>
        <p class="mt-1">La granja es de una universidad pública, así que <strong>no</strong> tiene la exoneración de aportes de salud, SENA e ICBF
        del artículo 114-1: paga esos aportes completos. Eso hace el costo un poco más alto y es correcto que así se muestre.</p>`,
    }) + `<div class="cuadro-cuerpo"><div class="grid gap-6 lg:grid-cols-2">`;

    cfg.roles.forEach((rol, i) => { h += tarjetaRol(rol, i); });
    h += `</div>`;

    // barra de guardado
    h += `<div class="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
      <button type="button" id="mo-guardar" class="btn">💾 Guardar estos valores en el servidor</button>
      <span id="mo-guardar-estado" class="text-sm text-neutral-500">${est.estado === 'conectado' ? 'Al guardar, cualquiera verá estos salarios desde cualquier computador.' : 'Sin conexión con el servidor: se guardará solo en este navegador.'}</span>
      <button type="button" id="mo-restablecer" class="btn-sec text-sm">↩️ Volver a los valores de ejemplo</button>
      <button type="button" id="mo-excel" class="btn-sec text-sm" title="Descargar los roles y su costo por hora en Excel">⬇️ Excel</button>
    </div></div>`;
    return h;
  }

  function tarjetaRol(rol, idx) {
    const r = calcularRol(rol);
    const grupos = { prestacion: 'Prestaciones sociales', seguridad: 'Seguridad social', parafiscal: 'Aportes parafiscales' };
    let filas = '';
    for (const gk of ['prestacion', 'seguridad', 'parafiscal']) {
      const ls = r.lineas.filter(l => l.grupo === gk);
      const sub = ls.reduce((a, l) => a + l.monto, 0);
      filas += `<tr class="bg-neutral-100"><th colspan="3" class="text-left !py-1 text-xs uppercase tracking-wide text-neutral-500">${grupos[gk]}</th></tr>`;
      for (const l of ls) {
        filas += `<tr>
          <td>${G.esc(l.nombre)}${l.clase ? ` <span class="chip-neutro">clase ${l.clase}</span>` : ''} <span class="ayuda !cursor-help" title="${G.esc(l.nota)}">?</span></td>
          <td class="money text-neutral-500">${l.exonerado ? 'exonerado' : pct(l.tarifa)}</td>
          <td class="money">${l.monto ? G.cop(l.monto) : '—'}</td></tr>`;
      }
      filas += `<tr class="text-sm"><td class="text-right text-neutral-500" colspan="2">Subtotal ${grupos[gk].toLowerCase()}</td><td class="money font-semibold">${G.cop(sub)}</td></tr>`;
    }
    const claseOpts = cfg.clasesARL.map(c => `<option value="${c.clase}" ${rol.claseARL === c.clase ? 'selected' : ''}>Clase ${c.clase} — ${c.tarifa ? pct(c.tarifa) : ''} (${c.ejemplo})</option>`).join('');
    return `<article class="rounded-xl border border-neutral-300 bg-white overflow-hidden" data-rol="${rol.id}">
      <header class="bg-primary-50 border-b border-neutral-200 px-4 py-3">
        <h3 class="flex flex-wrap items-center gap-2">👤 ${G.esc(rol.nombre)}${rol.persona ? ` <span class="chip-info">${G.esc(rol.persona)}</span>` : ''}</h3>
        <p class="text-xs text-neutral-500 mt-0.5">${G.esc(rol.nota || '')}</p>
      </header>
      <div class="p-4 space-y-3">
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-sm font-medium">Salario bruto mensual
            ${rol.usaSmmlv ? `<div class="mt-1 flex items-center gap-2"><input type="number" class="w-full border border-neutral-300 rounded-lg px-2 py-1.5 bg-neutral-100" value="${cfg.smmlv}" disabled><span class="text-xs text-neutral-500">= SMMLV</span></div><label class="flex items-center gap-1 text-xs mt-1"><input type="checkbox" class="mo-usasmmlv" data-rol="${rol.id}" checked> usar el salario mínimo</label>` :
              `<input type="number" min="0" step="50000" class="mo-salario mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5" data-rol="${rol.id}" value="${rol.salarioBruto || 0}"><label class="flex items-center gap-1 text-xs mt-1"><input type="checkbox" class="mo-usasmmlv" data-rol="${rol.id}"> usar el salario mínimo</label>`}
          </label>
          <label class="text-sm font-medium">Clase de riesgo (ARL)
            <select class="mo-arl mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5 bg-white" data-rol="${rol.id}">${claseOpts}</select>
          </label>
          <label class="text-sm font-medium">Horas por semana
            <input type="number" min="1" max="48" class="mo-horas mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1.5" data-rol="${rol.id}" value="${rol.horasSemana}">
            <span class="text-xs text-neutral-500">jornada legal máx.: 42 h</span>
          </label>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="kpi"><span class="titulo">Factor prestacional</span><span class="valor">${r.factor ? r.factor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span><span class="lectura">por cada $1 de salario, el costo total</span></div>
          <div class="kpi"><span class="titulo">Costo total al mes</span><span class="valor">${G.cop(r.costoTotalMes)}</span><span class="lectura">salario ${r.aplicaAux ? '+ auxilio ' : ''}+ prestaciones + aportes</span></div>
          <div class="kpi"><span class="titulo">Costo de una hora</span><span class="valor text-primary-900">${G.cop(Math.round(r.costoHora))}</span><span class="lectura">${Math.round(r.horasMes)} horas al mes</span></div>
        </div>

        <details class="text-sm">
          <summary class="cursor-pointer text-primary-800 font-medium">🔍 Ver el desglose, concepto por concepto</summary>
          <table class="mt-2">
            <caption class="sr-only">Desglose del costo de ${G.esc(rol.nombre)}</caption>
            <thead><tr><th scope="col">Concepto</th><th scope="col" class="text-right">Tarifa</th><th scope="col" class="text-right">Al mes</th></tr></thead>
            <tbody>
              <tr><td>Salario bruto</td><td class="money text-neutral-500">base</td><td class="money">${G.cop(r.salario)}</td></tr>
              ${r.aplicaAux ? `<tr><td>Auxilio de transporte <span class="ayuda !cursor-help" title="Se paga a quien gana hasta 2 salarios mínimos. No es salario, pero sí cuenta para cesantías y prima.">?</span></td><td class="money text-neutral-500">fijo</td><td class="money">${G.cop(r.auxilio)}</td></tr>` : ''}
              ${filas}
              <tr class="font-bold border-t-2 border-neutral-300"><td>Costo total mensual del empleador</td><td></td><td class="money">${G.cop(r.costoTotalMes)}</td></tr>
            </tbody>
          </table>
          <p class="text-xs text-neutral-500 mt-2">Los valores son de referencia y parametrizables. Confírmelos con la nómina o el contador de la institución.</p>
        </details>
      </div>
    </article>`;
  }

  /* ============================ SIMULACIÓN ============================ */
  function proyectosActividad() {
    // proyectos que tienen algún movimiento, producción o inventario (donde tiene sentido imputar trabajo)
    const cods = new Set();
    (G.proyectos() || []).forEach(p => cods.add(p.codigo));
    return (G.proyectos() || []).filter(p => p.estado === 'Activo' || (G.movimientos() || []).some(m => m.proyecto === p.codigo));
  }

  function bloqueSimulacion() {
    const activo = simulacion.activo;
    let h = `<div class="rounded-xl border-2 ${activo ? 'border-warning-500 bg-warning-50' : 'border-dashed border-neutral-300 bg-white'} p-4 mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="!text-lg flex items-center gap-2">🧪 Simulación de imputación de horas</h2>
          <p class="text-sm text-neutral-600 mt-1 max-w-2xl">La granja aún no registra cuántas horas dedica cada persona a cada proyecto.
            Active esta simulación para <strong>ver cómo quedaría el costeo</strong> repartiendo el tiempo de cada rol. Todo lo que aquí aparezca
            está marcado como <strong>simulación</strong> y no se guarda como dato real.</p>
        </div>
        <button type="button" id="mo-sim-toggle" class="btn ${activo ? '!bg-warning-500 !text-warning-900' : ''}">${activo ? '✖ Ocultar la simulación' : '▶ Ver con datos simulados'}</button>
      </div>`;

    if (activo) {
      h += `<div class="mt-4 rounded-lg bg-warning-100 border border-warning-500 px-3 py-2 text-sm text-warning-900">⚠️ <strong>Está viendo una SIMULACIÓN.</strong> Estos costos usan horas inventadas para mostrar el modelo; no son la dedicación real.</div>`;
      const proyectos = proyectosActividad();
      // panel de configuración: por rol, incluir + % por proyecto
      h += `<div class="mt-4 space-y-4">`;
      cfg.roles.forEach(rol => {
        const s = simulacion.roles[rol.id] || { incluir: rol.id === 'ADMIN_GRANJA', dist: {} };
        simulacion.roles[rol.id] = s;
        const usado = Object.values(s.dist).reduce((a, b) => a + (+b || 0), 0);
        h += `<div class="rounded-lg border border-neutral-300 bg-white p-3">
          <label class="flex items-center gap-2 font-medium"><input type="checkbox" class="mo-sim-incluir" data-rol="${rol.id}" ${s.incluir ? 'checked' : ''}> Incluir a <strong>${G.esc(rol.nombre)}</strong>${rol.persona ? ' (' + G.esc(rol.persona) + ')' : ''} en la simulación</label>`;
        if (s.incluir) {
          h += `<p class="text-xs text-neutral-500 mt-1">Reparta el <strong>porcentaje</strong> de su tiempo entre proyectos. Lo que no asigne se considera trabajo general/administrativo.</p>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2">`;
          proyectos.forEach(p => {
            const v = s.dist[p.codigo] || '';
            h += `<label class="flex items-center gap-2 text-sm"><span class="grow truncate" title="${G.esc(p.nombre)}">${G.esc(p.nombre)}</span>
              <input type="number" min="0" max="100" step="5" class="mo-sim-pct w-16 border border-neutral-300 rounded px-1 py-0.5 text-right" data-rol="${rol.id}" data-proy="${p.codigo}" value="${v}">%</label>`;
          });
          h += `</div><p id="mo-asig-${rol.id}" class="text-xs mt-2 ${usado > 100 ? 'text-danger-700 font-semibold' : 'text-neutral-500'}">Asignado: ${usado} % · ${usado > 100 ? 'supera el 100 %' : 'sin asignar (general): ' + (100 - usado) + ' %'}</p>`;
        }
        h += `</div>`;
      });
      h += `</div>`;
      // resultados
      h += `<div id="mo-sim-resultado">` + resultadoSimulacion(proyectos) + `</div>`;
    }
    h += `</div>`;
    return h;
  }

  function resultadoSimulacion(proyectos) {
    // costo mensual simulado por proyecto = Σ rol.costoMes * (%/100)
    const porProy = {}; let general = 0; let totalSim = 0;
    cfg.roles.forEach(rol => {
      const s = simulacion.roles[rol.id];
      if (!s || !s.incluir) return;
      const r = calcularRol(rol);
      let asignado = 0;
      proyectos.forEach(p => {
        const v = +(s.dist[p.codigo] || 0);
        if (v > 0) { const monto = r.costoTotalMes * v / 100; porProy[p.codigo] = (porProy[p.codigo] || 0) + monto; asignado += v; totalSim += monto; }
      });
      const restante = Math.max(0, 100 - asignado);
      general += r.costoTotalMes * restante / 100; totalSim += r.costoTotalMes * restante / 100;
    });
    const filas = proyectos.filter(p => porProy[p.codigo]).sort((a, b) => porProy[b.codigo] - porProy[a.codigo])
      .map(p => `<tr><td><a href="proyecto?p=${p.codigo}">${G.esc(p.nombre)}</a></td><td class="money">${G.cop(Math.round(porProy[p.codigo]))}</td><td class="money text-neutral-500">${G.cop(Math.round(porProy[p.codigo] * 12))}</td></tr>`).join('');
    if (!filas && !general) return `<p class="mt-4 text-sm text-neutral-600">Marque al menos un rol y asígnele algún porcentaje para ver el costeo simulado.</p>`;
    return `<div class="mt-5">
      <h3 class="!text-base mb-2">Costo de mano de obra simulado por proyecto</h3>
      <div class="overflow-x-auto"><table>
        <caption class="sr-only">Costo de mano de obra simulado por proyecto</caption>
        <thead><tr><th scope="col">Proyecto</th><th scope="col" class="text-right">Al mes (simulado)</th><th scope="col" class="text-right">Al año (simulado)</th></tr></thead>
        <tbody>${filas}
          ${general ? `<tr><td class="text-neutral-600">Trabajo general / administrativo (a distribuir)</td><td class="money">${G.cop(Math.round(general))}</td><td class="money text-neutral-500">${G.cop(Math.round(general * 12))}</td></tr>` : ''}
          <tr class="font-bold border-t-2 border-neutral-300"><td>Total mano de obra simulada</td><td class="money">${G.cop(Math.round(totalSim))}</td><td class="money">${G.cop(Math.round(totalSim * 12))}</td></tr>
        </tbody>
      </table></div>
      <p class="text-xs text-neutral-500 mt-2">🧪 Simulación. Cuando la granja registre las horas reales, este mismo cuadro se llenará con datos verdaderos.</p>
    </div>`;
  }

  /* ============================ IMPUTACIÓN REAL (VACÍA) ============================ */
  function bloqueImputacionReal() {
    const hay = (cfg.imputaciones || []).length;
    let h = G.cuadroControl({
      icono: '📋', titulo: 'Imputación real de horas por proyecto',
      queVes: hay ? 'las dedicaciones de tiempo que la granja ha registrado.' : 'la tabla donde se registrará cuánto tiempo dedica cada rol a cada proyecto. Está en blanco porque ese registro todavía no existe.',
      deDondeSale: 'lo que registre la granja (hoja de dedicación). Diana eligió trabajar con porcentajes, más fáciles de mantener.',
      corte: 'sin registros aún',
      estado: hay ? { tipo: 'ok', icono: '✔', texto: `${hay} registros` } : { tipo: 'alerta', icono: '⚠', texto: 'sin registros: pendiente de diligenciar' },
      ayudaHtml: `<p>Esta tabla es la única forma honesta de repartir el costo del trabajo entre los proyectos. Mientras esté vacía, use la <strong>simulación</strong> de arriba.</p><p class="mt-1">No se inventa ningún dato: cuando la granja empiece a registrar, se llena aquí.</p>`,
    }) + `<div class="cuadro-cuerpo">`;
    if (!hay) {
      h += `<div class="text-center py-6">
        <p class="text-4xl mb-2">📝</p>
        <p class="text-neutral-600 max-w-xl mx-auto">Todavía no hay registro de imputación de horas. Cuando la granja lo lleve,
        cada fila dirá: <em>periodo, rol, proyecto y % de dedicación</em>. Por ahora, la simulación de arriba muestra cómo se vería.</p>
        <button type="button" id="mo-add-imp" class="btn-sec mt-4">➕ Añadir una fila de imputación</button>
      </div>`;
    }
    h += `<div id="mo-imp-tabla" class="${hay ? '' : 'hidden'} mt-2"></div></div>`;
    return h;
  }

  /* ============================ ROLES PREVISTOS ============================ */
  function bloqueRolesPrevistos() {
    const filas = cfg.rolesPrevistos.map(r => `<tr>
      <td class="font-medium">${G.esc(r.nombre)}</td>
      <td><span class="chip-neutro">${G.esc(r.tipoCosto)}</span></td>
      <td class="text-neutral-600">${G.esc(r.nota)}</td></tr>`).join('');
    return G.cuadroControl({
      icono: '🧩', titulo: 'Otros roles que trabajan en la granja (pendientes de medir)',
      queVes: 'los demás tipos de personas que aportan trabajo a la granja. Se dejan listados para que sea fácil sumarlos después, con su tipo de costo.',
      deDondeSale: 'identificación de roles hecha en la pasantía',
      corte: 'sin datos de horas ni costos aún',
      estado: { tipo: 'info', icono: 'ℹ', texto: 'listos para diligenciar cuando haya datos' },
      ayudaHtml: '<p>No se registra todavía cuántas horas aportan ni cuánto cuestan. El sistema queda preparado para relacionarlos fácilmente más adelante, con cualquier combinación de rol y proyecto.</p>',
    }) + `<div class="cuadro-cuerpo"><table>
      <caption class="sr-only">Roles previstos</caption>
      <thead><tr><th scope="col">Rol</th><th scope="col">Tipo de costo</th><th scope="col">Nota</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <p class="text-sm text-neutral-600 mt-3">➕ Añadir un rol o una combinación nueva es escribir una fila en <code>data/manoobra.js</code> (campo <code>rolesPrevistos</code>) o registrarlo cuando exista la hoja de dedicación.</p>
      </div>`;
  }

  /* ============================ DONACIONES / HALLAZGO ARL ============================ */
  function bloqueDonaciones() {
    return G.cuadroControl({
      icono: '🎁', titulo: 'Donación de servicios profesionales — y un riesgo que conviene revisar',
      queVes: 'el caso de profesionales (por ejemplo veterinarios o zootecnistas) que a veces atienden la granja sin cobrar. Su trabajo tiene un valor de mercado que hoy no se cuenta, y su presencia trae un riesgo que sí conviene revisar.',
      deDondeSale: 'identificación de la pasantía',
      corte: 'sin registro aún',
      estado: { tipo: 'alerta', icono: '⚠', texto: 'riesgo de cobertura de ARL en las donaciones de servicio' },
      ayudaHtml: '<p>Registrar estas donaciones sirve para dos cosas: mostrar el valor real del apoyo que recibe la granja, y no perder de vista un riesgo de seguridad y salud en el trabajo.</p>',
    }) + `<div class="cuadro-cuerpo">
      <div class="alerta-amarilla">⚠️ <strong>Hallazgo — riesgo de cobertura de ARL en las donaciones de servicios.</strong>
        Cuando un profesional externo realiza un procedimiento en la granja <strong>sin vínculo ni afiliación a riesgos laborales (ARL)</strong>,
        y llegara a sufrir un accidente durante esa labor, puede no haber cobertura y la responsabilidad recaería sobre la institución.
        No es un problema de quién dona su tiempo —que es valioso—, sino de <strong>formalizar la relación</strong>: una afiliación temporal a ARL,
        un permiso o convenio, o un registro de la actividad, protegen a la persona y a la universidad.</div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-neutral-300 p-3"><h4 class="font-semibold">Qué se recomienda</h4>
          <ul class="list-disc ml-4 mt-1 text-sm text-neutral-700 space-y-1">
            <li>Llevar un registro de cada visita de un profesional que dona su servicio (fecha, persona, procedimiento).</li>
            <li>Verificar con Talento Humano cómo afiliar temporalmente a ARL a quien va a realizar una labor de riesgo.</li>
            <li>Valorar ese trabajo donado a precio de mercado, para mostrar el apoyo real que recibe la granja.</li>
          </ul></div>
        <div class="rounded-lg border border-neutral-300 p-3"><h4 class="font-semibold">Cómo registrarlo aquí (cuando haya datos)</h4>
          <p class="text-sm text-neutral-700 mt-1">El rol <strong>«Profesional que dona sus servicios»</strong> ya está previsto. Se le puede asignar un costo de
          mercado imputado (no sale de la caja) y relacionarlo con el proyecto que atendió, igual que cualquier otro rol.</p></div>
      </div>
    </div>`;
  }

  /* =============================== EVENTOS =============================== */
  function conectar() {
    document.querySelectorAll('.mo-salario').forEach(el => el.addEventListener('input', e => {
      setRol(e.target.dataset.rol, r => r.salarioBruto = +e.target.value); reRenderRoles();
    }));
    document.querySelectorAll('.mo-usasmmlv').forEach(el => el.addEventListener('change', e => {
      setRol(e.target.dataset.rol, r => r.usaSmmlv = e.target.checked); render();
    }));
    document.querySelectorAll('.mo-arl').forEach(el => el.addEventListener('change', e => {
      setRol(e.target.dataset.rol, r => r.claseARL = e.target.value); reRenderRoles();
    }));
    document.querySelectorAll('.mo-horas').forEach(el => el.addEventListener('input', e => {
      setRol(e.target.dataset.rol, r => r.horasSemana = +e.target.value); reRenderRoles();
    }));
    const g = document.getElementById('mo-guardar'); if (g) g.addEventListener('click', guardar);
    const rb = document.getElementById('mo-restablecer'); if (rb) rb.addEventListener('click', () => { cfg = clon(D); render(); });
    const bx = document.getElementById('mo-excel'); if (bx && window.EXPORTA) bx.addEventListener('click', exportarExcel);
    const st = document.getElementById('mo-sim-toggle'); if (st) st.addEventListener('click', () => { simulacion.activo = !simulacion.activo; render(); });
    document.querySelectorAll('.mo-sim-incluir').forEach(el => el.addEventListener('change', e => {
      const s = simulacion.roles[e.target.dataset.rol] || { dist: {} }; s.incluir = e.target.checked; simulacion.roles[e.target.dataset.rol] = s; render();
    }));
    document.querySelectorAll('.mo-sim-pct').forEach(el => el.addEventListener('input', e => {
      const s = simulacion.roles[e.target.dataset.rol]; if (!s) return; s.dist[e.target.dataset.proy] = +e.target.value; reRenderSim();
    }));
    const ai = document.getElementById('mo-add-imp'); if (ai) ai.addEventListener('click', () => alert('El registro real de horas se habilitará cuando la granja empiece a llevar la hoja de dedicación. Por ahora use la simulación.'));
  }

  function setRol(id, fn) { const r = cfg.roles.find(x => x.id === id); if (r) fn(r); }

  /* ---- exportar la hoja de roles a Excel ---- */
  function exportarExcel() {
    if (!window.EXPORTA) return;
    const filas = [['Rol', 'Persona', 'Salario bruto', 'Auxilio', 'Costo total mes', 'Factor', 'Costo hora', 'Clase ARL']];
    cfg.roles.forEach(rol => {
      const r = calcularRol(rol);
      filas.push([
        rol.nombre || rol.id,
        rol.persona || '',
        r.salario,
        r.auxilio,
        r.costoTotalMes,
        Math.round(r.factor * 100) / 100,
        Math.round(r.costoHora),
        r.clase ? r.clase.clase : '',
      ]);
    });
    EXPORTA.descargar('granja_mano_obra', [{ nombre: 'Mano de obra', filas: filas }]);
  }

  // re-render solo del bloque de roles (para no perder el foco de otros inputs de la página)
  function reRenderRoles() {
    // recalcular tarjetas en su sitio
    cfg.roles.forEach(rol => {
      const art = document.querySelector(`article[data-rol="${rol.id}"]`);
      if (!art) return;
      const tmp = document.createElement('div'); tmp.innerHTML = tarjetaRol(rol);
      art.replaceWith(tmp.firstElementChild);
    });
    // reconectar los inputs de las tarjetas nuevas
    reconectarRoles();
    if (simulacion.activo) reRenderSim();
  }
  function reconectarRoles() {
    document.querySelectorAll('.mo-salario').forEach(el => el.addEventListener('input', e => { setRol(e.target.dataset.rol, r => r.salarioBruto = +e.target.value); reRenderRoles(); }));
    document.querySelectorAll('.mo-usasmmlv').forEach(el => el.addEventListener('change', e => { setRol(e.target.dataset.rol, r => r.usaSmmlv = e.target.checked); render(); }));
    document.querySelectorAll('.mo-arl').forEach(el => el.addEventListener('change', e => { setRol(e.target.dataset.rol, r => r.claseARL = e.target.value); reRenderRoles(); }));
    document.querySelectorAll('.mo-horas').forEach(el => el.addEventListener('input', e => { setRol(e.target.dataset.rol, r => r.horasSemana = +e.target.value); reRenderRoles(); }));
  }
  function reRenderSim() {
    const cont2 = document.getElementById('mo-sim-resultado');
    if (!cont2) { render(); return; }
    cont2.innerHTML = resultadoSimulacion(proyectosActividad());
    cfg.roles.forEach(rol => {
      const s = simulacion.roles[rol.id]; if (!s || !s.incluir) return;
      const usado = Object.values(s.dist).reduce((a, b) => a + (+b || 0), 0);
      const el = document.getElementById('mo-asig-' + rol.id);
      if (el) { el.textContent = 'Asignado: ' + usado + ' % · ' + (usado > 100 ? 'supera el 100 %' : 'sin asignar (general): ' + (100 - usado) + ' %'); el.className = 'text-xs mt-2 ' + (usado > 100 ? 'text-danger-700 font-semibold' : 'text-neutral-500'); }
    });
  }

  /* =============================== GUARDADO =============================== */
  function guardar() {
    const payload = { roles: cfg.roles, empleadorEntidadPublica: cfg.empleadorEntidadPublica, smmlv: cfg.smmlv, auxilioTransporte: cfg.auxilioTransporte, imputaciones: cfg.imputaciones, notasRevelacion: cfg.notasRevelacion };
    try { localStorage.setItem('granja_manoobra', JSON.stringify(payload)); } catch (e) {}
    const est = G.estadoServidor ? G.estadoServidor() : { estado: 'desconectado' };
    const salida = document.getElementById('mo-guardar-estado');
    if (est.estado !== 'conectado') { salida.textContent = '✔ Guardado en este navegador (sin servidor).'; return; }
    const clave = G.claveEdicion ? G.claveEdicion() : '';
    if (est.exigeClave && !clave) { pedirClaveYGuardar(payload); return; }
    enviar(payload, clave);
  }
  function pedirClaveYGuardar(payload) {
    const clave = prompt('Escriba la contraseña para guardar los valores de mano de obra en el servidor:');
    if (clave == null) return;
    if (G.recordarClave) G.recordarClave(clave, false);
    enviar(payload, clave);
  }
  function enviar(payload, clave) {
    const salida = document.getElementById('mo-guardar-estado'); salida.textContent = 'Guardando…';
    fetch('api/manoobra.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave, datos: payload }) })
      .then(r => r.json()).then(d => {
        if (d && d.ok) salida.innerHTML = '<span class="text-success-700 font-semibold">✔ Guardado en el servidor.</span> Lo verá cualquiera desde cualquier computador.';
        else if (d && d.claveInvalida) salida.innerHTML = '<span class="text-danger-700 font-semibold">🔒 Contraseña incorrecta.</span>';
        else salida.innerHTML = '<span class="text-danger-700">No se pudo guardar: ' + G.esc((d && d.mensaje) || 'error') + '</span>';
      })['catch'](() => { salida.innerHTML = '<span class="text-danger-700">Sin conexión con el servidor. Se guardó solo en este navegador.</span>'; });
  }

  /* =============================== INICIO =============================== */
  function cargar() {
    // 1) valores del servidor si los hay
    const fromLocal = () => { try { return JSON.parse(localStorage.getItem('granja_manoobra') || 'null'); } catch (e) { return null; } };
    const aplicar = (ov) => { if (!ov) return; if (ov.roles) cfg.roles = ov.roles; if (ov.smmlv) cfg.smmlv = ov.smmlv; if (ov.auxilioTransporte) cfg.auxilioTransporte = ov.auxilioTransporte; if (typeof ov.empleadorEntidadPublica === 'boolean') cfg.empleadorEntidadPublica = ov.empleadorEntidadPublica; if (ov.imputaciones) cfg.imputaciones = ov.imputaciones; if (ov.notasRevelacion) cfg.notasRevelacion = ov.notasRevelacion; };
    if (location.protocol === 'file:') { aplicar(fromLocal()); render(); return; }
    fetch('api/manoobra.php', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.ok && d.datos) aplicar(d.datos); else aplicar(fromLocal());
    })['catch'](() => aplicar(fromLocal())).finally(render);
  }

  cargar();
})();
