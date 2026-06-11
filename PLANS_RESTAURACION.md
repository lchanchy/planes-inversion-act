# PLANS_RESTAURACION.md

## Rol de Codex

Actúa como arquitecto senior de software, ingeniero full stack, experto en aplicaciones offline-first, Android nativo, bases de datos relacionales, Supabase, generación de documentos PDF/Word, sistemas de seguimiento de proyectos de restauración ecológica, consolidación de materiales, control de compras, indicadores físicos y desarrollo mediante vibe coding.

## Solución que se desea construir

Desarrollar una solución integral para proyectos de restauración ecológica, compuesta por:

1. App móvil Android offline-first para captura de planes operativos en campo.
2. Aplicativo web administrativo sincronizado con la app.
3. Base de datos central multi-proyecto.
4. Módulo de consolidación de materiales e insumos.
5. Módulo de compras y valores reales.
6. Módulo de generación automática de actas de entrega.
7. Herramienta de indicadores físicos por familia, vereda, municipio, mes y trimestre.
8. Sistema de reportes consolidados y validaciones de consistencia.

## Instrucción obligatoria de trabajo por fases

No empieces generando código todavía.

Primero debes elaborar únicamente el plan técnico, funcional y estructural completo del sistema. En la primera respuesta solo debes entregar análisis, arquitectura, modelo de datos, módulos, flujos, reglas de negocio, validaciones, estructura del proyecto, tecnologías recomendadas, fases de desarrollo y criterios de aceptación.

Queda estrictamente prohibido iniciar la generación del aplicativo web, la app Android, backend, scripts SQL, componentes, pantallas o código fuente hasta que el usuario revise el plan y escriba explícitamente:

`APROBADO, INICIE EL DESARROLLO`

Mientras no recibas esa aprobación, debes limitarte a:

1. Analizar el requerimiento.
2. Revisar los archivos de referencia ubicados en la ruta local indicada.
3. Proponer la arquitectura.
4. Diseñar la estructura funcional.
5. Diseñar el modelo de datos.
6. Proponer los módulos del aplicativo web.
7. Proponer los módulos de la app Android.
8. Definir los flujos del sistema.
9. Definir las reglas de negocio.
10. Definir las validaciones.
11. Definir el plan de desarrollo por fases.
12. Identificar dudas, riesgos o decisiones pendientes.

Después de entregar el plan, debes cerrar tu respuesta preguntando:

“¿Aprueba este plan técnico para iniciar la generación de los aplicativos?”

Solo cuando el usuario confirme la aprobación, podrás iniciar la generación del sistema por fases, comenzando por la base de datos, backend y aplicativo web administrativo. Posteriormente se desarrollará la app Android offline-first.

## Archivos de referencia

Los ejemplos de formatos base se encuentran en la siguiente ruta local del equipo del usuario:

`C:\Users\libar\Desktop\Aplicativo planes de inversion act\Ejemplo`

En esa carpeta están los archivos de referencia del sistema, incluyendo ejemplos de:

- Plan operativo por familia.
- Consolidado de materiales.
- Acta de entrega.
- Herramienta de indicadores.

Usa esos archivos únicamente como referencia funcional y estructural para entender la lógica del proceso, los campos principales, los consolidados, las actas y los indicadores.

No copies literalmente los formatos. Propón una versión digital más ordenada, escalable, normalizada y fácil de administrar desde el aplicativo web y la app Android.

Antes de iniciar cualquier desarrollo, revisa esos archivos y describe cómo se traducen a módulos, tablas, formularios, reportes y documentos generados automáticamente dentro del sistema.

## Contexto general del sistema

En proyectos de restauración ecológica, el equipo de campo elabora un plan operativo o plan de inversión por familia. En este plan se definen actividades de implementación y seguimiento. Para cada actividad se definen materiales, insumos o aportes que entregará el proyecto, y materiales, insumos, mano de obra o aportes de contrapartida que pondrá la familia.

