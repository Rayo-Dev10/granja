(function () {
  'use strict';
  var G = window.GRANJA, MO = window.MANOOBRA;
  var root = document.getElementById('resumen-ejecutivo');
  if (!root || !G || !MO) return;

  function cop(v) { return G.cop(Math.round(v || 0)); }
  function esc(v) { return G.esc(v == null ? '' : String(v)); }
  function pct(v, dec) { return (+v || 0).toLocaleString('es-CO', { minimumFractionDigits:dec == null ? 1 : dec, maximumFractionDigits:dec == null ? 1 : dec }) + ' %'; }
  function clase(v) { return v > 0 ? 'positivo' : (v < 0 ? 'negativo' : 'neutro'); }
  function signo(v) { return v > 0 ? '+' + cop(v) : cop(v); }

  var movimientos = G.movimientosDelPeriodo();
  var caja = G.totales(movimientos);
  var meses = 7;
  var personal = MO.totalGranjaMes() * meses;
  var costo = caja.egresos + personal;
  var resultado = caja.ingresos - costo;
  var cobertura = costo ? caja.ingresos / costo : 0;
  var porCaja = G.porProyecto(movimientos);
  var proyectos = G.proyectos().map(function (p) {
    var c = porCaja.filter(function (x) { return x.proyecto === p.codigo; })[0] || { ingresos:0, egresos:0, balance:0 };
    var m = MO.repartoProyecto(p.codigo, 'B_OPERACION', meses);
    return { codigo:p.codigo, nombre:p.nombre, ingresos:c.ingresos || 0, egresos:c.egresos || 0,
      caja:c.balance || 0, manoObra:m.costoTotal || 0, resultado:(c.balance || 0) - (m.costoTotal || 0) };
  });
  var conCaja = proyectos.filter(function (p) { return p.ingresos || p.egresos; })
    .sort(function (a,b) { return Math.max(b.ingresos,b.egresos)-Math.max(a.ingresos,a.egresos); });
  var maxCaja = conCaja.reduce(function (m,p) { return Math.max(m,p.ingresos,p.egresos); },1);
  var topIngresos = proyectos.slice().sort(function(a,b){return b.ingresos-a.ingresos;});
  var top3 = topIngresos.slice(0,3).reduce(function(s,p){return s+p.ingresos;},0);
  var alimento = movimientos.reduce(function(s,m){return s + (m.egresos && m.producto === 'Alimentación' ? m.egresos : 0);},0);
  var negativos = proyectos.filter(function(p){return p.resultado<0;}).length;
  var positivos = proyectos.filter(function(p){return p.resultado>0;}).length;
  var sinCaja = proyectos.length-conCaja.length;

  function botonCaja(p) {
    var ai=Math.max(2,Math.round(p.ingresos/maxCaja*100)), ae=Math.max(2,Math.round(p.egresos/maxCaja*100));
    return '<button type="button" class="v5-caja-fila v5-proyecto-control" data-proyecto="'+esc(p.codigo)+'" aria-expanded="false" aria-controls="v5-detalle-proyecto">'+
      '<strong class="v5-caja-nombre">'+esc(p.nombre)+'</strong>'+
      '<span class="v5-caja-par"><span class="v5-caja-etiqueta">Entró</span><span class="v5-caja-pista"><span class="v5-caja-barra ingreso" style="width:'+ai+'%"></span></span><span class="v5-caja-valor positivo">'+cop(p.ingresos)+'</span></span>'+
      '<span class="v5-caja-par"><span class="v5-caja-etiqueta">Salió</span><span class="v5-caja-pista"><span class="v5-caja-barra egreso" style="width:'+ae+'%"></span></span><span class="v5-caja-valor negativo">'+cop(p.egresos)+'</span></span>'+
      '<span class="v5-caja-accion">Ver detalle aquí <span aria-hidden="true">⌄</span></span></button>';
  }

  root.innerHTML =
    '<section class="v5-hero" aria-labelledby="v5-titulo"><div class="v5-hero-texto"><p class="v5-eyebrow">Resumen para decisión · enero–julio de 2026</p><h1 id="v5-titulo">La granja opera con un déficit económico estructural</h1><p>La caja aparenta un excedente de <strong>'+signo(caja.balance)+'</strong>. Esa lectura cambia al reconocer el personal pagado por la institución: la operación registra una pérdida económica de <strong>'+cop(Math.abs(resultado))+'</strong>.</p><div class="v5-hero-acciones no-imprimir"><a class="btn-prim" href="dashboard">Explorar escenarios en el Dashboard →</a><button type="button" class="btn-sec" id="v5-imprimir">Imprimir resumen</button></div></div><div class="v5-resultado"><span>Resultado económico acumulado</span><strong class="v5-monto-hero">'+signo(resultado)+'</strong><small>Ingresos − egresos de caja − personal</small></div></section>'+

    '<section class="v5-kpis" aria-label="Indicadores decisivos"><article><span>Ingresos</span><strong class="v5-monto-kpi">'+cop(caja.ingresos)+'</strong><small>Libro de caja</small></article><article><span>Costo económico</span><strong class="v5-monto-kpi">'+cop(costo)+'</strong><small>Caja + personal</small></article><article><span>Cobertura del costo</span><strong class="v5-monto-kpi">'+pct(cobertura*100,2)+'</strong><small>Solo $'+(cobertura*100).toLocaleString('es-CO',{maximumFractionDigits:2})+' de cada $100</small></article><article><span>Peso del personal</span><strong class="v5-monto-kpi">'+pct(personal/costo*100,1)+'</strong><small>Del costo total</small></article></section>'+

    '<section class="v5-panel" aria-labelledby="v5-puente"><div class="v5-panel-cab"><div><p class="v5-eyebrow">Conciliación principal</p><h2 id="v5-puente">Por qué un saldo de caja positivo no significa rentabilidad</h2></div><p>Todos los valores corresponden al mismo periodo</p></div><div class="v5-puente"><article class="positivo"><span>Ingresos</span><strong class="v5-monto-paso">'+cop(caja.ingresos)+'</strong><small>Dato del libro</small></article><i>−</i><article><span>Egresos de caja</span><strong class="v5-monto-paso">'+cop(caja.egresos)+'</strong><small>Dato del libro</small></article><i>−</i><article><span>Personal</span><strong class="v5-monto-paso">'+cop(personal)+'</strong><small>Dato de Talento Humano</small></article><i>=</i><article class="negativo"><span>Resultado</span><strong class="v5-monto-paso">'+signo(resultado)+'</strong><small>Pérdida económica</small></article></div></section>'+

    '<section class="v5-panel" aria-labelledby="v5-panorama"><div class="v5-panel-cab"><div><p class="v5-eyebrow">Panorama de operación</p><h2 id="v5-panorama">Cuatro hechos que requieren atención directiva</h2></div></div><div class="v5-hallazgos"><article class="critico"><span class="v5-chip">Sostenibilidad</span><strong>'+pct((1-cobertura)*100,1)+' del costo no tiene cobertura</strong><p>El déficit no es marginal: los ingresos actuales cubren únicamente '+pct(cobertura*100,1)+' del costo económico.</p></article><article class="alerta"><span class="v5-chip">Concentración</span><strong>'+pct(caja.ingresos?top3/caja.ingresos*100:0,1)+' del ingreso viene de 3 proyectos</strong><p>'+esc(topIngresos[0].nombre)+', '+esc(topIngresos[1].nombre)+' y '+esc(topIngresos[2].nombre)+' concentran la mayor parte de las entradas.</p></article><article class="alerta"><span class="v5-chip">Estructura de gasto</span><strong>'+pct(caja.egresos?alimento/caja.egresos*100:0,1)+' de los egresos es alimentación</strong><p>Es la categoría de caja con mayor peso y el primer frente para revisar compras, consumos y productividad.</p></article><article class="datos"><span class="v5-chip">Cobertura de datos</span><strong>'+conCaja.length+' de '+proyectos.length+' proyectos tienen caja</strong><p>'+sinCaja+' no muestran entradas ni salidas propias. La ausencia de registro no demuestra inactividad operativa.</p></article></div></section>'+

    '<section class="v5-panel" aria-labelledby="v5-caja-titulo"><div class="v5-panel-cab"><div><p class="v5-eyebrow">Libro de caja · lectura por proyecto</p><h2 id="v5-caja-titulo">Qué entró y qué salió</h2></div><p>Toque una barra para ver sus movimientos sin salir del inicio</p></div><div class="v5-leyenda"><span><i class="ingreso"></i> Entradas</span><span><i class="egreso"></i> Salidas</span></div><div class="v5-caja-grafico">'+conCaja.map(botonCaja).join('')+'</div><section id="v5-detalle-proyecto" class="v5-detalle" hidden aria-live="polite"></section></section>'+

    '<section class="v5-panel v5-decision" aria-labelledby="v5-decision"><div><p class="v5-eyebrow">Lectura responsable</p><h2 id="v5-decision">Qué puede concluir la vicerrectoría</h2><ul><li><strong>Sí:</strong> con los ingresos registrados, la granja no cubre su costo económico.</li><li><strong>Sí:</strong> el personal es el componente dominante del costo y debe hacerse visible en toda evaluación.</li><li><strong>No todavía:</strong> cuál proyecto absorbe exactamente cada hora de trabajo; esa distribución no fue medida.</li><li><strong>No todavía:</strong> si el valor académico, social o investigativo compensa el déficit; ese valor no está monetizado.</li></ul></div><aside><span>Escenario recomendado para gestión</span><strong>B · Operación y sanidad</strong><p>Distribuye solo los costos con inductores razonables y mantiene dirección y sede como estructura.</p><a href="dashboard">Comparar los cuatro escenarios →</a></aside></section>'+
    '<section class="v5-fuentes"><p><strong>Fuentes:</strong> libro de caja y planilla de Talento Humano. Costo mensual del personal: '+cop(MO.totalGranjaMes())+', incluidas prestaciones.</p><p><strong>Estado de proyectos en el escenario B:</strong> '+negativos+' con resultado estimado negativo, '+positivos+' positivo(s). La pérdida total de la granja no depende del escenario elegido.</p></section>';

  function detalleProyecto(codigo) {
    var p=proyectos.filter(function(x){return x.codigo===codigo;})[0]; if(!p)return;
    var lista=movimientos.filter(function(m){return m.proyecto===codigo;}).sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
    var agrupado={}; lista.forEach(function(m){var k=m.producto||'Sin categoría';agrupado[k]=agrupado[k]||{nombre:k,ingresos:0,egresos:0};agrupado[k].ingresos+=m.ingresos||0;agrupado[k].egresos+=m.egresos||0;});
    var grupos=Object.keys(agrupado).map(function(k){return agrupado[k];}).sort(function(a,b){return(b.ingresos+b.egresos)-(a.ingresos+a.egresos);});
    var filasGrupo=grupos.map(function(x){return '<tr><td>'+esc(x.nombre)+'</td><td class="money positivo">'+cop(x.ingresos)+'</td><td class="money negativo">'+cop(x.egresos)+'</td></tr>';}).join('');
    var filasMov=lista.map(function(m){return '<tr><td class="whitespace-nowrap">'+esc(G.fecha(m.fecha)||m.fecha||'')+'</td><td>'+esc(m.detalle||m.producto||'')+'</td><td>'+esc(m.producto||'')+'</td><td class="money positivo">'+(m.ingresos?cop(m.ingresos):'—')+'</td><td class="money negativo">'+(m.egresos?cop(m.egresos):'—')+'</td></tr>';}).join('');
    var panel=document.getElementById('v5-detalle-proyecto'); panel.hidden=false;
    panel.innerHTML='<div class="v5-detalle-cab"><div><p class="v5-eyebrow">Detalle cargado al seleccionar</p><h3>'+esc(p.nombre)+'</h3></div><button type="button" class="v5-cerrar" aria-label="Cerrar detalle">×</button></div><div class="v5-detalle-kpis"><article><span>Entró</span><strong class="positivo">'+cop(p.ingresos)+'</strong></article><article><span>Salió</span><strong class="negativo">'+cop(p.egresos)+'</strong></article><article><span>Saldo de caja</span><strong class="'+clase(p.caja)+'">'+signo(p.caja)+'</strong></article><article><span>Resultado estimado B</span><strong class="'+clase(p.resultado)+'">'+signo(p.resultado)+'</strong><small>Incluye ≈ '+cop(p.manoObra)+' de personal atribuido</small></article></div><div class="v5-detalle-columnas"><div><h4>Composición</h4><div class="overflow-x-auto"><table><thead><tr><th>Concepto</th><th class="text-right">Entró</th><th class="text-right">Salió</th></tr></thead><tbody>'+filasGrupo+'</tbody></table></div></div><div><h4>Movimientos ('+lista.length+')</h4><div class="v5-movimientos overflow-x-auto"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Concepto</th><th class="text-right">Entró</th><th class="text-right">Salió</th></tr></thead><tbody>'+filasMov+'</tbody></table></div></div></div><p class="v5-detalle-pie">El reparto de personal es estimado. <a href="proyecto?p='+encodeURIComponent(p.codigo)+'">Abrir ficha completa →</a></p>';
    panel.dataset.cargado=codigo; panel.querySelector('.v5-cerrar').addEventListener('click',cerrarDetalle);
  }
  function cerrarDetalle(){var panel=document.getElementById('v5-detalle-proyecto');panel.hidden=true;panel.innerHTML='';panel.removeAttribute('data-cargado');root.querySelectorAll('.v5-proyecto-control').forEach(function(b){b.setAttribute('aria-expanded','false');b.classList.remove('is-active');});}
  root.addEventListener('click',function(e){var b=e.target.closest('.v5-proyecto-control');if(!b)return;var cod=b.dataset.proyecto;root.querySelectorAll('.v5-proyecto-control').forEach(function(x){var a=x.dataset.proyecto===cod;x.setAttribute('aria-expanded',a?'true':'false');x.classList.toggle('is-active',a);});detalleProyecto(cod);document.getElementById('v5-detalle-proyecto').scrollIntoView({behavior:'smooth',block:'nearest'});});
  var imprimir=document.getElementById('v5-imprimir');if(imprimir)imprimir.addEventListener('click',function(){window.print();});
})();
