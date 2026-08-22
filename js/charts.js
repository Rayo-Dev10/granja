/* charts.js — gráficos SVG accesibles en JS vanilla.
   Cada chart devuelve un <figure> con el SVG + una tabla de datos equivalente
   dentro de <details> (accesibilidad e impresión). */
window.CHARTS = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    azul: '#0b67d0', azulOscuro: '#0a3568', verde: '#16965c', amarillo: '#f4b400',
    rojo: '#d6455d', cian: '#11afc4', gris: '#94a3b8', texto: '#0f172a', mut: '#475569',
    borde: '#e2e8f0',
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

  function tablaEquivalente(titulo, cab, filas) {
    return `<details class="mt-2 text-sm"><summary class="cursor-pointer text-neutral-600">Ver estos datos como tabla</summary>
      <table class="mt-2"><caption class="sr-only">${esc(titulo)}</caption>
      <thead><tr>${cab.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map((v,i) => `<td class="${i>0?'money':''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></details>`;
  }

  function figura(titulo, lectura, svg, tabla) {
    return `<figure role="group">
      ${svg}
      <figcaption class="text-sm text-neutral-600 mt-1">${esc(lectura)}</figcaption>
      ${tabla}
    </figure>`;
  }

  /* Barras horizontales. datos: [{etiqueta, valor, color?, href?}] */
  function barras(o) {
    const d = o.datos; if (!d.length) return '<p class="text-neutral-500">Sin datos para graficar.</p>';
    const max = Math.max(...d.map(x => Math.abs(x.valor)), 1);
    const rowH = 34, labelW = 175, W = 640, chartW = W - labelW - 90, H = d.length * rowH + 8;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}" class="w-full h-auto" font-family="Inter,system-ui,sans-serif">`;
    d.forEach((x, i) => {
      const y = i * rowH + 4, w = Math.max(2, Math.round(Math.abs(x.valor) / max * chartW));
      const color = x.color || C.azul;
      const bar = `<rect x="${labelW}" y="${y}" width="${w}" height="${rowH - 12}" rx="4" fill="${color}"></rect>`;
      s += `<text x="${labelW - 8}" y="${y + 15}" text-anchor="end" font-size="12.5" fill="${C.texto}">${esc(x.etiqueta)}</text>`;
      s += x.href ? `<a href="${esc(x.href)}" aria-label="Ver detalle de ${esc(x.etiqueta)}">${bar}</a>` : bar;
      s += `<text x="${labelW + w + 6}" y="${y + 15}" font-size="12" fill="${C.mut}" style="font-variant-numeric:tabular-nums">${o.formato === 'cop' ? '$' + fmt.format(x.valor) : fmt.format(x.valor)}</text>`;
    });
    s += '</svg>';
    return figura(o.titulo, o.lectura || '', s,
      tablaEquivalente(o.titulo, [o.colEtiqueta || 'Concepto', o.colValor || 'Valor'],
        d.map(x => [x.etiqueta, (o.formato === 'cop' ? '$' : '') + fmt.format(x.valor)])));
  }

  /* Barras divergentes (balance +/-). datos: [{etiqueta, valor, href?}] */
  function divergente(o) {
    const d = o.datos; if (!d.length) return '<p class="text-neutral-500">Sin datos.</p>';
    const max = Math.max(...d.map(x => Math.abs(x.valor)), 1);
    const rowH = 30, labelW = 175, W = 640, half = (W - labelW - 110) / 2, cx = labelW + half, H = d.length * rowH + 24;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}" class="w-full h-auto" font-family="Inter,system-ui,sans-serif">`;
    s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${H - 20}" stroke="${C.gris}" stroke-dasharray="3 3"/>`;
    d.forEach((x, i) => {
      const y = i * rowH + 4, w = Math.max(2, Math.round(Math.abs(x.valor) / max * half));
      const pos = x.valor >= 0;
      const bar = `<rect x="${pos ? cx : cx - w}" y="${y}" width="${w}" height="${rowH - 10}" rx="4" fill="${pos ? C.verde : C.rojo}"></rect>`;
      s += `<text x="${labelW - 8}" y="${y + 14}" text-anchor="end" font-size="12.5" fill="${C.texto}">${esc(x.etiqueta)}</text>`;
      s += x.href ? `<a href="${esc(x.href)}" aria-label="Ver detalle de ${esc(x.etiqueta)}">${bar}</a>` : bar;
      const txt = (pos ? '+' : '−') + '$' + fmt.format(Math.abs(x.valor));
      const dentro = !pos && (cx - w - 5 - txt.length * 6.5) < labelW; // no cabe a la izquierda: escribir dentro de la barra
      s += dentro
        ? `<text x="${cx - w + 6}" y="${y + 14}" text-anchor="start" font-size="11.5" fill="#ffffff" style="font-variant-numeric:tabular-nums">${txt}</text>`
        : `<text x="${pos ? cx + w + 5 : cx - w - 5}" y="${y + 14}" text-anchor="${pos ? 'start' : 'end'}" font-size="11.5" fill="${C.mut}" style="font-variant-numeric:tabular-nums">${txt}</text>`;
    });
    s += `<text x="${cx - half / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${C.mut}">◀ consume recursos</text>`;
    s += `<text x="${cx + half / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${C.mut}">aporta recursos ▶</text>`;
    s += '</svg>';
    return figura(o.titulo, o.lectura || '', s,
      tablaEquivalente(o.titulo, ['Proyecto', 'Balance'], d.map(x => [x.etiqueta, (x.valor >= 0 ? '+$' : '−$') + fmt.format(Math.abs(x.valor))])));
  }

  /* Líneas por mes. series: [{nombre, color, puntos: [{x:'2026-01', y}]}]
     o.compacto: versión de menor alto para rejillas (paneles de proyecto). */
  function lineas(o) {
    const meses = [...new Set(o.series.flatMap(s => s.puntos.map(p => p.x)))].sort();
    if (!meses.length) return '<p class="text-neutral-500">Sin datos.</p>';
    const W = 640, H = o.compacto ? 180 : 240, padB = 28, padT = 12, padR = 12;
    const maxY = Math.max(...o.series.flatMap(s => s.puntos.map(p => p.y)), 1);
    const padL = Math.max(46, 12 + fmt.format(Math.round(maxY)).length * 6.5);
    const X = i => padL + i * (W - padL - padR) / Math.max(meses.length - 1, 1);
    const Y = v => padT + (1 - v / maxY) * (H - padT - padB);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}" class="w-full h-auto" font-family="Inter,system-ui,sans-serif">`;
    for (let g = 0; g <= 4; g++) {
      const v = maxY * g / 4, y = Y(v);
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${C.borde}"/>`;
      s += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="${C.mut}">${fmt.format(Math.round(v))}</text>`;
    }
    meses.forEach((m, i) => {
      const anchor = i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle';
      s += `<text x="${X(i)}" y="${H - 8}" text-anchor="${anchor}" font-size="10.5" fill="${C.mut}">${esc(window.GRANJA ? GRANJA.mesLabel(m) : m)}</text>`;
    });
    for (const serie of o.series) {
      const map = Object.fromEntries(serie.puntos.map(p => [p.x, p.y]));
      const pts = meses.map((m, i) => map[m] == null ? null : [X(i), Y(map[m])]).filter(Boolean);
      if (pts.length > 1) s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${serie.color}" stroke-width="2.5"/>`;
      for (const [x, y] of pts) s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${serie.color}"/>`;
    }
    s += '</svg>';
    const leyenda = o.series.length > 1
      ? `<p class="text-xs text-neutral-600 flex gap-4 mt-1">${o.series.map(x => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${x.color}"></span> ${esc(x.nombre)}</span>`).join('')}</p>` : '';
    return figura(o.titulo, o.lectura || '', s + leyenda,
      tablaEquivalente(o.titulo, ['Mes', ...o.series.map(x => x.nombre)],
        meses.map(m => [window.GRANJA ? GRANJA.mesLabel(m) : m,
          ...o.series.map(sr => { const p = sr.puntos.find(p => p.x === m); return p ? fmt.format(p.y) : '—'; })])));
  }

  /* Dona de composición. datos: [{etiqueta, valor, color}]
     o.compacto: versión estrecha (dona sola + leyenda HTML debajo) para rejillas. */
  function dona(o) {
    const d = o.datos.filter(x => x.valor > 0);
    const total = d.reduce((a, x) => a + x.valor, 0);
    if (!total) return '<p class="text-neutral-500">Sin datos.</p>';
    if (o.compacto) return donaCompacta(o, d, total);
    const W = 640, H = 230, cx = 130, cy = 115, R = 88, r = 52;
    let ang = -Math.PI / 2, s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}" class="w-full h-auto" font-family="Inter,system-ui,sans-serif">`;
    d.forEach(x => {
      const a2 = ang + (x.valor / total) * Math.PI * 2;
      const large = (a2 - ang) > Math.PI ? 1 : 0;
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x1, y1] = p(ang, R), [x2, y2] = p(a2, R), [x3, y3] = p(a2, r), [x4, y4] = p(ang, r);
      s += `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z" fill="${x.color}" stroke="white" stroke-width="1.5"/>`;
      ang = a2;
    });
    s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.texto}">${esc(o.centro || '')}</text>`;
    s += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10.5" fill="${C.mut}">${esc(o.centroSub || '')}</text>`;
    let ly = 40;
    d.forEach(x => {
      const pct = Math.round(x.valor / total * 100);
      s += `<rect x="255" y="${ly - 10}" width="12" height="12" rx="2" fill="${x.color}"/>`;
      s += `<text x="273" y="${ly}" font-size="12.5" fill="${C.texto}">${esc(x.etiqueta)} — ${pct}% ($${fmt.format(x.valor)})</text>`;
      ly += 22;
    });
    s += '</svg>';
    return figura(o.titulo, o.lectura || '', s,
      tablaEquivalente(o.titulo, ['Concepto', 'Valor', '%'],
        d.map(x => [x.etiqueta, '$' + fmt.format(x.valor), Math.round(x.valor / total * 100) + '%'])));
  }

  /* Dona compacta: SVG cuadrado (dona sola, centrado) + leyenda como lista HTML
     debajo, para que quepan tres en una fila. Mantiene la tabla accesible. */
  function donaCompacta(o, d, total) {
    const W = 200, H = 190, cx = 100, cy = 95, R = 80, r = 46;
    let ang = -Math.PI / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}" class="w-full h-auto" style="max-height:190px" font-family="Inter,system-ui,sans-serif">`;
    d.forEach(x => {
      const a2 = ang + (x.valor / total) * Math.PI * 2;
      const large = (a2 - ang) > Math.PI ? 1 : 0;
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x1, y1] = p(ang, R), [x2, y2] = p(a2, R), [x3, y3] = p(a2, r), [x4, y4] = p(ang, r);
      s += `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z" fill="${x.color}" stroke="white" stroke-width="1.5"/>`;
      ang = a2;
    });
    if (o.centro) s += `<text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.texto}">${esc(o.centro)}</text>`;
    if (o.centroSub) s += `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9.5" fill="${C.mut}">${esc(o.centroSub)}</text>`;
    s += '</svg>';
    const leyenda = `<ul class="text-xs text-neutral-700 mt-2 space-y-1">${d.map(x => {
      const pct = Math.round(x.valor / total * 100);
      return `<li><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${x.color};vertical-align:middle"></span> ${esc(x.etiqueta)} — ${pct}% ($${fmt.format(x.valor)})</li>`;
    }).join('')}</ul>`;
    return figura(o.titulo, o.lectura || '', s + leyenda,
      tablaEquivalente(o.titulo, ['Concepto', 'Valor', '%'],
        d.map(x => [x.etiqueta, '$' + fmt.format(x.valor), Math.round(x.valor / total * 100) + '%'])));
  }

  /* Variantes compactas para rejillas (paneles de proyecto). */
  const mini = {
    dona: o => dona(Object.assign({}, o, { compacto: true })),
    lineas: o => lineas(Object.assign({}, o, { compacto: true })),
  };

  return { barras, divergente, lineas, dona, mini, COLORES: C };
})();