Después de capturar los planes operativos de varias familias, por ejemplo 50, 100, 300 o más, el sistema debe consolidar automáticamente todos los materiales para apoyar la elaboración del plan de compras y los términos de referencia. Después de realizar las compras, el sistema debe permitir registrar el valor real de compra por material, actualizar el valor real por familia y generar actas de entrega por familia y por número de compra.

La app Android debe funcionar completamente offline en campo. El técnico debe poder levantar el plan operativo sin internet y sincronizar posteriormente cuando tenga conexión.

La solución debe permitir trabajar con varios proyectos al mismo tiempo. Cada proyecto debe tener su propio código o prefijo. Por ejemplo:

- Proyecto Restauración Ecológica: RE-0001, RE-0002, RE-0003.
- Proyecto Conservación: C-0001, C-0002, C-0003.

El código predial o código familiar debe generarse como consecutivo por proyecto, conservarse en la app Android, en el aplicativo web, en los consolidados, en la herramienta de indicadores y en las actas de entrega.

## Arquitectura tecnológica recomendada

Define y justifica la arquitectura más adecuada, pero toma como base esta orientación:

- App Android nativa: Kotlin + Jetpack Compose.
- Base de datos local móvil: Room.
- Sincronización: API REST o cliente Supabase con control de estados.
- Backend/base central: Supabase con PostgreSQL.
- Autenticación: Supabase Auth.
- Roles y permisos: administrador y usuario técnico.
- Web administrativa: React + TypeScript o Next.js.
- Reportes: exportación a Excel, CSV, PDF y Word.
- Documentos: generación de actas desde plantillas editables.
- Almacenamiento de plantillas, logos y documentos generados: Supabase Storage.
- Despliegue web: opción sencilla en Netlify, Vercel o hosting estático conectado a Supabase.
- Evitar servidor propio y pagos frecuentes al inicio.
- Priorizar tecnologías de bajo costo, fáciles de mantener y escalables.

## Objetivo funcional principal

Diseñar y posteriormente desarrollar un sistema que permita:

1. Capturar planes operativos por familia desde una app Android offline.
2. Registrar actividades, metas físicas, línea base, materiales del proyecto y contrapartida familiar.
3. Usar catálogos prediseñados de familias, actividades, materiales, unidades y precios.
4. Permitir que el administrador actualice catálogos desde el aplicativo web.
5. Permitir materiales provisionales en campo cuando no existan en el catálogo oficial.
6. Sincronizar los planes con el aplicativo web.
7. Revisar, corregir, aprobar y consolidar planes.
8. Consolidar materiales para compras.
9. Registrar compras reales, cantidades compradas y precios reales.
10. Actualizar automáticamente valores reales por familia.
11. Generar actas de entrega por familia y número de compra.
12. Llevar indicadores físicos por familia, vereda, municipio, mes, trimestre y proyecto.
13. Generar reportes consolidados.
14. Validar que la información coincida desde la app hasta el aplicativo web.

## Módulo 1. Gestión multi-proyecto

El sistema debe permitir crear y administrar varios proyectos.

Cada proyecto debe tener:

- Nombre del proyecto.
- Código o prefijo del proyecto.
- Departamento o zona de intervención.
- Municipios asociados.
- Fecha de inicio.
- Fecha de finalización.
- Estado: activo, cerrado, archivado.
- Logos institucionales.
- Textos base para actas.
- Consecutivo automático para códigos prediales o códigos familiares.

El sistema debe permitir seleccionar el proyecto activo antes de registrar planes operativos, familias, compras, entregas o indicadores.

El código predial o familiar debe generarse automáticamente con el prefijo del proyecto y un consecutivo. Ejemplos:

- RE-0001.
- RE-0002.
- C-0001.
- C-0002.

El sistema debe evitar duplicados y asegurar que el consecutivo sea único por proyecto.

## Módulo 2. Usuarios y roles

Debe existir autenticación con usuario y contraseña.

Roles mínimos:

### Administrador

