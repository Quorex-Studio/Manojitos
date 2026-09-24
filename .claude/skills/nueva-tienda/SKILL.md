---
name: nueva-tienda
description: Crear o rebrandear una tienda a partir de esta plantilla (EINA/Manojitos). Úsalo cuando el usuario pida "copiar la tienda para X", "cambiar la marca", "nueva tienda", "conectar la base de datos de la nueva tienda" o cambiar el dominio, los correos, el logo o el nombre de la asistente.
---

# Nueva tienda desde la plantilla

Arquitectura: un repo y un proyecto Supabase por tienda. Ver `docs/ADR-001-plantilla-multitienda.md`.
La marca **nunca** se escribe a mano: todo sale de `src/config/brand.ts`.

## 1. Datos que hay que pedirle al usuario
Nombre, dominio, correo de contacto y de soporte, Instagram, ID de GTM (opcional), logo y
favicons, y la URL y la anon key de Supabase. Si falta alguno, se usa el valor por defecto y se
avisa al usuario. No hay que bloquearse por eso.

## 2. Frontend (solo variables de entorno)
En `.env` (local) y en Vercel → Environment Variables:
```
VITE_BRAND_NAME, VITE_BRAND_DOMAIN, VITE_BRAND_CONTACT_EMAIL, VITE_BRAND_SUPPORT_EMAIL,
VITE_BRAND_INSTAGRAM, VITE_BRAND_STORAGE_KEY, VITE_GTM_ID
```
Además hay que editar a mano, porque son archivos estáticos que no leen el entorno:
- `public/site.webmanifest` (name, short_name)
- `public/sw.js` (CACHE_NAME y títulos)
- `public/robots.txt` (Host)
- Logos: `src/assets/logo.jpeg`, `public/logo.jpeg` y los favicons en `public/`. Se reemplaza
  el archivo **en la misma ruta**.

## 3. Base de datos (proyecto Supabase nuevo)
1. `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_PROJECT_ID`.
   Sacar los valores con `get_project_url` y `get_publishable_keys` del MCP de Supabase.
2. `supabase/config.toml` → `project_id`.
3. **Antes de aplicar migraciones**, busca la ref vieja:
   `grep -rn "supabase.co/functions" supabase/migrations`. Si una migración cron trae la URL
   o la anon key de otra tienda, corrígela. No hay que aplicarla tal cual.
4. Aplica las migraciones en orden y ejecuta `get_advisors` (security).
5. Secretos de las edge functions: `BRAND_NAME`, `VAPID_CONTACT_EMAIL`, `RESEND_FROM_EMAIL`,
   `VAPID_PRIVATE_KEY`, las claves de IA y de Resend. Despliega las funciones.
6. Plantillas de email de Auth:
   `BRAND_NAME=X SUPABASE_PROJECT_REF=ref node supabase/emails/update_templates.js`

## 4. Verificación (obligatoria antes de push)
```bash
grep -rniE "manojitos|utfoempgdbhhikpvbvir" --exclude-dir={node_modules,.git,dist,docs} . \
  | grep -v "\.md:"            # debe salir vacío (salvo migraciones históricas ya revisadas)
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "^src"   # no debe subir respecto a main
npx vite build && grep -o "<title>[^<]*</title>" dist/index.html
```

## Reglas
- Código nuevo con marca → importa desde `@/config/brand`. No se escribe el nombre literal.
- Claves de localStorage → `storageKey('x')`, así no se mezclan los carritos entre tiendas.
- No se publica en Vercel mientras `.env` apunte a la DB de otra tienda.
