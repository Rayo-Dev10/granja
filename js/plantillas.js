/* plantillas.js — repositorio de plantillas descargables.
   Filtro dinámico por nombre mientras se escribe; carga de un Excel con título
   automático + descripción + quién la carga; queda disponible para todos. */
(function () {
  'use strict';
  const G = window.GRANJA;
  const cont = document.getElementById('contenido-pl');
  let lista = [];
  let filtro = '';
  let porSubir = null;         // {nombre, base64, titulo}
  let escribible = true;
  let sinServidor = false;

  function normaliza(s) { return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function kb(n) { return n ? (n / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' KB' : '—'; }

  /* ------------------------------- carga ------------------------------- */
  function cargar() {
    if (location.protocol === 'file:') { sinServidor = true; return cargarSemilla(); }
    fetch('api/plantillas.php', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { lista = d.plantillas || []; escribible = d.escribible !== false; render(); })
      .catch(() => { sinServidor = true; cargarSemilla(); });
  }
  function cargarSemilla() {
    const d = window.DATA_PLANTILLAS_SEMILLA || { plantillas: [] };
    lista = (d.plantillas || []).map(p => Object.assign({ origen: 'semilla', descargaUrl: 'formatos-plantillas/' + encodeURIComponent(p.archivo) }, p));
    render();
  }

  /* ------------------------------- render ------------------------------ */
  function render() {
    const filtradas = lista.filter(p => normaliza(p.titulo + ' ' + p.descripcion + ' ' + p.archivo).includes(normaliza(filtro)));
    let h = `
      <nav aria-label="Ruta" class="text-sm text-neutral-500 mb-3"><a href="./">Inicio</a> › Plantillas</nav>
      <h1>🧾 Plantillas descargables ${G.ayuda('¿Qué es esto?', '<p>Un repositorio de formatos en blanco (Excel, Word, PDF) para llevar los registros de la granja: dedicación de horas, alimentación, recolección, inventario, donación de servicios…</p><p class="mt-1">Cualquiera puede <strong>descargar</strong> una plantilla. Para <strong>cargar</strong> una nueva se pide la contraseña, y desde ese momento queda disponible para todos, desde cualquier computador.</p>')}</h1>
      <p class="text-neutral-600 mt-2 mb-6 max-w-3xl">Formatos listos para imprimir o llenar. Descárguelos, complételos y, cuando toque,
        entréguelos para que el sitio los procese. Escriba en el buscador para encontrar una plantilla por su nombre.</p>`;

    h += G.cuadroControl({
      icono: '📥', titulo: `Plantillas disponibles (${lista.length})`,
      queVes: 'la lista de formatos que se pueden descargar. Use el buscador para filtrar por nombre a medida que escribe.',
      deDondeSale: sinServidor ? 'copia incluida en el sitio (abierto sin servidor)' : 'repositorio del servidor (plantillas de ejemplo + las que se hayan cargado)',
      corte: 'se actualiza al cargar una nueva',
      estado: sinServidor ? { tipo: 'alerta', icono: '📴', texto: 'sin servidor: solo se pueden descargar las de ejemplo' } : { tipo: 'ok', icono: '🌐', texto: 'repositorio compartido' },
      ayudaHtml: '<p>La columna «Cargada por» dice quién subió cada plantilla. Fíjese en las descripciones de las que ya están para escribir la de una nueva.</p>',
    }) + `<div class="cuadro-cuerpo">
      <label class="block mb-4"><span class="text-sm font-medium">🔎 Buscar plantilla</span>
        <input id="pl-buscar" type="search" value="${G.esc(filtro)}" placeholder="Escriba parte del nombre: alimentación, horas, huevos…"
          class="mt-1 w-full sm:max-w-md border border-neutral-300 rounded-lg px-3 py-2" autocomplete="off"></label>
      <div class="overflow-x-auto"><table>
        <caption class="sr-only">Plantillas descargables</caption>
        <thead><tr><th scope="col">Plantilla</th><th scope="col">Descripción</th><th scope="col">Cargada por</th><th scope="col">Fecha</th><th scope="col" class="text-right">Tamaño</th><th scope="col">Descargar</th></tr></thead>
        <tbody id="pl-filas">${filas(filtradas)}</tbody>
      </table></div>
      ${filtradas.length ? '' : '<p class="text-center text-neutral-500 py-4">Ninguna plantilla coincide con «' + G.esc(filtro) + '».</p>'}
    </div>`;

    h += bloqueCarga();
    cont.innerHTML = h;
    conectar();
  }

  function filas(arr) {
    if (!arr.length) return '';
    return arr.map(p => `<tr>
      <td class="font-medium">${G.esc(p.titulo)}<span class="block text-xs text-neutral-400">${G.esc(p.archivo)}</span></td>
      <td class="text-neutral-600 max-w-[24rem]">${G.esc(p.descripcion || '')}</td>
      <td>${G.esc(p.autor || '—')}${p.origen === 'semilla' ? ' <span class="chip-neutro">ejemplo</span>' : ''}</td>
      <td class="whitespace-nowrap">${G.esc(p.fecha || '')}</td>
      <td class="money">${kb(p.tamano)}</td>
      <td><a class="btn-sec !px-3 !py-1 text-sm" href="${G.esc(p.descargaUrl)}" download>⬇️ Descargar</a>
        ${p.origen === 'cargada' && !sinServidor ? `<button type="button" class="btn-sec !px-2 !py-1 text-xs pl-borrar mt-1" data-id="${p.id}" title="Quitar esta plantilla del repositorio">🗑️</button>` : ''}</td>
    </tr>`).join('');
  }

  /* --------------------------- panel de carga --------------------------- */
  function bloqueCarga() {
    if (sinServidor) {
      return `<div class="alerta-azul">📴 <strong>Está viendo el sitio sin servidor</strong> (abierto por doble clic). Puede descargar las plantillas de ejemplo,
        pero para <strong>cargar</strong> una nueva y que otros la descarguen, abra el sitio publicado en <code>granja.rayogestion.com</code>.</div>`;
    }
    const ejemplos = lista.slice(0, 3).map(p => `<li class="text-neutral-600"><strong>${G.esc(p.titulo)}:</strong> ${G.esc(p.descripcion || '')}</li>`).join('');
    return G.cuadroControl({
      icono: '⬆️', titulo: 'Cargar una plantilla nueva',
      queVes: 'el formulario para subir un formato nuevo. Elija el archivo: el título se toma solo del nombre. Luego escriba una descripción y quién la carga.',
      deDondeSale: 'lo que usted suba (pide la contraseña de edición)',
      corte: 'queda disponible para todos al guardar',
      estado: escribible ? { tipo: 'info', icono: '🔒', texto: 'cargar pide contraseña; descargar es libre' } : { tipo: 'error', icono: '✖', texto: 'la carpeta del servidor no permite escritura' },
      ayudaHtml: '<p>Solo hace falta el archivo. El título se rellena solo con el nombre del archivo (puede ajustarlo). En la descripción, cuente en una frase para qué sirve — guíese por los ejemplos de abajo.</p>',
    }) + `<div class="cuadro-cuerpo">
      <p class="mb-3"><button type="button" id="pl-abrir" class="btn">⬆️ Cargar una plantilla nueva</button></p>
      <dialog id="pl-dialogo" class="rounded-xl border border-neutral-300 shadow-xl p-0 w-[min(46rem,calc(100%-2rem))] backdrop:bg-black/40">
      <form method="dialog" id="pl-formulario" class="p-5">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div><h3 class="text-xl font-semibold">Cargar una plantilla nueva</h3><p class="text-sm text-neutral-600 mt-1">El archivo solo se enviará al servidor después de completar la descripción y pulsar Guardar.</p></div>
        <button type="button" id="pl-cerrar" class="btn-sec !px-3 !py-1" aria-label="Cerrar y descartar el archivo seleccionado">✕ Cerrar</button>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-3">
          <label class="block"><span class="text-sm font-medium">1. Elija el archivo (Excel, Word o PDF)</span>
            <input id="pl-archivo" type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.docx,.pdf" class="mt-1 block w-full text-sm border border-neutral-300 rounded-lg p-2"></label>
          <label class="block"><span class="text-sm font-medium">2. Título de la plantilla</span>
            <input id="pl-titulo" type="text" maxlength="90" placeholder="Se toma del nombre del archivo" class="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"></label>
          <label class="block"><span class="text-sm font-medium">3. Descripción (para qué sirve)</span>
            <textarea id="pl-desc" rows="3" minlength="10" maxlength="300" required placeholder="Ej.: Planilla mensual para repartir el tiempo de cada persona entre proyectos." class="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"></textarea>
            <span class="block text-xs text-neutral-500 mt-1">Obligatoria: mínimo 10 caracteres. Sin descripción, el archivo no se guarda.</span></label>
          <label class="block"><span class="text-sm font-medium">4. ¿Quién la carga?</span>
            <input id="pl-autor" type="text" maxlength="60" placeholder="Su nombre" class="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2" value="${G.esc(G.autor ? G.autor() : '')}"></label>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" id="pl-guardar" class="btn">💾 Guardar plantilla</button>
            <button type="button" id="pl-cancelar" class="btn-sec">Cancelar y descartar</button>
            <span id="pl-estado" class="text-sm text-neutral-500"></span>
          </div>
        </div>
        <div class="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
          <h4 class="font-semibold text-sm mb-1">Ejemplos de descripción</h4>
          <p class="text-xs text-neutral-500 mb-2">Guíese por cómo están descritas las plantillas que ya existen:</p>
          <ul class="list-disc ml-4 text-sm space-y-1">${ejemplos || '<li class="text-neutral-500">(aún no hay ejemplos)</li>'}</ul>
        </div>
      </div>
      </form></dialog>
    </div>`;
  }

  /* ------------------------------ eventos ------------------------------ */
  function conectar() {
    const b = document.getElementById('pl-buscar');
    if (b) b.addEventListener('input', e => {
      filtro = e.target.value;
      document.getElementById('pl-filas').innerHTML = filas(lista.filter(p => normaliza(p.titulo + ' ' + p.descripcion + ' ' + p.archivo).includes(normaliza(filtro))));
      conectarBorrar();
    });
    const arch = document.getElementById('pl-archivo');
    if (arch) arch.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const tit = document.getElementById('pl-titulo');
      if (tit && !tit.value.trim()) tit.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const rd = new FileReader();
      rd.onload = () => { porSubir = { nombre: f.name, base64: rd.result, tamano: f.size }; };
      rd.readAsDataURL(f);
    });
    const dialogo = document.getElementById('pl-dialogo');
    const abrir = document.getElementById('pl-abrir');
    if (abrir && dialogo) abrir.addEventListener('click', () => dialogo.showModal());
    ['pl-cerrar', 'pl-cancelar'].forEach(id => {
      const boton = document.getElementById(id);
      if (boton && dialogo) boton.addEventListener('click', () => cerrarCarga(true));
    });
    if (dialogo) {
      dialogo.addEventListener('cancel', e => { e.preventDefault(); cerrarCarga(true); });
      dialogo.addEventListener('click', e => {
        const r = dialogo.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrarCarga(true);
      });
    }
    const g = document.getElementById('pl-guardar'); if (g) g.addEventListener('click', guardar);
    conectarBorrar();
  }

  function cerrarCarga(confirmar) {
    const dialogo = document.getElementById('pl-dialogo');
    if (confirmar && porSubir && !confirm('La plantilla aún no se ha guardado. Si cierra, el archivo seleccionado se descartará. ¿Desea cerrar?')) return;
    porSubir = null;
    const form = document.getElementById('pl-formulario');
    if (form) form.reset();
    const estado = document.getElementById('pl-estado');
    if (estado) estado.textContent = '';
    if (dialogo && dialogo.open) dialogo.close();
  }
  function conectarBorrar() {
    document.querySelectorAll('.pl-borrar').forEach(btn => btn.addEventListener('click', () => borrar(btn.dataset.id)));
  }

  function guardar() {
    const estado = document.getElementById('pl-estado');
    const titulo = document.getElementById('pl-titulo').value.trim();
    const desc = document.getElementById('pl-desc').value.trim();
    const autor = document.getElementById('pl-autor').value.trim();
    if (!porSubir) { estado.innerHTML = '<span class="text-danger-700">Elija primero un archivo.</span>'; return; }
    if (!titulo) { estado.innerHTML = '<span class="text-danger-700">Escriba un título.</span>'; return; }
    if (desc.length < 10) { estado.innerHTML = '<span class="text-danger-700">Escriba una descripción de al menos 10 caracteres. Sin descripción, el archivo no se guarda.</span>'; document.getElementById('pl-desc').focus(); return; }
    if (!autor) { estado.innerHTML = '<span class="text-danger-700">Escriba quién la carga.</span>'; return; }
    let clave = G.claveEdicion ? G.claveEdicion() : '';
    if (!clave) { clave = prompt('Escriba la contraseña para cargar la plantilla:'); if (clave == null) return; if (G.recordarClave) G.recordarClave(clave, false); }
    estado.textContent = 'Subiendo…';
    fetch('api/plantillas.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', clave, titulo, descripcion: desc, autor, archivoNombre: porSubir.nombre, archivoBase64: porSubir.base64 }),
    }).then(r => r.json()).then(d => {
      if (d && d.ok) {
        lista = d.plantillas || lista; porSubir = null;
        if (G.recordarAutor) G.recordarAutor(autor);
        render();
        const e2 = document.getElementById('pl-estado'); if (e2) e2.innerHTML = '<span class="text-success-700 font-semibold">✔ Plantilla cargada y disponible para todos.</span>';
      } else if (d && d.claveInvalida) estado.innerHTML = '<span class="text-danger-700 font-semibold">🔒 Contraseña incorrecta.</span>';
      else estado.innerHTML = '<span class="text-danger-700">No se pudo cargar: ' + G.esc((d && d.mensaje) || 'error') + '</span>';
    }).catch(() => { estado.innerHTML = '<span class="text-danger-700">Sin conexión con el servidor.</span>'; });
  }

  function borrar(id) {
    if (!confirm('¿Quitar esta plantilla del repositorio? Esta acción no se puede deshacer.')) return;
    let clave = G.claveEdicion ? G.claveEdicion() : '';
    if (!clave) { clave = prompt('Escriba la contraseña para borrar la plantilla:'); if (clave == null) return; if (G.recordarClave) G.recordarClave(clave, false); }
    fetch('api/plantillas.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'borrar', clave, id }) })
      .then(r => r.json()).then(d => { if (d && d.ok) { lista = d.plantillas || lista; render(); } else alert((d && d.mensaje) || 'No se pudo borrar.'); })
      .catch(() => alert('Sin conexión con el servidor.'));
  }

  cargar();
})();
