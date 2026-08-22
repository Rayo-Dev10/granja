/* indice.js — buscador estático de los manuales de la pasantía.
   Sin dependencias. Filtra una lista fija de páginas por título y palabras clave.
   El <input> vive en la portada (id="buscador"); los resultados van en id="resultados".
   Las URL son relativas a la portada (pasantia/index.html). */

const PAGINAS = [
  { titulo: "Usar el sitio — recorrido guiado", url: "usar/index.html", palabras: "usar recorrido pantallas navegar secciones inicio proyectos diario controles mano de obra plantillas hojas de vida" },
  { titulo: "Leer las cifras sin engañarse", url: "usar/leer-cifras.html", palabras: "cifras kpi indicador balance ingresos egresos cobertura interpretar que no significa" },
  { titulo: "Filtrar por periodo", url: "usar/periodos.html", palabras: "periodo filtro fechas mes rango franja engaño acumulado" },
  { titulo: "Qué es una revelación", url: "usar/revelaciones.html", palabras: "revelacion revelaciones merma nota conciliacion produccion ventas control" },
  { titulo: "Exportar cualquier tabla a Excel", url: "usar/exportar.html", palabras: "exportar excel xlsx descargar tabla diario controles cobertura" },
  { titulo: "Por qué importa registrar bien", url: "registrar/index.html", palabras: "registrar datos calidad captura formatos importancia" },
  { titulo: "Hoja de alimentación", url: "registrar/hoja-alimentacion.html", palabras: "alimentacion hoja google kilos proyecto fecha subproyecto errores formato" },
  { titulo: "Hoja de mano de obra (horas)", url: "registrar/hoja-manoobra.html", palabras: "mano de obra horas porcentaje dedicacion imputacion regla operador administrador" },
  { titulo: "Registrar en el libro de caja (Excel)", url: "registrar/libro-caja.html", palabras: "libro caja excel movimiento fila fecha monto proyecto no romper el sitio" },
  { titulo: "Arquitectura en una página", url: "mantener/index.html", palabras: "arquitectura estatico html css js data como funciona mantener" },
  { titulo: "Llega un corte nuevo del libro", url: "mantener/nuevo-corte.html", palabras: "corte nuevo excel libro exportar datos python regenerar contrato de datos rangos" },
  { titulo: "Desplegar: SSH, FTP, permisos", url: "mantener/desplegar.html", palabras: "desplegar subir hosting ssh ftp permisos diagnostico chmod servidor" },
  { titulo: "Cambiar la contraseña (bcrypt)", url: "mantener/contrasena.html", palabras: "contraseña clave bcrypt hash config intentos bloqueo editar" },
  { titulo: "Problemas: síntoma, causa, solución", url: "mantener/problemas.html", palabras: "problemas errores sintoma causa solucion pagina en blanco nan consola" },
  { titulo: "La pasantía: objetivo y alcance", url: "pasantia/index.html", palabras: "pasantia objetivo alcance cronologia ciclo propedeutico tecnico profesional procesos contables cinoc" },
  { titulo: "Metodología de normalización", url: "pasantia/metodologia.html", palabras: "metodologia normalizar libro criterios correcciones trazabilidad datos" },
  { titulo: "Hallazgos de la pasantía", url: "pasantia/hallazgos.html", palabras: "hallazgos software contable propio arl donacion servicios riesgo recomendacion evidencia" },
  { titulo: "Bitácora de decisiones técnicas", url: "pasantia/decisiones.html", palabras: "decisiones bitacora tecnicas estatico sin backend por que" },
];

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function buscar(termino) {
  const t = norm(termino).trim();
  if (!t) return [];
  const palabras = t.split(/\s+/);
  return PAGINAS.filter((p) => {
    const heno = norm(p.titulo + " " + p.palabras);
    return palabras.every((w) => heno.includes(w));
  });
}

function pintar(lista, cont) {
  if (!lista.length) {
    cont.innerHTML = '<p class="text-sm text-neutral-500 px-1 py-2">Sin resultados. Pruebe otra palabra (por ejemplo: «corte», «ARL», «excel», «permisos»).</p>';
    return;
  }
  cont.innerHTML =
    '<ul class="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">' +
    lista
      .map(
        (p) =>
          '<li><a class="block px-3 py-2 no-underline hover:bg-primary-50" href="' +
          p.url +
          '"><span class="font-medium text-primary-900">' +
          p.titulo +
          "</span></a></li>"
      )
      .join("") +
    "</ul>";
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("buscador");
  const cont = document.getElementById("resultados");
  if (!input || !cont) return;
  const actualizar = () => {
    const q = input.value;
    if (!q.trim()) {
      cont.innerHTML = "";
      return;
    }
    pintar(buscar(q), cont);
  };
  input.addEventListener("input", actualizar);
});
