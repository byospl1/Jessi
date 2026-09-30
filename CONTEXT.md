# CONTEXT.md

## 1. Proyecto & Objetivo
App web de rutinas de gimnasio para una clienta real de coaching de Hugo ("Jessi"). La clienta consulta y sigue su rutina desde el navegador; la app aplica la progresión de peso/repeticiones cuando la abre. Ya no se envían correos semanales.

## 2. Stack & Arquitectura
- Frontend: un único `index.html` monolítico (sin framework, sin build step) que concentra toda la app.
- `seed.html` y `seed.mjs`: utilidades para sembrar/inicializar datos en la base de datos.
- Backend/datos: Firebase / Firestore (proyecto `asesoriasjessi`).
- Publicación: GitHub Pages (dominio `byospl1.github.io`).
- Existe también una copia descargable de la rutina como HTML standalone ("Rutina de Jessi (descargable).html") generada a partir de este proyecto para enviar directo a la clienta.

## 3. Estado Actual
- Repo git activo; la app principal y Firebase/Firestore están operativos.
- La progresión se gestiona desde la app. El workflow de correo y sus archivos de configuración ya fueron retirados.
- Último commit: `18f27f6` "auto: update" (2026-08-16).

## 4. Decisiones Clave
- Se optó por un monolito de un solo archivo (`index.html`) sin pipeline de build para simplicidad; cualquier cambio debe probarse directamente ahí, no hay componentes separados.
- No existe una rutina automática de correo semanal; no recrearla salvo que se solicite expresamente.
- Los datos de rutina/progreso pertenecen a una persona real (la clienta) — tratar con cuidado si se expone, comparte o publica contenido del proyecto.

## 5. Próximos Pasos
- Revisar si la copia standalone descargable ("Rutina de Jessi (descargable).html") sigue generándose/actualizándose en sync con `index.html`.
