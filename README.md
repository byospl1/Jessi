# Jessi — Rutina de gimnasio

App web de rutinas de gimnasio para una clienta real de coaching de Hugo ("Jessi"): la clienta ve y sigue su rutina desde el navegador con progresión automática de peso/repeticiones semana a semana, y recibe un aviso semanal por correo con los cambios aplicados. Todo el frontend vive en un único `index.html` monolítico (sin build step), con Firebase/Firestore como backend y publicación en GitHub Pages. Ver `CONTEXT.md` para el estado narrativo del proyecto (objetivo, decisiones, próximos pasos) — este README cubre solo el "cómo correrlo".

## Prerrequisitos

- Un navegador moderno (para abrir la app).
- Un servidor HTTP estático simple para servir `index.html` localmente (por ejemplo `python3`, ya viene en macOS, o `npx serve`). Firebase no funciona correctamente abriendo el archivo directo con `file://`.
- Python 3.12+ y `pip` (para correr o probar `weekly_email/weekly_email.py` localmente).
- Node.js + `npm` (solo si vas a ejecutar `seed.mjs` para sembrar datos iniciales en Firestore).
- Acceso al proyecto Firebase `asesoriasjessi` (Firestore) si necesitas datos reales o credenciales.

## Correr la app web localmente

`index.html` es un archivo autocontenido (un export tipo "bundled page": desempaqueta sus propios recursos con JS al cargar). No requiere `npm install` ni build. Basta con servirlo por HTTP:

```bash
cd /Users/hugo/Documents/Proyectos/Jessi
python3 -m http.server 8000
# abre http://localhost:8000/index.html en el navegador
```

La configuración de Firebase (`firebaseConfig`) ya está embebida dentro de `index.html`, apuntando al proyecto `asesoriasjessi`. No hay variables de entorno que configurar para la app web — cualquier cambio se prueba directamente editando `index.html`.

### Sembrar datos iniciales (opcional, una sola vez)

`seed.mjs` / `seed.html` cargan la rutina inicial a Firestore (colección `rutinas`). Requieren el SDK de Firebase:

```bash
cd /Users/hugo/Documents/Proyectos/Jessi
npm install firebase
node seed.mjs
```

Antes de correrlo, revisa que `firebaseConfig` dentro de `seed.mjs` sea la misma que usa `index.html`, y que las reglas de Firestore permitan escritura temporalmente (ver advertencia dentro de `seed.html`). Al terminar, se recomienda regresar las reglas a solo lectura.

## Correr/probar el script de correo semanal localmente

`weekly_email/weekly_email.py` lee Firestore vía REST, calcula la progresión de la semana y envía un correo con los cambios (no escribe en la base de datos salvo el marcador `progWeek` — ver `weekly_email/README.md` para el detalle completo).

```bash
cd /Users/hugo/Documents/Proyectos/Jessi
python3 -m venv .venv && source .venv/bin/activate
pip install -r weekly_email/requirements.txt

# exporta las variables de entorno necesarias (ver .env.example) y corre:
export FIREBASE_API_KEY=...
export GMAIL_USER=...
export GMAIL_APP_PASSWORD=...
export TO_EMAIL=...
python weekly_email/weekly_email.py
```

`FIREBASE_PROJECT_ID` tiene un default (`asesoriasjessi`) si no se define. Si no hay cambios de progresión esa semana, el script no envía correo (esto es normal, no es un error).

En producción este script se dispara solo, vía GitHub Actions (`.github/workflows/weekly-email.yml`), cada lunes 06:00 UTC (00:00 hora México) o manualmente desde la pestaña **Actions → Correo semanal de Jessi → Run workflow**.

## Variables de entorno / secrets

Ninguna se usa en el `index.html` de la app web (la config de Firebase está embebida en el archivo). Las siguientes solo aplican al script de correo semanal, tanto en local como en GitHub Actions (configuradas ahí como *repository secrets*, ver `weekly_email/README.md` para el paso a paso):

| Variable | Dónde se usa | Notas |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `weekly_email.py` | Opcional; default `asesoriasjessi` |
| `FIREBASE_API_KEY` | `weekly_email.py` | Web API Key del proyecto Firebase (misma que usa la app) |
| `GMAIL_USER` | `weekly_email.py` | Cuenta de Gmail que envía el correo |
| `GMAIL_APP_PASSWORD` | `weekly_email.py` | App Password de Gmail (16 caracteres, no la contraseña normal) |
| `TO_EMAIL` | `weekly_email.py` | Destinatario del correo semanal |

Plantilla en `.env.example` (solo nombres, sin valores).

## Estructura del repo

```
Jessi/
├─ index.html              # app principal (frontend monolítico, sin build)
├─ seed.html / seed.mjs     # utilidades para sembrar datos iniciales en Firestore
├─ weekly_email/
│  ├─ weekly_email.py       # script que calcula progresión y envía el correo semanal
│  ├─ requirements.txt
│  └─ README.md             # guía detallada de configuración del correo semanal
├─ .github/workflows/weekly-email.yml   # dispara weekly_email.py cada lunes
├─ CONTEXT.md               # estado narrativo del proyecto (objetivo, decisiones, próximos pasos)
└─ .env.example             # nombres de variables de entorno usadas por weekly_email.py
```

## Notas

- Los datos de rutina/progreso pertenecen a una persona real (la clienta) — tratar con cuidado si se expone, comparte o publica contenido del proyecto.
- No hay pipeline de build para `index.html`; cualquier cambio se prueba directamente ahí.
- El script de correo semanal solo lee y escribe el marcador de progresión en Firestore; la progresión real la sigue aplicando la app cuando la clienta la abre.