- Crear, editar y eliminar proyectos.
- Crear, editar y eliminar usuarios.
- Cargar familias desde Excel.
- Crear, editar y eliminar familias.
- Crear, editar y eliminar catálogos.
- Actualizar listado de materiales e insumos.
- Actualizar precios de cotización.
- Aprobar planes operativos.
- Gestionar compras.
- Generar actas.
- Editar plantillas de actas.
- Exportar reportes.
- Revisar y validar indicadores.

### Usuario técnico

- Descargar información asignada.
- Capturar planes operativos offline.
- Editar planes en estado borrador.
- Registrar actividades por familia.
- Registrar materiales del proyecto.
- Registrar contrapartida familiar.
- Sincronizar información.
- Consultar planes sincronizados.
- No puede eliminar catálogos oficiales.
- No puede aprobar definitivamente planes, salvo que el administrador le otorgue permiso.

El diseño debe considerar que en el futuro puedan agregarse otros roles como coordinador, visor o auditor.

## Módulo 3. Familias y predios

Las familias deben cargarse inicialmente desde Excel por el administrador. El sistema debe permitir descargar una plantilla Excel para cargue masivo.

El administrador también debe poder crear, editar o eliminar familias manualmente desde el aplicativo web.

Cada familia debe tener como mínimo:

- Proyecto.
- Código predial o código familiar generado automáticamente.
- Nombre del representante familiar.
- Número de cédula.
- Edad.
- Teléfono, opcional.
- Departamento.
- Municipio.
- Vereda.
- Nombre del predio.
- Área total del predio en hectáreas.
- Área bajo acuerdo de conservación en hectáreas.
- Observaciones.
- Estado: activa, inactiva, retirada.

La app Android debe permitir consultar familias cargadas previamente y asignadas al técnico.

Si se requiere, debe permitir crear una familia nueva en campo como registro temporal, pero debe quedar marcada como “pendiente de validación por administrador”.

El sistema debe permitir validar duplicados por:

- Código predial.
- Nombre de representante.
- Número de cédula.
- Proyecto.
- Municipio.
- Vereda.
- Predio.

## Módulo 4. Catálogo de actividades

Las actividades deben venir de un catálogo administrable.

Cada actividad debe tener:

- Proyecto.
- Nombre de la actividad.
- Categoría.
- Descripción.
- Unidad de manejo: hectáreas, metros cuadrados, metros lineales, unidades, árboles, jornadas u otra.
- Estado activo/inactivo.
- Indicador asociado.
- Requiere línea base: sí/no.
- Requiere meta: sí/no.
- Permite materiales del proyecto: sí/no.
- Permite contrapartida familiar: sí/no.

Ejemplos de actividades:

- Aislamiento de áreas de conservación.
- Restauración pasiva.
- Restauración activa.
- Enriquecimiento vegetal.
- Siembra de árboles.
- Sistemas agroforestales.
- Sistemas silvopastoriles.
- Huertas.
- Protección de fuentes hídricas.
- Área bajo acuerdo de conservación.
- Mantenimiento.
- Seguimiento técnico.

La actividad “Área bajo acuerdo de conservación” debe poder manejarse como actividad de seguimiento, con línea base, meta y avance físico.

Cada actividad debe tener una unidad de manejo definida para evitar inconsistencias al consolidar indicadores.

## Módulo 5. Catálogo de materiales e insumos

El sistema debe tener un catálogo oficial de materiales e insumos.

Cada material debe tener:

- Proyecto, si aplica.
- Código interno del material.
- Nombre oficial del material.
- Categoría.
- Unidad de medida.
- Precio unitario de cotización.
- Fecha de actualización del precio.
- Estado activo/inactivo.
- Observaciones.

El administrador debe poder:

- Crear nuevos materiales.
- Editar materiales.
- Inactivar materiales.
- Actualizar precios.
- Cargar materiales desde Excel.
- Exportar catálogo a Excel.
- Evitar duplicados por nombre, categoría y unidad de medida.

En la app Android, el técnico debe poder buscar y filtrar materiales por:

- Nombre.
- Categoría.
- Unidad de medida.
- Proyecto.

