# CONTEXT.md

## 1. Proyecto & Objetivo
App web de rutinas de gimnasio para una clienta real de coaching de Hugo ("Jessi"). El objetivo es que la clienta pueda ver y seguir su rutina desde el navegador, con la progresión de peso/repeticiones calculada automáticamente semana a semana, y que reciba un aviso semanal por correo con los cambios.

## 2. Stack & Arquitectura
- Frontend: un único `index.html` monolítico (sin framework, sin build step) que concentra toda la app.
- `seed.html` y `seed.mjs`: utilidades para sembrar/inicializar datos en la base de datos.
- Backend/datos: Firebase / Firestore (proyecto `asesoriasjessi`).
- Publicación: GitHub Pages (dominio `byospl1.github.io`).
- Envío semanal de correo: script Python `weekly_email/weekly_email.py` (dependencias en `weekly_email/requirements.txt`), disparado por GitHub Actions (`.github/workflows/weekly-email.yml`) cada lunes 06:00 UTC (00:00 hora México). Lee Firestore, calcula la progresión (misma lógica que la app: +1 repetición; al pasar de 12 reps baja a 8 reps y sube peso +5 kg / +10 lb / +1 nivel) y envía un correo solo si hubo cambios esa semana. No escribe en la base de datos.
- Secrets usados por el workflow (no exponer valores, solo nombres): `FIREBASE_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `TO_EMAIL`.
- Existe también una copia descargable de la rutina como HTML standalone ("Rutina de Jessi (descargable).html") generada a partir de este proyecto para enviar directo a la clienta.

## 3. Estado Actual
- Repo git activo y funcional; working tree limpio salvo `CONTEXTO-IA.md` sin trackear en git.
- `index.html` (app principal) y el flujo de Firebase/Firestore están operativos; historial de commits reciente son actualizaciones directas a `index.html` ("Update index.html", "auto: update").
- El workflow de correo semanal (`weekly-email.yml`) ya está integrado en `.github/workflows/` y el script `weekly_email.py` ya existe en el repo — la integración descrita en `LEEME-PRIMERO.txt` (que asumía que había que copiar la carpeta `weekly_email/` a mano) ya se aplicó.
- Último commit: `18f27f6` "auto: update" (2026-08-16).

## 4. Decisiones Clave
- Se optó por un monolito de un solo archivo (`index.html`) sin pipeline de build para simplicidad; cualquier cambio debe probarse directamente ahí, no hay componentes separados.
- El correo semanal es solo informativo: la progresión real la sigue aplicando la app cuando la clienta la abre; el script de Python solo lee y notifica, nunca escribe en Firestore.
- El horario del cron está fijado en UTC asumiendo México en UTC-6 (CST); si cambia el horario de verano hay que ajustar manualmente el cron en el workflow.
- Los datos de rutina/progreso pertenecen a una persona real (la clienta) — tratar con cuidado si se expone, comparte o publica contenido del proyecto.

## 5. Próximos Pasos
- Decidir si `CONTEXTO-IA.md` (actualmente sin trackear) se conserva, se integra a `CONTEXT.md`, o se elimina para no duplicar el resumen del proyecto.
- Confirmar que los 4 secrets de GitHub Actions (`FIREBASE_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `TO_EMAIL`) siguen vigentes y que el workflow semanal se ha probado con éxito recientemente.
- Revisar si la copia standalone descargable ("Rutina de Jessi (descargable).html") sigue generándose/actualizándose en sync con `index.html`.
