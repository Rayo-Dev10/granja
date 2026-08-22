/* manoobra-core.js — núcleo reutilizable del costeo de MANO DE OBRA.
   Expone window.MANOOBRA con la MISMA lógica de prestaciones que la página
   «Mano de obra», para que las demás páginas (ficha de proyecto, resumen,
   controles) puedan calcular el costo de una hora de trabajo y el costo de
   mano de obra imputado a un proyecto SIN duplicar el cálculo ni inventar horas.

   Lee siempre window.DATA_MANOOBRA (valores de ley vigentes a agosto de 2026).
   Si no hay imputaciones registradas, costoManoObraProyecto() responde
   honestamente con hayDatos:false y no inventa ninguna dedicación. */
window.MANOOBRA = (function () {
  'use strict';

  function D() { return window.DATA_MANOOBRA || {}; }

  /* Costo del empleador para un rol dado. `rol` puede ser un rol del catálogo
     o un objeto parcial {usaSmmlv, salarioBruto, claseARL, horasSemana}. */
  function calcular(rol) {
    const d = D();
    rol = rol || {};
    const smmlv = d.smmlv || 0;
    const salario = rol.usaSmmlv ? smmlv : Math.max(0, +rol.salarioBruto || 0);
    const topeAux = (d.topeAuxilioSmmlv || 0) * smmlv;
    const aplicaAux = salario > 0 && salario <= topeAux;
    const auxilio = aplicaAux ? (d.auxilioTransporte || 0) : 0;
    const clasesARL = d.clasesARL || [];
    const clase = clasesARL.find(c => c.clase === rol.claseARL) || clasesARL[0] || { clase: null, tarifa: 0 };
    const lineas = [];
    let totalConceptos = 0;
    (d.conceptos || []).forEach(c => {
      const tarifa = c.porRol ? clase.tarifa : c.tarifa;
      const exonerado = c.exonerable && !d.empleadorEntidadPublica && salario < 10 * smmlv;
      const baseMonto = c.base === 'salario+auxilio' ? salario + auxilio : salario;
      const monto = exonerado ? 0 : Math.round(baseMonto * (tarifa || 0));
      lineas.push({ id: c.id, nombre: c.nombre, grupo: c.grupo, tarifa: tarifa, base: c.base, baseMonto: baseMonto, monto: monto, exonerado: exonerado, clase: c.porRol ? clase.clase : null });
      totalConceptos += monto;
    });
    const costoTotalMes = salario + auxilio + totalConceptos;
    const horasSemana = +rol.horasSemana || d.horasSemanaTiempoCompleto || 42;
    const horasMes = horasSemana * 52 / 12;
    const costoHora = horasMes ? costoTotalMes / horasMes : 0;
    const factor = salario ? costoTotalMes / salario : 0;
    return { salario: salario, auxilio: auxilio, aplicaAux: aplicaAux, lineas: lineas, totalConceptos: totalConceptos, costoTotalMes: costoTotalMes, horasSemana: horasSemana, horasMes: horasMes, costoHora: costoHora, factor: factor, clase: clase };
  }

  function rolPorId(id) { return (D().roles || []).find(r => r.id === id) || null; }

  /* Costo de mano de obra imputado a un proyecto (opcionalmente de un solo periodo).
     Suma, sobre las imputaciones de ese proyecto, costoTotalMes(rol) × porcentaje/100.
     Con imputaciones vacías devuelve {costo:0, horas:0, personas:0, hayDatos:false}. */
  function costoManoObraProyecto(cod, periodo) {
    const imps = (D().imputaciones || []).filter(i => i.proyecto === cod && (!periodo || i.periodo === periodo));
    if (!imps.length) return { costo: 0, horas: 0, personas: 0, hayDatos: false, imputaciones: [] };
    let costo = 0, horas = 0;
    const personas = new Set();
    imps.forEach(i => {
      const rol = rolPorId(i.rolId);
      const pct = (+i.porcentaje || 0) / 100;
      if (rol) {
        const r = calcular(rol);
        costo += r.costoTotalMes * pct;
        horas += r.horasMes * pct;
      }
      personas.add(i.rolId || i.persona || 'desconocido');
    });
    return { costo: costo, horas: horas, personas: personas.size, hayDatos: true, imputaciones: imps };
  }

  /* Costo/hora de referencia del operador de campo (el rol de labor de granja),
     útil como cifra honesta cuando aún no hay horas registradas. */
  function costoHoraOperador() {
    const rol = rolPorId('OPERADOR_GRANJA') || { usaSmmlv: true, claseARL: 'V', horasSemana: 42 };
    return calcular(rol).costoHora;
  }

  return { calcular: calcular, rolPorId: rolPorId, costoManoObraProyecto: costoManoObraProyecto, costoHoraOperador: costoHoraOperador };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.MANOOBRA;