Al seleccionar un material y digitar cantidad, la app debe calcular automáticamente:

Cantidad × precio unitario de cotización = valor total cotizado.

Si el técnico no encuentra un material en campo, debe poder registrar un material provisional o “material no catalogado”, indicando:

- Nombre provisional.
- Unidad sugerida.
- Cantidad.
- Actividad asociada.
- Observación.
- Si pertenece al aporte del proyecto o a la contrapartida familiar.

Ese plan debe quedar en estado “pendiente por material no catalogado”.

Posteriormente, el administrador debe poder crear el material oficial en el catálogo y reemplazar el material provisional por el material oficial antes de aprobar el plan.

## Módulo 6. App Android offline-first

La app Android debe permitir trabajar sin conexión.

Funciones principales:

- Login del usuario.
- Selección de proyecto.
- Descarga de proyectos asignados.
- Descarga de familias asignadas.
- Descarga de catálogos de actividades.
- Descarga de catálogo de materiales.
- Creación y edición de planes operativos offline.
- Registro de actividades por familia.
- Registro de línea base por actividad.
- Registro de meta física por actividad.
- Registro de unidad de manejo por actividad.
- Registro de materiales aportados por el proyecto.
- Registro de materiales o aportes de contrapartida familiar.
- Cálculo automático de valores cotizados.
- Resumen de inversión por familia.
- Validación de campos obligatorios.
- Estado del plan.
- Sincronización cuando haya conexión.
- Manejo de conflictos de sincronización.
- Consulta de planes sincronizados.

No se requiere captura de coordenadas GPS ni fotos.

Estados del plan operativo en la app:

- Borrador.
- Listo para sincronizar.
- Sincronizado.
- Pendiente por material no catalogado.
- Pendiente de revisión.
- Aprobado.
- Devuelto para ajuste.
- Cerrado.

La app debe validar que no se pueda enviar un plan como completo si:

- Falta familia.
- Falta código predial.
- Falta actividad.
- Falta unidad de manejo.
- Falta línea base cuando sea obligatoria.
- Falta meta física cuando sea obligatoria.
- Hay materiales sin cantidad.
- Hay materiales sin unidad.
- Hay materiales no catalogados pendientes.
- Hay inconsistencias en valores.
- Hay datos mínimos faltantes de familia, predio, municipio o vereda.

## Módulo 7. Plan operativo por familia

Cada familia puede tener un plan operativo por proyecto, pero el sistema debe permitir versiones o ajustes si el administrador lo habilita.

El plan operativo debe contener:

### Datos generales

- Proyecto.
- Código predial o código familiar.
- Familia.
- Cédula.
- Edad.
- Departamento.
- Municipio.
- Vereda.
- Predio.
- Área total del predio.
- Área bajo acuerdo de conservación.
- Técnico responsable.
- Fecha de levantamiento.
- Estado del plan.

### Detalle de actividades

Por cada actividad:

- Nombre de la actividad.
- Unidad de manejo.
- Línea base.
- Meta física.
- Observaciones.
- Materiales del proyecto asociados.
- Materiales de contrapartida familiar asociados.

Por cada material del proyecto:

- Material oficial.
- Cantidad.
- Unidad.
- Precio unitario de cotización.
- Valor total cotizado.
- Observaciones.

Por cada material, insumo o aporte de contrapartida:

- Tipo de aporte.
- Nombre del aporte.
- Cantidad.
- Unidad.
- Valor unitario estimado, si aplica.
- Valor total estimado.
- Observaciones.

El sistema debe calcular:

- Total cotizado del proyecto por actividad.
- Total cotizado del proyecto por familia.
- Total estimado de contrapartida por actividad.
- Total estimado de contrapartida por familia.
- Total general de inversión estimada.

## Módulo 8. Aplicativo web administrativo

El aplicativo web debe permitir:

