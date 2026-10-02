# Actualización del informe web — 2 de octubre de 2026

## Alcance aprobado

Ampliar el sitio PHP existente con producción contextualizada, inventarios, áreas y requerimientos del director. Mantener caja vigente, correcciones, plantillas y datos guardados. Se recuperó la versión publicada del 31 de agosto (resumen ejecutivo, dashboard y costeo de Talento Humano), que era posterior a la copia local de Git; no se volvió al diseño anterior.

## Entradas y límites

El exportador recibe la semilla trazable del producto portable y sus fuentes S04/S05. Publica solo datos de los proyectos, no documentos de identidad, teléfono, correo del estudiante, credenciales ni adjuntos privados. La fuente Talento Humano ya publicada se conserva, sin convertir estimaciones por proyecto en horas medidas.

- 17 proyectos; 159 eventos/referencias de animales; 11 activos/unidades; 36 actividades; 9 cargos; 41 revisiones.
- Caja y producción: julio de 2026. Alimentación: 474 registros, 2.177 kg, hasta el 3 de agosto. Actividades: agosto. Seguimiento S05: fecha de constatación pendiente.
- Propuestas del portable: evidencia separada, NO sustituyen la caja que usa el sitio ni las correcciones del servidor.
- Censos: último registro por grupo hasta la fecha seleccionada, no suma de registros sucesivos. No acreditan existencia física actual ni cobertura completa.
- Áreas: huerta 0,0315 ha, café 1,34 ha y Pino Romerón 4 ha, cada una con alcance reportado; no se calcula superficie total sin delimitación/solapamientos.
- Etapas, sexo, géneros y variedades ausentes quedan pendientes. Nombres científicos explícitos de S05 se identifican como reportados, no verificados externamente. No se asignan automáticamente proyectos sin correspondencia inequívoca.

## Postura

Diario: huevos / hembras activas ese día × 100. Periodo: huevos / suma de hembras-día × 100. La cobertura se refiere a fechas con recolección; no implica mes calendario completo. Sin cobertura completa de esas fechas, la tasa de periodo es nula; una tasa del subconjunto cubierto se muestra separadamente. Valores superiores a 100 % requieren revisión y no se recortan artificialmente.

El campo `PopulationPeriods` está vacío porque no se aportó un padrón confirmado. No se usa el inventario final, no se extiende un censo histórico a fechas posteriores, no se convierten aves de cualquier etapa en hembras en postura.

Para incorporar población posteriormente, validar el soporte e incluir registros del siguiente contrato en la generación de datos (los valores son ilustrativos, nunca carga inicial):

```json
{"ProjectId":"P06","Scope":"Proyecto","DateFrom":"AAAA-MM-DD","DateTo":"AAAA-MM-DD","Count":100,"Sex":"Hembra","Stage":"Postura","Status":"confirmed","CoverageComplete":true,"SourceId":"fuente-validada"}
```

El alcance debe comprender TODO el proyecto cuyo total de huevos se usa. Intervalos superpuestos se consideran ambiguos y no se suman. La plantilla CSV se descarga desde el informe; no sube datos automáticamente ni acredita validación humana.

## Uso

`/seguimiento`: matriz de los 17 proyectos; filtro por proyecto y fecha de referencia de censos; producción, alimentación, actividades, personal, propuestas y fuentes. Las fichas `/proyecto?p=...` añaden inventario y postura y respetan el filtro de producción. Libro diario y mano de obra mantienen su funcionalidad.

Detalles de evidencia extensos se dibujan al expandirlos. No se incorpora la carga de evidencia a la portada, para preservar su ruta de carga. Navegación a informe disponible en todas las pantallas principales.

## Comprobaciones y despliegue

Pruebas: `node --test tests/*.test.cjs`. Verificación visual local y pública: filtros, censos, consumo, móvil y consola. El despliegue debe respaldar fuera de `public_html`, comparar SHA256 de los archivos seleccionados y comprobar que `datos-servidor/` no cambió. No publicar `api/config.php`, datos privados, herramientas o pruebas. Conservar el respaldo para recuperación.
