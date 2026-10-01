---
name: reporte-jessi
description: Genera un reporte longitudinal y ejecutivo del desempeño de Jessi a partir de todos los datos pertinentes y accesibles de Firebase, con gráficos, tablas, trazabilidad y límites de evidencia. Úsala para informes de progreso, no para modificar rutinas ni datos.
---

# Reporte de desempeño de Jessi

Trabaja únicamente en `/Users/hugo/Documents/Proyectos/Jessi`. Esta skill autoriza lectura y análisis, no cambios en Firestore, la app ni la rutina. El reporte es privado por defecto; no lo publiques en GitHub Pages ni lo envíes a servicios de IA externos sin autorización específica. No incluyas claves, identificadores internos, datos de configuración ni información sensible innecesaria.

## Cobertura de datos

1. Lee [references/firebase-map.md](references/firebase-map.md) y comprueba el esquema real al momento de generar el reporte. Verifica el proyecto Firebase y anota la fecha/hora de corte y el método de acceso. Si hay acceso administrativo autorizado, inventaría las colecciones y subcolecciones para no limitarte a lo que conoce la web. Si solo hay acceso cliente, inspecciona todas las colecciones conocidas y declara expresamente que no puedes certificar que sean todas.
2. Extrae de forma paginada y solo de lectura los campos pertinentes de cada fuente accesible. Conserva una copia de trabajo privada, fuera de cualquier ruta publicable; nunca guardes credenciales ni valores de `config/app` en el reporte o sus insumos. Cuenta documentos, cobertura temporal, campos disponibles, valores faltantes y duplicados. Distingue datos archivados, borrados o parciales si la fuente permite verlo.
3. Concilia sesiones completadas (`doneIds`), series marcadas (`exDone`), cargas/repeticiones guardadas (`snapshots`) y la prescripción actual (`rutinas`). Una marca de finalización, una serie registrada y un valor prescrito son hechos distintos. No interpretes una semana sin documento como cero entrenamientos; una semana en curso no es comparable con una cerrada. No reconstruyas retrospectivamente rutinas antiguas a partir de la rutina actual sin evidencia.

## Análisis

- Calcula adherencia con un denominador verificable para cada periodo. Si no hay historial del número de sesiones programadas, presenta la limitación y, si usas la estructura actual como aproximación, etiquétala como tal. Muestra intervalos y semanas faltantes.
- Compara ejercicios equivalentes por nombre/identidad, unidad, modalidad y serie. Convierte KG/LB solo cuando la unidad sea explícita y la comparación tenga sentido; `nivel`, pesos sin unidad, cargas por lado y texto libre requieren clasificación separada. No sumes un volumen global de cargas mixtas o prescripciones incompletas.
- Identifica tendencias y particularidades con números y ejemplos comprobables: constancia, interrupciones, saltos, estancamientos, cambios en repeticiones/cargas, calidad de registro y discrepancias entre fuentes. Señala hipótesis como hipótesis; no atribuyas causas médicas o fisiológicas a partir de correlaciones débiles.
- Trata `wellness` como dato sensible. Evalúa primero cobertura y consentimiento/pertinencia. Si se usa, agrega o resume sin exponer detalles íntimos innecesarios; nunca infieras causalidad entre ciclo, hidratación, estrés y rendimiento a partir de registros aislados.

## Entregable y control de calidad

Produce un informe ejecutivo en español con fecha de corte, resumen de hallazgos, tabla de cobertura/calidad, tabla de indicadores con definiciones, gráficos legibles (adherencia temporal y progresión de ejercicios comparables), particularidades, límites y recomendaciones de seguimiento de datos. Separa observaciones de inferencias. Incluye el rango y la fuente de cada cifra importante, sin IDs ni datos crudos sensibles. Si se solicita un documento, guárdalo en una carpeta privada no publicable dentro del proyecto y revisa visualmente tablas, ejes, unidades y páginas antes de entregarlo.

Antes de finalizar, verifica que los totales cuadren con los registros originales, que ninguna serie histórica se haya presentado como ejecución real si solo era una prescripción y que el reporte no diga «todos los datos de Firebase» cuando el acceso no permitió inventariarlos todos. No actualices un reporte anterior copiando cifras: vuelve a leer las fuentes.