- Ver tablero general.
- Administrar proyectos.
- Administrar familias.
- Administrar usuarios.
- Administrar actividades.
- Administrar materiales.
- Revisar planes operativos.
- Aprobar o devolver planes.
- Consolidar materiales.
- Gestionar compras.
- Generar actas.
- Registrar avances físicos.
- Consultar indicadores.
- Exportar reportes.

Filtros mínimos:

- Proyecto.
- Familia.
- Código predial.
- Vereda.
- Municipio.
- Técnico.
- Estado del plan.
- Actividad.
- Material.
- Mes.
- Trimestre.
- Año.
- Número de compra.
- Estado de entrega.

El aplicativo web debe ser sencillo, ordenado, responsive y pensado para uso administrativo.

## Módulo 9. Consolidado de materiales

El sistema debe consolidar automáticamente los materiales de los planes aprobados.

Debe permitir:

- Agrupar materiales iguales por nombre oficial, categoría y unidad.
- Sumar cantidades.
- Filtrar por proyecto, familia, vereda, municipio, actividad, técnico, mes, trimestre y año.
- Ver detalle de qué familias requieren cada material.
- Ver cantidad por familia.
- Ver cantidad total.
- Ver valor unitario cotizado.
- Ver valor total cotizado.
- Exportar a Excel.
- Generar base para plan de compras.
- Separar materiales por número de compra.

El consolidado debe validar que:

- No existan materiales provisionales pendientes.
- Las unidades de medida coincidan.
- Los materiales estén activos en el catálogo.
- Las cantidades sean mayores que cero.
- Los planes estén aprobados antes de consolidar compra.

## Módulo 10. Gestión de compras

Durante el proyecto pueden existir múltiples compras por familia: Compra 1, Compra 2, Compra 3 o más.

El sistema debe permitir crear compras por proyecto.

Cada compra debe tener:

- Proyecto.
- Número de compra.
- Nombre de la compra.
- Fecha.
- Estado: planeada, en proceso, comprada, entregada, cerrada.
- Materiales incluidos.
- Cantidad comprada.
- Valor unitario real de compra.
- Valor total real de compra.
- Proveedor.
- Número de factura o soporte.
- Observaciones.

El sistema debe permitir asignar materiales comprados a familias según los planes aprobados.

Debe calcular:

- Valor cotizado por material.
- Valor real comprado por material.
- Diferencia entre cotización y compra real.
- Valor real asignado por familia.
- Valor real asignado por compra.
- Valor acumulado por familia en todas las compras.
- Valor acumulado por vereda.
- Valor acumulado por municipio.
- Valor acumulado por proyecto.

Debe permitir filtrar por:

- Proyecto.
- Familia.
- Código predial.
- Vereda.
- Municipio.
- Número de compra.
- Material.
- Actividad.
- Mes.
- Trimestre.

## Módulo 11. Actas de entrega

El sistema debe generar automáticamente actas de entrega por familia y por número de compra.

Las actas deben poder generarse:

- Individualmente por familia.
- Masivamente por vereda.
- Masivamente por municipio.
- Masivamente por número de compra.
- Masivamente por proyecto.

Cada acta debe incluir:

- Título del acta.
- Número de entrega o número de compra.
- Proyecto.
- Representante familiar.
- Número de cédula.
- Departamento.
- Municipio.
- Vereda.
- Nombre del predio.
- Código predial o código familiar.
- Fecha de entrega.
- Texto institucional editable.
- Tabla de materiales entregados:
  - Número.
  - Descripción del artículo.
  - Unidad.
  - Cantidad.
  - Observaciones, si aplica.
- Espacio para firma del representante familiar.
- Espacio para firma del técnico o responsable del proyecto.
- Nombre y cédula del representante familiar.
- Nombre y cédula del técnico o responsable.
- Logos institucionales.
- Pie de página editable.

No se requiere firma digital. El acta se debe imprimir y firmar físicamente.

El sistema debe generar:

- PDF final para impresión.
- Word editable.
- Historial de actas generadas.

El administrador debe poder modificar fácilmente:

- Logos.
- Encabezado.
- Texto principal.
- Texto de constancia.
- Pie de página.
- Nombres institucionales.
- Formato general del acta.

