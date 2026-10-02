/* Indicadores documentales: ningún censo se convierte automáticamente en hembras en postura. */
window.SEGUIMIENTO = (function () {
  'use strict';
  function data() { return window.DATA_SEGUIMIENTO || {}; }
  function projectId(code) { const p = (data().Projects || []).find(p => p.Code === code || p.Id === code); return p ? p.Id : code; }
  function active(project, date) {
    const rows = (data().PopulationPeriods || []).filter(p => p.ProjectId === projectId(project) && p.Scope === 'Proyecto' && p.DateFrom <= date && p.DateTo >= date);
    // Los intervalos superpuestos son una ambigüedad, no poblaciones adicionales.
    if (rows.length !== 1) return null;
    const p = rows[0];
    return p.Status === 'confirmed' && p.CoverageComplete === true && p.Sex === 'Hembra' && p.Stage === 'Postura' && Number.isInteger(p.Count) && p.Count > 0 && !p.ReviewStatus ? p.Count : null;
  }
  function production(project, rows) {
    const byDay = {};
    for (const row of rows) {
      if (!row.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) continue;
      const d = byDay[row.fecha] || (byDay[row.fecha] = { date: row.fecha, eggs: 0, missing: false });
      if (!Number.isFinite(row.unidades) || row.unidades < 0) d.missing = true;
      else d.eggs += row.unidades;
    }
    const months = {}, days = Object.values(byDay).sort((a,b) => a.date.localeCompare(b.date)).map(d => {
      const layers = active(project, d.date), rate = layers !== null && !d.missing ? d.eggs / layers * 100 : null;
      const m = months[d.date.slice(0,7)] || (months[d.date.slice(0,7)] = { month: d.date.slice(0,7), eggs:0, layerDays:0, coveredEggs:0, coveredDays:0, days:0 });
      m.eggs += d.eggs; m.days++;
      if (rate !== null) { m.layerDays += layers; m.coveredEggs += d.eggs; m.coveredDays++; }
      return { date:d.date, eggs:d.missing ? null : d.eggs, layers, rate, needsReview: rate !== null && rate > 100 };
    });
    return { days, months: Object.values(months).map(m => ({ ...m, coverage: m.coveredDays / m.days * 100, rate: m.coveredDays === m.days && m.layerDays > 0 ? m.eggs / m.layerDays * 100 : null, coveredRate: m.layerDays > 0 ? m.coveredEggs / m.layerDays * 100 : null })) };
  }
  function census(project, at) {
    const groups = {};
    for (const r of data().Animals || []) {
      if (r.ProjectId !== projectId(project) || r.Kind !== 'census' || !r.Date || r.Date > at || r.ReviewStatus === 'pending' || r.Quality === 'provisional') continue;
      const key = r.Scope || 'Proyecto';
      if (!groups[key] || r.Date > groups[key].Date) groups[key] = r;
      else if (r.Date === groups[key].Date && r.Count !== groups[key].Count) groups[key] = { ...r, Count:null, Notes:'Censos contradictorios en la misma fecha; requiere revisión.' };
    }
    return Object.values(groups);
  }
  return { data, projectId, active, production, census };
})();
