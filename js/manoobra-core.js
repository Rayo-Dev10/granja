/* Núcleo de costeo de mano de obra. Evita el doble conteo de prestaciones y
   separa el dato de Talento Humano de la estimación de reparto por proyecto. */
window.MANOOBRA = (function () {
  'use strict';
  function D() { return window.DATA_MANOOBRA || {}; }
  function personal() { return (D().personal || []).slice(); }
  function calcular(p) {
    p = p || {};
    var costo = Math.max(0, +p.costoMensualTotal || 0);
    var horasSemana = +p.horasSemana || D().horasSemanaTiempoCompleto || 42;
    var horasMes = horasSemana * 52 / 12;
    return { salario:null, auxilio:0, aplicaAux:false, lineas:[], totalConceptos:0,
      costoTotalMes:costo, horasSemana:horasSemana, horasMes:horasMes,
      costoHora:horasMes ? costo / horasMes : 0, factor:1, clase:null,
      fuenteCosto:'TALENTO_HUMANO', costoIncluyePrestaciones:true };
  }
  function rolPorId(id) { return personal().filter(function (p) { return p.id === id; })[0] || null; }
  function totalGranjaMes() { return personal().reduce(function (s,p) { return s + (+p.costoMensualGranja || 0); }, 0); }
  function mesesInclusivos(desde, hasta) {
    if (!desde || !hasta) return 7;
    var a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T00:00:00');
    return Math.max(0, (b.getFullYear()-a.getFullYear())*12 + b.getMonth()-a.getMonth()+1);
  }
  function totalGranjaPeriodo(desde, hasta) { return totalGranjaMes() * mesesInclusivos(desde, hasta); }
  function porPool() {
    var o = {};
    personal().forEach(function (p) { o[p.pool] = (o[p.pool] || 0) + (+p.costoMensualGranja || 0); });
    return o;
  }
  function escenario(id) {
    var es = D().escenarios || [], buscado = id || D().escenarioPorDefecto || 'B_OPERACION';
    return es.filter(function (e) { return e.id === buscado; })[0] || es[1] || es[0];
  }
  function estimadoBase(cod) {
    return (D().repartoEstimado || []).filter(function (r) { return r.proyecto === cod; })[0] || {proyecto:cod,ico:0,operacionMes:0,sanidadMes:0};
  }
  function repartoProyecto(cod, escenarioId, meses) {
    var e = escenario(escenarioId), r = estimadoBase(cod), pools = e.poolsDistribuidos || [];
    var directo = (pools.indexOf('P_OPERACION') >= 0 ? r.operacionMes : 0) + (pools.indexOf('P_SANIDAD') >= 0 ? r.sanidadMes : 0);
    var baseDirecta = 14149118, adicionales = 0;
    if (pools.indexOf('P_SEDE') >= 0) adicionales += 6837054;
    if (pools.indexOf('P_DIRECCION') >= 0) adicionales += 5666466;
    var paso = adicionales && baseDirecta ? adicionales * (r.operacionMes + r.sanidadMes) / baseDirecta : 0;
    var mensual = directo + paso, n = meses == null ? 7 : meses;
    return { proyecto:cod, operacionMensual:r.operacionMes, sanidadMensual:r.sanidadMes,
      costoMensual:mensual, costoTotal:mensual*n, costo:mensual*n, nPeriodos:n,
      costoMensualPromedio:mensual, horasTotal:null, horas:null, horasMensualPromedio:null,
      personas:0, hayDatos:false, origen:'inductor', esEstimacion:true,
      inductor:'ICO compuesto + índice sanitario', escenario:e.id, ico:r.ico };
  }
  function estructuraPeriodo(escenarioId, meses) {
    var e=escenario(escenarioId), pools=e.poolsDistribuidos || [], pp=porPool(), mensual=0;
    Object.keys(pp).forEach(function(k){ if(pools.indexOf(k)<0) mensual += pp[k]; });
    return {mensual:mensual,total:mensual*(meses==null?7:meses)};
  }
  function costoManoObraProyecto(cod, periodo, escenarioId) {
    var n = periodo && periodo.desde && periodo.hasta ? mesesInclusivos(periodo.desde, periodo.hasta) : 7;
    return repartoProyecto(cod, escenarioId, n);
  }
  function costoHoraGranja() { return totalGranjaMes() / ((D().controlFTE || 0) * (D().horasSemanaTiempoCompleto || 42) * 52 / 12); }
  function costoHoraOperador() { return costoHoraGranja(); }
  function validarReparto(filas) {
    var suma = (filas || []).reduce(function(s,x){return s+(+x.porcentaje||0);},0);
    if (Math.abs(suma-100)>0.000001) throw new Error('El reparto interno debe sumar exactamente 100 %. Suma actual: '+suma+' %.');
    return true;
  }
  return {personal:personal, calcular:calcular, rolPorId:rolPorId, totalGranjaMes:totalGranjaMes,
    totalGranjaPeriodo:totalGranjaPeriodo, porPool:porPool, escenario:escenario,
    repartoProyecto:repartoProyecto, estructuraPeriodo:estructuraPeriodo,
    costoManoObraProyecto:costoManoObraProyecto, costoHoraGranja:costoHoraGranja,
    costoHoraOperador:costoHoraOperador, validarReparto:validarReparto, mesesInclusivos:mesesInclusivos};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = window.MANOOBRA;