El formato debe inspirarse en un acta sencilla de entrega de insumos y materiales, con tabla central de artículos, cantidades y espacio para firmas.

## Módulo 12. Herramienta de indicadores físicos

El aplicativo web debe tener una herramienta de indicadores construida a partir de las actividades definidas en los planes operativos.

Debe permitir medir avances físicos por familia, vereda, municipio, mes, trimestre y año.

Cada indicador debe tener:

- Proyecto.
- Familia.
- Código predial.
- Municipio.
- Vereda.
- Actividad.
- Unidad de manejo.
- Línea base.
- Meta física.
- Avance por mes.
- Avance por trimestre.
- Avance acumulado.
- Porcentaje de avance frente a la meta.
- Estado tipo semáforo: bajo, medio, alto.
- Observaciones.

Debe incluir indicadores específicos para:

- Área total del predio.
- Área bajo acuerdo de conservación.
- Actividades de restauración.
- Actividades de aislamiento.
- Actividades de siembra.
- Actividades de mantenimiento.
- Árboles entregados.
- Árboles sembrados.
- Otras actividades del catálogo.

Para árboles debe manejar:

- Línea base de árboles entregados.
- Árboles entregados por trimestre.
- Acumulado de árboles entregados.
- Línea base de árboles sembrados.
- Árboles sembrados por trimestre.
- Acumulado de árboles sembrados.
- Porcentaje de avance.

Los reportes deben permitir:

- Consolidado por familia.
- Consolidado por vereda.
- Consolidado por municipio.
- Consolidado por proyecto.
- Consolidado por actividad.
- Consolidado por mes.
- Consolidado por trimestre.
- Comparación meta vs avance.
- Exportación a Excel, PDF y CSV.

## Módulo 13. Reportes consolidados

El sistema debe permitir generar reportes por:

- Familia.
- Código predial.
- Vereda.
- Municipio.
- Proyecto.
- Mes.
- Trimestre.
- Año.
- Actividad.
- Material.
- Número de compra.

Reportes mínimos:

1. Reporte de planes operativos.
2. Reporte de materiales por familia.
3. Reporte consolidado de materiales.
4. Reporte de materiales por vereda.
5. Reporte de materiales por municipio.
6. Reporte de compras.
7. Reporte de compras por familia.
8. Reporte de valores cotizados vs valores reales.
9. Reporte de actas generadas.
10. Reporte de entregas por compra.
11. Reporte de indicadores físicos.
12. Reporte de avance por trimestre.
13. Reporte de árboles entregados y sembrados.
14. Reporte de área bajo acuerdo de conservación.
15. Reporte general del proyecto.

Los reportes deben permitir exportación en:

- Excel.
- CSV.
- PDF.
- Word cuando aplique.

## Módulo 14. Validaciones de consistencia

El sistema debe validar que toda la información coincida desde la app móvil hasta el aplicativo web.

Validaciones obligatorias:

- El código predial debe ser único por proyecto.
- Una familia no debe duplicarse dentro del mismo proyecto.
- El número de cédula debe ayudar a detectar duplicados.
- Cada plan debe pertenecer a una familia existente.
- Cada familia debe pertenecer a un proyecto.
- Cada actividad debe pertenecer al catálogo activo.
- Cada actividad debe tener unidad de manejo.
- Cada meta debe tener unidad.
- Cada material debe estar asociado a una actividad.
- Cada material debe tener cantidad mayor a cero.
- Cada material debe tener unidad de medida.
- Cada material oficial debe existir en catálogo.
- No se puede aprobar un plan con materiales provisionales.
- No se puede consolidar una compra con planes no aprobados.
- No se puede generar acta de entrega si no hay compra asociada.
- No se puede generar acta si la familia no tiene código predial.
- No se puede generar acta si faltan datos mínimos de familia, municipio, vereda o representante.
- No se puede cerrar una compra si existen materiales sin asignar.
- No se puede reportar avance físico superior a la meta sin advertencia.
- Los avances trimestrales deben acumular correctamente.
- Los reportes por familia, vereda, municipio y proyecto deben cuadrar con el total general.
- Los valores reales de compra deben actualizar los valores por familia.
- El sistema debe registrar auditoría de cambios importantes.

