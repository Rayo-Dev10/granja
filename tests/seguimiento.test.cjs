const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(data = {}) {
  const context = { window: { DATA_SEGUIMIENTO: data } };
  const path = require('node:path').join(__dirname, '../js/seguimiento-core.js');
  if (fs.existsSync(path)) vm.runInNewContext(fs.readFileSync(path, 'utf8'), context);
  return context.window.SEGUIMIENTO || {};
}
const period = (from, to, count, extra = {}) => ({ ProjectId: 'P06', DateFrom: from, DateTo: to, Count: count, Sex: 'Hembra', Stage: 'Postura', Scope: 'Proyecto', Status: 'confirmed', CoverageComplete: true, ...extra });
test('postura mensual usa hembras-día variables, no inventario final', () => {
  const api = load({ PopulationPeriods: [period('2026-01-01', '2026-01-01', 100), period('2026-01-02', '2026-01-02', 50)] });
  assert.equal(typeof api.production, 'function');
  const result = api.production('P06', [{ fecha: '2026-01-01', unidades: 80 }, { fecha: '2026-01-02', unidades: 20 }]);
  assert.equal(result.months[0].layerDays, 150);
  assert.equal(result.months[0].rate, 100 / 150 * 100);
  assert.equal(result.days[1].rate, 40);
});
test('un censo histórico no demuestra hembras activas', () => {
  const api = load({ Animals: [{ ProjectId: 'P06', Date: '2026-01-01', Kind: 'census', Count: 100 }] });
  assert.equal(typeof api.production, 'function');
  const result = api.production('P06', [{ fecha: '2026-01-01', unidades: 80 }]);
  assert.equal(result.days[0].rate, null);
  assert.equal(result.months[0].rate, null);
});
test('cobertura parcial no publica un porcentaje mensual completo', () => {
  const api = load({ PopulationPeriods: [period('2026-01-01', '2026-01-01', 100)] });
  assert.equal(typeof api.production, 'function');
  const r = api.production('P06', [{ fecha: '2026-01-01', unidades: 80 }, { fecha: '2026-01-02', unidades: 20 }]);
  assert.equal(r.months[0].rate, null);
  assert.equal(r.months[0].coveredRate, 80);
  assert.equal(r.months[0].coverage, 50);
});
test('solapamientos, machos, ceros y población sin confirmar no generan tasas', () => {
  for (const periods of [[period('2026-01-01', '2026-01-02', 100), period('2026-01-01', '2026-01-02', 50)], [period('2026-01-01', '2026-01-02', 0)], [period('2026-01-01', '2026-01-02', 100, { Sex: 'Macho' })], [period('2026-01-01', '2026-01-02', 100, { Status: 'reported' })]]) {
    const api = load({ PopulationPeriods: periods });
    assert.equal(typeof api.production, 'function');
    assert.equal(api.production('P06', [{ fecha: '2026-01-01', unidades: 80 }]).days[0].rate, null);
  }
});
test('inventario usa último censo por grupo, nunca suma censos sucesivos', () => {
  const api = load({ Animals: [
    { ProjectId:'P10', Scope:'Hembras', Date:'2026-01-01', Kind:'census', Count:10 },
    { ProjectId:'P10', Scope:'Hembras', Date:'2026-07-01', Kind:'census', Count:7 },
    { ProjectId:'P10', Scope:'Machos', Date:'2026-07-01', Kind:'census', Count:2 }
  ] });
  assert.equal(typeof api.census, 'function');
  assert.equal(api.census('P10', '2026-07-31').reduce((sum, x) => sum + x.Count, 0), 9);
  assert.equal(api.census('P10', '2026-01-31')[0].Count, 10);
});
test('fechas propuestas y censos futuros no se presentan como confirmados', () => {
  const api = load({ Animals: [
    {ProjectId:'P06', Scope:'A', Date:'2026-01-01', Kind:'census', Count:46, ReviewStatus:'pending'},
    {ProjectId:'P06', Scope:'A', Date:'2026-08-01', Kind:'census', Count:30}
  ] });
  assert.equal(typeof api.census, 'function');
  assert.equal(api.census('P06', '2026-07-31').length, 0);
});

