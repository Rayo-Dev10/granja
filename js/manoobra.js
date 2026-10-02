(function () {
  'use strict';
  var G=window.GRANJA, MO=window.MANOOBRA, D=window.DATA_MANOOBRA, raiz=document.getElementById('contenido-mo');
  function cop(v){return G.cop(Math.round(v));}
  function etiqueta(p){return p.baseDedicacion==='declarada'?'<span class="estado estado-ok">Dato TH</span>':'<span class="estado estado-alerta">Supuesto por confirmar</span>';}
  function render(){
    var totalMes=MO.totalGranjaMes(), totalPeriodo=totalMes*7, fte=D.personal.reduce(function(s,p){return s+p.dedicacionGranja;},0);
    var sup=D.personal.filter(function(p){return p.baseDedicacion!=='declarada';}).reduce(function(s,p){return s+p.costoMensualGranja;},0);
    var filas=D.personal.map(function(p){return '<tr><td><strong>'+G.esc(p.cargo)+'</strong><br><small>'+G.esc(p.tipoVinculacion)+'</small></td><td class="money">'+cop(p.costoMensualTotal)+'</td><td class="money">'+G.num(p.dedicacionGranja*100)+' %</td><td class="money"><strong>'+cop(p.costoMensualGranja)+'</strong></td><td>'+etiqueta(p)+(p.nota?'<br><small>'+G.esc(p.nota)+'</small>':'')+'</td></tr>';}).join('');
    var pools=D.pools.map(function(p){return '<tr><td>'+G.esc(p.nombre)+'</td><td class="money">'+cop(p.costoMensual)+'</td><td>'+(p.distribuyeAProyecto?'Se estima por '+G.esc(p.inductor):'Estructura no distribuida')+'</td></tr>';}).join('');
    raiz.innerHTML='<h1>👷 Mano de obra real informada por Talento Humano</h1>'+
      '<p class="text-neutral-600 mt-1 max-w-4xl">La cifra mensual ya incluye prestaciones, recargos, primas y seguridad social. Por eso se usa directamente y <strong>no se aplica un segundo factor prestacional</strong>.</p>'+
      '<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">'+
      '<article class="kpi"><span class="titulo">Costo mensual asignado</span><span class="valor">'+cop(totalMes)+'</span><span class="lectura">Dato de Talento Humano</span></article>'+
      '<article class="kpi"><span class="titulo">Costo enero–julio</span><span class="valor">'+cop(totalPeriodo)+'</span><span class="lectura">Supone la misma planta durante 7 meses</span></article>'+
      '<article class="kpi"><span class="titulo">Equivalentes tiempo completo</span><span class="valor">'+G.num(fte)+'</span><span class="lectura">Suma de dedicaciones a la granja</span></article>'+
      '<article class="kpi"><span class="titulo">Costo medio por hora</span><span class="valor">'+cop(MO.costoHoraGranja())+'</span><span class="lectura">Referencia agregada, 42 h/semana</span></article></section>'+
      '<section class="mt-8"><div class="alerta-azul"><strong>Dos etapas distintas.</strong> Etapa 1: dedicación a la granja, informada por Talento Humano. Etapa 2: reparto entre proyectos, no medido y estimado mediante inductores de actividad. Las cifras estimadas sirven para dimensionar, no para juzgar responsables.</div></section>'+
      '<section class="mt-8"><h2>Personal asignado</h2><div class="overflow-x-auto"><table class="mt-3"><thead><tr><th>Cargo y vinculación</th><th class="text-right">Costo mensual incl. prestaciones</th><th class="text-right">Dedicación granja</th><th class="text-right">Costo asignado</th><th>Calidad</th></tr></thead><tbody>'+filas+'</tbody><tfoot><tr><th>Total</th><th></th><th class="money">'+G.num(fte*100)+' %</th><th class="money">'+cop(totalMes)+'</th><th></th></tr></tfoot></table></div><p class="text-sm text-neutral-600 mt-2"><strong>'+cop(sup)+' mensuales</strong> ('+G.num(sup/totalMes*100)+' %) provienen de dedicaciones supuestas, no medidas: veterinario 0,5 y supervisor 3/15.</p></section>'+
      '<section class="mt-8"><h2>Centros de costo y política de atribución</h2><div class="overflow-x-auto"><table class="mt-3"><thead><tr><th>Centro</th><th class="text-right">Costo mensual</th><th>Tratamiento en escenario B</th></tr></thead><tbody>'+pools+'</tbody></table></div><p class="text-sm text-neutral-600 mt-2">Dirección y sede suman <strong>'+cop(12503520)+'/mes</strong> y se muestran como estructura. Operación y sanidad suman <strong>'+cop(14149118)+'/mes</strong> y se distribuyen con una estimación visible.</p></section>'+
      '<section class="mt-8"><h2>Limitaciones que deben acompañar cualquier lectura</h2><ul class="lista-normal mt-3"><li>No existe registro de horas por proyecto.</li><li>Se supone que la planta de julio rigió desde enero; cada mes de diferencia vale '+cop(totalMes)+'.</li><li>El registro de alimentación solo cubre mayo–julio.</li><li>Ganado Bovino usa 11 semovientes tomados de una glosa, no de inventario.</li><li>Los coeficientes de manejo animal y la dedicación de auxiliares requieren validación técnica/documental.</li></ul><p class="mt-4"><a class="btn-pri" href="dashboard">Abrir Dashboard económico →</a></p></section>';
  }
  render();
})();
