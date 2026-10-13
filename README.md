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

- El 30 de septiembre se eliminó `weekly-email.yml`, que también actualizaba las cargas: esa dependencia detuvo la progresión. Desde el 13 de octubre, `scripts/weekly-progression.mjs` permite simular y aplicar el método anterior por separado. El workflow `weekly-progression.yml` es manual; no dispara incrementos durante el piloto sin revisión.
- Con `FIREBASE_API_KEY` configurada, `node scripts/weekly-progression.mjs` simula sin escribir. `--apply` actualiza una sola semana; `--allow-started` solo se usa cuando Hugo autoriza modificar una semana ya iniciada. `--baseline --apply` fija la semana sin modificar cargas. Las escrituras son atómicas, verificadas e idempotentes por `progWeek`.
- La regla anterior aumenta una repetición por serie numérica; al superar 12, vuelve a 8 y aumenta 5 KG, 10 LB o un nivel. Si la unidad del incremento es desconocida, conserva la serie para revisión. Conserva pausas, descargas, ejercicios, series y metadatos.
- El historial de ejecución se conserva y el registro de cambios queda en `progreso/{semana}.progression`. Los respaldos permanecen en la carpeta privada excluida de GitHub.
- La propuesta del piloto supervisado está en [`PROPUESTA_PROGRESION.md`](PROPUESTA_PROGRESION.md).

- `progreso/{semana}` guarda marcas de días/series y, desde esta versión, `plannedDayIds` y `sessionLog_<id del día>` con series marcadas y hora. `snapshots` conserva cargas guardadas al editar; no confirma por sí solo que se hayan realizado.
- El historial antiguo no siempre conserva la cantidad de días programados: cuando usa los cuatro días actuales como referencia, la app lo indica. Una semana sin documento se muestra como «sin registro», no como cero.
- Los reportes privados se excluyen del repositorio. La lectura anónima de datos y la clave de Gemini siguen siendo un riesgo pendiente; esta entrega no cambia autenticación, reglas ni claves.
