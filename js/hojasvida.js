/* hojasvida.js — hoja de vida documental por proyecto.
   Carpetas y archivos se guardan en IndexedDB (en el navegador del visitante),
   porque el sitio es estático y sin login. Tipos permitidos:
   PDF, Word, TXT, MD, Excel e imágenes. */
(function () {
  'use strict';
  const G = window.GRANJA;
  const cont = document.getElementById('contenido-hv');
  const ICONO = { BIOINSUMOS:'🧪', HUERTA:'🥬', CAFE_CENICAFE_I:'☕', GANADO_BOVINO:'🐄', CODORNICES:'🥚',
    GALLINAS_PONEDORAS:'🐔', CONEJOS:'🐰', POLLOS:'🐤', APICOLA:'🐝', CERDOS:'🐷', OVINOS:'🐑',
    PISCICOLA:'🐟', PINO_ROMERON:'🌲', AMBIENTE_CREATIVO:'🌳', PINO_PATULA:'🌲', OTRO_MADERAS:'🪵', OTROS_GRANJA:'🏡' };

  const TIPOS = {
    pdf:   { ext: ['pdf'], icono: '📄', nombre: 'PDF', apila: true },
    word:  { ext: ['doc', 'docx'], icono: '📝', nombre: 'Word', apila: true },
    txt:   { ext: ['txt'], icono: '📃', nombre: 'Texto', apila: true },
    md:    { ext: ['md', 'markdown'], icono: '🗒️', nombre: 'Markdown', apila: true },
    excel: { ext: ['xls', 'xlsx', 'xlsm', 'csv'], icono: '📊', nombre: 'Excel', apila: false },
    imagen:{ ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'], icono: '🖼️', nombre: 'Imagen', apila: true },
  };
  const ACCEPT = Object.values(TIPOS).flatMap(t => t.ext.map(e => '.' + e)).join(',');
  function tipoDe(nombre) {
    const ext = (nombre.split('.').pop() || '').toLowerCase();
    for (const [k, t] of Object.entries(TIPOS)) if (t.ext.includes(ext)) return { clave: k, ...t };
    return null;
  }

  /* ---------- IndexedDB ---------- */
  let db;
  function abrirDB() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open('granja-hojas-vida', 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        d.createObjectStore('carpetas', { keyPath: 'id', autoIncrement: true }).createIndex('proyecto', 'proyecto');
        d.createObjectStore('archivos', { keyPath: 'id', autoIncrement: true }).createIndex('proyecto', 'proyecto');
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  const tx = (store, modo) => db.transaction(store, modo).objectStore(store);
  function porProyecto(store, proyecto) {
    return new Promise(res => {
      const out = [];
      tx(store, 'readonly').index('proyecto').openCursor(IDBKeyRange.only(proyecto)).onsuccess = e => {
        const c = e.target.result;
        if (c) { out.push(c.value); c.continue(); } else res(out);
      };
    });
  }
  const agregar = (store, obj) => new Promise(res => { tx(store, 'readwrite').add(obj).onsuccess = e => res(e.target.result); });
  const borrar = (store, id) => new Promise(res => { tx(store, 'readwrite').delete(id).onsuccess = () => res(); });

  /* ---------- vistas ---------- */
  const cod = G.qs('p');
  const vista = G.qs('v');

  async function inicio() {
    db = await abrirDB();
    if (cod && vista === 'consolidado') return verConsolidado(cod);
    if (cod) return verProyecto(cod);
    verLista();
  }

  async function verLista() {
    const tarjetas = [];
    for (const p of G.proyectos()) {
      const [nc, na] = [await porProyecto('carpetas', p.codigo), await porProyecto('archivos', p.codigo)];
      tarjetas.push(`<li class="kpi !p-4">
        <a href="hojas-vida?p=${p.codigo}" class="font-semibold no-underline text-primary-900 text-lg">${ICONO[p.codigo] || '📌'} ${G.esc(p.nombre)}</a>
        <span class="text-sm text-neutral-600">${G.esc(p.responsable)} · ${G.esc(p.area)}</span>
        <span class="text-xs text-neutral-500">${nc.length} carpeta(s) · ${na.length} documento(s) en este navegador</span>
      </li>`);
    }
    cont.innerHTML = `
      <h1>📁 Hojas de vida de los proyectos</h1>
      <p class="text-neutral-600 mt-1 mb-4 max-w-3xl">La <strong>hoja de vida</strong> es el expediente documental de cada proyecto:
        sus actas, fotos, facturas e informes, organizados en carpetas. Elija un proyecto para abrir su expediente,
        crear carpetas y cargar documentos.</p>
      <div class="alerta-azul max-w-3xl">ℹ️ <strong>¿Dónde se guardan los documentos?</strong> En su propio navegador (el sitio es público,
        de solo consulta y sin usuarios). Si abre el sitio en otro computador, verá el expediente vacío: cada equipo guarda los suyos.</div>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6 list-none p-0">${tarjetas.join('')}</ul>`;
  }

  async function verProyecto(codigo) {
    const p = G.proyecto(codigo);
    if (!p) { cont.innerHTML = '<p>Proyecto no encontrado. <a href="hojas-vida">Volver</a>.</p>'; return; }
    document.title = 'Hoja de vida: ' + p.nombre + ' · Granja San José';
    const carpetas = await porProyecto('carpetas', codigo);
    const archivos = await porProyecto('archivos', codigo);

    const secciones = carpetas.map(c => {
      const del = archivos.filter(a => a.carpetaId === c.id);
      return `<section class="mb-6" aria-label="Carpeta ${G.esc(c.nombre)}">
        <div class="cuadro-control"><h3>📁 ${G.esc(c.nombre)} <span class="chip-neutro">${del.length} documento(s)</span></h3>
          <p class="descripcion">Carpeta del expediente. Cargue aquí los documentos que correspondan a «${G.esc(c.nombre)}».</p></div>
        <div class="cuadro-cuerpo">
          <div class="flex flex-wrap gap-2 mb-3">
            <label class="btn text-sm cursor-pointer">⬆️ Subir documentos<input type="file" multiple accept="${ACCEPT}" class="sr-only input-subir" data-carpeta="${c.id}"></label>
            <button type="button" class="btn-sec text-sm btn-borrar-carpeta" data-id="${c.id}">🗑 Eliminar carpeta</button>
          </div>
          ${del.length ? `<ul class="grid gap-2 sm:grid-cols-2 list-none p-0">${del.map(a => {
            const t = tipoDe(a.nombre) || { icono: '📎', nombre: 'Archivo' };
            return `<li class="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-neutral-50">
              <span aria-hidden="true">${t.icono}</span>
              <span class="grow min-w-0"><span class="block truncate font-medium">${G.esc(a.nombre)}</span>
              <span class="text-xs text-neutral-500">${t.nombre} · ${(a.tam / 1024).toFixed(0)} KB · ${G.esc(a.fecha)}</span></span>
              <button type="button" class="btn-sec !px-2 !py-1 text-xs btn-descargar" data-id="${a.id}" title="Descargar">⬇️</button>
              <button type="button" class="btn-sec !px-2 !py-1 text-xs btn-borrar-archivo" data-id="${a.id}" title="Eliminar">🗑</button>
            </li>`; }).join('')}</ul>`
          : '<p class="text-sm text-neutral-500">Esta carpeta está vacía. Use «Subir documentos» para cargar PDF, Word, TXT, MD, Excel o imágenes.</p>'}
        </div></section>`;
    }).join('');

    cont.innerHTML = `
      <nav aria-label="Ruta de navegación" class="text-sm text-neutral-500 mb-3"><a href="hojas-vida">Hojas de vida</a> › ${G.esc(p.nombre)}</nav>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1>${ICONO[codigo] || '📌'} Hoja de vida: ${G.esc(p.nombre)} ${G.ayuda('¿Qué es la hoja de vida?', `<p>Es el expediente documental del proyecto: sus actas, fotos, facturas e informes, organizados en carpetas.</p><p class="mt-1"><strong>«Ver hoja de vida completa»</strong> abre todos los documentos apilados uno debajo del otro, para revisarlos de un solo vistazo con la rueda del ratón. Los libros de Excel no se apilan (no se pueden mostrar dentro de la página): aparecen como tarjeta para descargar.</p>`)}</h1>
        <div class="flex gap-2">
          <button type="button" class="btn-sec" id="btn-nueva-carpeta">📁 Nueva carpeta</button>
          <a class="btn" href="hojas-vida?p=${codigo}&v=consolidado">👁 Ver hoja de vida completa</a>
        </div>
      </div>
      <p class="text-neutral-600 mb-6">Responsable: <strong>${G.esc(p.responsable)}</strong> · ${G.esc(p.tipo)} · <a href="proyecto?p=${codigo}">Ver los datos del proyecto →</a></p>
      ${carpetas.length ? secciones : `<div class="alerta-azul">ℹ️ Este expediente aún no tiene carpetas. Toque <strong>«📁 Nueva carpeta»</strong> para crear la primera (por ejemplo: «Actas», «Fotos», «Facturas») y luego cargue los documentos dentro de ella.</div>`}
    `;

    document.getElementById('btn-nueva-carpeta').addEventListener('click', () => {
      document.getElementById('carpeta-nombre').value = '';
      document.getElementById('dlg-carpeta').showModal();
    });
    document.getElementById('form-carpeta').onsubmit = async () => {
      const nombre = document.getElementById('carpeta-nombre').value.trim();
      if (nombre) { await agregar('carpetas', { proyecto: codigo, nombre }); verProyecto(codigo); }
    };
    document.getElementById('carpeta-cancelar').onclick = () => document.getElementById('dlg-carpeta').close();

    cont.querySelectorAll('.input-subir').forEach(inp => inp.addEventListener('change', async () => {
      for (const f of inp.files) {
        if (!tipoDe(f.name)) { alert('El archivo «' + f.name + '» no es de un tipo permitido (PDF, Word, TXT, MD, Excel o imagen).'); continue; }
        await agregar('archivos', { proyecto: codigo, carpetaId: +inp.dataset.carpeta, nombre: f.name,
          mime: f.type, tam: f.size, fecha: new Date().toISOString().slice(0, 10), blob: f });
      }
      verProyecto(codigo);
    }));
    cont.querySelectorAll('.btn-borrar-carpeta').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta carpeta y todos sus documentos (solo de este navegador)?')) return;
      const id = +b.dataset.id;
      for (const a of archivos.filter(a => a.carpetaId === id)) await borrar('archivos', a.id);
      await borrar('carpetas', id);
      verProyecto(codigo);
    }));
    cont.querySelectorAll('.btn-borrar-archivo').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este documento (solo de este navegador)?')) return;
      await borrar('archivos', +b.dataset.id); verProyecto(codigo);
    }));
    cont.querySelectorAll('.btn-descargar').forEach(b => b.addEventListener('click', async () => {
      const a = archivos.find(x => x.id === +b.dataset.id);
      const url = URL.createObjectURL(a.blob);
      const el = document.createElement('a'); el.href = url; el.download = a.nombre; el.click();
      URL.revokeObjectURL(url);
    }));
  }

  async function verConsolidado(codigo) {
    const p = G.proyecto(codigo);
    document.title = 'Hoja de vida completa: ' + p.nombre;
    const carpetas = await porProyecto('carpetas', codigo);
    const archivos = await porProyecto('archivos', codigo);
    const nombreCarpeta = id => (carpetas.find(c => c.id === id) || {}).nombre || 'Sin carpeta';

    let bloques = '';
    for (const a of archivos) {
      const t = tipoDe(a.nombre) || { clave: 'otro', icono: '📎', nombre: 'Archivo', apila: false };
      const url = URL.createObjectURL(a.blob);
      let cuerpo;
      if (!t.apila) {
        cuerpo = `<div class="alerta-azul !mb-0">📊 <strong>${G.esc(a.nombre)}</strong> es un libro de Excel: no se apila en esta vista (los libros se revisan en Excel).
          <a class="btn-sec text-xs ml-2" href="${url}" download="${G.esc(a.nombre)}">⬇️ Descargar</a></div>`;
      } else if (t.clave === 'imagen') {
        cuerpo = `<img src="${url}" alt="Documento: ${G.esc(a.nombre)}" class="max-w-full h-auto rounded-lg border border-neutral-200">`;
      } else if (t.clave === 'pdf') {
        cuerpo = `<embed src="${url}" type="application/pdf" class="w-full rounded-lg border border-neutral-200" style="height:80vh">
          <p class="text-xs text-neutral-500 mt-1">Si el PDF no se muestra, <a href="${url}" download="${G.esc(a.nombre)}">descárguelo aquí</a>.</p>`;
      } else if (t.clave === 'txt' || t.clave === 'md') {
        const texto = await a.blob.text();
        cuerpo = `<pre class="whitespace-pre-wrap text-sm bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-auto max-h-[70vh]">${G.esc(texto)}</pre>`;
      } else { // word
        cuerpo = `<div class="alerta-azul !mb-0">📝 <strong>${G.esc(a.nombre)}</strong> es un documento de Word: el navegador no puede mostrarlo dentro de la página, así que se incluye como tarjeta.
          <a class="btn-sec text-xs ml-2" href="${url}" download="${G.esc(a.nombre)}">⬇️ Descargar y abrir en Word</a></div>`;
      }
      bloques += `<article class="mb-8" aria-label="${G.esc(a.nombre)}">
        <div class="cuadro-control"><h3>${t.icono} ${G.esc(a.nombre)} <span class="chip-neutro">📁 ${G.esc(nombreCarpeta(a.carpetaId))}</span></h3>
        <p class="meta"><span>${t.nombre} · ${(a.tam / 1024).toFixed(0)} KB · cargado el ${G.esc(a.fecha)}</span></p></div>
        <div class="cuadro-cuerpo">${cuerpo}</div></article>`;
    }

    cont.innerHTML = `
      <nav aria-label="Ruta de navegación" class="text-sm text-neutral-500 mb-3"><a href="hojas-vida">Hojas de vida</a> › <a href="hojas-vida?p=${codigo}">${G.esc(p.nombre)}</a> › Vista completa</nav>
      <h1>👁 Hoja de vida completa: ${G.esc(p.nombre)}</h1>
      <p class="text-neutral-600 mt-1 mb-6 max-w-3xl">Todos los documentos del expediente, <strong>apilados uno debajo del otro</strong> para revisarlos
        de un solo vistazo desplazándose hacia abajo. Los libros de Excel no se apilan: aparecen como tarjeta para descargar.</p>
      ${archivos.length ? bloques : '<div class="alerta-azul">ℹ️ Este expediente no tiene documentos en este navegador. Vuelva a la <a href="hojas-vida?p=' + codigo + '">página del expediente</a> para crear carpetas y cargarlos.</div>'}
      <p><a class="btn-sec" href="hojas-vida?p=${codigo}">← Volver al expediente</a></p>`;
  }

  inicio();
})();
