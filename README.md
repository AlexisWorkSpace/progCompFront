# progCompFront

Interfaz React + Vite para Tecla-Ton. El frontend se despliega en Vercel y consume la Edge Function de Supabase.

## Despliegue en Vercel

1. Importa `AlexisWorkSpace/progCompFront` en Vercel.
2. Deja **Root Directory** en `.`.
3. Usa **Build Command** `npm run build` y **Output Directory** `dist`.
4. En las variables de entorno de producción define `VITE_SUPABASE_URL` (Project URL de Supabase) y `VITE_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_…`). Elimina `VITE_API_URL` si quedó de una configuración anterior. Solo la Publishable key puede estar en el navegador; nunca pongas `sb_secret_…` aquí.
5. Despliega de nuevo después de añadir o cambiar la variable. Vite incorpora las variables `VITE_*` durante la compilación.

`vercel.json` reescribe las rutas de la aplicación al punto de entrada para que funcionen las rutas de cliente. Para desarrollo local, Vite conserva el proxy `/api` hacia `http://localhost:3001`.

Configura `FRONTEND_ORIGIN` en los secretos de la función Supabase con el origen exacto de este frontend, por ejemplo `https://prog-comp-front.vercel.app`. Agrega los dominios de producción adicionales separados por coma; no incluyas una barra final.

## Desarrollo

Instala dependencias con `npm ci` y ejecuta `npm run dev`. Para trabajar contra el backend Express local, crea `.env.local` con `VITE_API_URL=http://localhost:3001`. Para usar una función local de Supabase, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` correspondientes a ese proyecto.
