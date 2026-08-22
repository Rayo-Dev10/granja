/* exporta.js — escritor de archivos Excel (.xlsx) en JavaScript vanilla, sin dependencias.
   Un .xlsx es un ZIP con XML dentro; aquí el ZIP se escribe SIN comprimir (método "store"),
   que Excel acepta perfectamente. Expone:
     EXPORTA.construir(hojas)         -> Uint8Array con el .xlsx  (hojas = [{nombre, filas:[[celda,…],…]}])
     EXPORTA.descargar(archivo, hojas)-> dispara la descarga en el navegador
     EXPORTA.tabla(tablaEl, hoja, archivo) -> exporta una <table> del DOM
   Cada celda puede ser número o texto; los textos que "parecen dinero/número" se exportan
   como número para que en Excel se puedan sumar. */
window.EXPORTA = (function () {
  'use strict';

  /* -------- CRC32 -------- */
  var CRC = (function () { var c, t = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function enc(str) { return new TextEncoder().encode(str); }
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }

  /* ¿la celda es un número? Acepta $ 1.234.567 y 12,5 (formato es-CO). */
  function comoNumero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    var s = String(v).trim();
    if (s === '') return null;
    var neg = /^[-−(]/.test(s);
    var limpio = s.replace(/[$\s%()]/g, '').replace(/−/g, '-').replace(/\./g, '').replace(/,/g, '.').replace(/[+-]/g, '');
    if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
    var n = parseFloat(limpio);
    return neg ? -n : n;
  }

  function colLetra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

  function hojaXml(filas) {
    var celdas = '';
    for (var r = 0; r < filas.length; r++) {
      var fila = filas[r] || []; var row = '<row r="' + (r + 1) + '">';
      for (var c = 0; c < fila.length; c++) {
        var ref = colLetra(c) + (r + 1);
        var num = comoNumero(fila[c]);
        var esNum = num !== null && String(fila[c]).replace(/[$\s%.,()+\-−\d]/g, '') === '';
        if (esNum) row += '<c r="' + ref + '"><v>' + num + '</v></c>';
        else row += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(fila[c]) + '</t></is></c>';
      }
      row += '</row>'; celdas += row;
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + celdas + '</sheetData></worksheet>';
  }

  function construir(hojas) {
    hojas = hojas && hojas.length ? hojas : [{ nombre: 'Hoja1', filas: [] }];
    var archivos = [];
    archivos.push({ nombre: '[Content_Types].xml', datos: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      hojas.map(function (h, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '</Types>') });
    archivos.push({ nombre: '_rels/.rels', datos: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') });
    var sheetsXml = hojas.map(function (h, i) { return '<sheet name="' + xmlEsc((h.nombre || ('Hoja' + (i + 1))).slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('');
    archivos.push({ nombre: 'xl/workbook.xml', datos: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheetsXml + '</sheets></workbook>') });
    archivos.push({ nombre: 'xl/_rels/workbook.xml.rels', datos: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas.map(function (h, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '</Relationships>') });
    hojas.forEach(function (h, i) { archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: enc(hojaXml(h.filas || [])) }); });
    return zipStore(archivos);
  }

  /* -------- ZIP (método store, sin compresión) -------- */
  function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
  function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }
  function zipStore(archivos) {
    var locales = [], central = [], offset = 0;
    archivos.forEach(function (f) {
      var nombre = enc(f.nombre), datos = f.datos, crc = crc32(datos);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
      locales.push(new Uint8Array(lh)); locales.push(nombre); locales.push(datos);
      var ch = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(ch)); central.push(nombre);
      offset += lh.length + nombre.length + datos.length;
    });
    var centralInicio = offset, centralTam = 0;
    central.forEach(function (u) { centralTam += u.length; });
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(archivos.length), u16(archivos.length), u32(centralTam), u32(centralInicio), u16(0)));
    var total = offset + centralTam + eocd.length, out = new Uint8Array(total), pos = 0;
    locales.forEach(function (u) { out.set(u, pos); pos += u.length; });
    central.forEach(function (u) { out.set(u, pos); pos += u.length; });
    out.set(eocd, pos);
    return out;
  }

  /* -------- descarga en el navegador -------- */
  function descargar(archivo, hojas) {
    var u8 = construir(hojas);
    var blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = /\.xlsx$/i.test(archivo) ? archivo : archivo + '.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* -------- exportar una <table> del DOM -------- */
  function filasDeTabla(tabla) {
    var filas = [];
    tabla.querySelectorAll('tr').forEach(function (tr) {
      var celda = [];
      tr.querySelectorAll('th,td').forEach(function (c) {
        if (c.querySelector('button')) { var cl = c.cloneNode(true); cl.querySelectorAll('button').forEach(function (b) { b.remove(); }); celda.push(cl.textContent.trim()); }
        else celda.push((c.textContent || '').trim());
      });
      if (celda.some(function (x) { return x !== ''; })) filas.push(celda);
    });
    return filas;
  }
  function tabla(tablaEl, hoja, archivo) {
    if (!tablaEl) return;
    descargar(archivo || 'granja-san-jose', [{ nombre: (hoja || 'Datos').slice(0, 31), filas: filasDeTabla(tablaEl) }]);
  }

  return { construir: construir, descargar: descargar, tabla: tabla, filasDeTabla: filasDeTabla };
})();

/* Node (para pruebas): exportar si estamos fuera del navegador */
if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) module.exports = (function () {
  global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
  return window.EXPORTA;
})();
