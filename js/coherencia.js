/* coherencia.js — motor de coherencia de la Granja San José.
   Revisa, con los mismos datos que muestran las demás páginas, si las cuentas cuadran
   entre sí (inventarios, producción, ventas, alimento, sanitario y libro diario)
   y lo cuenta en frases sencillas. No inventa cifras: todo se calcula aquí, salvo
   dos conciliaciones documentales que se citan como constantes con su explicación.

   API pública:
     COHERENCIA.controles()            -> [{id, proyecto|null, tema, nivel, titulo, queRevisa, hallazgo, recomendacion, detalleHtml?}]
     COHERENCIA.resumenProyecto(cod)   -> HTML compacto "en un solo vistazo" para proyecto
*/
window.COHERENCIA = (function () {
  'use strict';
  const G = window.GRANJA;

  /* Dos cifras DOCUMENTALES (no calculables desde data/*.js porque provienen de la
     comparación entre la hoja del proyecto y CAJA DIARIO, verificada en auditoría): */
  const CONCILIACION_GALLINAS = {
    caja: 3456000,   // CAJA DIARIO fila 9: 36 bultos × $96.000 (aritméticamente consistente)
    hoja: 3436000,   // Hoja PROY. GALLINAS, cuadro CONCENTRADOS: mismo lote digitado distinto
  };
  const HUEVOS_POR_CUBETA = { GALLINAS_PONEDORAS: 30, CODORNICES: 24 };

  const NIVEL_PESO = { error: 3, alerta: 2, info: 1, ok: 0 };
  const NIVEL_CHIP = {
    ok: { clase: 'chip-ok', icono: '✔' },
    alerta: { clase: 'chip-alerta', icono: '⚠' },
    error: { clase: 'chip-error', icono: '✖' },
    info: { clase: 'chip-info', icono: 'ℹ' },
    neutro: { clase: 'chip-neutro', icono: '—' },
  };
  const TEMAS = [
    { tema: 'sanitario', icono: '🩺', nombre: 'Sanitario' },
    { tema: 'alimentacion', icono: '🌾', nombre: 'Alimentación' },
    { tema: 'produccion', icono: '🥚', nombre: 'Producción' },
    { tema: 'inventario', icono: '🐾', nombre: 'Inventario' },
    { tema: 'trazabilidad', icono: '🔎', nombre: 'Trazabilidad' },
  ];

  function nombreP(cod) {
    if (cod === 'FUERA_DE_GRANJA') return 'Fuera de la granja';
    const p = G.proyecto(cod);
    return p ? p.nombre : (cod || '—');
  }
  function tabla(cabeceras, filas) {
    return `<table class="mt-2"><thead><tr>${cabeceras.map(c => `<th scope="col">${G.esc(c)}</th>`).join('')}</tr></thead>` +
      `<tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  /* ================= 1. CADENA DE INVENTARIO ================= */
  /* Recorre los eventos de cada lote en el orden del libro y compara el saldo ANOTADO
     con el saldo que da la aritmética (entradas + nacimientos − bajas). */
  function analizarLote(eventos) {
    let calc = null;            // saldo calculado
    let entradas = 0, muertes = 0, bajasTotales = 0;
    const saltos = [], notas = [];
    let obsPendientes = [];     // observaciones desde el último saldo verificado

    for (const ev of eventos) {
      let delta = 0;
      if (ev.nacimientos) delta += ev.nacimientos;
      if (ev.bajas) {
        delta -= ev.bajas;
        bajasTotales += ev.bajas;
        if (!/vend/i.test(ev.obs || '')) muertes += ev.bajas;
      }
      if (ev.obs) obsPendientes.push(ev.obs);

      const esEntradaConCosto = ev.cantidad != null && ((ev.costoTotal || 0) > 0 || (ev.costoUnitario || 0) > 0);
      if (ev.cantidad != null) {
        if (calc === null || esEntradaConCosto) {
          // primer registro del lote o compra/ingreso con costo: entra al inventario
          delta += ev.cantidad; entradas += ev.cantidad;
        } else if (ev.cantidad <= 5 && !esEntradaConCosto) {
          // cantidad pequeña sin costo en lote ya iniciado: en el libro son muertes
          // anotadas en la columna CANTIDAD (patrón verificado en gallinas lote 1)
          delta -= ev.cantidad; muertes += ev.cantidad; bajasTotales += ev.cantidad;
          notas.push(`Fila ${ev.fila} (${G.fecha(ev.fecha)}): la cantidad ${ev.cantidad} sin costo se interpretó como baja anotada en la columna CANTIDAD${ev.obs ? ` («${ev.obs}»)` : ''}.`);
        } else {
          // cantidad grande sin costo: es un conteo/saldo digitado en la columna CANTIDAD
          // (se compara contra el saldo calculado ANTES de las bajas/nacimientos de la misma fila)
          if (ev.cantidad !== calc) {
            saltos.push({ ev, esperado: calc, registrado: ev.cantidad, causa: causaProbable(obsPendientes), enCantidad: true });
            obsPendientes = [];
          }
          calc = ev.cantidad;
          // el saldo anotado en la misma fila (si existe) se compara en el bloque de abajo
        }
      }

      if (calc === null) {
        if (delta !== 0) { calc = 0; } // primera entrada del lote
        else if (ev.saldo != null) { calc = ev.saldo; entradas += calc; obsPendientes = []; continue; }
        else continue; // todavía no hay ningún dato numérico del lote
      }
      calc += delta;

      if (ev.saldo != null) {
        const saldoEsFilaPropia = ev.cantidad != null && ev.saldo === ev.cantidad && esEntradaConCosto;
        if (!saldoEsFilaPropia && ev.saldo !== calc) {
          saltos.push({ ev, esperado: calc, registrado: ev.saldo, causa: causaProbable(obsPendientes) });
          calc = ev.saldo; // se continúa desde lo anotado, para no arrastrar el mismo salto
        }
        obsPendientes = [];
      }
    }
    return { saltos, notas, entradas, muertes, bajasTotales, saldoFinal: calc };
  }
  function causaProbable(obsList) {
    const texto = obsList.join(' · ');
    if (/vend/i.test(texto)) return 'las observaciones del periodo mencionan ventas que no se registraron en la columna de bajas: «' + texto + '»';
    if (/nac|cria|cría/i.test(texto)) return 'las observaciones del periodo mencionan nacimientos que no se registraron en la columna de nacimientos: «' + texto + '»';
    if (/muer/i.test(texto)) return 'las observaciones del periodo mencionan muertes que no se registraron en la columna de bajas: «' + texto + '»';
    return null;
  }

  function controlesInventario() {
    const out = [];
    const porLote = {};
    for (const ev of window.DATA_INVENTARIOS.eventos) {
      const k = ev.proyecto + '||' + (ev.lote || '');
      (porLote[k] = porLote[k] || []).push(ev);
    }
    const porProyecto = {};
    for (const k of Object.keys(porLote)) {
      const [cod, lote] = k.split('||');
      (porProyecto[cod] = porProyecto[cod] || []).push({ lote: lote || null, analisis: analizarLote(porLote[k]) });
    }
    for (const cod of Object.keys(porProyecto)) {
      const lotes = porProyecto[cod];
      const saltos = lotes.flatMap(l => l.analisis.saltos.map(s => Object.assign({ lote: l.lote }, s)));
      const notas = lotes.flatMap(l => l.analisis.notas);
      const conCausa = saltos.filter(s => s.causa).length;
      let detalle = '';
      if (saltos.length) {
        detalle = '<p class="text-sm">Cada fila de esta tabla es un punto donde el saldo anotado en el libro no coincide con la cuenta aritmética (lo que había + nacimientos − bajas):</p>' +
          tabla(['Lote', 'Fila del libro', 'Fecha', 'La cuenta da', 'El libro anota', 'Causa probable'],
            saltos.map(s => [
              G.esc(s.lote || '—'), 'fila ' + s.ev.fila, G.esc(G.fecha(s.ev.fecha)),
              `<strong>${G.num(s.esperado)}</strong>`, `<strong>${G.num(s.registrado)}</strong>`,
              s.causa ? G.esc(s.causa) : '<span class="text-neutral-500">sin explicación en el libro</span>',
            ]));
        if (notas.length) detalle += `<p class="text-xs text-neutral-500 mt-2">${notas.map(G.esc).join('<br>')}</p>`;
      }
      out.push({
        id: 'inv-' + cod, proyecto: cod, tema: 'inventario',
        nivel: saltos.length === 0 ? 'ok' : (conCausa === saltos.length ? 'alerta' : 'error'),
        titulo: '¿Cuadra la cuenta de animales?',
        queRevisa: 'que el saldo de animales anotado en el inventario coincida, fila por fila, con la suma aritmética: lo que había, más los nacimientos y las entradas, menos las bajas.',
        hallazgo: saltos.length === 0
          ? `La cadena de saldos de ${nombreP(cod)} cierra sin saltos: cada saldo anotado coincide con la aritmética de las filas anteriores.`
          : `En ${nombreP(cod)} el saldo anotado se separa de la cuenta aritmética en ${G.num(saltos.length)} punto(s); por ejemplo, ` +
            `en la fila ${saltos[0].ev.fila} la cuenta da ${G.num(saltos[0].esperado)} pero el libro anota ${G.num(saltos[0].registrado)}.` +
            (conCausa ? ` En ${G.num(conCausa)} de los saltos las observaciones del libro dan la causa probable (ventas, nacimientos o muertes escritas solo como texto).` : ''),
        recomendacion: saltos.length === 0
          ? 'Mantener la disciplina de registrar cada entrada, nacimiento y baja en su columna. El saldo debería calcularse siempre con fórmula, nunca a mano.'
          : 'Registrar cada venta, nacimiento y muerte en su propia columna (no solo en las observaciones) y convertir la columna de saldo en una fórmula, para que nunca vuelva a saltar sola.',
        detalleHtml: detalle || null,
      });
    }
    return { controles: out, porProyecto };
  }

  /* ================= 2. PRODUCCIÓN vs VENTAS (huevos) ================= */
  function ventasHuevosCaja(cod) {
    const filas = [];
    let totalHuevos = 0;
    for (const m of G.movimientosEfectivos()) {
      if (m.proyecto !== cod || !m.ingresos || m.producto !== 'Huevos' || m.cantidad == null) continue;
      const porUnidad = m.ingresos / m.cantidad;
      // Detección de unidad: si el precio implícito por unidad es de cubeta (≥ $2.000)
      // o la cantidad es pequeña (<40) y el detalle habla de cubetas, la fila está en CUBETAS.
      const esCubeta = porUnidad >= 2000 || (m.cantidad < 40 && /CUBETA/i.test(m.detalle || '') && porUnidad >= 2000);
      const huevos = esCubeta ? m.cantidad * HUEVOS_POR_CUBETA[cod] : m.cantidad;
      totalHuevos += huevos;
      filas.push({ m, esCubeta, huevos, porUnidad });
    }
    return { filas, totalHuevos };
  }
  function ventasHuevosHoja(cod) {
    const meses = (window.DATA_PRODUCCION.ventasTexto || {})[cod] || [];
    let cubetas = 0;
    const filas = [];
    for (const v of meses) {
      let mm = /se\s*vendieron\s*(?:cubetas\s*)?(\d+)/i.exec(v.texto) || /(\d+)\s*cubetas/i.exec(v.texto);
      const n = mm ? +mm[1] : null;
      if (n != null) cubetas += n;
      filas.push({ mes: v.mes, cubetas: n, texto: v.texto });
    }
    return { filas, cubetas, huevos: cubetas * HUEVOS_POR_CUBETA[cod] };
  }
  function controlesProduccionVentas() {
    const out = [];
    for (const cod of ['GALLINAS_PONEDORAS', 'CODORNICES']) {
      const prod = (window.DATA_PRODUCCION.produccion || {})[cod] || [];
      if (!prod.length) continue;
      let producido = 0, danados = 0;
      for (const r of prod) { producido += r.unidades || 0; danados += r.danados || 0; }
      const neto = producido - danados;
      const caja = ventasHuevosCaja(cod);
      const hoja = ventasHuevosHoja(cod);
      const porCubeta = HUEVOS_POR_CUBETA[cod];
      const excesoHoja = hoja.huevos - neto;   // >0: se vendió más de lo producido
      const sobranteCaja = neto - caja.totalHuevos;

      const nivel = excesoHoja > 0 ? 'error' : (Math.abs(sobranteCaja) > neto * 0.05 ? 'alerta' : 'ok');
      const convertidas = caja.filas.filter(f => f.esCubeta).length;
      const detalle =
        `<p class="text-sm"><strong>Nota sobre las unidades:</strong> en el libro CAJA DIARIO unas filas de venta de huevos están anotadas
         en <em>huevos sueltos</em> y otras en <em>cubetas</em> (cubeta de ${porCubeta} huevos en este proyecto). Para poder comparar,
         este sitio detecta las filas en cubetas (el precio implícito por unidad es de cubeta, $2.000 o más) y las convierte
         multiplicando por ${porCubeta}. Se convirtieron ${G.num(convertidas)} de ${G.num(caja.filas.length)} filas:</p>` +
        tabla(['Movimiento', 'Fecha', 'Cantidad anotada', 'Unidad detectada', 'Huevos equivalentes', 'Ingreso'],
          caja.filas.map(f => [
            `<a href="diario#${f.m.id}">${f.m.id}</a>`, G.esc(G.fecha(f.m.fecha)), G.num(f.m.cantidad),
            f.esCubeta ? `cubetas ×${porCubeta}` : 'huevos sueltos', G.num(f.huevos), `<span class="money">${G.cop(f.m.ingresos)}</span>`,
          ])) +
        `<p class="text-sm mt-3">Ventas mensuales según la hoja del proyecto (texto embebido en el libro, en cubetas):</p>` +
        tabla(['Mes', 'Cubetas leídas', 'Texto original del libro'],
          hoja.filas.map(f => [G.esc(G.mesLabel(f.mes)), f.cubetas == null ? '—' : G.num(f.cubetas), `<span class="text-xs">${G.esc(f.texto)}</span>`])) +
        `<p class="text-sm mt-3">Resumen: producidos ${G.num(producido)}${danados ? ` (menos ${G.num(danados)} dañados = ${G.num(neto)} netos)` : ''} ·
         vendidos según la hoja del proyecto ${G.num(hoja.cubetas)} cubetas = ${G.num(hoja.huevos)} huevos ·
         vendidos según CAJA DIARIO ≈ ${G.num(caja.totalHuevos)} huevos.</p>`;

      out.push({
        id: 'prodventas-' + cod, proyecto: cod, tema: 'produccion',
        nivel,
        titulo: '¿Se vendió lo mismo que se produjo?',
        queRevisa: 'que los huevos vendidos (según la hoja del proyecto y según el libro CAJA DIARIO) no superen los huevos recogidos día a día, convirtiendo primero todas las cifras a huevos sueltos.',
        hallazgo: excesoHoja > 0
          ? `En ${nombreP(cod)} lo vendido supera lo producido: la hoja registra ventas por ${G.num(hoja.cubetas)} cubetas (= ${G.num(hoja.huevos)} huevos) pero la recolección diaria suma ${G.num(neto)} huevos netos, es decir, se vendieron ≈ ${G.num(excesoHoja)} huevos más de los que el libro dice haber recogido. Puede haber un inventario inicial de huevos sin registrar o unidades mezcladas.`
          : (nivel === 'alerta'
            ? `En ${nombreP(cod)} se produjeron ${G.num(neto)} huevos netos y las ventas anotadas en CAJA DIARIO equivalen a ≈ ${G.num(caja.totalHuevos)} huevos: quedan ≈ ${G.num(sobranteCaja)} huevos sin venta registrada en caja (parte puede estar en cartera, consumo o ventas anotadas solo en la hoja: allí figuran ${G.num(hoja.cubetas)} cubetas = ${G.num(hoja.huevos)} huevos).`
            : `En ${nombreP(cod)} la producción (${G.num(neto)} huevos netos) y las ventas registradas cuadran razonablemente.`),
        recomendacion: 'Anotar SIEMPRE la unidad junto a la cantidad (huevos o cubetas) y registrar las ventas mensuales en filas normales, no como texto dentro de una celda combinada.',
        detalleHtml: detalle,
      });
    }
    return out;
  }

  /* ================= 3. ALIMENTO: COMPRADO, SUMINISTRADO Y LO QUE CUESTA ================= */
  /* Desde el 1 de mayo de 2026 la granja lleva un registro diario del alimento que
     REALMENTE se le da a cada proyecto (data/suministros.js). Con ese dato y el precio
     medio del kilo comprado ya se puede decir cuánto cuesta alimentar cada proyecto,
     cuánto cuesta cada huevo y si la ración diaria se parece a la que recomienda la técnica. */

  /* Referencias técnicas de manejo (rangos de manual, para comparar; no son metas de la granja). */
  const REFERENCIA = {
    GALLINAS_PONEDORAS: { gramosMin: 110, gramosMax: 120, posturaMin: 80, posturaMax: 90, animales: 'gallinas' },
    CODORNICES: { gramosMin: 22, gramosMax: 25, posturaMin: 70, posturaMax: 80, animales: 'codornices' },
  };

  /* Los kilos se muestran con un decimal solo cuando hace falta (13,5 kg pero 190 kg). */
  function kgTxt(v) {
    if (v == null) return '—';
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? G.num(r) : r.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function datosSuministros() { return window.DATA_SUMINISTROS || null; }

  /* Precio medio del kilo de cada proyecto = todo lo que costaron sus compras de
     concentrado dividido por los kilos comprados. Las compras sin kilos anotados
     suman al costo (por eso encarecen un poco el kilo): así no se pierde ni un peso. */
  function comprasPorProyecto() {
    const map = {};
    for (const c of (window.DATA_ALIMENTO.compras || [])) {
      const p = (map[c.proyecto] = map[c.proyecto] || { kg: 0, costo: 0, n: 0, sinKg: 0 });
      p.n++; p.costo += c.costo || 0;
      if (c.kg != null) p.kg += c.kg; else p.sinKg++;
    }
    for (const k of Object.keys(map)) map[k].precioKg = map[k].kg ? map[k].costo / map[k].kg : null;
    return map;
  }
  function precioKg(cod) { const c = comprasPorProyecto()[cod]; return c ? c.precioKg : null; }

  /* Suministro de un proyecto entre dos fechas (ambas incluidas). */
  function suministroDe(cod, desde, hasta) {
    const S = datosSuministros();
    const vacio = { kg: 0, dias: 0, registros: [], porMes: [], porSub: [], porDia: {} };
    if (!S) return vacio;
    const regs = S.registros.filter(r => r.proyecto === cod &&
      (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta));
    if (!regs.length) return vacio;
    const dias = {}, meses = {}, subs = {};
    let kg = 0;
    for (const r of regs) {
      kg += r.kg || 0;
      dias[r.fecha] = (dias[r.fecha] || 0) + (r.kg || 0);
      const m = r.fecha.slice(0, 7);
      meses[m] = (meses[m] || 0) + (r.kg || 0);
      const s = r.subproyecto || 'GENERAL';
      subs[s] = (subs[s] || 0) + (r.kg || 0);
    }
    return {
      kg, dias: Object.keys(dias).length, registros: regs, porDia: dias,
      porMes: Object.keys(meses).sort().map(m => ({ mes: m, kg: meses[m] })),
      porSub: Object.keys(subs).sort().map(s => ({ sub: s, kg: subs[s] })),
    };
  }
  /* Ventana en la que se pueden cruzar alimento y producción: desde que empezó el
     registro de alimentación hasta el corte del libro. */
  function ventanaCruce() {
    const S = datosSuministros();
    if (!S) return null;
    const corte = (window.DATA_CATALOGO && window.DATA_CATALOGO.corte) || '2026-07-31';
    return { desde: S.periodo.desde, hasta: (S.periodo.hasta < corte ? S.periodo.hasta : corte) };
  }
  function huevosEntre(cod, desde, hasta) {
    const filas = (window.DATA_PRODUCCION.produccion || {})[cod] || [];
    let unidades = 0, danados = 0, dias = 0;
    for (const r of filas) {
      if (!r.fecha || r.fecha < desde || r.fecha > hasta) continue;
      unidades += r.unidades || 0; danados += r.danados || 0; dias++;
    }
    return { unidades, danados, dias };
  }
  /* Precio de venta observado: lo que de verdad se cobró por los huevos en esa ventana. */
  function ventaHuevosEntre(cod, desde, hasta) {
    const porCubeta = HUEVOS_POR_CUBETA[cod] || 30;
    let ingresos = 0, huevos = 0, filas = 0;
    for (const m of G.movimientosEfectivos()) {
      if (m.proyecto !== cod || !m.ingresos || m.producto !== 'Huevos') continue;
      if (!m.fecha || m.fecha < desde || m.fecha > hasta) continue;
      ingresos += m.ingresos; filas++;
      if (m.cantidad != null) {
        const porUnidad = m.ingresos / m.cantidad;
        huevos += (porUnidad >= 2000) ? m.cantidad * porCubeta : m.cantidad;
      }
    }
    return { ingresos, huevos, filas, porHuevo: huevos ? ingresos / huevos : null, porCubeta };
  }
  /* Animales vivos según el inventario (suma del saldo final de cada lote). */
  function animalesVivos(invPorProyecto, cod) {
    const lotes = (invPorProyecto || {})[cod] || [];
    let n = 0;
    for (const l of lotes) if (l.analisis && l.analisis.saldoFinal > 0) n += l.analisis.saldoFinal;
    return n;
  }
  function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
  /* Ingresos del proyecto en el libro de caja (para decir si el alimento ya se convirtió en ventas). */
  function ingresosDe(cod) {
    let s = 0;
    for (const m of G.movimientosEfectivos()) if (m.proyecto === cod) s += m.ingresos || 0;
    return s;
  }

  /* --- 3.a comprado vs suministrado, proyecto por proyecto --- */
  function controlesAlimento(invPorProyecto) {
    const out = [];
    const S = datosSuministros();
    const compras = comprasPorProyecto();
    const periodoTxt = S ? `del ${G.fecha(S.periodo.desde)} al ${G.fecha(S.periodo.hasta)}` : '';

    let kgTotal = 0, costoTotal = 0, sinKg = 0;
    for (const cod of Object.keys(compras)) { kgTotal += compras[cod].kg; costoTotal += compras[cod].costo; sinKg += compras[cod].sinKg; }
    const suministradoTotal = S ? S.registros.reduce((s, r) => s + (r.kg || 0), 0) : 0;

    function nivelAlimento(comprado, suministrado) {
      if (suministrado > comprado) return 'error';                 // habría salido más alimento del que entró
      if (!suministrado) return 'alerta';                          // sin registro de suministro
      if (comprado > 0 && (comprado - suministrado) / comprado < 0.20) return 'alerta'; // queda poco margen
      return 'ok';
    }
    function costoConsumo(cod, kg) { const p = compras[cod] && compras[cod].precioKg; return p ? kg * p : 0; }

    /* --- resumen general --- */
    const filasGlobal = Object.keys(compras).map(cod => {
      const c = compras[cod];
      const sm = suministroDe(cod, null, null);
      const margen = c.kg ? (c.kg - sm.kg) / c.kg : null;
      return { cod, c, sm, margen, costoConsumo: costoConsumo(cod, sm.kg), nivel: nivelAlimento(c.kg, sm.kg) };
    }).sort((a, b) => b.sm.kg - a.sm.kg);
    const conRegistro = filasGlobal.filter(f => f.sm.kg > 0);
    const sinRegistro = filasGlobal.filter(f => !f.sm.kg);
    const costoConsumidoTotal = conRegistro.reduce((s, f) => s + f.costoConsumo, 0);

    out.push({
      id: 'alimento-global', proyecto: null, tema: 'alimentacion',
      nivel: peorNivel(filasGlobal.map(f => f.nivel)) || 'alerta',
      titulo: '¿Sabemos cuánto alimento se les dio a los animales?',
      queRevisa: 'que los kilos de concentrado comprados tengan su contraparte de kilos entregados a los animales (lo que entra a la bodega debe salir registrado) y cuánto dinero representa ese alimento entregado.',
      hallazgo: !S || !suministradoTotal
        ? `La granja compró ${G.num(kgTotal)} kg de concentrado (por ${G.cop(costoTotal)}${sinKg ? `, más ${G.num(sinKg)} compra(s) sin kilos anotados` : ''}) pero el libro no registra kilos entregados a los animales.`
        : `Desde el 1.° de mayo de 2026 la granja sí anota cada día el alimento que entrega. Entre esa fecha y el ${G.fecha(S.periodo.hasta)} se entregaron ${kgTxt(suministradoTotal)} kg de concentrado a ${G.num(conRegistro.length)} proyecto(s), que al precio medio de compra valen ${G.cop(costoConsumidoTotal)}. ` +
          `De los ${G.num(kgTotal)} kg comprados en todo 2026 (${G.cop(costoTotal)}), ${kgTxt(kgTotal - suministradoTotal)} kg todavía no tienen registro de entrega: son los meses anteriores a mayo y los proyectos que aún no llevan el registro (${sinRegistro.map(f => nombreP(f.cod)).join(', ') || 'ninguno'}).`,
      recomendacion: 'Mantener el registro diario que ya se empezó y extenderlo a los proyectos que faltan. Con una sola fila por día y por proyecto (fecha, kilos, proyecto) la granja puede costear el consumo real, valorar lo que queda en bodega y detectar mermas.',
      detalleHtml:
        `<p class="text-sm">Comparación entre lo comprado en todo 2026 y lo entregado ${periodoTxt}. El costo del alimento entregado se calcula con el precio medio del kilo de cada proyecto (todo lo que costaron sus compras dividido por los kilos comprados).</p>` +
        tabla(['Proyecto', 'Kg comprados', 'Precio medio del kilo', 'Kg entregados', 'Costo del alimento entregado', 'Margen que queda sin entregar'],
          filasGlobal.map(f => [
            G.esc(nombreP(f.cod)),
            `<span class="money">${G.num(f.c.kg)}${f.c.sinKg ? ` <span class="text-xs text-neutral-500">(+${f.c.sinKg} compra sin kilos)</span>` : ''}</span>`,
            `<span class="money">${f.c.precioKg ? G.cop(Math.round(f.c.precioKg)) : '—'}</span>`,
            `<span class="money">${f.sm.kg ? kgTxt(f.sm.kg) : '<strong>0</strong> (sin registro)'}</span>`,
            `<span class="money">${f.sm.kg ? G.cop(Math.round(f.costoConsumo)) : '—'}</span>`,
            f.margen == null ? '—' : `${G.num(Math.round(f.margen * 100))} % (${kgTxt(f.c.kg - f.sm.kg)} kg)`,
          ])),
    });

    /* --- uno por proyecto --- */
    for (const f of filasGlobal) {
      const cod = f.cod, c = f.c, sm = f.sm;
      const margenPct = f.margen == null ? null : Math.round(f.margen * 100);
      let hallazgo;
      if (!sm.kg) {
        hallazgo = `Para ${nombreP(cod)} se compraron ${G.num(c.kg)} kg de concentrado (${G.cop(c.costo)} en ${G.num(c.n)} compra(s)${c.sinKg ? `, ${c.sinKg} de ellas sin kilos anotados` : ''}) y todavía no hay registro de cuánto se entregó: no se sabe cuánto se consumió ni cuánto queda en bodega.`;
      } else if (f.nivel === 'error') {
        hallazgo = `En ${nombreP(cod)} se entregaron ${kgTxt(sm.kg)} kg de concentrado ${periodoTxt}, más de los ${G.num(c.kg)} kg que figuran comprados en todo 2026: no puede salir de la bodega más alimento del que entró, así que falta registrar compras o sobran kilos en el registro de entrega.`;
      } else {
        hallazgo = `A ${nombreP(cod)} se le entregaron ${kgTxt(sm.kg)} kg de concentrado en ${G.num(sm.dias)} día(s) ${periodoTxt}, que al precio medio de ${G.cop(Math.round(c.precioKg || 0))} el kilo cuestan ${G.cop(Math.round(f.costoConsumo))}. Se compraron ${G.num(c.kg)} kg en todo 2026 (${G.cop(c.costo)}), de modo que quedan ${kgTxt(c.kg - sm.kg)} kg sin entregar todavía, un ${G.num(margenPct)} % de lo comprado` +
          (f.nivel === 'alerta' ? ': es un margen corto, conviene revisar la bodega antes de que falte alimento.' : '.') +
          (ingresosDe(cod) === 0 ? ` En lo que va de 2026 este proyecto no ha registrado ingresos, así que ese alimento todavía no se ha convertido en ventas.` : '');
      }
      out.push({
        id: 'alimento-' + cod, proyecto: cod, tema: 'alimentacion',
        nivel: f.nivel,
        titulo: '¿Cuadra el alimento comprado con el que se entregó?',
        queRevisa: 'que los kilos de concentrado comprados para este proyecto tengan su registro diario de entrega, y cuánto dinero vale el alimento que ya se entregó.',
        hallazgo,
        recomendacion: !sm.kg
          ? 'Empezar el registro diario de entrega, como ya se hace en gallinas, codornices, conejos y cerdos: una fila por día con la fecha, los kilos y el proyecto.'
          : (f.nivel === 'error'
            ? 'Revisar las dos fuentes: puede faltar una compra en el libro de caja o haberse anotado de más en el registro diario. Conviene hacer un conteo físico de la bodega para saber cuál de las dos cifras es la buena.'
            : 'Seguir anotando cada día los kilos entregados y comparar de vez en cuando con un conteo físico de la bodega: si el saldo real no coincide, hay merma o falta registro.'),
        detalleHtml: sm.porMes.length
          ? `<p class="text-sm">Kilos entregados mes a mes (el registro diario empieza el 1.° de mayo de 2026; antes de esa fecha no hay dato de entrega):</p>` +
            tabla(['Mes', 'Kg entregados', 'Costo al precio medio del kilo'],
              sm.porMes.map(x => [G.esc(G.mesLabel(x.mes)), `<span class="money">${kgTxt(x.kg)}</span>`, `<span class="money">${G.cop(Math.round(x.kg * (c.precioKg || 0)))}</span>`])) +
            (sm.porSub.length > 1
              ? `<p class="text-sm mt-3">Dentro del proyecto, el registro separa grupos de animales:</p>` +
                tabla(['Grupo', 'Kg entregados', 'Costo'], sm.porSub.map(x => [G.esc(x.sub), `<span class="money">${kgTxt(x.kg)}</span>`, `<span class="money">${G.cop(Math.round(x.kg * (c.precioKg || 0)))}</span>`]))
              : '')
          : null,
      });
    }

    return out.concat(controlesCostoHuevo()).concat(controlesRacion(invPorProyecto)).concat(controlRegistroAlimentacion());
  }

  /* --- 3.b ¿cuánto nos cuesta cada huevo? --- */
  function controlesCostoHuevo() {
    const out = [];
    const S = datosSuministros(); if (!S) return out;
    const v = ventanaCruce();
    const compras = comprasPorProyecto();
    for (const cod of ['GALLINAS_PONEDORAS', 'CODORNICES']) {
      const sm = suministroDe(cod, v.desde, v.hasta);
      const prod = huevosEntre(cod, v.desde, v.hasta);
      if (!sm.kg || !prod.unidades) continue;
      const precio = (compras[cod] || {}).precioKg || 0;
      const costo = sm.kg * precio;
      const porHuevo = costo / prod.unidades;
      const porCubeta = HUEVOS_POR_CUBETA[cod] || 30;
      const costoCubeta = porHuevo * porCubeta;
      const venta = ventaHuevosEntre(cod, v.desde, v.hasta);
      const ventaCubeta = venta.porHuevo != null ? venta.porHuevo * porCubeta : null;
      const margen = venta.ingresos - costo;
      const pierde = venta.porHuevo != null && porHuevo > venta.porHuevo;
      const rango = `entre el ${G.fecha(v.desde)} y el ${G.fecha(v.hasta)}`;

      out.push({
        id: 'costo-huevo-' + cod, proyecto: cod, tema: 'alimentacion',
        nivel: pierde ? 'error' : 'alerta',
        titulo: '¿Cuánto nos cuesta cada huevo?',
        queRevisa: 'cuánto cuesta el alimento que se necesitó para producir un huevo, comparado con el precio al que efectivamente se vendieron los huevos en el mismo periodo. Solo se cuenta el alimento: no incluye mano de obra, agua, luz ni el costo de las aves.',
        hallazgo: pierde
          ? `En ${nombreP(cod)}, ${rango}, se entregaron ${kgTxt(sm.kg)} kg de concentrado (${G.cop(Math.round(costo))}) y se recogieron ${G.num(prod.unidades)} huevos: cada huevo costó ${G.cop(Math.round(porHuevo))} solo de alimento, es decir ${G.cop(Math.round(costoCubeta))} la cubeta de ${porCubeta}. ` +
            `Los huevos se vendieron a ${G.cop(Math.round(venta.porHuevo))} cada uno (${G.cop(Math.round(ventaCubeta))} la cubeta), o sea que cada cubeta se está vendiendo por debajo de lo que cuesta alimentar a los animales que la producen. ` +
            `En total entraron ${G.cop(venta.ingresos)} por venta de huevos y el alimento costó ${G.cop(Math.round(costo))}: la diferencia es de ${G.cop(Math.abs(Math.round(margen)))} en contra.`
          : `En ${nombreP(cod)}, ${rango}, el alimento entregado (${kgTxt(sm.kg)} kg, ${G.cop(Math.round(costo))}) representa ${G.cop(Math.round(porHuevo))} por huevo (${G.cop(Math.round(costoCubeta))} la cubeta de ${porCubeta}), frente a un precio de venta observado de ${G.cop(Math.round(venta.porHuevo || 0))} por huevo. El alimento se alcanza a cubrir, pero el margen es estrecho.`,
        recomendacion: pierde
          ? 'Es una decisión de dirección, no un error de registro: o baja el costo del alimento por huevo (subiendo la postura, ajustando la ración, comprando mejor) o sube el precio de venta. Conviene poner las dos cifras —costo del alimento por cubeta y precio de venta— en la misma hoja cada mes, para que la decisión se tome con el dato a la vista.'
          : 'Vigilar mes a mes estas dos cifras: si el costo del alimento por cubeta se acerca al precio de venta, el proyecto deja de sostenerse solo.',
        detalleHtml:
          `<p class="text-sm">Todo lo de esta tabla sale de tres registros distintos: el registro diario de alimentación, la recolección diaria de huevos y las ventas del libro de caja, todos recortados al mismo periodo (${G.esc(rango)}) para que la comparación sea justa.</p>` +
          tabla(['Concepto', 'Cifra', 'De dónde sale'], [
            ['Alimento entregado', `<span class="money">${kgTxt(sm.kg)} kg</span>`, `registro diario de alimentación (${G.num(sm.dias)} días con registro)`],
            ['Costo de ese alimento', `<span class="money">${G.cop(Math.round(costo))}</span>`, `kilos entregados × ${G.cop(Math.round((compras[cod] || {}).precioKg || 0))} (precio medio del kilo comprado)`],
            ['Huevos recogidos', `<span class="money">${G.num(prod.unidades)}</span>`, `recolección diaria (${G.num(prod.dias)} días registrados)`],
            ['Costo de alimento por huevo', `<span class="money"><strong>${G.cop(Math.round(porHuevo))}</strong></span>`, 'costo del alimento ÷ huevos recogidos'],
            [`Costo de alimento por cubeta de ${porCubeta}`, `<span class="money"><strong>${G.cop(Math.round(costoCubeta))}</strong></span>`, 'costo por huevo × ' + porCubeta],
            ['Precio de venta observado', `<span class="money">${venta.porHuevo != null ? G.cop(Math.round(venta.porHuevo)) + ' por huevo · ' + G.cop(Math.round(ventaCubeta)) + ' la cubeta' : '—'}</span>`, `${G.num(venta.filas)} venta(s) de huevos en el libro de caja`],
            ['Ingresos por huevos', `<span class="money">${G.cop(venta.ingresos)}</span>`, 'libro de caja, mismo periodo'],
            ['Ingresos menos costo del alimento', `<span class="money ${margen < 0 ? 'text-danger-700' : 'text-success-700'}"><strong>${margen < 0 ? '−' : '+'}${G.cop(Math.abs(Math.round(margen)))}</strong></span>`, 'solo alimento; faltan mano de obra y demás costos'],
          ]),
      });
    }
    return out;
  }

  /* --- 3.c ¿la ración es la adecuada? (INDICIOS, no acusación) --- */
  function controlesRacion(invPorProyecto) {
    const out = [];
    const S = datosSuministros(); if (!S) return out;
    const v = ventanaCruce();
    for (const cod of Object.keys(REFERENCIA)) {
      const ref = REFERENCIA[cod];
      const sm = suministroDe(cod, v.desde, v.hasta);
      const animales = animalesVivos(invPorProyecto, cod);
      if (!sm.kg || !sm.dias || !animales) continue;
      const kgDia = sm.kg / sm.dias;
      const gramos = kgDia * 1000 / animales;
      const prod = huevosEntre(cod, v.desde, v.hasta);
      const postura = prod.dias && animales ? Math.round(100 * prod.unidades / (animales * prod.dias)) : null;
      const racionAlta = gramos > ref.gramosMax;
      const posturaBaja = postura != null && postura < ref.posturaMin;

      out.push({
        id: 'racion-' + cod, proyecto: cod, tema: 'alimentacion',
        nivel: 'alerta',
        titulo: '¿La ración diaria es la adecuada?',
        queRevisa: 'cuántos gramos de alimento recibe cada animal al día según el registro, comparados con el rango que recomiendan los manuales, y cuántos huevos pone cada animal, también frente al rango de referencia. Es una comparación de orientación, no una calificación del trabajo.',
        hallazgo: `En ${nombreP(cod)} se entregaron ${kgTxt(sm.kg)} kg en ${G.num(sm.dias)} días (${kgTxt(kgDia)} kg al día) para ${G.num(animales)} ${ref.animales} según el inventario: eso da ${G.num(Math.round(gramos))} gramos por animal al día, cuando la referencia técnica está entre ${ref.gramosMin} y ${ref.gramosMax} gramos. ` +
          (postura != null ? `En el mismo periodo la postura observada es del ${G.num(postura)} %, frente a un rango de referencia del ${ref.posturaMin} al ${ref.posturaMax} %. ` : '') +
          `En síntesis: ${racionAlta && posturaBaja ? 'se está entregando más alimento del que dice el manual y se están recogiendo menos huevos de lo esperado' : racionAlta ? 'se está entregando más alimento del que dice el manual' : posturaBaja ? 'se están recogiendo menos huevos de lo esperado para el alimento entregado' : 'las cifras están dentro de lo razonable'}. ` +
          `Este resultado es un indicio que conviene verificar en el galpón: puede haber desperdicio de alimento en los comederos, animales de otro lote comiendo del mismo alimento, más animales de los que figuran en el inventario, huevos que se recogen y no se anotan, o simplemente aves viejas. Ninguna de esas explicaciones se puede confirmar sin una verificación en campo.`,
        recomendacion: 'Antes de cambiar nada, verificar tres cosas en campo: (1) contar los animales que de verdad comen de ese alimento y compararlos con el inventario; (2) mirar si se riega alimento en los comederos; (3) confirmar que todos los huevos recogidos se anotan. Con eso se sabrá si el problema es la ración, el registro o el estado del lote.',
        detalleHtml: tabla(['Indicador', 'Observado en la granja', 'Referencia técnica', 'Cómo se calculó'], [
          ['Alimento por día', `<span class="money">${kgTxt(kgDia)} kg</span>`, '—', `${kgTxt(sm.kg)} kg entregados ÷ ${G.num(sm.dias)} días con registro`],
          ['Gramos por animal al día', `<span class="money"><strong>${G.num(Math.round(gramos))} g</strong></span>`, `${ref.gramosMin} – ${ref.gramosMax} g`, `kilos por día ÷ ${G.num(animales)} animales del inventario × 1.000`],
          ['Postura', postura != null ? `<span class="money"><strong>${G.num(postura)} %</strong></span>` : '—', `${ref.posturaMin} – ${ref.posturaMax} %`, `${G.num(prod.unidades)} huevos ÷ (${G.num(animales)} animales × ${G.num(prod.dias)} días)`],
        ]) + `<p class="text-sm mt-2">El número de animales sale del saldo del inventario al corte. Si ese saldo no está al día, estos dos indicadores cambian: por eso el primer paso es contar.</p>`,
      });
    }
    return out;
  }

  /* --- 3.d ¿está completo el registro de alimentación? --- */
  function controlRegistroAlimentacion() {
    const S = datosSuministros(); if (!S) return [];
    const desde = S.periodo.desde, hasta = S.periodo.hasta;
    const dias = [];
    for (let d = new Date(desde + 'T00:00:00Z'), fin = new Date(hasta + 'T00:00:00Z'); d <= fin; d = new Date(d.getTime() + 86400000)) {
      dias.push(d.toISOString().slice(0, 10));
    }
    // agrupar por proyecto y grupo (subproyecto)
    const grupos = {};
    for (const r of S.registros) {
      const k = r.proyecto + '||' + (r.subproyecto || 'GENERAL');
      (grupos[k] = grupos[k] || {})[r.fecha] = ((grupos[k] || {})[r.fecha] || 0) + (r.kg || 0);
    }
    const faltantes = [], saltos = [];
    for (const k of Object.keys(grupos)) {
      const [cod, sub] = k.split('||');
      const porDia = grupos[k];
      for (const f of dias) if (porDia[f] == null) faltantes.push({ cod, sub, fecha: f });
      const fechas = Object.keys(porDia).sort();
      const esSalto = (a, b) => a > 0 && Math.abs(b - a) >= 1 && Math.abs(b - a) / a >= 0.4;
      for (let i = 1; i < fechas.length; i++) {
        const antes = porDia[fechas[i - 1]], ahora = porDia[fechas[i]];
        if (!esSalto(antes, ahora)) continue;
        const siguiente = i + 1 < fechas.length ? porDia[fechas[i + 1]] : null;
        const volvio = siguiente === antes;   // fue un solo día distinto
        saltos.push({ cod, sub, de: fechas[i - 1], kgDe: antes, a: fechas[i], kgA: ahora, unDia: volvio });
        if (volvio) i++;                      // el regreso al valor normal no es otro salto
      }
    }
    // ¿el salto se quedó? (los 10 días siguientes mantienen el valor nuevo)
    for (const s of saltos) {
      const porDia = grupos[s.cod + '||' + s.sub];
      const post = Object.keys(porDia).filter(f => f > s.a).sort().slice(0, 10);
      s.estable = !s.unDia && post.length > 0 && post.every(f => porDia[f] === s.kgA);
    }
    const nivel = faltantes.length || saltos.length ? 'alerta' : 'ok';
    const listaFalt = faltantes.map(f => `${nombreP(f.cod)}${f.sub !== 'GENERAL' ? ' (' + f.sub.toLowerCase() + ')' : ''} el ${G.fecha(f.fecha)}`);

    return [{
      id: 'alimento-registro', proyecto: null, tema: 'alimentacion',
      nivel,
      titulo: '¿Está completo el registro de alimentación?',
      queRevisa: 'que dentro del periodo del registro no se haya quedado ningún día sin anotar para cada proyecto, y que los cambios fuertes de ración tengan explicación (un salto de un día suele ser un error de digitación; un salto que se mantiene suele ser una decisión de manejo que conviene dejar escrita).',
      hallazgo: nivel === 'ok'
        ? `El registro diario de alimentación está completo: los ${G.num(dias.length)} días del periodo (${G.fecha(desde)} al ${G.fecha(hasta)}) tienen anotación en todos los proyectos y no hay cambios bruscos de ración.`
        : `Entre el ${G.fecha(desde)} y el ${G.fecha(hasta)} el registro cubre ${G.num(dias.length)} días. ` +
          (faltantes.length
            ? `Falta la anotación de ${G.num(faltantes.length)} día(s): ${listaFalt.join('; ')}. Puede ser que ese día no se haya suministrado alimento o, con mayor probabilidad, que la anotación no se haya registrado; en ese día el costo del alimento queda subestimado. `
            : 'No falta ningún día de anotación. ') +
          (saltos.length
            ? `Además hay ${G.num(saltos.length)} cambio(s) fuerte(s) de ración de un día para otro: ` +
              saltos.map(s => `${nombreP(s.cod)}${s.sub !== 'GENERAL' ? ' (' + s.sub.toLowerCase() + ')' : ''} pasó de ${kgTxt(s.kgDe)} a ${kgTxt(s.kgA)} kg el ${G.fecha(s.a)}${s.estable ? ', y se mantuvo así los días siguientes (parece una decisión de manejo que no quedó explicada)' : ', y al día siguiente volvió al valor anterior (parece un dato mal anotado ese día)'}`).join('; ') + '.'
            : ''),
      recomendacion: 'Anotar todos los días, aunque la cifra se repita, y escribir en la columna de observaciones el porqué cada vez que cambie la ración (destete, cambio de lote, animales vendidos). Un renglón de explicación evita tener que adivinar meses después.',
      detalleHtml:
        (faltantes.length ? `<p class="text-sm">Días sin anotación dentro del periodo:</p>` +
          tabla(['Proyecto', 'Grupo', 'Día sin registro'], faltantes.map(f => [G.esc(nombreP(f.cod)), G.esc(f.sub === 'GENERAL' ? 'todo el proyecto' : f.sub), G.esc(G.fecha(f.fecha))])) : '') +
        (saltos.length ? `<p class="text-sm mt-3">Cambios fuertes de ración de un día para otro (más del 40 %):</p>` +
          tabla(['Proyecto', 'Grupo', 'Día anterior', 'Kg', 'Día del cambio', 'Kg', 'Qué parece'],
            saltos.map(s => [G.esc(nombreP(s.cod)), G.esc(s.sub === 'GENERAL' ? 'todo el proyecto' : s.sub), G.esc(G.fecha(s.de)), `<span class="money">${kgTxt(s.kgDe)}</span>`, G.esc(G.fecha(s.a)), `<span class="money">${kgTxt(s.kgA)}</span>`,
              s.estable ? 'el cambio se mantuvo: parece decisión de manejo, falta la explicación escrita' : 'volvió al valor anterior: parece un dato mal anotado ese día'])) : '') || null,
    }];
  }

  /* ================= 4. TRAZABILIDAD ================= */
  function controlesTrazabilidad() {
    const out = [];
    // (a) compra que está en la hoja del proyecto y NO en CAJA DIARIO
    const fantasma = window.DATA_ALIMENTO.compras.filter(c => c.movimientoId == null);
    if (fantasma.length) {
      const totalF = fantasma.reduce((s, c) => s + (c.costo || 0), 0);
      out.push({
        id: 'traza-hoja-sin-caja', proyecto: fantasma[0].proyecto, tema: 'trazabilidad',
        nivel: 'error',
        titulo: '¿Todo gasto de la hoja del proyecto está también en la caja?',
        queRevisa: 'que cada compra anotada en la hoja de un proyecto tenga su fila correspondiente en el libro CAJA DIARIO (el registro oficial del dinero).',
        hallazgo: `Hay ${G.num(fantasma.length)} compra(s) por ${G.cop(totalF)} que están en la hoja del proyecto pero NO aparecen en CAJA DIARIO: ` +
          fantasma.map(c => `${nombreP(c.proyecto)} — «${(c.detalle || '').split('\n')[0]}» por ${G.cop(c.costo)} (${G.fecha(c.fecha)})`).join('; ') +
          '. Ese dinero salió sin quedar en el registro oficial de caja.',
        recomendacion: 'Registrar el gasto faltante en CAJA DIARIO con su fecha real y, hacia adelante, anotar cada compra UNA sola vez (en caja) y traerla a la hoja del proyecto con fórmula, no a mano.',
        detalleHtml: tabla(['Proyecto', 'Fecha', 'Detalle', 'Costo', 'Dónde está / dónde falta'],
          fantasma.map(c => [G.esc(nombreP(c.proyecto)), G.esc(G.fecha(c.fecha)), G.esc((c.detalle || '').split('\n')[0]), `<span class="money">${G.cop(c.costo)}</span>`, G.esc(c.fuente)])),
      });
    }
    // (b) conciliación de doble digitación gallinas (documental)
    const dif = CONCILIACION_GALLINAS.caja - CONCILIACION_GALLINAS.hoja;
    out.push({
      id: 'traza-doble-digitacion-gallinas', proyecto: 'GALLINAS_PONEDORAS', tema: 'trazabilidad',
      nivel: 'alerta',
      titulo: '¿Dicen lo mismo la caja y la hoja del proyecto?',
      queRevisa: 'que una misma compra, digitada dos veces (en CAJA DIARIO y en el cuadro de concentrados de la hoja del proyecto), tenga el mismo valor en ambos lados.',
      hallazgo: `La compra de concentrado de gallinas está digitada dos veces con valores distintos: CAJA DIARIO dice ${G.cop(CONCILIACION_GALLINAS.caja)} (36 bultos × $96.000, la cifra aritméticamente consistente) y la hoja del proyecto dice ${G.cop(CONCILIACION_GALLINAS.hoja)}. Diferencia: ${G.cop(dif)}. Es el riesgo típico de digitar el mismo dato en dos lugares.`,
      recomendacion: 'Dejar CAJA DIARIO como único lugar donde se digita el dinero y que la hoja del proyecto lo traiga con fórmula. Corregir la hoja a $3.456.000.',
      detalleHtml: '<p class="text-sm">Esta conciliación es documental: proviene de comparar la fila 9 de CAJA DIARIO con el cuadro CONCENTRADOS (K35:V37) de la hoja PROY. GALLINAS del libro original. La cifra de caja es la consistente porque 36 × $96.000 = $3.456.000.</p>',
    });
    // (c) movimientos con alertas de origen
    const conAlertas = G.movimientosEfectivos().filter(m => (m.alertas || []).length);
    if (conAlertas.length) {
      out.push({
        id: 'traza-alertas-movimientos', proyecto: null, tema: 'trazabilidad',
        nivel: 'alerta',
        titulo: '¿Qué movimientos del diario piden revisión?',
        queRevisa: 'los movimientos del libro diario que llegaron con un problema de origen que no se puede corregir automáticamente: sin monto, gasto compartido, fechas de periodo, categoría dudosa.',
        hallazgo: `${G.num(conAlertas.length)} movimientos del libro diario tienen al menos una señal de revisión. Todos están marcados con ⚠ en el Libro diario.`,
        recomendacion: 'Revisarlos uno a uno en el Libro diario (el enlace de cada fila lleva directo al movimiento) y completar el dato que falta en el libro original.',
        detalleHtml: tabla(['Movimiento', 'Fecha', 'Proyecto', 'Qué se debe revisar'],
          conAlertas.map(m => [
            `<a href="diario#${m.id}">${m.id}</a>`, G.esc(G.fecha(m.fecha)), G.esc(nombreP(m.proyecto)),
            m.alertas.map(G.esc).join('<br>'),
          ])),
      });
    }
    // (d) normalizaciones automáticas
    const conCorrecciones = G.movimientosEfectivos().filter(m => (m.correcciones || []).length);
    if (conCorrecciones.length) {
      out.push({
        id: 'traza-normalizaciones', proyecto: null, tema: 'trazabilidad',
        nivel: 'info',
        titulo: '¿Qué datos se normalizaron automáticamente?',
        queRevisa: 'los movimientos cuyo dato crudo traía un error evidente (montos truncados, categorías en minúsculas, producto vacío) y que el sitio corrigió documentando el cambio.',
        hallazgo: `${G.num(conCorrecciones.length)} movimientos llegaron con un dato crudo que se normalizó automáticamente. Cada cambio quedó documentado y visible con la marca 🛠 en el Libro diario.`,
        recomendacion: 'No hay que hacer nada: es una nota informativa. Si alguna normalización parece incorrecta, se puede anotar una corrección manual con el botón ✏️ del Libro diario.',
        detalleHtml: tabla(['Movimiento', 'Fecha', 'Proyecto', 'Qué se normalizó'],
          conCorrecciones.map(m => [
            `<a href="diario#${m.id}">${m.id}</a>`, G.esc(G.fecha(m.fecha)), G.esc(nombreP(m.proyecto)),
            m.correcciones.map(G.esc).join('<br>'),
          ])),
      });
    }
    return out;
  }

  /* ================= 5. SANITARIO ================= */
  function controlesSanitario(codigosConAnimales) {
    const out = [];
    const CORTE = window.DATA_CATALOGO.corte || '2026-07-31';
    for (const cod of codigosConAnimales) {
      const evs = window.DATA_SANITARIO.eventos.filter(e => e.proyecto === cod && e.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
      let nivel, hallazgo;
      if (!evs.length) {
        nivel = 'alerta';
        hallazgo = `${nombreP(cod)} tiene animales pero no tiene eventos de control sanitario registrados en el libro.` +
          (cod === 'CODORNICES' ? ' El cuadro sanitario de la hoja existe pero lleva más de dos años con solo los encabezados: cero registros desde 2024.' : '');
      } else {
        const ultimo = evs[evs.length - 1];
        const mesesSin = Math.floor((new Date(CORTE + 'T00:00:00Z') - new Date(ultimo.fecha + 'T00:00:00Z')) / (30.44 * 24 * 3600 * 1000));
        if (mesesSin > 6) {
          nivel = 'alerta';
          hallazgo = `El último evento sanitario de ${nombreP(cod)} es del ${G.fecha(ultimo.fecha)} («${ultimo.actividad}»): al corte del ${G.fecha(CORTE)} lleva ≈ ${G.num(mesesSin)} meses sin registros.`;
        } else {
          nivel = 'ok';
          hallazgo = `${nombreP(cod)} tiene su control sanitario al día: ${G.num(evs.length)} eventos registrados, el último del ${G.fecha(ultimo.fecha)} («${ultimo.actividad}»).`;
        }
      }
      out.push({
        id: 'sanitario-' + cod, proyecto: cod, tema: 'sanitario',
        nivel,
        titulo: '¿Está al día el control sanitario?',
        queRevisa: 'que los proyectos con animales tengan eventos sanitarios registrados (vacunas, curaciones, desinfecciones) y que el último no sea demasiado viejo.',
        hallazgo,
        recomendacion: nivel === 'ok'
          ? 'Seguir registrando cada actividad sanitaria con fecha, producto y dosis, como se viene haciendo.'
          : 'Registrar en la hoja sanitaria cada actividad (fecha, actividad, producto, dosis, observación). Si en ese periodo no se registró ninguna actividad, esa ausencia también es un hallazgo que conviene revisar con el responsable.',
        detalleHtml: evs.length ? tabla(['Fecha', 'Actividad', 'Producto', 'Observación'],
          evs.map(e => [G.esc(G.fecha(e.fecha)), G.esc(e.actividad || '—'), G.esc(e.producto || '—'), G.esc(e.obs || '—')])) : null,
      });
    }
    return out;
  }

  /* ================= 6. MORTALIDAD ================= */
  function controlesMortalidad(invPorProyecto) {
    const out = [];
    for (const cod of Object.keys(invPorProyecto)) {
      let entradas = 0, muertes = 0;
      for (const l of invPorProyecto[cod]) { entradas += l.analisis.entradas; muertes += l.analisis.muertes; }
      if (!entradas) continue;
      const pct = Math.round(100 * muertes / entradas);
      const nivel = pct >= 50 ? 'error' : (pct >= 20 ? 'alerta' : 'ok');
      out.push({
        id: 'mortalidad-' + cod, proyecto: cod, tema: 'inventario',
        nivel,
        titulo: '¿Cuántos animales se han muerto?',
        queRevisa: 'las muertes acumuladas del inventario (bajas que no son ventas) frente al total de animales que han entrado al proyecto.',
        hallazgo: muertes === 0
          ? `En ${nombreP(cod)} no hay muertes registradas sobre ${G.num(entradas)} animales ingresados.`
          : `En ${nombreP(cod)} han muerto ${G.num(muertes)} de ${G.num(entradas)} animales ingresados: una mortalidad acumulada de ≈ ${G.num(pct)} %` +
            (nivel === 'error' ? '. La mortalidad supera el 50 %, un nivel que conviene revisar con el responsable técnico.' : (nivel === 'alerta' ? '. Conviene vigilarla.' : '.')),
        recomendacion: nivel === 'ok'
          ? 'Seguir registrando cada baja con su fecha y causa.'
          : 'Revisar con el responsable las causas (edad del lote, sanidad, manejo, instalaciones) y decidir si se renueva el lote. Registrar SIEMPRE la causa de cada muerte ayuda a ese diagnóstico.',
      });
    }
    return out;
  }

  /* ================= 7. GASTOS COMPARTIDOS ================= */
  function controlGastosCompartidos() {
    const asig = window.DATA_MOVIMIENTOS.asignaciones || [];
    if (!asig.length) return [];
    const porMov = {};
    for (const a of asig) (porMov[a.movimientoId] = porMov[a.movimientoId] || []).push(a);
    const movs = G.movimientosEfectivos();
    const filas = [];
    let total = 0;
    for (const id of Object.keys(porMov)) {
      const m = movs.find(x => x.id === id);
      for (const a of porMov[id]) {
        total += a.valor;
        filas.push([`<a href="diario#${id}">${id}</a>`, G.esc(m ? (m.detalle || '').split('\n')[0] : ''), G.esc(nombreP(a.proyecto)), G.num(a.porcentaje) + ' %', `<span class="money">${G.cop(a.valor)}</span>`]);
      }
    }
    return [{
      id: 'gastos-compartidos', proyecto: null, tema: 'trazabilidad',
      nivel: 'info',
      titulo: '¿Cómo se repartieron los gastos compartidos?',
      queRevisa: 'los gastos que benefician a varios proyectos a la vez y cómo se prorratean para que cada proyecto cargue su parte justa.',
      hallazgo: `Hay ${G.num(Object.keys(porMov).length)} gasto(s) compartido(s) prorrateado(s) por ${G.cop(total)} en total. El caso registrado es la caldolomita de ${G.cop(210000)}: quedó cargada entera a HUERTA en el libro, pero la observación indica repartirla entre 4 proyectos, a ${G.cop(52500)} cada uno.`,
      recomendacion: 'Cuando un gasto sirva a varios proyectos, anotar desde el inicio una fila por proyecto con su parte del valor, en lugar de dejar el total en uno solo.',
      detalleHtml: tabla(['Movimiento', 'Detalle', 'Proyecto beneficiado', 'Porcentaje', 'Valor asignado'], filas),
    }];
  }

  /* ================= 8. CORRECCIONES DEL USUARIO ================= */
  function controlCorreccionesUsuario() {
    const corr = G.correccionesUsuario();
    const ids = Object.keys(corr);
    const movs = G.movimientosEfectivos();
    const fuera = movs.filter(m => m.proyecto === 'FUERA_DE_GRANJA');
    const out = [];
    if (fuera.length) {
      const totalFuera = fuera.reduce((s, m) => s + (m.egresos || 0) - (m.ingresos || 0), 0);
      out.push({
        id: 'reclasificados-fuera', proyecto: null, tema: 'trazabilidad',
        nivel: 'info',
        titulo: '¿Qué gastos se reclasificaron fuera de la granja?',
        queRevisa: 'los movimientos que alguien marcó en este navegador como ajenos a la granja (por ejemplo, un gasto personal anotado por error en un proyecto).',
        hallazgo: `${G.num(fuera.length)} movimiento(s) por ${G.cop(Math.abs(totalFuera))} están reclasificados como «fuera de la granja»: ya NO se cuentan en los totales del proyecto donde estaban anotados originalmente.`,
        recomendacion: 'Estas correcciones viven solo en este navegador. Exportarlas (botón al final de la página de Controles) y aplicarlas en el libro oficial para que la corrección sea permanente.',
        detalleHtml: tabla(['Movimiento', 'Fecha', 'Proyecto original', 'Detalle', 'Valor', 'Nota de quien corrigió'],
          fuera.map(m => [
            `<a href="diario#${m.id}">${m.id}</a>`, G.esc(G.fecha(m.fecha)), G.esc(nombreP(m.proyectoCrudo ? m.proyectoCrudo.replace(/\./g, '_') : '')) || G.esc(m.proyectoCrudo || '—'),
            G.esc((m.detalle || '').split('\n')[0]), `<span class="money">${G.cop(m.egresos || m.ingresos)}</span>`, G.esc((m.correccionUsuario || {}).nota || '—'),
          ])),
      });
    }
    if (ids.length) {
      out.push({
        id: 'correcciones-usuario', proyecto: null, tema: 'trazabilidad',
        nivel: 'info',
        titulo: '¿Qué correcciones manuales hay guardadas?',
        queRevisa: 'las correcciones que usted (u otra persona en este navegador) guardó con el botón ✏️ del Libro diario.',
        hallazgo: `Hay ${G.num(ids.length)} corrección(es) guardadas en este navegador. Se aplican a todo el sitio (totales, proyectos y controles) pero NO cambian el libro original.`,
        recomendacion: 'Exportarlas a un archivo con el botón «Exportar correcciones» y llevarlas al libro oficial.',
      });
    }
    return out;
  }

  /* ================= ensamblado ================= */
  let cache = null;
  function controles() {
    if (cache) return cache;
    const inv = controlesInventario();
    const lista = []
      .concat(inv.controles)
      .concat(controlesProduccionVentas())
      .concat(controlesAlimento(inv.porProyecto))
      .concat(controlesTrazabilidad())
      .concat(controlesSanitario(codigosConAnimales()))
      .concat(controlesMortalidad(inv.porProyecto))
      .concat(controlGastosCompartidos())
      .concat(controlCorreccionesUsuario());
    cache = lista;
    return lista;
  }
  function invalidar() { cache = null; }

  function codigosConAnimales() {
    const set = {};
    for (const ev of window.DATA_INVENTARIOS.eventos) set[ev.proyecto] = true;
    for (const cod of Object.keys(window.DATA_PRODUCCION.produccion || {})) set[cod] = true;
    return Object.keys(set);
  }

  function peorNivel(niveles) {
    let peor = null;
    for (const n of niveles) if (peor === null || NIVEL_PESO[n] > NIVEL_PESO[peor]) peor = n;
    return peor;
  }

  /* Resumen compacto "en un solo vistazo" para proyecto y controles */
  function resumenProyecto(cod) {
    const propios = controles().filter(c => c.proyecto === cod);
    const chips = TEMAS.map(t => {
      const delTema = propios.filter(c => c.tema === t.tema);
      const nivel = delTema.length ? peorNivel(delTema.map(c => c.nivel)) : 'neutro';
      const ch = NIVEL_CHIP[nivel];
      const texto = delTema.length
        ? (nivel === 'ok' ? 'cuadra' : nivel === 'info' ? 'nota' : nivel === 'alerta' ? 'revisar' : 'no cuadra')
        : 'sin controles';
      return `<span class="${ch.clase}" title="${G.esc(t.nombre)}: ${delTema.length ? delTema.length + ' control(es)' : 'este proyecto no tiene controles de este tema'}">${t.icono} ${G.esc(t.nombre)}: ${ch.icono} ${texto}</span>`;
    }).join(' ');
    const noOk = propios.filter(c => c.nivel !== 'ok');
    const listaNoOk = noOk.length
      ? `<ul class="list-disc ml-5 mt-2 space-y-1 text-sm">` + noOk.map(c =>
          `<li><span class="${NIVEL_CHIP[c.nivel].clase}">${NIVEL_CHIP[c.nivel].icono}</span> ${G.esc(c.hallazgo)}</li>`).join('') + `</ul>`
      : `<p class="text-sm text-success-700 mt-2">✔ Todos los controles de este proyecto cuadran.</p>`;
    return `<div class="cuadro-cuerpo">
      <h3 class="text-base font-semibold mb-2">🚦 Sus controles en un solo vistazo</h3>
      <p class="flex flex-wrap gap-2">${chips}</p>
      ${listaNoOk}
      <p class="mt-2 text-sm"><a href="controles#${cod}">🚦 Ver el detalle de estos controles</a></p>
    </div>`;
  }

  /* Utilidades de alimentación que también usa la página de proyecto. */
  const ALIMENTO = { suministroDe, precioKg, comprasPorProyecto, ventanaCruce, huevosEntre, ventaHuevosEntre,
                     datosSuministros, REFERENCIA, HUEVOS_POR_CUBETA };

  return { controles, resumenProyecto, invalidar, TEMAS, NIVEL_CHIP, peorNivel, nombreP, ALIMENTO };
})();
