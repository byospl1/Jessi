# Mapa inicial de Firebase para Jessi

Este mapa describe lo conocido por el código y una inspección de solo lectura del 2026-09-30. Es una guía de descubrimiento, no una garantía de esquema completo ni una fuente de cifras vigentes.

| Fuente | Campos conocidos | Interpretación y cautela |
| --- | --- | --- |
| `rutinas` | `alumna`, `nombre`, `orden`, `archivada`, `ejercicios[]`, `progWeek` | Prescripción visible actualmente. En cada ejercicio pueden existir `nombre`, `series[{peso,reps}]`, `sets`, `peso`, `reps`, `unidadPeso`, `descanso`, `nota`, `solicitarVideo`. No implica que esos valores se ejecutaron ni documenta por sí sola las versiones históricas. |
| `progreso/{semana ISO}` | `week`, `doneIds[]`, `exDone[]`, `plannedDayIds[]`, `updatedAt`, `snapshots`, `sessionLog_<id del día>`, `wellness` | `doneIds` marca días; `exDone` marca series; `plannedDayIds` solo existe en registros nuevos. `snapshots` recoge valores al guardar cambios, no necesariamente al completar la sesión. `sessionLog_<id>` registra series marcadas con hora/carga/unidad desde la versión que lo incorpora; no existe retrospectivamente. `updatedAt` es la actualización del documento, no fecha de cada sesión. `wellness` puede contener ciclo, hidratación y estrés. |
| `config/app` | Configuración de la app, incluida una clave de análisis | No es fuente de desempeño. No extraer valores, registrar en insumos ni publicar. Solo puede anotarse su existencia como metadato técnico si hace falta. |

Para descubrir más fuentes, usa un inventario autorizado de colecciones/subcolecciones de Firestore. Una lectura pública o el frontend solo muestra rutas conocidas; no prueba que no haya otras. Busca también, si existe acceso legítimo, historial de cambios, sesiones individuales, notas de seguimiento y marcas temporales; no inventes esas fuentes si no aparecen.

Reglas de normalización: una semana ISO ausente significa «sin datos»; una semana abierta es parcial; `series[].peso` puede ser número, texto, nivel o vacío; KG y LB no son intercambiables; `reps` puede contener expresiones como fallo o minutos. Si falta unidad o fecha de ejecución, excluye ese registro de comparaciones cuantitativas que las exijan y explica cuánto quedó fuera.