## Módulo 15. Modelo de datos esperado

Diseña una base de datos relacional en PostgreSQL para Supabase.

Debe incluir como mínimo tablas para:

- projects.
- users_profiles.
- roles.
- municipalities.
- villages.
- families.
- properties.
- activity_catalog.
- material_catalog.
- operational_plans.
- plan_activities.
- plan_project_materials.
- plan_family_counterparts.
- provisional_materials.
- purchases.
- purchase_items.
- purchase_family_allocations.
- delivery_records.
- delivery_record_items.
- indicator_periods.
- physical_indicators.
- tree_indicators.
- document_templates.
- generated_documents.
- audit_logs.
- sync_logs.

Para cada tabla, propone:

- Nombre de la tabla.
- Campos.
- Tipo de dato.
- Llave primaria.
- Llaves foráneas.
- Índices recomendados.
- Reglas de validación.
- Relaciones principales.

## Módulo 16. Sincronización offline/online

Diseña un flujo de sincronización robusto.

Debe incluir:

- Identificadores UUID para registros creados offline.
- Fecha de creación local.
- Fecha de última modificación.
- Usuario que creó.
- Usuario que modificó.
- Estado de sincronización.
- Control de conflictos.
- Sincronización incremental.
- Descarga de catálogos actualizados.
- Subida de planes operativos.
- Manejo de registros pendientes.
- Manejo de errores.
- Reintentos.
- Bitácora de sincronización.

Reglas de conflicto:

- Si un plan fue editado en web y en móvil, debe marcarse como conflicto para revisión.
- Los catálogos oficiales los controla el administrador desde web.
- La app solo puede usar catálogos descargados o registrar materiales provisionales.
- Los planes aprobados no deben editarse desde la app, salvo que el administrador los devuelva para ajuste.

## Módulo 17. Interfaz de usuario

La app Android debe tener interfaz sencilla para técnicos de campo.

Pantallas sugeridas:

1. Login.
2. Selección de proyecto.
3. Sincronización.
4. Lista de familias asignadas.
5. Detalle de familia.
6. Crear/editar plan operativo.
7. Agregar actividad.
8. Agregar materiales del proyecto.
9. Agregar contrapartida familiar.
10. Resumen económico del plan.
11. Validaciones antes de sincronizar.
12. Estado de sincronización.

El aplicativo web debe tener:

1. Login.
2. Dashboard general.
3. Proyectos.
4. Usuarios.
5. Familias.
6. Catálogos.
7. Planes operativos.
8. Consolidado de materiales.
9. Compras.
10. Actas de entrega.
11. Indicadores físicos.
12. Reportes.
13. Plantillas de documentos.
14. Auditoría.

## Módulo 18. Entregable inicial obligatorio: plan técnico antes de programar

En esta primera fase no debes generar código.

Tu primera entrega debe ser un documento técnico completo que incluya:

1. Resumen ejecutivo de la solución.
2. Revisión e interpretación de los archivos de referencia ubicados en: `C:\Users\libar\Desktop\Aplicativo planes de inversion act\Ejemplo`.
3. Arquitectura recomendada.
4. Justificación de la tecnología seleccionada.
5. Mapa funcional del sistema.
6. Módulos del aplicativo web.
7. Módulos de la app Android.
8. Flujo completo desde captura en campo hasta consolidado de materiales.
9. Flujo completo desde compra hasta generación de actas de entrega.
10. Flujo completo de indicadores físicos por familia, vereda, municipio, mes y trimestre.
11. Modelo de base de datos propuesto.
12. Diccionario inicial de tablas y campos.
13. Relaciones entre tablas.
14. Reglas de negocio.
15. Validaciones de consistencia entre app y web.
16. Estados de planes operativos, compras, entregas e indicadores.
17. Diseño de sincronización offline-first.
18. Diseño de roles y permisos.
19. Diseño de reportes.
20. Diseño de plantillas PDF y Word.
21. Estructura recomendada del repositorio.
22. Plan de desarrollo por fases.
23. Criterios de aceptación por fase.
24. Riesgos técnicos y mitigaciones.
25. Decisiones que requieren aprobación del usuario antes de programar.

