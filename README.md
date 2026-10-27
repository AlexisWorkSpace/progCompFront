# progCompFront

Interfaz React + Vite para Tecla-Ton. Los participantes registran datos académicos y crean/unen equipos; el ranking y los puntajes son compartidos por equipo. El frontend consume la Edge Function de Supabase.

## Despliegue en Vercel

1. Importa `AlexisWorkSpace/progCompFront` en Vercel.
2. Deja **Root Directory** en `.`.
3. Usa **Build Command** `npm run build` y **Output Directory** `dist`.
4. En las variables de entorno de producción define `VITE_SUPABASE_URL` (Project URL de Supabase) y `VITE_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_…`). Elimina `VITE_API_URL` si quedó de una configuración anterior. Solo la Publishable key puede estar en el navegador; nunca pongas `sb_secret_…` aquí.
5. Despliega de nuevo después de añadir o cambiar la variable. Vite incorpora las variables `VITE_*` durante la compilación.

`vercel.json` reescribe las rutas de la aplicación al punto de entrada para que funcionen las rutas de cliente.

Configura `FRONTEND_ORIGIN` en los secretos de la función Supabase con el origen exacto de este frontend, por ejemplo `https://prog-comp-front.vercel.app`. Agrega los dominios de producción adicionales separados por coma; no incluyas una barra final.

## Desarrollo

Instala dependencias con `npm ci` y ejecuta `npm run dev` desde `frontend`. Crea `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto que usarás. La clave secreta nunca se coloca aquí.
