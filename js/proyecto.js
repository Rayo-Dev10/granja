/* proyecto.js — página de detalle de un proyecto (secciones según los datos que existan). */
(function () {
  'use strict';
  const G = window.GRANJA, CH = window.CHARTS;
  const cod = G.qs('p');
  const p = G.proyecto(cod);
  const cont = document.getElementById('contenido-proyecto');
  if (!p) {
    cont.innerHTML = `<h1>Proyecto no encontrado</h1>
      <p class="text-neutral-600 mt-2">El enlace no corresponde a ningún proyecto del catálogo.
      Vuelva a la <a href="proyectos">lista de proyectos</a> y elija uno.</p>`;
    return;
  }
  document.title = p.nombre + ' · Granja San José — Institución Universitaria Oriente de Caldas';

  const ICONO = { BIOINSUMOS:'🧪', HUERTA:'🥬', CAFE_CENICAFE_I:'☕', GANADO_BOVINO:'🐄', CODORNICES:'🥚',
    GALLINAS_PONEDORAS:'🐔', CONEJOS:'🐰', POLLOS:'🐤', APICOLA:'🐝', CERDOS:'🐷', OVINOS:'🐑',
    PISCICOLA:'🐟', PINO_ROMERON:'🌲', AMBIENTE_CREATIVO:'🌳', PINO_PATULA:'🌲', OTRO_MADERAS:'🪵', OTROS_GRANJA:'🏡' };

  // agrupa filas diarias de producción {fecha, unidades, danados} por mes (YYYY-MM)
  function agruparProdMes(rows) {
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

  function render() {
  // FLUJO: movimientos de dinero del proyecto, acotados al periodo activo.
  const movs = G.enPeriodo(G.movimientosEfectivos().filter(m => m.proyecto === cod));
  const t = G.totales(movs);
  const moEjecutiva = window.MANOOBRA ? MANOOBRA.repartoProyecto(cod, 'B_OPERACION', 7) : { costoTotal:0 };
  const resultadoEjecutivo = t.balance - (moEjecutiva.costoTotal || 0);
  // FLUJO: producción (huevos recogidos), acotada al periodo activo.
  const prodTodo = window.DATA_PRODUCCION.produccion[cod] || [];
  const prod = G.enPeriodo(prodTodo, 'fecha');
  // STOCK / histórico: inventario y sanitario NO se filtran por periodo.
  const inv = window.DATA_INVENTARIOS.eventos.filter(e => e.proyecto === cod);
  const san = window.DATA_SANITARIO.eventos.filter(e => e.proyecto === cod);
  const compras = window.DATA_ALIMENTO.compras.filter(c => c.proyecto === cod);

  let html = `
  <div class="flex flex-wrap items-center gap-3 mb-3 no-imprimir">
    <button type="button" id="btn-volver" class="btn-sec !py-1.5 text-sm">← Volver</button>
    <nav aria-label="Ruta de navegación" class="text-sm text-neutral-500"><a href="proyectos">Proyectos</a> › ${G.esc(p.nombre)}</nav>
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <h1 class="text-3xl wrap-anywhere">${ICONO[cod] || '📌'} ${G.esc(p.nombre)}</h1>
    ${p.estado === 'Activo' ? '<span class="chip-ok">✔ Activo</span>' : '<span class="chip-neutro">⏸ Sin movimientos en 2026</span>'}
  </div>
  <p class="text-neutral-600 mt-1 mb-6">Proyecto <strong>${G.esc(p.tipo)}</strong> del área <strong>${G.esc(p.area)}</strong> ·
    Responsable: <strong>${G.esc(p.responsable)}</strong> ·
    <a href="hojas-vida?p=${cod}">📁 Ver su hoja de vida</a> · <a href="controles#${cod}">🚦 Ver sus controles</a></p>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
    <div class="kpi"><span class="titulo">💰 Ingresos 2026 ${G.ayuda('Ingresos del proyecto', '<p>Todo el dinero que entró por ventas de este proyecto según el Libro caja diario.</p>')}</span><span class="valor text-success-700">${G.cop(t.ingresos)}</span><span class="lectura">${movs.filter(m => m.ingresos).length} ventas registradas · <a href="#movimientos">ver movimientos ↓</a></span></div>
    <div class="kpi"><span class="titulo">💸 Egresos 2026</span><span class="valor text-danger-700">${G.cop(t.egresos)}</span><span class="lectura">${movs.filter(m => m.egresos).length} gastos registrados · <a href="#movimientos">ver movimientos ↓</a></span></div>
    <div class="kpi"><span class="titulo">⚖️ Saldo de caja</span><span class="valor ${t.balance >= 0 ? 'text-success-700' : 'text-danger-700'}">${(t.balance >= 0 ? '+' : '−')}${G.cop(Math.abs(t.balance)).replace('$', '$ ')}</span><span class="lectura">Ingresos menos egresos; no incluye personal</span></div>
    <div class="kpi ${resultadoEjecutivo < 0 ? 'border-danger-500' : ''}"><span class="titulo">📉 Resultado económico estimado</span><span class="valor ${resultadoEjecutivo >= 0 ? 'text-success-700' : 'text-danger-700'}">${resultadoEjecutivo > 0 ? '+' : ''}${G.cop(Math.round(resultadoEjecutivo))}</span><span class="lectura">Saldo de caja menos ≈ ${G.cop(Math.round(moEjecutiva.costoTotal || 0))} de mano de obra atribuida</span></div>
  </div>`;

  /* ---- Controles del proyecto (motor de coherencia) ---- */
  if (window.SEGUIMIENTO_UI) {
    const at = window.ESTADO ? ESTADO.periodo().hasta : '2026-07-31';
    html += SEGUIMIENTO_UI.inventory(cod, at);
  }
  if (window.COHERENCIA && typeof COHERENCIA.resumenProyecto === 'function') {
    html += `<section aria-label="Controles del proyecto" class="mb-8">${COHERENCIA.resumenProyecto(cod)}</section>`;
  }

  /* ---- Economía mensual ---- */
  if (movs.length) {
    const pm = G.porMes(movs);
    html += G.cuadroControl({
      icono: '📈', titulo: '¿Cómo le fue mes a mes?',
      queVes: 'los ingresos (verde) y los gastos (rojo) de este proyecto, sumados por mes.',
      deDondeSale: 'Libro caja diario, filtrado por este proyecto',
      ayudaHtml: '<p>Cada punto es un mes de 2026. Si la línea verde va por encima de la roja, ese mes el proyecto aportó más de lo que gastó. Los meses sin punto no tuvieron registros.</p>',
    }) + `<div class="cuadro-cuerpo">` + CH.lineas({
      titulo: 'Ingresos y egresos por mes de ' + p.nombre,
      lectura: 'Lectura: cada punto es un mes; verde = lo que entró, rojo = lo que se gastó.',
      series: [
        { nombre: 'Ingresos', color: CH.COLORES.verde, puntos: pm.map(x => ({ x: x.mes, y: x.ingresos })) },
        { nombre: 'Egresos', color: CH.COLORES.rojo, puntos: pm.map(x => ({ x: x.mes, y: x.egresos })) },
      ],
    }) + `</div>`;
  } else {
    html += `<div class="alerta-azul">ℹ️ <strong>Este proyecto no tiene movimientos de dinero registrados en 2026.</strong> No es un error del sitio: en el libro de la granja no aparece ni una venta ni un gasto para ${G.esc(p.nombre)}. Si esto no debería ser así, es un hallazgo para revisar con el responsable.</div>`;
  }

  /* ---- Producción (huevos) — FLUJO: acotada al periodo ---- */
  if (prod.length) {
    const pm = agruparProdMes(prod);
    const total = pm.reduce((a, x) => a + x.unidades, 0);
    const unidad = window.DATA_PRODUCCION.unidades[cod] || 'unidad';
    const primero = pm[0], ultimo = pm[pm.length - 1];
    const tendencia = ultimo.unidades < primero.unidades * 0.8;
    html += G.cuadroControl({
      icono: '🥚', titulo: '¿Cuánto se produjo?',
      queVes: `los huevos recogidos cada mes (${G.num(total)} en total de enero a julio). Unidad: ${unidad}.`,
      deDondeSale: 'registro de recolección diaria de la hoja del proyecto',
      estado: tendencia
        ? { tipo: 'alerta', icono: '⚠', texto: `la producción bajó de ${G.num(primero.unidades)} a ${G.num(ultimo.unidades)}/mes` }
        : { tipo: 'ok', icono: '✔', texto: 'producción estable' },
      ayudaHtml: `<p>La granja anota todos los días cuántos huevos recoge. Aquí se suman por mes.</p><p class="mt-1">⚠ La marca amarilla aparece cuando el último mes produjo al menos 20&nbsp;% menos que el primero: puede deberse a la edad de las aves o a la mortalidad, y es una señal para tomar decisiones.</p>`,
    }) + `<div class="cuadro-cuerpo">` + CH.lineas({
      titulo: 'Producción mensual de ' + p.nombre,
      lectura: 'Lectura: cada punto es la suma de la recolección diaria de ese mes.',
      series: [{ nombre: 'Huevos recogidos', color: CH.COLORES.azul, puntos: pm.map(x => ({ x: x.mes, y: x.unidades })) }],
    }) + `</div>`;
  }

  if (window.SEGUIMIENTO_UI && ['GALLINAS_PONEDORAS', 'CODORNICES'].includes(cod)) {
    html += SEGUIMIENTO_UI.posture(cod, prod);
  }

  /* ---- Revelaciones (conciliación de huevos) — respeta el periodo activo ---- */
  if (window.REVELACIONES && typeof REVELACIONES.deProyecto === 'function') {
    try {
      const revs = REVELACIONES.deProyecto(cod);
      if (revs && revs.length) {
        html += revs.map(r => `<div class="mb-8">${REVELACIONES.render(r)}</div>`).join('');
      }
    } catch (e) { /* nunca romper la ficha por una revelación */ }
  }

  /* ---- Inventario de animales ---- */
  if (inv.length) {
    const lotes = [...new Set(inv.map(e => e.lote).filter(Boolean))];
    const filas = inv.map(e => `<tr>
      <td class="whitespace-nowrap">${G.fecha(e.fecha)}${e.fechaTexto ? ' <span title="Fecha original en texto: «' + G.esc(e.fechaTexto) + '»">✱</span>' : ''}</td>
      <td>${G.esc(e.lote || '')}</td><td>${G.esc(e.especie || '')}</td>
      <td class="money">${e.cantidad != null ? G.num(e.cantidad) : ''}</td>
      <td class="money">${e.nacimientos != null ? G.num(e.nacimientos) : ''}</td>
      <td class="money text-danger-700">${e.bajas != null ? G.num(e.bajas) : ''}</td>
      <td class="money font-semibold">${e.saldo != null ? G.num(e.saldo) : (e.saldoTexto ? G.esc(e.saldoTexto) : '')}</td>
      <td class="text-xs text-neutral-600">${G.esc(e.obs || '')}</td></tr>`).join('');
    const notaInv = (window.ESTADO && !ESTADO.esPeriodoCompleto())
      ? `<div class="alerta-azul">ℹ️ <strong>El inventario es un saldo, no un flujo: no se filtra por periodo.</strong> Muestra siempre el estado del hato según el último registro del libro, aunque esté viendo un tramo del corte.</div>`
      : '';
    html += G.cuadroControl({
      icono: '🐾', titulo: '¿Cuántos animales hay? (inventario)',
      queVes: `los movimientos del inventario de animales: entradas, nacimientos, bajas (muertes o ventas) y el saldo que la granja anotó. ${lotes.length > 1 ? 'Este proyecto maneja ' + lotes.length + ' lotes.' : ''}`,
      deDondeSale: 'hoja del proyecto en el libro de control',
      corte: '31 de julio de 2026',   // STOCK: saldo al corte, no se filtra por periodo
      ayudaHtml: `<p>Cada fila es un registro del cuaderno de la granja. El <strong>saldo</strong> es el número de animales vivos después de ese registro.</p><p class="mt-1">El inventario es un <strong>saldo</strong> (cuántos animales hay), no un flujo, así que no se recorta por periodo: siempre se muestra completo.</p><p class="mt-1">Importante: en el libro original estos saldos se escribieron A MANO (no con fórmulas), por eso el módulo de <a href="controles">Controles</a> verifica si la cuenta cuadra y avisa cuando no.</p><p class="mt-1">El símbolo ✱ marca fechas que estaban escritas como texto.</p>`,
    }) + `<div class="cuadro-cuerpo">${notaInv}<table>
      <caption class="sr-only">Inventario de animales de ${G.esc(p.nombre)}</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Lote</th><th scope="col">Especie</th><th scope="col" class="text-right">Entrada</th><th scope="col" class="text-right">Nacim.</th><th scope="col" class="text-right">Bajas</th><th scope="col" class="text-right">Saldo</th><th scope="col">Observaciones</th></tr></thead>
      <tbody>${filas}</tbody></table></div>`;
  }

  /* ---- Control sanitario ---- */
  const tieneAnimales = inv.length || prod.length;
  if (san.length) {
    html += G.cuadroControl({
      icono: '🩺', titulo: 'Control sanitario',
      queVes: 'las actividades de salud animal registradas: vacunas, curaciones, desinfecciones.',
      deDondeSale: 'bloque de control sanitario de la hoja del proyecto',
      corte: '31 de julio de 2026',   // histórico: no se filtra por periodo
      estado: { tipo: 'ok', icono: '✔', texto: san.length + ' actividades registradas' },
      ayudaHtml: '<p>Cada fila es una actividad sanitaria con su fecha, el producto usado y las observaciones del técnico.</p>',
    }) + `<div class="cuadro-cuerpo"><table>
      <caption class="sr-only">Control sanitario de ${G.esc(p.nombre)}</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Actividad</th><th scope="col">Producto</th><th scope="col">Dosis</th><th scope="col">Observaciones</th></tr></thead>
      <tbody>${san.map(e => `<tr><td class="whitespace-nowrap">${G.fecha(e.fecha)}</td><td>${G.esc(e.actividad || '')}</td><td>${G.esc(e.producto || '')}</td><td>${G.esc(e.dosis || '')}</td><td class="text-xs text-neutral-600">${G.esc(e.obs || '')}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (tieneAnimales) {
    html += `<div class="alerta-amarilla">🩺 <strong>Sin registros sanitarios.</strong> Este proyecto tiene animales pero el libro no registra ninguna vacuna, desparasitación ni tratamiento${cod === 'GALLINAS_PONEDORAS' ? ' desde junio de 2025' : ''}. Es uno de los hallazgos de la revisión: el registro sanitario debe empezar a llevarse al día.</div>`;
  }

  /* ---- Alimentación: lo que se compró y lo que de verdad se entregó ---- */
  const AL = (window.COHERENCIA && COHERENCIA.ALIMENTO) ? COHERENCIA.ALIMENTO : null;
  const sumin = (AL && AL.datosSuministros()) ? AL.suministroDe(cod, null, null) : { kg: 0, dias: 0, porMes: [], porSub: [] };
  const kg1 = v => {
    if (v == null) return '—';
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? G.num(r) : r.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  if (compras.length || sumin.kg) {
    const totalCosto = compras.reduce((a, c) => a + (c.costo || 0), 0);
    const totalKg = compras.reduce((a, c) => a + (c.kg || 0), 0);

    if (sumin.kg) {
      /* --- SÍ hay registro diario de entrega --- */
      const S = AL.datosSuministros();
      const precioKg = AL.precioKg(cod) || 0;
      const costoEntregado = sumin.kg * precioKg;
      const esHuevos = !!AL.HUEVOS_POR_CUBETA[cod];
      const porCubeta = AL.HUEVOS_POR_CUBETA[cod] || null;
      const v = AL.ventanaCruce();
      const smVentana = AL.suministroDe(cod, v.desde, v.hasta);
      const prodVentana = AL.huevosEntre(cod, v.desde, v.hasta);
      const costoVentana = smVentana.kg * precioKg;
      const porHuevo = (esHuevos && prodVentana.unidades) ? costoVentana / prodVentana.unidades : null;
      const costoCubeta = porHuevo != null ? porHuevo * porCubeta : null;
      const venta = esHuevos ? AL.ventaHuevosEntre(cod, v.desde, v.hasta) : null;
      const pierde = venta && venta.porHuevo != null && porHuevo != null && porHuevo > venta.porHuevo;
      const prodMes = esHuevos ? G.produccionMensual(cod) : [];
      const huevosDeMes = m => { const x = prodMes.find(p => p.mes === m); return x ? x.unidades : null; };

      html += G.cuadroControl({
        icono: '🌾', titulo: 'Alimentación: lo que se compró y lo que se entregó',
        queVes: `el concentrado comprado para este proyecto (${kg1(totalKg)} kg por ${G.cop(totalCosto)}) y, desde el 1.° de mayo de 2026, el que efectivamente se le entregó a los animales día a día: ${kg1(sumin.kg)} kg en ${G.num(sumin.dias)} días.`,
        deDondeSale: 'compras: Libro caja diario (categoría Alimentación, 1 bulto = 40 kg) · entregas: registro diario de alimentación de la granja',
        corte: `entregas del ${G.fecha(S.periodo.desde)} al ${G.fecha(S.periodo.hasta)}`,
        estado: pierde
          ? { tipo: 'error', icono: '✖', texto: 'el alimento cuesta más que lo que se vende' }
          : { tipo: 'ok', icono: '✔', texto: G.num(sumin.dias) + ' días con registro de entrega' },
        ayudaHtml: `<p>Hay dos cosas distintas: lo que se <strong>compró</strong> (sale del libro de caja) y lo que se <strong>entregó</strong> a los animales (sale del registro diario de alimentación que la granja lleva desde el 1.° de mayo de 2026).</p>
          <p class="mt-1">El <strong>costo del alimento entregado</strong> se calcula multiplicando los kilos entregados por el precio medio del kilo comprado de este proyecto (${G.cop(Math.round(precioKg))}). Es una aproximación honesta: los bultos no siempre costaron lo mismo.</p>
          ${esHuevos ? `<p class="mt-1">El <strong>costo por huevo</strong> se calcula solo con el periodo en que hay las dos cosas (alimento entregado y huevos recogidos): del ${G.fecha(v.desde)} al ${G.fecha(v.hasta)}. Cuenta únicamente el alimento: no incluye mano de obra, agua, luz ni el costo de las aves.</p>` : ''}
          <p class="mt-1">Antes del 1.° de mayo de 2026 no hay registro de entrega: por eso los kilos comprados son más que los entregados.</p>`,
      }) + `<div class="cuadro-cuerpo">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="kpi"><span class="titulo">🛒 Alimento comprado en 2026</span><span class="valor">${kg1(totalKg)} kg</span><span class="lectura">${G.cop(totalCosto)} en ${G.num(compras.length)} compra(s)</span></div>
          <div class="kpi"><span class="titulo">🥣 Alimento entregado</span><span class="valor">${kg1(sumin.kg)} kg</span><span class="lectura">en ${G.num(sumin.dias)} días de registro, desde el 1.° de mayo</span></div>
          <div class="kpi"><span class="titulo">💵 Costo del alimento entregado</span><span class="valor">${G.cop(Math.round(costoEntregado))}</span><span class="lectura">kilos entregados × ${G.cop(Math.round(precioKg))} el kilo (precio medio de compra)</span></div>
        </div>`;

      if (porHuevo != null) {
        html += `<div class="grid gap-4 sm:grid-cols-2 mt-4">
          <div class="kpi"><span class="titulo">🥚 Cuesta de alimento cada huevo</span><span class="valor ${pierde ? 'text-danger-700' : ''}">${G.cop(Math.round(porHuevo))}</span><span class="lectura">${kg1(smVentana.kg)} kg (${G.cop(Math.round(costoVentana))}) para ${G.num(prodVentana.unidades)} huevos, del ${G.fecha(v.desde)} al ${G.fecha(v.hasta)}</span></div>
          <div class="kpi"><span class="titulo">📦 Cuesta de alimento cada cubeta de ${porCubeta}</span><span class="valor ${pierde ? 'text-danger-700' : ''}">${G.cop(Math.round(costoCubeta))}</span><span class="lectura">${venta && venta.porHuevo != null ? 'y la cubeta se vendió a ' + G.cop(Math.round(venta.porHuevo * porCubeta)) : 'sin ventas de huevos en el periodo para comparar'}</span></div>
        </div>`;
        if (pierde) {
          html += `<div class="alerta-roja mt-4">✖ <strong>Cada cubeta se está vendiendo por debajo de lo que cuesta alimentarla.</strong>
            El alimento de una cubeta de ${porCubeta} huevos cuesta ${G.cop(Math.round(costoCubeta))} y la cubeta se vendió a ${G.cop(Math.round(venta.porHuevo * porCubeta))}.
            En el periodo entraron ${G.cop(venta.ingresos)} por venta de huevos y el alimento costó ${G.cop(Math.round(costoVentana))}: quedan ${G.cop(Math.abs(Math.round(venta.ingresos - costoVentana)))} en contra, contando solo el alimento.
            No es un error del registro: es una decisión que hay que tomar (bajar el costo del alimento por huevo o revisar el precio de venta). <a href="controles#${cod}">Ver el control completo →</a></div>`;
        }
      }

      /* gráfico: kilos entregados por mes (y huevos, cuando los hay) */
      const series = [{ nombre: 'Kilos de alimento entregados', color: CH.COLORES.amarillo, puntos: sumin.porMes.map(x => ({ x: x.mes, y: Math.round(x.kg * 10) / 10 })) }];
      if (esHuevos) {
        const mesesSum = sumin.porMes.map(x => x.mes);
        series.push({ nombre: 'Huevos recogidos', color: CH.COLORES.azul, puntos: prodMes.filter(p => mesesSum.indexOf(p.mes) >= 0).map(p => ({ x: p.mes, y: p.unidades })) });
      }
      html += CH.lineas({
        titulo: 'Alimento entregado por mes en ' + p.nombre,
        lectura: esHuevos
          ? 'Lectura: cada punto es un mes. La línea amarilla son los kilos de alimento entregados y la azul los huevos recogidos. Nota: las dos líneas comparten la misma escala vertical, así que sirven para ver si suben y bajan juntas, no para compararlas entre sí.'
          : 'Lectura: cada punto es la suma de los kilos entregados en ese mes, según el registro diario.',
        series,
      });

      /* tabla resumen mensual */
      const filasMes = sumin.porMes.map(x => {
        const c = x.kg * precioKg;
        const h = esHuevos ? huevosDeMes(x.mes) : null;
        const cel = [`<td>${G.esc(G.mesLabel(x.mes))}</td>`, `<td class="money">${kg1(x.kg)}</td>`, `<td class="money">${G.cop(Math.round(c))}</td>`];
        if (esHuevos) {
          cel.push(`<td class="money">${h != null ? G.num(h) : '—'}</td>`);
          cel.push(`<td class="money">${h ? G.cop(Math.round(c / h)) : '—'}</td>`);
        }
        return `<tr>${cel.join('')}</tr>`;
      }).join('');
      const totKgMes = sumin.porMes.reduce((a, x) => a + x.kg, 0);
      const totHue = esHuevos ? sumin.porMes.reduce((a, x) => a + (huevosDeMes(x.mes) || 0), 0) : 0;
      html += `<table class="mt-4">
        <caption class="sr-only">Alimento entregado mes a mes en ${G.esc(p.nombre)}</caption>
        <thead><tr><th scope="col">Mes</th><th scope="col" class="text-right">Kilos entregados</th><th scope="col" class="text-right">Costo del alimento</th>${esHuevos ? '<th scope="col" class="text-right">Huevos recogidos</th><th scope="col" class="text-right">Costo por huevo</th>' : ''}</tr></thead>
        <tbody>${filasMes}
          <tr class="font-semibold"><th scope="row" class="text-left">Total del registro</th><td class="money">${kg1(totKgMes)}</td><td class="money">${G.cop(Math.round(totKgMes * precioKg))}</td>${esHuevos ? `<td class="money">${G.num(totHue)}</td><td class="money">${totHue ? G.cop(Math.round(totKgMes * precioKg / totHue)) : '—'}</td>` : ''}</tr>
        </tbody>
      </table>`;
      const finMes = new Date(S.periodo.hasta + 'T00:00:00Z');
      const diaSiguiente = new Date(finMes.getTime() + 86400000);
      if (diaSiguiente.getUTCMonth() === finMes.getUTCMonth()) {
        html += `<p class="text-xs text-neutral-500 mt-1">El último mes de la tabla está incompleto: el registro de entrega llega hasta el ${G.fecha(S.periodo.hasta)}, así que ese mes tiene menos días que los demás.</p>`;
      }

      /* desglose por grupos dentro del proyecto (por ejemplo hembras y machos) */
      if (sumin.porSub.length > 1) {
        html += `<h4 class="mt-6 mb-1 font-semibold">Dentro del proyecto: ¿a qué grupo se le entregó?</h4>
        <p class="text-sm text-neutral-600">El registro diario separa grupos de animales. Así se repartieron los ${kg1(sumin.kg)} kg entregados:</p>
        <table class="mt-2"><caption class="sr-only">Alimento entregado por grupo en ${G.esc(p.nombre)}</caption>
        <thead><tr><th scope="col">Grupo</th><th scope="col" class="text-right">Kilos entregados</th><th scope="col" class="text-right">Costo</th><th scope="col" class="text-right">Parte del total</th></tr></thead>
        <tbody>${sumin.porSub.map(x => `<tr><td>${G.esc(x.sub === 'GENERAL' ? 'Todo el proyecto' : x.sub.charAt(0) + x.sub.slice(1).toLowerCase())}</td><td class="money">${kg1(x.kg)}</td><td class="money">${G.cop(Math.round(x.kg * precioKg))}</td><td class="money">${G.num(Math.round(100 * x.kg / sumin.kg))} %</td></tr>`).join('')}</tbody></table>`;
      }

      html += `<p class="alerta-azul mt-4">ℹ️ <strong>El registro diario de alimentación empieza el 1.° de mayo de 2026.</strong>
        Antes de esa fecha la granja no anotaba cuánto alimento entregaba, así que de enero a abril no hay ningún dato de entrega:
        lo comprado en esos meses no se puede repartir entre los animales sin inventarlo, y por eso aquí no aparece.</p>`;

      html += `<h4 class="mt-6 mb-1 font-semibold">Las compras de alimento de este proyecto</h4>`;
    } else {
      html += G.cuadroControl({
        icono: '🌾', titulo: 'Alimentación: lo que se compró',
        queVes: `las compras de concentrado para este proyecto: ${G.num(totalKg)} kg por ${G.cop(totalCosto)} en total.`,
        deDondeSale: 'Libro caja diario (categoría Alimentación); 1 bulto = 40 kg',
        corte: '31 de julio de 2026',   // prorrateado/histórico: se incluye completo, no se corta por periodo
        estado: { tipo: 'alerta', icono: '⚠', texto: 'este proyecto todavía no registra el alimento entregado' },
        ayudaHtml: `<p>Aquí está todo el alimento COMPRADO. Desde el 1.° de mayo de 2026 la granja lleva un registro diario del alimento que ENTREGA a los animales, pero ese registro todavía no incluye este proyecto.</p><p class="mt-1">Por eso aquí no se puede saber si el alimento comprado alcanzó, sobró o faltó. En <a href="controles">Controles</a> se explica y se propone cómo extenderlo.</p>`,
      }) + `<div class="cuadro-cuerpo">`;
    }

    html += `<table>
      <caption class="sr-only">Compras de alimento de ${G.esc(p.nombre)}</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Detalle</th><th scope="col" class="text-right">Bultos</th><th scope="col" class="text-right">Kilos</th><th scope="col" class="text-right">Costo</th><th scope="col">Fuente</th></tr></thead>
      <tbody>${compras.map(c => `<tr><td class="whitespace-nowrap">${G.fecha(c.fecha)}</td><td>${G.esc(c.detalle || '')}</td><td class="money">${c.bultos != null ? G.num(c.bultos) : '—'}</td><td class="money">${c.kg ? G.num(c.kg) : '—'}</td><td class="money">${G.cop(c.costo)}</td><td class="text-xs ${c.fuente.includes('NO figura') ? 'text-danger-700 font-semibold' : 'text-neutral-500'}">${G.esc(c.fuente)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ---- 👷 Mano de obra ---- */
  if (window.MANOOBRA) {
    const MO = window.MANOOBRA;
    const mo = MO.costoManoObraProyecto(cod);                 // suma sobre todos los periodos registrados
    const costoHoraOp = Math.round(MO.costoHoraOperador());
    const esHuevosP = !!(AL && AL.HUEVOS_POR_CUBETA && AL.HUEVOS_POR_CUBETA[cod]);

    if (mo.hayDatos) {
      /* --- SÍ hay dedicación registrada --- */
      const periodos = [...new Set(mo.imputaciones.map(i => i.periodo))].sort();
      // huevos y alimento por huevo, para el costo unitario COMPLETO en proyectos de huevos
      let huevos = 0, alimPorHuevo = null;
      if (esHuevosP) {
        const pm = G.produccionMensual(cod);
        periodos.forEach(per => { const x = pm.find(m => m.mes === per); if (x) huevos += x.unidades; });
        if (AL) { const v = AL.ventanaCruce(); const precioKg = AL.precioKg(cod) || 0; const sv = AL.suministroDe(cod, v.desde, v.hasta); const pv = AL.huevosEntre(cod, v.desde, v.hasta); if (pv.unidades) alimPorHuevo = sv.kg * precioKg / pv.unidades; }
      }
      const moPorHuevo = (esHuevosP && huevos) ? mo.costo / huevos : null;
      const filasImp = mo.imputaciones.map(i => {
        const rol = MO.rolPorId(i.rolId);
        const r = rol ? MO.calcular(rol) : null;
        const costoFila = r ? r.costoTotalMes * i.porcentaje / 100 : null;
        const horasFila = r ? r.horasMes * i.porcentaje / 100 : null;
        return `<tr><td>${G.esc(i.periodo)}</td><td>${G.esc(rol ? rol.nombre : i.rolId)}</td>
          <td class="money">${G.num(i.porcentaje)} %</td>
          <td class="money">${horasFila != null ? G.num(Math.round(horasFila)) : '—'}</td>
          <td class="money">${costoFila != null ? G.cop(Math.round(costoFila)) : '—'}</td></tr>`;
      }).join('');

      html += G.cuadroControl({
        icono: '👷', titulo: 'Mano de obra imputada a este proyecto',
        queVes: `cuánta dedicación de las personas se ha registrado para este proyecto y cuánto cuesta ese trabajo: ${G.num(mo.personas)} persona(s), ${G.num(Math.round(mo.horas))} horas al mes.`,
        deDondeSale: 'hoja de dedicación de horas de la granja (porcentajes) × costo real de la hora, calculado con la ley vigente a agosto de 2026',
        corte: periodos.length ? ('periodos ' + periodos.join(', ')) : '—',
        estado: { tipo: 'ok', icono: '✔', texto: G.num(mo.imputaciones.length) + ' registro(s) de dedicación' },
        ayudaHtml: '<p>El costo de la mano de obra es el costo real de la hora de cada rol (salario más prestaciones y aportes de ley) multiplicado por el porcentaje de su tiempo dedicado a este proyecto. Vea el detalle del costo por hora en <a href="mano-obra">👷 Mano de obra</a>.</p>',
      }) + `<div class="cuadro-cuerpo">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="kpi"><span class="titulo">👷 Costo de mano de obra al mes</span><span class="valor">${G.cop(Math.round(mo.costo))}</span><span class="lectura">${G.num(mo.personas)} persona(s) con dedicación registrada</span></div>
          <div class="kpi"><span class="titulo">⏱️ Horas dedicadas al mes</span><span class="valor">${G.num(Math.round(mo.horas))}</span><span class="lectura">suma de las dedicaciones registradas</span></div>
          ${moPorHuevo != null ? `<div class="kpi"><span class="titulo">🥚 Costo unitario COMPLETO por huevo</span><span class="valor text-primary-900">${G.cop(Math.round((alimPorHuevo || 0) + moPorHuevo))}</span><span class="lectura">alimento ${G.cop(Math.round(alimPorHuevo || 0))} + mano de obra ${G.cop(Math.round(moPorHuevo))}</span></div>` : `<div class="kpi"><span class="titulo">💵 Costo de una hora (referencia)</span><span class="valor">${G.cop(costoHoraOp)}</span><span class="lectura">operador de granja, ver 👷 Mano de obra</span></div>`}
        </div>
        <table class="mt-4"><caption class="sr-only">Dedicación de horas registrada en ${G.esc(p.nombre)}</caption>
          <thead><tr><th scope="col">Periodo</th><th scope="col">Rol</th><th scope="col" class="text-right">Dedicación</th><th scope="col" class="text-right">Horas/mes</th><th scope="col" class="text-right">Costo/mes</th></tr></thead>
          <tbody>${filasImp}</tbody></table>
      </div>`;
    } else {
      /* No hay horas registradas: se muestra una estimación claramente rotulada. */
      html += G.cuadroControl({
        icono: '👷', titulo: 'Mano de obra estimada',
        queVes: 'una atribución razonable del costo real de personal a este proyecto. No corresponde a horas observadas.',
        deDondeSale: 'costo real de Talento Humano × ICO compuesto e índice sanitario',
        corte: 'enero–julio de 2026',
        estado: { tipo: 'alerta', icono: '≈', texto: 'estimación; sin horas registradas' },
        ayudaHtml: '<p>Talento Humano informó el costo y la dedicación a la granja, pero no la dedicación por proyecto. La estimación usa alimento (35 %), cabezas equivalentes (30 %), eventos (25 %) y un piso igualitario (10 %), más el índice sanitario. Consulte el <a href="dashboard">Dashboard económico</a>.</p>',
      }) + `<div class="cuadro-cuerpo">
        <div class="grid gap-4 sm:grid-cols-2"><div class="kpi"><span class="titulo">≈ Mano de obra al mes</span><span class="valor">${G.cop(Math.round(mo.costoMensualPromedio || 0))}</span><span class="lectura">Estimación, escenario B</span></div><div class="kpi"><span class="titulo">≈ Mano de obra ene–jul</span><span class="valor">${G.cop(Math.round(mo.costoTotal || 0))}</span><span class="lectura">No incluye estructura no distribuida</span></div></div>
        <p class="alerta-amarilla mt-4">⚠️ <strong>No existe registro de horas para este proyecto.</strong> Estas cifras sirven para dimensionar y serán reemplazadas cuando exista una planilla de dedicación. <a href="mano-obra">Ver metodología →</a></p>
      </div>`;
    }
  }

  /* ---- Movimientos del proyecto ---- */
  if (movs.length) {
    html += '<div id="movimientos" class="scroll-mt-4"></div>';
    html += G.cuadroControl({
      icono: '📒', titulo: 'Todos sus movimientos de dinero',
      queVes: `las ${movs.length} filas del Libro caja diario que pertenecen a este proyecto.`,
      deDondeSale: 'Libro caja diario (puede abrirlo completo y filtrar por cualquier proyecto)',
      ayudaHtml: '<p>Es el mismo libro diario, ya filtrado. Para buscar o corregir un movimiento, use la página <a href="diario">Libro diario</a>.</p>',
    }) + `<div class="cuadro-cuerpo"><table>
      <caption class="sr-only">Movimientos de ${G.esc(p.nombre)}</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Detalle</th><th scope="col">Categoría</th><th scope="col" class="text-right">Ingreso</th><th scope="col" class="text-right">Egreso</th></tr></thead>
      <tbody>${movs.map(m => `<tr><td class="whitespace-nowrap">${G.fecha(m.fecha)}</td><td class="max-w-[24rem]">${G.esc(m.detalle || '(sin detalle)')}</td><td>${G.esc(m.producto || '—')}</td><td class="money text-success-700">${m.ingresos ? G.cop(m.ingresos) : ''}</td><td class="money text-danger-700">${m.egresos ? G.cop(m.egresos) : ''}</td></tr>`).join('')}</tbody></table>
      <p class="text-sm mt-3"><a class="btn-sec" href="diario">Abrir el Libro diario completo →</a></p></div>`;
  }

  cont.innerHTML = html;

  /* ---- botón "volver" inteligente: vuelve a la pantalla anterior del mismo sitio,
       o, si se llegó por un enlace directo, a la lista de proyectos ---- */
  (function () {
    const btn = document.getElementById('btn-volver');
    if (!btn) return;
    const ref = document.referrer;
    const mismoSitio = ref && ref.indexOf(location.origin) === 0 && ref !== location.href;
    const nombreDesde = { 'index': 'al resumen', 'proyectos': 'a proyectos', 'diario': 'al libro diario',
      'controles': 'a controles', 'mano-obra': 'a mano de obra', 'hojas-vida': 'a hojas de vida' };
    let etiqueta = 'a proyectos';
    if (mismoSitio) {
      const arch = ref.split('/').pop().split('?')[0].replace('.html', '') || 'index';
      etiqueta = nombreDesde[arch] || 'atrás';
    }
    btn.textContent = '← Volver ' + etiqueta;
    btn.addEventListener('click', function () {
      if (mismoSitio) history.back(); else location.href = 'proyectos';
    });
  })();
  }

  render();
  if (window.ESTADO && ESTADO.alCambiar) ESTADO.alCambiar(render);
})();