function report(data) {
  const context = { console, Intl, URLSearchParams, location:{search:''}, window:null };
  context.window=context;
  context.DATA_SEGUIMIENTO=data;
  context.DATA_EVIDENCIAS={};
  context.DATA_CATALOGO={proyectos:[]};
  const base=require('node:path').join(__dirname,'../js/');
  for(const name of ['util.js','seguimiento-core.js','seguimiento-ui.js','seguimiento.js']) {
    const path=base+name;
    if(fs.existsSync(path))vm.runInNewContext(fs.readFileSync(path,'utf8'),context);
  }
  return context.INFORME_SEGUIMIENTO || {};
}
test('informe del director mantiene proyectos sin información como pendientes, no ceros', () => {
  const api=report({Projects:[{Id:'P01',Code:'BIOINSUMOS',Name:'BIOINSUMOS'}]});
  assert.equal(typeof api.render,'function');
  const html=api.render('');
  assert.match(html,/BIOINSUMOS/);
  assert.match(html,/Pendiente/);
  assert.match(html,/Hembras/);
  assert.match(html,/Hectáreas/);
});
test('las descripciones de fuentes no se ejecutan como HTML', () => {
  const api=report({Projects:[{Id:'P01',Code:'BIOINSUMOS',Name:'<img src=x onerror=alert(1)>',Purpose:'<script>alert(1)</script>'}]});
  assert.equal(typeof api.render,'function');
  const html=api.render('BIOINSUMOS');
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('el informe publica áreas del conjunto sin agregarlas como superficie de la granja', () => {
  const api=report({Projects:[{Id:'P03',Code:'CAFE',Name:'Café'}],Assets:[{ProjectId:'P03',Name:'Café conjunto ocho lotes',AreaHa:1.34,SharedArea:true}]});
  assert.equal(typeof api.render,'function');
  const html=api.render('CAFE');
  assert.match(html,/1,34/);
  assert.match(html,/no repetir por lote/);
});

test('controles no comparan postura o ración histórica con inventario final', () => {
  const c={window:null,Intl,URLSearchParams,location:{search:''}};c.window=c;
  const root=require('node:path').join(__dirname,'../');
  for(const name of ['data/catalogo.js','data/movimientos.js','data/produccion.js','data/inventarios.js','data/sanitario.js','data/alimento.js','data/suministros.js','data/seguimiento.js','js/util.js','js/seguimiento-core.js','js/coherencia.js'])vm.runInNewContext(fs.readFileSync(root+name,'utf8'),c);
  const controls=c.COHERENCIA.controles().filter(x=>x.id.startsWith('racion-'));
  assert.equal(controls.length,2);
  assert.ok(controls.every(x=>x.hallazgo.includes('No calculable')));
  assert.ok(controls.every(x=>!x.hallazgo.includes('postura observada es del')));
});
test('la matriz muestra el censo vegetal y el nombre científico ya documentados', () => {
  const api=report({Projects:[{Id:'P03',Code:'CAFE',Name:'Café',ReportedVarieties:['Cenicafé 1']},{Id:'P13',Code:'PINO',Name:'Pino',ReportedScientificNames:['Retrophyllum rospigliosii'],ReportedGenera:['Retrophyllum']}],Assets:[{ProjectId:'P03',Name:'Ocho lotes',Kind:'crop_census',Quantity:8657,Unit:'árboles'}]});
  const html=api.render('');
  assert.match(html,/8\.657/);
  assert.match(html,/Cenicafé 1/);
  assert.match(html,/Retrophyllum rospigliosii/);
});
test('no valida una población fraccionaria de aves y marca postura superior al 100 por ciento', () => {
  const fractional=load({PopulationPeriods:[period('2026-01-01','2026-01-01',10.5)]});
  assert.equal(fractional.production('P06',[{fecha:'2026-01-01',unidades:8}]).days[0].rate,null);
  const valid=load({PopulationPeriods:[period('2026-01-01','2026-01-01',10)]});
  const day=valid.production('P06',[{fecha:'2026-01-01',unidades:15}]).days[0];
  assert.equal(day.rate,150);
  assert.equal(day.needsReview,true);
});
