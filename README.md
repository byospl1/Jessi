# Jessi — Rutina de gimnasio

App web móvil de entrenamiento para Jessi. El frontend publicado es `index.html`, con Firebase/Firestore como backend y GitHub Pages como alojamiento. La app muestra la rutina guardada; las actualizaciones de progresión se aplican después de la revisión de Hugo. Ver `CONTEXT.md` para decisiones del proyecto.

## Prerrequisitos

- Un navegador moderno (para abrir la app).
- Un servidor HTTP estático simple para servir `index.html` localmente (por ejemplo `python3`, ya viene en macOS, o `npx serve`). Firebase no funciona correctamente abriendo el archivo directo con `file://`.
- Node.js para regenerar `index.html` desde el archivo fuente y ejecutar las pruebas locales.
- Acceso autorizado a Firebase `asesoriasjessi` si necesitas inspeccionar datos reales.

## Correr la app web localmente

`index.html` es una página empaquetada que desempaqueta sus recursos al cargar. Basta con servirla por HTTP:

```bash
cd /Users/hugo/Documents/Proyectos/Jessi
python3 -m http.server 8000
# abre http://localhost:8000/index.html en el navegador
```

La configuración pública de Firebase está embebida en la página. El código editable vive en `src/app.html`; después de modificarlo, ejecuta `node scripts/build.mjs` y verifica con `node scripts/build.mjs --check`. No edites manualmente el payload empaquetado de `index.html`.

Las pruebas de comportamiento no escriben en Firebase y se ejecutan con `node --test tests/*.test.mjs`.

## Estructura del repo

```
Jessi/
├─ index.html              # página publicable, generada desde src/app.html
├─ src/app.html            # código fuente editable de la app
├─ scripts/build.mjs      # empaqueta la fuente sin dependencias externas
├─ tests/                 # pruebas locales de datos y navegación
├─ assets/
│  └─ lo-siento-jefa.jpeg  # imagen de la cabecera
├─ .agents/skills/         # skill local de reportes de Jessi
├─ CONTEXT.md               # estado y decisiones del proyecto
└─ NOTAS.md                 # decisiones internas de coaching
```

## Notas

- El 30 de septiembre se eliminó `weekly-email.yml`. `scripts/weekly-progression.mjs` conserva la regla anterior por trazabilidad; su workflow solo permite simular, sin aplicar incrementos durante el piloto.
- `scripts/adaptive-progression.mjs` genera un borrador por ejercicio con los resultados reales y sensaciones de Jessi. El workflow `adaptive-proposals.yml` lo actualiza diariamente a las 15:00 UTC (07:00/08:00 en Tijuana); no modifica rutinas. También puede ejecutarse manualmente en modo `draft`.
- Con `FIREBASE_API_KEY`, `RUN_MODE=inspect TARGET_WEEK=2026-W43 node scripts/adaptive-progression.mjs` lee el borrador vigente. En GitHub Actions, Hugo puede elegir `approve` o `reject` indicando `target_week` y el `draft_id` exacto. Para aprobar exige IDs concretos en `approved_exercises` y `technique_confirmed=true`. El script recalcula el borrador, rechaza datos obsoletos o semanas iniciadas y aplica un commit atómico y verificado. No hay aprobación desde la página pública.
- La regla anterior aumentaba una repetición por serie numérica; al superar 12, volvía a 8 y aumentaba 5 KG, 10 LB o un nivel. El modelo nuevo no inventa saltos: exige resultados explícitos, RIR, recuperación y, para subir carga, dos exposiciones comparables y un salto configurado de no más del 5%.
- El historial de ejecución se conserva. Los borradores y decisiones quedan en `progreso/{semana}.adaptiveDraft` y `.adaptiveDecision`; una aplicación aprobada también se audita en `.progression`. Los respaldos permanecen en la carpeta privada excluida de GitHub.
- La propuesta del piloto supervisado está en [`PROPUESTA_PROGRESION.md`](PROPUESTA_PROGRESION.md).

- `progreso/{semana}` guarda marcas de días/series y, desde esta versión, `plannedDayIds` y `sessionLog_<id del día>` con series marcadas y hora. `snapshots` conserva cargas guardadas al editar; no confirma por sí solo que se hayan realizado.
- La captura de resultados vive en `progreso/{semana}.exerciseFeedback_<id del día>_<índice de ejercicio>` (esquema 1): `sets` con carga, unidad, repeticiones y hora explícitas; RIR, dificultad, recuperación, bombeo, agujetas limitantes, molestia articular y comentario opcional. Las cargas/repeticiones parten vacías, se sincronizan por ejercicio y quedan localmente pendientes si falla la red. Una marca nueva sin resultado queda como `source: not_recorded`; las series antiguas sin `source` se conservan como registros no verificados. Estos datos alimentan propuestas, nunca una aplicación automática.
- El historial antiguo no siempre conserva la cantidad de días programados: cuando usa los cuatro días actuales como referencia, la app lo indica. Una semana sin documento se muestra como «sin registro», no como cero.
- Los reportes privados se excluyen del repositorio. La lectura anónima de datos y la clave de Gemini siguen siendo un riesgo pendiente; esta entrega no cambia autenticación, reglas ni claves.