Al finalizar este documento técnico, no continúes con código. Debes esperar aprobación explícita.

Cierra tu respuesta con esta pregunta:

“¿Aprueba este plan técnico para iniciar la generación de los aplicativos?”

Solo después de la aprobación podrás continuar con la Fase 1 de desarrollo.

## Módulo 19. Plan de desarrollo sugerido después de la aprobación

Cuando recibas la aprobación, desarrolla el sistema por fases, no todo al mismo tiempo.

### Fase 1. Diseño y base central

- Crear proyecto Supabase.
- Crear estructura de base de datos PostgreSQL.
- Crear tablas principales.
- Crear relaciones.
- Crear roles básicos.
- Crear políticas de seguridad.
- Crear autenticación.
- Crear estructura base del aplicativo web.

### Fase 2. Aplicativo web administrativo base

- Login.
- Dashboard.
- Módulo de proyectos.
- Módulo de familias.
- Cargue de familias desde Excel.
- Módulo de actividades.
- Módulo de materiales.
- Roles y permisos.

### Fase 3. Planes operativos web

- Consulta de planes.
- Revisión de planes.
- Aprobación de planes.
- Devolución para ajuste.
- Validación de materiales provisionales.
- Resumen económico por familia.

### Fase 4. App Android offline-first

- Login.
- Selección de proyecto.
- Descarga de familias.
- Descarga de catálogos.
- Captura offline de planes.
- Actividades.
- Materiales.
- Contrapartida.
- Cálculos.
- Validaciones.
- Sincronización.

### Fase 5. Consolidado de materiales

- Consolidado automático.
- Filtros.
- Exportación Excel.
- Validaciones.
- Preparación de compras.

### Fase 6. Gestión de compras

- Crear compras.
- Asignar materiales.
- Registrar valores reales.
- Comparar valor cotizado vs real.
- Distribuir valores por familia.
- Reportes de compra.

### Fase 7. Actas de entrega

- Plantillas editables.
- Logos.
- Textos.
- Generación PDF.
- Generación Word.
- Generación individual y masiva.
- Historial de actas.

### Fase 8. Indicadores físicos

- Registro de línea base.
- Registro de metas.
- Avances mensuales.
- Avances trimestrales.
- Semáforo de avance.
- Árboles entregados y sembrados.
- Área bajo acuerdo de conservación.
- Reportes por familia, vereda, municipio y proyecto.

### Fase 9. Reportes finales y validaciones

- Reportes consolidados.
- Auditoría.
- Exportaciones.
- Revisión de consistencia.
- Pruebas finales.
- Manual básico de uso.

## Condiciones importantes

- No inventes funcionalidades innecesarias.
- Prioriza facilidad de uso en campo.
- Prioriza mantenimiento sencillo.
- Prioriza bajo costo de alojamiento.
- Evita depender de servidores propios.
- El sistema debe ser multi-proyecto.
- El sistema debe soportar trabajo offline.
- El sistema debe validar que la información coincida entre app y web.
- El sistema debe permitir exportar información para informes técnicos, planes de compra, TDR, actas e indicadores.
- La solución debe ser escalable para más de 300 familias.
- El diseño debe estar preparado para manejar varios municipios, veredas, técnicos y proyectos.
- Los datos deben ser consistentes entre plan operativo, consolidado, compra, acta de entrega e indicadores físicos.
- No generes código hasta que el plan técnico sea aprobado.
- Antes de diseñar la solución, revisa e interpreta los ejemplos de formatos ubicados en: `C:\Users\libar\Desktop\Aplicativo planes de inversion act\Ejemplo`.
