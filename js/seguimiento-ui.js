window.SEGUIMIENTO_UI = (function () {
  'use strict';
  const S = window.SEGUIMIENTO, G = window.GRANJA;
  const esc = G.esc;
  function value(v) { return v === null || v === undefined || v === '' ? '<span class="dato-pendiente">Pendiente</span>' : esc(v); }
  function number(v) { return v === null || v === undefined ? '<span class="dato-pendiente">Pendiente</span>' : Number(v).toLocaleString('es-CO', { maximumFractionDigits:4 }); }
  function percentage(v) { return v === null || v === undefined ? '<span class="dato-pendiente">No calculable</span>' : Number(v).toLocaleString('es-CO', {maximumFractionDigits:2}) + ' %'; }
  function source(r) { return esc((r.SourceId || '') + ' · ' + (r.SourceLocation || 'ubicación pendiente')); }
  function table(headers, rows, caption) {
    if (!rows.length) return '<p class="dato-pendiente">No se aportaron registros para este apartado.</p>';
    return '<div class="seguimiento-tabla"><table><caption>' + esc(caption || '') + '</caption><thead><tr>' + headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('') + '</tr></thead><tbody>' + rows.map(c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function sex(r) { return r.Sex || (/^(hembras|machos)$/i.test(r.Scope || '') ? r.Scope : null); }
  function inventory(code, at = '2026-07-31') {
    const id = S.projectId(code), d = S.data(), p = (d.Projects || []).find(p=>p.Id===id);
    const animals = S.census(id, at), assets = (d.Assets || []).filter(a=>a.ProjectId===id);
    const pending = (d.Reviews || []).filter(r=>r.ProjectId===id && r.Decision==='pending');
    return '<section class="seguimiento-panel" id="inventario-director"><h2>Inventario, etapas y áreas del proyecto</h2><p>Último censo documental por grupo hasta '+esc(G.fecha(at))+'. No equivale a un conteo actualizado en campo ni se suman censos sucesivos.</p>' +
      table(['Grupo / lote','Fecha del censo','Número reportado','Hembras / machos','Especie','Género taxonómico','Raza / variedad','Etapa','Cobertura','Fuente'], animals.map(r=>[value(r.Scope),value(r.Date),number(r.Count),value(sex(r)),value(r.Species),value(r.Genus),value(r.Breed || r.Variety),value(r.Stage),r.CoverageComplete?'Completa documentada':'Sin confirmar',source(r)]), 'Censos disponibles; datos faltantes explícitos') +
      table(['Activo / unidad territorial','Cantidad','Unidad','Hectáreas','Alcance del área','Especie / variedad','Etapa / estado','Fecha de constatación','Fuente'], assets.map(r=>[value(r.Name),number(r.Quantity),value(r.Unit),number(r.AreaHa),r.AreaHa!=null?(r.SharedArea?'Área del conjunto; no repetir por lote':'Área individual reportada'):'Pendiente delimitación',value(r.Species || r.Variety),value(r.Stage || r.State),value(r.Date),source(r)]), 'Activos y superficies documentadas') +
      '<p class="seguimiento-nota">No se suman superficies compartidas: falta delimitar lotes, posibles solapamientos y fecha de medición. Género taxonómico y sexo son campos distintos. La ausencia de información no significa cero.</p>' +
      (p ? '<p>Nombres científicos reportados: '+value((p.ReportedScientificNames || []).join('; '))+' · Género taxonómico derivado del nombre reportado: '+value((p.ReportedGenera || []).join('; '))+'</p><details><summary>Seguimiento y contexto documentado (S05)</summary><p>'+value(p.Purpose)+'</p><p>'+esc(p.Notes || 'Sin ampliación documental')+'</p><p>Vigencia / fechas reportadas: '+value(p.OriginalDate)+'</p></details>' : '') +
      '<p><a href="seguimiento?p='+encodeURIComponent(code)+'#revisiones">'+pending.length+' asuntos de revisión del proyecto</a> · <a href="seguimiento?p='+encodeURIComponent(code)+'">Ver informe del director y evidencias →</a></p></section>';
  }
  function posture(code, rows) {
    const r=S.production(code,rows), total=r.days.length, covered=r.days.filter(d=>d.rate!==null).length;
    return '<section class="seguimiento-panel" id="porcentaje-postura"><h2>Porcentaje de producción de huevos (postura)</h2><p><strong>Diario:</strong> huevos recogidos ÷ hembras activas en postura ese día × 100. <strong>Periodo:</strong> huevos ÷ suma de hembras-día × 100; no usa el inventario al corte ni promedia porcentajes diarios.</p><p class="dato-pendiente">Cobertura del denominador: '+covered+' de '+total+' fechas con recolección. Un censo de aves no acredita sexo, etapa productiva ni permanencia diaria. No se proyectan censos históricos sin soporte.</p>' +
      table(['Mes','Huevos registrados','Hembras-día acreditadas','Fechas cubiertas / registradas','Cobertura','Postura en fechas registradas','Postura solo del subconjunto cubierto'],r.months.map(m=>[value(m.month),number(m.eggs),m.layerDays?number(m.layerDays):value(null),m.coveredDays+' / '+m.days,percentage(m.coverage),percentage(m.rate),percentage(m.coveredRate)]),'La cobertura se refiere a fechas con recolección; no demuestra un mes calendario completo') +
      '<details><summary>Ver recolección diaria y población activa ('+total+' fechas)</summary>'+table(['Fecha','Huevos','Hembras activas','Postura diaria','Revisión'],r.days.map(d=>[value(d.date),number(d.eggs),number(d.layers),percentage(d.rate),d.needsReview?'Revisar: supera 100 %':'—']),'Detalle diario del periodo seleccionado')+'</details>' +
      '<details><summary>¿Qué hacer para poder calcularlo?</summary><p>Registrar por proyecto la población de hembras efectivamente en postura, con fecha inicial y final de vigencia, lote, fuente y confirmación del responsable. Actualizar entradas, bajas y cambios de etapa. Si solo se cubre un lote, separar también su recolección; no dividir huevos de todo el proyecto por aves de un solo lote.</p><p>Descargar <a href="formatos-plantillas/poblacion-postura.csv" download>plantilla de población activa</a>. Su diligenciamiento no modifica el sitio automáticamente: requiere validación e incorporación al conjunto publicado.</p></details></section>';
  }
  function link() { return '<section class="seguimiento-panel"><h2>Información para el director de pasantía</h2><p>Inventarios fechados, sexo, etapas, especies, superficies, alimentación, actividades, personal y revisiones documentales de los 17 proyectos.</p><p><a class="btn-sec" href="seguimiento">Abrir informe de seguimiento →</a></p><p class="seguimiento-nota">Caja y producción: julio. Alimentación: hasta el 3 de agosto. Actividades: agosto. El seguimiento sin fecha de constatación no actualiza automáticamente el corte financiero.</p></section>'; }
  return { value, number, percentage, source, table, sex, inventory, posture, link };
})();
