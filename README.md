# Jessi — Rutina de gimnasio

App web de rutinas de gimnasio para una clienta real de coaching de Hugo ("Jessi"): la clienta ve y sigue su rutina desde el navegador con progresión automática de peso/repeticiones. Todo el frontend vive en un único `index.html` (sin build step), con Firebase/Firestore como backend y publicación en GitHub Pages. La rutina ya no envía correos semanales. Ver `CONTEXT.md` para el estado del proyecto.

## Prerrequisitos

- Un navegador moderno (para abrir la app).
- Un servidor HTTP estático simple para servir `index.html` localmente (por ejemplo `python3`, ya viene en macOS, o `npx serve`). Firebase no funciona correctamente abriendo el archivo directo con `file://`.
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

## Estructura del repo

```
Jessi/
├─ index.html              # app principal (frontend monolítico, sin build)
├─ seed.html / seed.mjs     # utilidades para sembrar datos iniciales en Firestore
├─ CONTEXT.md               # estado y decisiones del proyecto
└─ NOTAS.md                 # decisiones internas de coaching
```

## Notas

- Los datos de rutina/progreso pertenecen a una persona real (la clienta) — tratar con cuidado si se expone, comparte o publica contenido del proyecto.
- No hay pipeline de build para `index.html`; cualquier cambio se prueba directamente ahí.
- La progresión se aplica desde la app cuando Jessi la abre; no hay automatización de correo semanal.
