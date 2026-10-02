/* Mano de obra de la Granja San Jose.
   FUENTE REAL: Talento Humano, planilla "Costos mensuales personal asignado CTT Granja".
   La columna C ya incluye prestaciones, recargos, primas y seguridad social: esta
   aplicacion NO vuelve a aplicar ningun factor prestacional.

   La dedicacion a la granja (etapa 1) es un dato suministrado. El reparto entre
   proyectos (etapa 2) no fue medido y se presenta exclusivamente como estimacion. */
window.DATA_MANOOBRA = {
  vigencia: 'Información de Talento Humano recibida en agosto de 2026',
  fuentePersonal: 'Talento Humano — planilla «Costos mensuales personal asignado CTT Granja»',
  vigenciaPersonalDesde: '2026-01',
  costoYaIncluyePrestaciones: true,
  factorPrestacionalAplicable: false,
  horasSemanaTiempoCompleto: 42,
  escenarioPorDefecto: 'B_OPERACION',
  controlSumaMensual: 26652638,
  controlSumaPeriodo: 186568466,
  controlFTE: 7.7,
  supuestoVigencia: 'Se asume que la planta y las dedicaciones informadas al corte de julio de 2026 rigieron desde enero de 2026. No se dispone de planta mes a mes.',
  advertenciaAtribucion: 'Talento Humano informó dedicación a la granja, no dedicación por proyecto. El reparto interno es una estimación por inductores de actividad y debe reemplazarse cuando exista registro de tiempo.',
  personal: [
    { id:'COORD_TEC_GRANJA', cargo:'TÉCNICO COORDINACIÓN GRANJA', tipoVinculacion:'Planta administrativa', costoMensualTotal:4955812, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:4955812, pool:'P_DIRECCION', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto' },
    { id:'AUX_SERV_GEN_1', cargo:'AUX. SERV. GENERALES 1', tipoVinculacion:'Planta administrativa', costoMensualTotal:3418527, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:3418527, pool:'P_SEDE', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto', nota:'Confirmar documentalmente que la dedicación exclusiva a la granja se mantuvo durante todo el periodo.' },
    { id:'AUX_SERV_GEN_2', cargo:'AUX. SERV. GENERALES 2', tipoVinculacion:'Planta administrativa', costoMensualTotal:3418527, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:3418527, pool:'P_SEDE', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto', nota:'Confirmar documentalmente que la dedicación exclusiva a la granja se mantuvo durante todo el periodo.' },
    { id:'VET_PLANEACION', cargo:'PROFESIONAL VETERINARIO PLANEAC. CENTROS', tipoVinculacion:'Prestación servicios', costoMensualTotal:3421506, dedicacionGranja:0.5, dedicacionTexto:'0,5', costoMensualGranja:1710753, pool:'P_SANIDAD', aplicarFactorPrestacional:false, baseDedicacion:'supuesto_por_confirmar', nivelEvidencia:'medio', nota:'Confirmar si 0,5 representa tiempo, centros atendidos o proporción contractual.' },
    { id:'TEC_GRANJA', cargo:'TÉCNICO GRANJA', tipoVinculacion:'Prestación servicios', costoMensualTotal:2222915, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:2222915, pool:'P_OPERACION', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto', nota:'Solicitar a Talento Humano la base de cálculo; el valor requiere validación de consistencia.' },
    { id:'OPER_CAMPO_1', cargo:'OPERARIO CAMPO 1', tipoVinculacion:'Tercerización serv.', costoMensualTotal:3397790, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:3397790, pool:'P_OPERACION', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto' },
    { id:'OPER_CAMPO_2', cargo:'OPERARIO CAMPO 2', tipoVinculacion:'Tercerización serv.', costoMensualTotal:3397790, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:3397790, pool:'P_OPERACION', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto' },
    { id:'OPER_CAMPO_3', cargo:'OPERARIO CAMPO 3', tipoVinculacion:'Tercerización serv.', costoMensualTotal:3419870, dedicacionGranja:1, dedicacionTexto:'1', costoMensualGranja:3419870, pool:'P_OPERACION', aplicarFactorPrestacional:false, baseDedicacion:'declarada', nivelEvidencia:'alto' },
    { id:'SUP_OPERARIOS', cargo:'SUPERVISOR OPERARIOS GRANJA', tipoVinculacion:'Tercerización serv.', costoMensualTotal:3553270, dedicacionGranja:0.2, dedicacionTexto:'3/15', costoMensualGranja:710654, pool:'P_DIRECCION', aplicarFactorPrestacional:false, baseDedicacion:'supuesto_por_confirmar', nivelEvidencia:'bajo', nota:'3/15 es un prorrateo por personas supervisadas, no una medición de tiempo.' }
  ],
  pools: [
    { id:'P_OPERACION', nombre:'Operación de campo', costoMensual:12438365, distribuyeAProyecto:true, inductor:'ICO compuesto' },
    { id:'P_SANIDAD', nombre:'Sanidad y planeación veterinaria', costoMensual:1710753, distribuyeAProyecto:true, inductor:'Índice sanitario', alcance:'solo proyectos pecuarios' },
    { id:'P_DIRECCION', nombre:'Dirección y supervisión', costoMensual:5666466, distribuyeAProyecto:false, politica:'estructura de la granja' },
    { id:'P_SEDE', nombre:'Servicios generales de sede', costoMensual:6837054, distribuyeAProyecto:false, politica:'estructura de la granja' }
  ],
  /* Participaciones reproducidas y auditadas desde los datos actuales del repositorio.
     Son parametros transparentes y editables; no representan horas observadas. */
  repartoEstimado: [
    { proyecto:'GALLINAS_PONEDORAS', ico:0.30015, operacionMes:3733379, sanidadMes:91418 },
    { proyecto:'GANADO_BOVINO', ico:0.17056, operacionMes:2121541, sanidadMes:694720 },
    { proyecto:'CERDOS', ico:0.11853, operacionMes:1474361, sanidadMes:45808 },
    { proyecto:'CODORNICES', ico:0.11420, operacionMes:1420464, sanidadMes:100497 },
    { proyecto:'OVINOS', ico:0.09278, operacionMes:1154019, sanidadMes:719285 },
    { proyecto:'CONEJOS', ico:0.06366, operacionMes:791768, sanidadMes:46245 },
    { proyecto:'CAFE_CENICAFE_I', ico:0.04836, operacionMes:601546, sanidadMes:0 },
    { proyecto:'PISCICOLA', ico:0.02944, operacionMes:366138, sanidadMes:8913 },
    { proyecto:'POLLOS', ico:0.02078, operacionMes:258523, sanidadMes:3867 },
    { proyecto:'HUERTA', ico:0.01367, operacionMes:170072, sanidadMes:0 },
    { proyecto:'PINO_ROMERON', ico:0.01008, operacionMes:125437, sanidadMes:0 },
    { proyecto:'AMBIENTE_CREATIVO', ico:0.00889, operacionMes:110558, sanidadMes:0 },
    { proyecto:'PINO_PATULA', ico:0.00889, operacionMes:110559, sanidadMes:0, notaRedondeo:'Incluye $1 de ajuste para que el pool mensual cierre exactamente.' }
  ],
  escenarios: [
    { id:'A_SOLO_CAJA', nombre:'A · Solo caja', poolsDistribuidos:[] },
    { id:'B_OPERACION', nombre:'B · Operación y sanidad (recomendado)', poolsDistribuidos:['P_OPERACION','P_SANIDAD'] },
    { id:'C_OPERACION_SEDE', nombre:'C · Operación, sanidad y sede', poolsDistribuidos:['P_OPERACION','P_SANIDAD','P_SEDE'] },
    { id:'D_ABSORCION_PLENA', nombre:'D · Absorción plena', poolsDistribuidos:['P_OPERACION','P_SANIDAD','P_SEDE','P_DIRECCION'] }
  ],
  imputaciones: [],
  modoImputacion: 'porcentaje',
  imputacionesTienenPrelacionSobreInductores: true
};
