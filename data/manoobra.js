/* data/manoobra.js — parámetros de MANO DE OBRA de la Granja San José.
   NO contiene datos reales de imputación de horas: la granja no los lleva todavía.
   Aquí viven los VALORES POR DEFECTO (legislación laboral vigente a agosto de 2026)
   y los DOS roles que hoy se conocen. Todo es parametrizable desde la página
   «Mano de obra»; lo que se edite y se guarde se conserva en el servidor
   (datos-servidor/manoobra.json) y lo ve cualquiera desde cualquier computador.

   Fuente legal de los valores por defecto:
   · SMMLV 2026: $1.750.905 · Auxilio de transporte 2026: $249.095
     (Decretos 1469 y 1470 de 2025, ratificados por el Decreto 0159 de 2026).
   · Prestaciones sociales: Código Sustantivo del Trabajo.
   · Aportes y parafiscales: Ley 100 de 1993, Ley 21 de 1982, Ley 89 de 1988, Ley 119 de 1994.
   · Tarifas de riesgos laborales (ARL): Decreto 1607 de 2002.
   · Exoneración de aportes (art. 114-1 E.T.): NO aplica a entidades públicas, por eso
     por defecto la granja paga salud, SENA e ICBF completos (empleadorEntidadPublica = true). */
window.DATA_MANOOBRA = {
  vigencia: 'Legislación laboral colombiana vigente a agosto de 2026',
  smmlv: 1750905,
  auxilioTransporte: 249095,
  topeAuxilioSmmlv: 2,          // el auxilio de transporte se paga hasta 2 SMMLV de salario
  horasSemanaTiempoCompleto: 42, // jornada máxima legal desde julio de 2026 (Ley 2101 de 2021)
  empleadorEntidadPublica: true, // la granja es de una universidad pública → sin exoneración de aportes

  /* ---- Conceptos del costo del empleador. Cada uno es un % sobre una base. ----
     grupo: 'prestacion' (provisión social) | 'seguridad' (seguridad social) | 'parafiscal'
     base:  'salario' (solo el salario) | 'salario+auxilio' (salario + auxilio de transporte)
     exonerable: si la exoneración del art. 114-1 lo cubre cuando el empleador NO es entidad pública
     porRol: la tarifa la fija el rol (caso de la ARL, que depende de la clase de riesgo) */
  conceptos: [
    { id:'cesantias',   nombre:'Cesantías',                 grupo:'prestacion', tarifa:0.0833, base:'salario+auxilio', exonerable:false, nota:'Un mes de salario por año trabajado (art. 249 CST).' },
    { id:'intereses',   nombre:'Intereses a las cesantías', grupo:'prestacion', tarifa:0.0100, base:'salario+auxilio', exonerable:false, nota:'12 % anual sobre las cesantías (Ley 52 de 1975).' },
    { id:'prima',       nombre:'Prima de servicios',        grupo:'prestacion', tarifa:0.0833, base:'salario+auxilio', exonerable:false, nota:'Un mes de salario por año, en dos pagos (art. 306 CST).' },
    { id:'vacaciones',  nombre:'Vacaciones',                grupo:'prestacion', tarifa:0.0417, base:'salario',         exonerable:false, nota:'15 días hábiles por año trabajado (art. 186 CST). No se calcula sobre el auxilio de transporte.' },
    { id:'salud',       nombre:'Salud (aporte del empleador)', grupo:'seguridad', tarifa:0.0850, base:'salario',       exonerable:true,  nota:'8,5 % a cargo del empleador (Ley 100 de 1993). La granja, por ser entidad pública, no accede a la exoneración del art. 114-1.' },
    { id:'pension',     nombre:'Pensión (aporte del empleador)', grupo:'seguridad', tarifa:0.1200, base:'salario',     exonerable:false, nota:'12 % a cargo del empleador (Ley 100 de 1993).' },
    { id:'arl',         nombre:'Riesgos laborales (ARL)',   grupo:'seguridad', tarifa:null, porRol:true, base:'salario', exonerable:false, nota:'La tarifa depende de la clase de riesgo del cargo (Decreto 1607 de 2002).' },
    { id:'caja',        nombre:'Caja de compensación familiar', grupo:'parafiscal', tarifa:0.0400, base:'salario',     exonerable:false, nota:'4 % (Ley 21 de 1982).' },
    { id:'icbf',        nombre:'ICBF',                      grupo:'parafiscal', tarifa:0.0300, base:'salario',         exonerable:true,  nota:'3 % (Ley 89 de 1988).' },
    { id:'sena',        nombre:'SENA',                      grupo:'parafiscal', tarifa:0.0200, base:'salario',         exonerable:true,  nota:'2 % (Ley 119 de 1994).' },
  ],

  /* ---- Clases de riesgo de la ARL (Decreto 1607 de 2002) ---- */
  clasesARL: [
    { clase:'I',   tarifa:0.00522, ejemplo:'labores administrativas, de oficina' },
    { clase:'II',  tarifa:0.01044, ejemplo:'trabajo con algo de esfuerzo físico' },
    { clase:'III', tarifa:0.02436, ejemplo:'trabajo manual, cultivos' },
    { clase:'IV',  tarifa:0.04350, ejemplo:'manejo de animales, maquinaria' },
    { clase:'V',   tarifa:0.06960, ejemplo:'ganadería, labores de campo de mayor riesgo' },
  ],

  /* ---- Los DOS roles que hoy se conocen (con valores de ejemplo editables) ---- */
  roles: [
    { id:'ADMIN_GRANJA', nombre:'Administrador de granja', persona:'Diana',
      salarioBruto:3000000, usaSmmlv:false, claseARL:'I', horasSemana:42,
      nota:'Trabaja 42 horas semanales, casi todas administrativas. Salario de ejemplo: $3.000.000 (cámbielo por el real informado en la quincena).' },
    { id:'OPERADOR_GRANJA', nombre:'Operador de granja', persona:null,
      salarioBruto:null, usaSmmlv:true, claseARL:'V', horasSemana:42,
      nota:'Salario de ejemplo: un salario mínimo legal (SMMLV 2026 = $1.750.905). Clase de riesgo V por ser labor de campo.' },
  ],

  /* ---- Roles previstos, SIN datos todavía. Se dejan listos para diligenciar. ---- */
  rolesPrevistos: [
    { id:'PROFESOR',   nombre:'Profesor con horas asignadas a la granja', tipoCosto:'nomina',    nota:'Costo institucional por horas de docencia dedicadas a proyectos de la granja.' },
    { id:'PASANTE',    nombre:'Pasante / estudiante en práctica',          tipoCosto:'formacion', nota:'Puede no tener costo salarial (formación), pero sí dedicación que conviene medir.' },
    { id:'APRENDIZ',   nombre:'Aprendiz SENA',                             tipoCosto:'apoyo',     nota:'Apoyo de sostenimiento según convenio; verificar si lo asume la granja o la institución.' },
    { id:'JORNALERO',  nombre:'Jornalero por día',                         tipoCosto:'caja',      nota:'Se paga por día desde la caja de la granja: revisar que no se cuente dos veces con el libro.' },
    { id:'DONANTE',    nombre:'Profesional que dona sus servicios',        tipoCosto:'donacion',  nota:'Veterinarios, zootecnistas u otros que a veces atienden la granja sin cobrar. Costo de mercado imputado. VER RIESGO DE COBERTURA DE ARL.' },
  ],

  /* ---- Imputación de horas por proyecto: VACÍA a propósito (no se inventa nada). ----
     Formato de cada fila: { periodo:'2026-07', rolId:'OPERADOR_GRANJA', proyecto:'GALLINAS_PONEDORAS', porcentaje:30 }
     Diana eligió trabajar con PORCENTAJES de dedicación (más fácil de mantener). */
  imputaciones: [],
  modoImputacion: 'porcentaje',   // 'porcentaje' | 'horas'

  /* ---- Motivos de merma para las revelaciones (semilla editable) ---- */
  motivosMerma: [
    { id:'vendido',     nombre:'Vendido',                    tipo:'salida' },
    { id:'danado',      nombre:'Dañado / roto',              tipo:'merma'  },
    { id:'autoconsumo', nombre:'Autoconsumo institucional',  tipo:'salida' },
    { id:'donacion',    nombre:'Donación / muestra',         tipo:'salida' },
    { id:'existencias', nombre:'Variación de existencias',   tipo:'ajuste' },
  ],

  /* ---- Notas para las revelaciones (vacías; se llenan a mano) ---- */
  notasRevelacion: [],
};
