/* dashboard.js — portada "La granja de un vistazo".
   Todo se CALCULA con GRANJA (nada de cifras escritas a mano):
   si mañana cambian los datos, esta página cambia sola. */
(function () {
  'use strict';
  const G = window.GRANJA, CH = window.CHARTS, COL = CH.COLORES;

  const ICONOS_PROY = {
    GALLINAS_PONEDORAS: '🐔', CODORNICES: '🐦', GANADO_BOVINO: '🐄', CONEJOS: '🐰',
    POLLOS: '🐓', CERDOS: '🐖', OVINOS: '🐑', PISCICOLA: '🐟', APICOLA: '🐝',
    HUERTA: '🥬', CAFE_CENICAFE_I: '☕', BIOINSUMOS: '🧪', PINO_ROMERON: '🌲',
    AMBIENTE_CREATIVO: '🎨', PINO_PATULA: '🌲', OTRO_MADERAS: '🪵', OTROS_GRANJA: '📦',
  };

  // Abre (y por tanto dibuja, vía 'toggle') el panel cuyo id coincide con el hash actual.
  function abrirDesdeHash() {
    const h = location.hash;
    if (!/^#panel-/.test(h)) return;
    const det = document.getElementById(h.slice(1));
    if (det && det.tagName === 'DETAILS' && !det.open) det.open = true;
  }

  function render() {
  const CORTE = undefined; // el «corte» de cada cuadro lo pone GRANJA: refleja el periodo activo

  /* ---------- cálculos base ---------- */
  const movs = G.movimientosDelPeriodo();
  const tot = G.totales(movs);
  const porProy = G.porProyecto(movs);
  const porMes = G.porMes(movs);
  const totalProyectos = G.proyectos().length;
  // Proyectos con plata registrada (para los gráficos de barras)…
  const conDatos = porProy.filter(p => p.ingresos > 0 || p.egresos > 0);
  // …y proyectos que aparecen al menos una vez en el libro de caja
  // (incluye AMBIENTE.CREATIVO, que figura en un gasto compartido sin monto propio).
  const conMovimiento = porProy.filter(p => p.proyecto && p.proyecto !== '(sin proyecto)');

  // nombre bonito y código de enlace de cada proyecto
  function nombreDe(codigo) {
    const p = G.proyecto(codigo);
    return p ? p.nombre : codigo;
  }
  function hrefDe(codigo) { return 'proyecto?p=' + encodeURIComponent(codigo); }

  function millones(v) {
    // Para frases: "$7,5 millones" (aprox., una décima)
    const m = v / 1e6;
    return '$' + m.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' millones';
  }

  /* ---------- frase global de saludo ---------- */
  const completo = !window.ESTADO || ESTADO.esPeriodoCompleto();
  const cuando = completo ? 'En estos siete meses la' : 'En el periodo <strong>' + G.etiquetaPeriodo() + '</strong> la';
  document.getElementById('frase-global').innerHTML =
    cuando + ' granja recibió <strong>' + G.cop(tot.ingresos) + '</strong>, gastó <strong>' +
    G.cop(tot.egresos) + '</strong> y le quedaron <strong>' + G.cop(tot.balance) + '</strong>. ' +
    (tot.balance >= 0 ? 'Es decir: la granja está produciendo más de lo que gasta.' : 'Es decir: en este periodo, la granja gastó más de lo que recibió, pero unos proyectos están subsidiando las pérdidas de otros.');

  /* ---------- tarjetas KPI ---------- */
  function kpi(o) {
    return `<article class="kpi">
      <p class="titulo">${o.icono} ${G.esc(o.titulo)} ${G.ayuda(o.titulo, o.ayudaHtml)}</p>
      <p class="valor">${o.valor}</p>
      <p class="lectura">${G.esc(o.lectura)}</p>
    </article>`;
  }
  /* ---- Costo económico (mano de obra): honesto mientras no haya horas registradas ---- */
  const MO = window.MANOOBRA;
  let moHayDatos = false, moTotal = 0;
  const moPorProy = [];
  if (MO) {
    G.proyectos().forEach(p => {
      const r = MO.costoManoObraProyecto(p.codigo);
      if (r.hayDatos) { moHayDatos = true; moTotal += r.costo; moPorProy.push({ proyecto: p.codigo, costo: r.costo, horas: r.horas }); }
    });
  }
  const kpiCostoEconomico = kpi(moHayDatos ? {
    icono: '👷', titulo: 'Costo económico total', valor: G.cop(Math.round(moTotal)),
    lectura: 'Costo de la mano de obra imputada a los proyectos, sumado al gasto de caja.',
    ayudaHtml: '<p>Suma del costo de la mano de obra registrada en la hoja de dedicación de horas, valorada con el costo real de la hora de cada rol. Vea el detalle en <a href="mano-obra">👷 Mano de obra</a>.</p>',
  } : {
    icono: '👷', titulo: 'Costo económico total', valor: '<span class="text-warning-700 text-2xl">No calculable aún</span>',
    lectura: 'Falta registrar las horas de trabajo por proyecto (ver Mano de obra).',
    ayudaHtml: '<p>El costo de caja (arriba) solo cuenta el dinero que sale de la granja. El <strong>costo económico</strong> también incluye el trabajo de las personas, que hoy pagan la universidad u otros. Para calcularlo hace falta registrar cuántas horas se dedican a cada proyecto: mientras no exista ese registro, no se inventa. Vea <a href="mano-obra">👷 Mano de obra</a>.</p>',
  });
  document.getElementById('seccion-kpis').innerHTML = [
    kpi({
      icono: '💰', titulo: 'Lo que entró (ingresos)', valor: G.cop(tot.ingresos),
      lectura: 'Todo lo que la granja vendió entre enero y julio: huevos, café, animales, madera…',
      ayudaHtml: '<p>Es la <strong>suma de todas las ventas</strong> anotadas en el libro de caja de la granja entre enero y julio de 2026. Cada venta puede verse una por una en el <a href="diario">Libro diario</a>.</p>',
    }),
    kpi({
      icono: '🧾', titulo: 'Lo que salió (egresos)', valor: G.cop(tot.egresos),
      lectura: 'Todo lo que la granja compró o pagó: sobre todo la comida de los animales.',
      ayudaHtml: '<p>Es la <strong>suma de todas las compras y pagos</strong> del mismo periodo. La mayor parte es el concentrado (la comida) de los animales. El detalle está en el <a href="diario">Libro diario</a>.</p>',
    }),
    kpi({
      icono: '🌟', titulo: 'Lo que quedó (balance)', valor: (tot.balance >= 0 ? '+' : '') + G.cop(tot.balance),
      lectura: tot.balance >= 0
        ? 'La granja ganó más de lo que gastó: quedó un excedente a favor.'
        : 'Este periodo la granja gastó más de lo que recibió.',
      ayudaHtml: '<p>Es simplemente <strong>lo que entró menos lo que salió</strong>. Si el número es positivo, la granja produjo más de lo que gastó en el periodo.</p>',
    }),
    kpi({
      icono: '🗂️', titulo: 'Proyectos con datos', valor: '<a href="#seccion-cobertura" class="underline decoration-dotted decoration-2 underline-offset-4 hover:text-primary-600" title="Ver la tabla: ¿de qué proyectos tenemos información?">' + G.num(conMovimiento.length) + ' de ' + G.num(totalProyectos) + '</a>',
      lectura: 'Proyectos que aparecen al menos una vez en el libro de caja este semestre. Los otros ' +
        G.num(totalProyectos - conMovimiento.length) + ' están en el catálogo pero sin registro aún.',
      ayudaHtml: '<p>La granja tiene <strong>' + G.num(totalProyectos) + ' proyectos</strong> en su catálogo (animales, cultivos y bosques). ' +
        'De ellos, <strong>' + G.num(conMovimiento.length) + '</strong> aparecen en el libro de caja este semestre (uno de ellos, AMBIENTE.CREATIVO, solo en un gasto compartido sin valor propio). ' +
        'Los demás aparecen como «sin registro»: no es que tengan pérdidas, es que no han registrado movimientos de caja. Véalos todos en <a href="proyectos">Proyectos</a>.</p>',
    }),
    kpiCostoEconomico,
  ].join('');

  /* ---------- helper para armar cada cuadro ---------- */
  function cuadro(opts, figuraHtml, extraClase) {
    return `<article class="${extraClase || ''}">
      ${G.cuadroControl(opts)}
      <div class="cuadro-cuerpo">${figuraHtml}</div>
    </article>`;
  }

  const charts = [];

  /* 1. ¿Qué proyectos traen más ingresos? */
  const topIngresos = porProy.filter(p => p.ingresos > 0).sort((a, b) => b.ingresos - a.ingresos);
  const lider = topIngresos[0];
  charts.push(cuadro({
    icono: '💰',
    titulo: '¿Qué proyectos traen más ingresos?',
    queVes: 'Cada barra es un proyecto; la más larga es el que más vendió entre enero y julio. Toque una barra para desplegar aquí mismo el detalle de ese proyecto.',
    deDondeSale: 'Libro de caja de la granja, sumando las ventas de cada proyecto.',
    corte: CORTE,
    estado: { tipo: 'ok', icono: '✅', texto: nombreDe(lider.proyecto) + ' lidera' },
    ayudaHtml: '<p>Se suman las <strong>ventas</strong> de cada proyecto anotadas en el libro de caja. Los proyectos que no vendieron nada este semestre no aparecen en esta gráfica, pero sí en <a href="proyectos">Proyectos</a>.</p>',
  }, CH.barras({
    titulo: '¿Qué proyectos traen más ingresos?',
    lectura: nombreDe(lider.proyecto) + ' es el que más plata trae: ' + G.cop(lider.ingresos) +
      ', casi uno de cada tres pesos que recibe la granja. Le siguen las gallinas ponedoras y el ganado bovino.',
    formato: 'cop',
    colEtiqueta: 'Proyecto', colValor: 'Ingresos',
    datos: topIngresos.map(p => ({ etiqueta: nombreDe(p.proyecto), valor: p.ingresos, color: COL.verde, href: '#panel-' + p.proyecto })),
  })));

  /* 2. ¿Quién aporta y quién consume? */
  const balances = conDatos.slice().sort((a, b) => b.balance - a.balance);
  const cerdos = porProy.find(p => p.proyecto === 'CERDOS');
  let lecturaBalance = 'A la derecha (en verde) están los proyectos que dejaron plata; a la izquierda, los que por ahora gastan más de lo que venden.';
  if (cerdos) {
    lecturaBalance += ' El caso más grande es CERDOS: ha gastado ' + G.cop(cerdos.egresos) +
      ' y aún no vende nada, porque los cerdos están en levante (creciendo). No es una pérdida: es una inversión que se recuperará cuando haya crías para vender.';
  }
  charts.push(cuadro({
    icono: '⚖️',
    titulo: '¿Quién aporta y quién consume?',
    queVes: 'El balance de cada proyecto: lo que vendió menos lo que gastó. Toque una barra para ver el detalle del proyecto.',
    deDondeSale: 'Libro de caja: ingresos menos egresos de cada proyecto.',
    corte: CORTE,
    estado: { tipo: 'info', icono: 'ℹ️', texto: 'CERDOS está en levante: aún no vende' },
    ayudaHtml: '<p>Un proyecto con barra hacia la izquierda <strong>no necesariamente va mal</strong>: puede estar en etapa de cría o levante, invirtiendo hoy para vender mañana. Ese es el caso de CERDOS. El detalle de cada uno está en su hoja de vida.</p>',
  }, CH.divergente({
    titulo: '¿Quién aporta y quién consume?',
    lectura: lecturaBalance,
    datos: balances.map(p => ({ etiqueta: nombreDe(p.proyecto), valor: p.balance, href: hrefDe(p.proyecto) })),
  })));

  /* 3. ¿Cómo se movió la plata mes a mes? (no sale en la impresión) */
  charts.push(cuadro({
    icono: '📈',
    titulo: '¿Cómo se movió la plata mes a mes?',
    queVes: 'Dos líneas: la verde es lo que entró cada mes y la roja lo que salió.',
    deDondeSale: 'Libro de caja, agrupando los movimientos por el mes de su fecha.',
    corte: CORTE,
    estado: { tipo: 'ok', icono: '✅', texto: 'Las ventas vienen subiendo desde abril' },
    ayudaHtml: '<p>El gasto tan alto de <strong>enero</strong> tiene explicación: ese mes se registró la compra del concentrado (la comida de los animales) de buena parte del semestre, incluidas facturas desde diciembre de 2025. Además, hay unas ventas registradas por periodos («del 13 de febrero al 23 de marzo») que se cuentan en el mes en que se anotaron; por eso febrero se ve casi en cero.</p>',
  }, CH.lineas({
    titulo: '¿Cómo se movió la plata mes a mes?',
    lectura: 'En enero el gasto se ve muy alto porque ese mes se compró la comida de los animales de casi todo el semestre. Desde abril las ventas suben mes a mes, y julio fue el mejor mes del año gracias a la venta grande de café.',
    series: [
      { nombre: 'Lo que entró (ingresos)', color: COL.verde, puntos: porMes.map(m => ({ x: m.mes, y: m.ingresos })) },
      { nombre: 'Lo que salió (egresos)', color: COL.rojo, puntos: porMes.map(m => ({ x: m.mes, y: m.egresos })) },
    ],
  }), 'no-imprimir'));

  /* 4. ¿En qué gastamos la plata? */
  const catMap = {};
  for (const m of movs) {
    if (!m.egresos) continue;
    const k = m.producto || 'Sin categoría';
    catMap[k] = (catMap[k] || 0) + m.egresos;
  }
  const cats = Object.entries(catMap).map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor);
  const paletaDona = [COL.azul, COL.amarillo, COL.cian, COL.rojo, COL.gris, COL.azulOscuro, COL.verde];
  const alim = catMap['Alimentación'] || 0;
  const pctAlim = Math.round(alim / tot.egresos * 100);
  charts.push(cuadro({
    icono: '🍽️',
    titulo: '¿En qué gastamos la plata?',
    queVes: 'La torta reparte todo el gasto del semestre según en qué se usó. Cada porción trae su valor y su porcentaje escritos.',
    deDondeSale: 'Libro de caja, agrupando los egresos por tipo de gasto.',
    corte: CORTE,
    estado: { tipo: 'alerta', icono: '⚠️', texto: 'La comida de los animales es el ' + pctAlim + ' % del gasto' },
    ayudaHtml: '<p>«Alimentación» es el concentrado que comen gallinas, cerdos, codornices, conejos, ovejas y peces. Que sea tan grande (' + pctAlim + ' % de todo el gasto) es normal en una granja, pero también dice dónde está la mayor oportunidad de ahorro: negociar compras por volumen o probar alimentos alternativos.</p>',
  }, CH.dona({
    titulo: '¿En qué gastamos la plata?',
    lectura: 'De cada $100 que gasta la granja, $' + pctAlim + ' se van en la alimentación de los animales (' + millones(alim) + '). El resto se reparte en mantenimiento, insumos, control sanitario y otros gastos.',
    centro: G.cop(tot.egresos).replace('$ ', '$'),
    centroSub: 'gasto total ene–jul',
    datos: cats.map((c, i) => ({ etiqueta: c.etiqueta, valor: c.valor, color: paletaDona[i % paletaDona.length] })),
  })));

  /* 5. ¿Cuántos huevos están dando las aves? (no sale en la impresión) */
  const prodGall = G.produccionMensual('GALLINAS_PONEDORAS');
  const prodCod = G.produccionMensual('CODORNICES');
  const cod1 = prodCod.length ? prodCod[0].unidades : 0;
  const codUlt = prodCod.length ? prodCod[prodCod.length - 1].unidades : 0;
  charts.push(cuadro({
    icono: '🥚',
    titulo: '¿Cuántos huevos están dando las aves?',
    queVes: 'Huevos recogidos cada mes: la línea amarilla son las gallinas ponedoras y la azul las codornices.',
    deDondeSale: 'Planillas de recolección diaria de huevos de cada galpón, sumadas por mes.',
    corte: CORTE,
    estado: { tipo: 'alerta', icono: '⚠️', texto: 'La postura de codorniz viene cayendo' },
    ayudaHtml: '<p>Las aves ponen menos a medida que envejecen, y el lote de codornices además ha tenido muchas bajas. Por eso la línea azul baja de ' + G.num(cod1) + ' huevos en enero a ' + G.num(codUlt) + ' en julio. Las gallinas también bajaron al inicio del año, pero se estabilizaron: el lote nuevo sostiene la producción. El detalle está en la hoja de vida de <a href="proyecto?p=GALLINAS_PONEDORAS">gallinas</a> y de <a href="proyecto?p=CODORNICES">codornices</a>.</p>',
  }, CH.lineas({
    titulo: '¿Cuántos huevos están dando las aves?',
    lectura: 'Las gallinas bajaron su postura al comienzo del año y luego se estabilizaron alrededor de ' + G.num(prodGall.length ? prodGall[prodGall.length - 1].unidades : 0) +
      ' huevos al mes. Las codornices, en cambio, vienen cayendo sin parar: de ' + G.num(cod1) + ' huevos en enero a ' + G.num(codUlt) +
      ' en julio, por la edad del lote y las bajas. Es una señal para pensar en renovar ese lote.',
    series: [
      { nombre: 'Gallinas ponedoras', color: COL.amarillo, puntos: prodGall.map(m => ({ x: m.mes, y: m.unidades })) },
      { nombre: 'Codornices', color: COL.azul, puntos: prodCod.map(m => ({ x: m.mes, y: m.unidades })) },
    ],
  }), 'no-imprimir'));

  /* Reparto de horas de trabajo por proyecto — solo si HAY dedicación registrada (no se inventa). */
  if (moHayDatos && moPorProy.length) {
    const datosH = moPorProy.slice().sort((a, b) => b.horas - a.horas)
      .map(x => ({ etiqueta: nombreDe(x.proyecto), valor: Math.round(x.horas), color: COL.azul, href: hrefDe(x.proyecto) }));
    charts.push(cuadro({
      icono: '👷',
      titulo: '¿Cómo se reparten las horas de trabajo?',
      queVes: 'Cada barra es un proyecto; la más larga concentra más horas de dedicación de las personas al mes.',
      deDondeSale: 'Hoja de dedicación de horas de la granja (porcentajes), convertida a horas por proyecto.',
      corte: CORTE,
      estado: { tipo: 'ok', icono: '✅', texto: 'dedicación registrada' },
      ayudaHtml: '<p>El reparto sale de los porcentajes de dedicación que registra la granja, multiplicados por las horas de cada rol. El costo de esas horas está en <a href="mano-obra">👷 Mano de obra</a>.</p>',
    }, CH.barras({
      titulo: 'Reparto de horas de trabajo por proyecto',
      lectura: 'Horas de trabajo al mes dedicadas a cada proyecto, según la hoja de dedicación.',
      formato: 'num', colEtiqueta: 'Proyecto', colValor: 'Horas/mes',
      datos: datosH,
    })));
  }

  document.getElementById('seccion-charts').innerHTML = charts.join('');

  /* ---------- paneles desplegables por proyecto (acordeón nativo, dibujo perezoso) ----------
     Un <details> por proyecto CON INGRESOS. El cuerpo se dibuja la PRIMERA vez que se abre
     (evento 'toggle'), y se cachea en det.dataset.dibujado. Como estos paneles se reconstruyen
     dentro de render(), la caché se resetea sola al cambiar el periodo. */
  const secP = document.getElementById('seccion-paneles');
  if (secP) {
    const paleta = [COL.verde, COL.azul, COL.amarillo, COL.cian, COL.rojo, COL.gris, COL.azulOscuro];
    // movimientos del periodo (solo de la granja) agrupados por proyecto, para el dibujo perezoso
    const movsPorProy = {};
    for (const m of movs) {
      if (!m.proyecto || (G.esFueraDeGranja && G.esFueraDeGranja(m))) continue;
      (movsPorProy[m.proyecto] = movsPorProy[m.proyecto] || []).push(m);
    }
    // topIngresos ya viene filtrado (ingresos > 0) y ordenado de mayor a menor
    secP.innerHTML =
      '<h2>🔎 El detalle de cada proyecto que vendió</h2>' +
      '<p class="text-neutral-600 mt-1 max-w-3xl">Toque un proyecto (o una barra de «¿Qué proyectos traen más ingresos?») para ver, de lo que vendió, <strong>qué vendió exactamente</strong>, cómo se movió mes a mes y en qué se gastó.</p>' +
      topIngresos.map(p => {
        const cod = p.proyecto;
        return `<details class="panel-proyecto rounded-xl border border-neutral-300 bg-white" id="panel-${cod}">
          <summary class="cursor-pointer px-4 py-3 font-medium text-primary-900 flex flex-wrap items-center gap-2">
            <span aria-hidden="true">${iconoProy(cod)}</span> ${G.esc(nombreDe(cod))}
            <span class="text-sm text-neutral-500 font-normal">· ${G.cop(p.ingresos)} en ventas</span>
          </summary>
          <div class="panel-cuerpo px-4 pb-4"></div>
        </details>`;
      }).join('');

    secP.querySelectorAll('details.panel-proyecto').forEach(det => {
      det.addEventListener('toggle', () => {
        if (det.open && det.dataset.dibujado !== '1') {
          dibujarPanel(det, det.id.replace('panel-', ''), movsPorProy, paleta);
        }
      });
    });

    // si la página cargó (o se re-renderizó) con un #panel-… en la URL, ábrelo y dibújalo
    abrirDesdeHash();
  }

  /* Dibuja los 3 gráficos + cobertura + chips + enlace de un panel (perezoso). */
  function dibujarPanel(det, cod, movsPorProy, paleta) {
    const cuerpo = det.querySelector('.panel-cuerpo');
    if (!cuerpo) return;
    const lista = movsPorProy[cod] || [];

    // 1) Dona de INGRESOS por producto
    const ingArr = agrupaProducto(lista, 'ingresos');
    const totIng = ingArr.reduce((a, x) => a + x.valor, 0);
    let g1;
    if (ingArr.length < 2) {
      const uni = ingArr[0];
      g1 = `<p class="text-sm text-neutral-700">Todo su ingreso vino de: <strong>${G.esc(uni ? uni.etiqueta : '—')}</strong>${uni ? ' (' + G.cop(uni.valor) + ')' : ''}.</p>`;
    } else {
      g1 = CH.mini.dona({
        titulo: '¿Qué se vendió? (ingresos por producto)',
        datos: ingArr.map((c, i) => ({ etiqueta: c.etiqueta, valor: c.valor, color: paleta[i % paleta.length] })),
        centro: G.cop(totIng).replace('$ ', '$'), centroSub: 'en ventas',
      });
    }

    // 2) Líneas ingresos vs egresos por mes (compacto)
    const pm = G.porMes(lista);
    let g2;
    if (!pm.length) {
      g2 = '<p class="text-sm text-neutral-700">No hay movimientos con fecha para trazar la evolución mensual.</p>';
    } else {
      g2 = CH.mini.lineas({
        titulo: 'Ingresos vs egresos por mes',
        series: [
          { nombre: 'Ingresos', color: COL.verde, puntos: pm.map(m => ({ x: m.mes, y: m.ingresos })) },
          { nombre: 'Egresos', color: COL.rojo, puntos: pm.map(m => ({ x: m.mes, y: m.egresos })) },
        ],
      });
    }

    // 3) Dona de EGRESOS por categoría
    const egrArr = agrupaProducto(lista, 'egresos');
    const totEgr = egrArr.reduce((a, x) => a + x.valor, 0);
    let g3;
    if (egrArr.length === 0) {
      g3 = '<p class="text-sm text-neutral-700">Este proyecto no registró gastos en el periodo.</p>';
    } else if (egrArr.length < 2) {
      g3 = `<p class="text-sm text-neutral-700">Todo su gasto fue en: <strong>${G.esc(egrArr[0].etiqueta)}</strong> (${G.cop(egrArr[0].valor)}).</p>`;
    } else {
      g3 = CH.mini.dona({
        titulo: '¿En qué se gastó? (egresos por categoría)',
        datos: egrArr.map((c, i) => ({ etiqueta: c.etiqueta, valor: c.valor, color: paleta[i % paleta.length] })),
        centro: G.cop(totEgr).replace('$ ', '$'), centroSub: 'en gastos',
      });
    }

    const chips = (window.COHERENCIA && COHERENCIA.resumenProyecto) ? COHERENCIA.resumenProyecto(cod) : '';
    const enlace = `<p class="mt-3"><a href="${hrefDe(cod)}" class="font-medium">Ver la ficha completa de ${G.esc(nombreDe(cod))} →</a></p>`;

    cuerpo.innerHTML =
      `<div class="grid gap-6 md:grid-cols-3 mt-1">
        <div><h4 class="text-sm font-semibold text-neutral-800 mb-1">🍩 ¿Qué se vendió?</h4>${g1}</div>
        <div><h4 class="text-sm font-semibold text-neutral-800 mb-1">📈 ¿Cómo se movió mes a mes?</h4>${g2}</div>
        <div><h4 class="text-sm font-semibold text-neutral-800 mb-1">🍩 ¿En qué se gastó?</h4>${g3}</div>
      </div>` + franjaCobertura(cod) + chips + enlace;

    det.dataset.dibujado = '1';
  }

  // agrupa por m.producto sumando el campo pedido ('ingresos'|'egresos'), descendente
  function agrupaProducto(lista, campo) {
    const map = {};
    for (const m of lista) {
      const v = m[campo] || 0;
      if (!v) continue;
      const k = m.producto || 'Sin categoría';
      map[k] = (map[k] || 0) + v;
    }
    return Object.entries(map).map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor);
  }

  // franja de iconos de cobertura del proyecto (usa COBERTURA)
  function franjaCobertura(cod) {
    if (!window.COBERTURA) return '';
    const fila = COBERTURA.matriz().find(m => m.codigo === cod);
    if (!fila) return '';
    const IC = { ok: '✅', falta: '⚠️', na: '⬜' };
    const TIT = { ok: 'con dato', falta: 'falta registro', na: 'no aplica' };
    const iconos = COBERTURA.FUENTES.map(f =>
      `<span class="inline-flex items-center gap-1 whitespace-nowrap" title="${G.esc(f.nombre)}: ${TIT[fila.celdas[f.id]]}">${f.icono} ${IC[fila.celdas[f.id]]} <span class="text-xs text-neutral-500">${G.esc(f.nombre)}</span></span>`).join('');
    return `<div class="mt-4 pt-3 border-t border-neutral-200">
      <p class="text-sm font-semibold text-neutral-800">📋 ¿Qué información tenemos de este proyecto?</p>
      <p class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">${iconos}</p>
      <p class="text-xs text-neutral-500 mt-1">${G.esc(COBERTURA.faltantesDe(cod))}</p>
    </div>`;
  }

  function iconoProy(cod) {
    return ICONOS_PROY[cod] || '📂';
  }

  /* ---------- cobertura de información por proyecto (NO se filtra: histórico) ---------- */
  const secCob = document.getElementById('seccion-cobertura');
  if (secCob && window.COBERTURA) { secCob.innerHTML = COBERTURA.seccionHTML(); if (COBERTURA.conectarExport) COBERTURA.conectarExport(); }
  }

  render();
  if (window.ESTADO && ESTADO.alCambiar) ESTADO.alCambiar(render);
  // Un solo listener global: al llegar a #panel-COD (clic en una barra), abre ese panel.
  window.addEventListener('hashchange', abrirDesdeHash);
})();
