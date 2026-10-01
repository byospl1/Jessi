# Jessi — Rutina de gimnasio

App web móvil de entrenamiento para Jessi. El frontend publicado es `index.html`, con Firebase/Firestore como backend y GitHub Pages como alojamiento. La app muestra la rutina guardada; no modifica automáticamente la progresión ni envía correos semanales. Ver `CONTEXT.md` para decisiones del proyecto.

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

- `progreso/{semana}` guarda marcas de días/series y, desde esta versión, `plannedDayIds` y `sessionLog_<id del día>` con series marcadas y hora. `snapshots` conserva cargas guardadas al editar; no confirma por sí solo que se hayan realizado.
- El historial antiguo no siempre conserva la cantidad de días programados: cuando usa los cuatro días actuales como referencia, la app lo indica. Una semana sin documento se muestra como «sin registro», no como cero.
- Los reportes privados se excluyen del repositorio. La lectura anónima de datos y la clave de Gemini siguen siendo un riesgo pendiente; esta entrega no cambia autenticación, reglas ni claves.
