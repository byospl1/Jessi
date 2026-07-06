# Correo semanal de la Rutina de Jessi

Cada **lunes a las 00:00 (hora de México)** este proceso lee las rutinas desde
Firebase, calcula la progresión de la semana (la misma que aplica la app: +1
repetición; al pasar de 12 reps baja a 8 y sube el peso +5 kg / +10 lb / +1
nivel) y **envía un correo** con los cambios a tu email.

Corre solo, gratis, con **GitHub Actions** — no necesitas dejar ninguna
computadora encendida. No modifica la base de datos: solo lee y envía el resumen.

---

## Configuración (una sola vez)

### 1. Crear una App Password de Gmail
Para que el script pueda enviar correos desde tu Gmail necesitas una
"contraseña de aplicación" (no tu contraseña normal):

1. Activa la **verificación en 2 pasos** en tu cuenta de Google:
   https://myaccount.google.com/security
2. Entra a **App Passwords**: https://myaccount.google.com/apppasswords
3. Crea una nueva (nombre libre, ej. "Rutina Jessi").
4. Google te da **16 letras**. Cópialas (quita los espacios).

### 2. Guardar los secretos en GitHub
En tu repositorio `Jessi` → **Settings** → **Secrets and variables** →
**Actions** → botón **"New repository secret"**. Crea estos:

| Nombre del secret     | Valor                                             |
|-----------------------|---------------------------------------------------|
| `FIREBASE_API_KEY`    | La Web API Key de tu proyecto (empieza con `AIza`)|
| `GMAIL_USER`          | El Gmail que envía, ej. `tucorreo@gmail.com`      |
| `GMAIL_APP_PASSWORD`  | Las 16 letras del paso 1 (sin espacios)           |
| `TO_EMAIL`            | `lorenzohugo33@gmail.com`                          |

> La `FIREBASE_API_KEY` es la misma que usa la app (la encuentras en Firebase →
> Configuración del proyecto → Tus apps → Web API Key).

### 3. Activar GitHub Actions
Si es la primera vez, entra a la pestaña **Actions** del repo y acepta habilitar
los workflows.

---

## Probarlo ya (sin esperar al lunes)
1. Ve a la pestaña **Actions** → **"Correo semanal de Jessi"**.
2. Botón **"Run workflow"** → **Run**.
3. En un minuto revisa tu correo. Si algo falla, abre la ejecución y lee el log.

---

## Notas
- El horario del cron está en **UTC**. Como México es UTC-6, se usa
  `0 6 * * 1` (lunes 06:00 UTC = lunes 00:00 México). Si cambia el horario de
  verano o tu zona, ajusta la hora en `.github/workflows/weekly-email.yml`.
- Si una semana no hay cambios de progresión, **no se envía** correo.
- El correo es solo informativo (objetivos de la semana). La app sigue aplicando
  la progresión por su cuenta cuando la abres.
