# progCompFront

Interfaz React + Vite para Tecla-Ton. El frontend se despliega en Vercel y consume el backend HTTP configurado en `VITE_API_URL`.

## Despliegue en Vercel

1. Importa `AlexisWorkSpace/progCompFront` en Vercel.
2. Deja **Root Directory** en `.`.
3. Usa **Build Command** `npm run build` y **Output Directory** `dist`.
4. En las variables de entorno de producción define `VITE_API_URL` como la URL HTTPS pública del backend, sin barra final ni `/api`; por ejemplo `https://api.example.com`.
5. Despliega de nuevo después de añadir o cambiar la variable. Vite incorpora las variables `VITE_*` durante la compilación.

`vercel.json` reescribe las rutas de la aplicación al punto de entrada para que funcionen las rutas de cliente. Para desarrollo local, Vite conserva el proxy `/api` hacia `http://localhost:3001`.

Configura también `CORS_ORIGIN` en el backend con el origen exacto de este frontend, por ejemplo `https://prog-comp-front.vercel.app`. Agrega por separado el dominio personalizado, si existe. No incluyas una barra al final.

## Desarrollo

Instala dependencias con `npm ci` y ejecuta `npm run dev`. Si no se configura `VITE_API_URL`, la aplicación usa el proxy local `/api`.
