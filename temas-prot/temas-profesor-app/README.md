# Temas del profesor

Aplicación con backend real (Node/Express) y autenticación de verdad (contraseña con
hash + sesión con token JWT). Solo quien tenga la contraseña del profesor puede
agregar, editar o borrar temas; cualquiera puede verlos.

## Estructura

```
temas-profesor-app/
  backend/     API en Express (auth, temas, subida de imágenes)
  frontend/    Interfaz en React (Vite)
```

## Cómo correrlo en tu computadora

Necesitas [Node.js](https://nodejs.org) instalado (versión 18 o más reciente).

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Esto levanta la API en `http://localhost:4000`. La primera vez no hay contraseña
configurada: se crea la primera vez que alguien use "Entrar como profesor" en la
página. Los datos se guardan en `backend/data/topics.json` y las imágenes subidas en
`backend/uploads/`.

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador. El frontend habla con el backend a
través de un proxy configurado en `vite.config.js`, así que ambos deben estar
corriendo al mismo tiempo.

## Primer uso

1. Abre la página. Cualquiera puede ver los temas (al inicio, ninguno).
2. Da clic en "Entrar como profesor". Como todavía no existe contraseña, se te pedirá
   crear una (mínimo 6 caracteres). Se guarda en el servidor con hash (bcrypt), nunca
   en texto plano.
3. Ya dentro, puedes agregar temas, poner categoría, descripción e imagen (por enlace
   o subiendo un archivo), editar o borrar.
4. Los alumnos que abran la misma URL ven los temas actualizados pero no ven los
   botones de editar/borrar.

## Cómo publicarlo para que los alumnos lo usen desde internet

Para que no dependa de tu computadora, puedes desplegarlo en servicios gratuitos o de
bajo costo, por ejemplo:

- **Backend**: Render, Railway o Fly.io (sube la carpeta `backend/`).
- **Frontend**: Vercel o Netlify (sube la carpeta `frontend/`, configurando la
  variable de entorno o el proxy para que apunte a la URL pública del backend en vez
  de `localhost:4000`).

Si quieres, puedo ayudarte a preparar esa configuración específica según el servicio
que elijas.

## Notas de seguridad

- La contraseña se guarda con `bcrypt` (hash), no en texto plano.
- La sesión usa un JWT firmado con una clave generada aleatoriamente en
  `backend/data/secret.txt` la primera vez que corre el servidor. No borres ese
  archivo o se invalidarán las sesiones activas.
- Este proyecto es una base sólida para un salón de clases, pero si lo vas a usar con
  muchos grupos o datos sensibles, conviene migrar de archivos JSON a una base de
  datos real (por ejemplo PostgreSQL) y añadir límites de intentos de login.
