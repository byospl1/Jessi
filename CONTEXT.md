# CONTEXT.md

## 1. Proyecto & Objetivo
App web de rutinas de gimnasio para una clienta real de coaching de Hugo ("Jessi"). La clienta consulta y sigue su rutina desde el navegador. La progresión se actualiza en Firebase después de la revisión de Hugo.

## 2. Stack & Arquitectura
- Frontend: fuente editable `src/app.html`, empaquetada mecánicamente en `index.html` con `scripts/build.mjs`.
- Las herramientas antiguas de siembra fueron retiradas; no se necesita recrearlas para la app cotidiana.
- Backend/datos: Firebase / Firestore (proyecto `asesoriasjessi`).
- Publicación: GitHub Pages (dominio `byospl1.github.io`).
- Existe también una copia descargable de la rutina como HTML standalone ("Rutina de Jessi (descargable).html") generada a partir de este proyecto para enviar directo a la clienta.

## 3. Estado Actual
- Repo git activo; la app principal y Firebase/Firestore están operativos.
- La app muestra la rutina almacenada en Firestore y registra progreso, sesiones marcadas, solicitudes de video y datos de bienestar. No calcula ni envía progresión semanal desde el navegador.
- El correo semanal está retirado. Las funciones antiguas de correo fueron eliminadas del frontend.
- El 13 de octubre se restauró la actualización de cargas mediante un script independiente y un workflow manual, con control de semana, commit atómico y verificación. Se aplicó un solo avance a los cuatro días de la semana 2026-W42; el historial y la cantidad de series se conservaron.
- El 13 de octubre se incorporó a la página oficial la captura por ejercicio de series realmente realizadas y sensaciones, separada de los objetivos de la rutina. El generador adaptativo `reviewed-rp-v1` produce borradores para la semana siguiente a partir de estos datos; solo una decisión explícita de Hugo puede cambiar objetivos.
- Para las semanas siguientes se acordó un piloto supervisado de un mes inspirado en principios públicos de progresión, no en código propietario de RP. El workflow diario genera borradores, no aumentos. La revisión se hace por ejercicio, con confirmación de técnica, huella de datos y commit condicional. El workflow de la regla anterior queda solo para simulación.

## 4. Decisiones Clave
- `index.html` sigue siendo la página publicable autocontenida. La fuente se mantiene en `src/app.html` para poder revisar cambios y probarlos sin editar una línea JSON de gran tamaño.
- No existe una rutina automática de correo semanal; no recrearla salvo que se solicite expresamente.
- Los datos de rutina/progreso pertenecen a una persona real (la clienta) — tratar con cuidado si se expone, comparte o publica contenido del proyecto.

## 5. Próximos Pasos
- Verificar cualquier copia standalone descargable frente a `index.html` antes de distribuirla: no se genera automáticamente desde este repositorio.
- Sigue pendiente restringir la lectura anónima de Firestore y sacar la clave de Gemini del cliente. Esta decisión quedó fuera de la entrega solicitada.
- Antes del piloto, recopilar el feedback de Jessi y Hugo y confirmar rangos, unidades e incrementos disponibles por ejercicio. Ver `PROPUESTA_PROGRESION.md`.
