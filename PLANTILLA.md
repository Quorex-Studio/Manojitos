# 🛍️ Plantilla de tienda: guía para montar una tienda nueva

Esta plataforma (e-commerce, portal de clientes, ERP/CRM y asistente IA) es **una plantilla**.
Cada tienda que se venda usa **el mismo código**, con su propio `.env`, sus logos y su proyecto Supabase.
No hay que tocar el código. Decisión de arquitectura: [`docs/ADR-001`](docs/ADR-001-plantilla-multitienda.md).

---

## Resumen (≈30 min por tienda)

| Paso | Qué | Dónde |
|---|---|---|
| 1 | Crear repo de la tienda desde esta plantilla | GitHub |
| 2 | `npm install && npm run nueva-tienda` | Terminal (genera `.env`) |
| 3 | Reemplazar logos | `src/assets/`, `public/` |
| 4 | (Opcional) Colores | `src/index.css` |
| 5 | Crear proyecto Supabase y preparar Vault | Supabase |
| 6 | Aplicar migraciones, secretos y edge functions | Supabase CLI |
| 7 | Deploy y dominio | Vercel |

---

## 1. Crear el repo
En GitHub: **Use this template** (activarlo en Settings → *Template repository*) o hacer fork.
Para traer arreglos de la plantilla más adelante:
```bash
git remote add plantilla https://github.com/Quorex-Studio/EinaShopV.git
git fetch plantilla && git merge plantilla/main
```

## 2. Configurar la marca
```bash
npm install
npm run nueva-tienda
```
El asistente pregunta nombre, dominio, correos, Instagram, nombre de la asistente IA, GTM y
datos de Supabase, y genera el `.env`. El `.env` **no se sube a git**: cada tienda tiene el suyo.
Todas las variables están documentadas en [`.env.example`](.env.example).

Qué se configura solo a partir del `.env`:
- Nombre en toda la app, textos legales, FAQ, recibos PDF, reportes Excel y notificaciones → `src/config/brand.ts`
- `<title>`, SEO, canonical y Open Graph → `index.html` (`%VITE_BRAND_*%`)
- `site.webmanifest` y `robots.txt` → los genera `scripts/vite-brand-files.ts`
- Claves de localStorage con prefijo propio, para que no se mezclen carritos entre tiendas
- Google Tag Manager propio (o ninguno)

## 3. Logos e imágenes
Reemplaza estos archivos **con el mismo nombre**:

| Archivo | Uso |
|---|---|
| `src/assets/logo.jpeg` | Logo en el header, el sidebar y el login |
| `src/assets/stitch-rosa-mascot.png` | Avatar de la asistente IA |
| `public/logo.jpeg` | Imagen al compartir en redes (og:image) |
| `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png` | Iconos |

Si quieres otras rutas o formatos, cámbialas en un solo lugar: `src/config/brand-assets.ts`.
Para generar los favicons desde el logo: `python generate_icons.py`.

## 4. Colores (opcional)
La paleta está en `src/index.css`: variables `--primary` (rosa) y `--gold` (dorado) en `:root`
(modo claro) y `.dark`. Están en formato HSL (`345 55% 62%`). El color de la barra del navegador
sale de `VITE_BRAND_THEME_COLOR`.

## 5. Supabase: proyecto nuevo
1. Crea el proyecto y copia la **Project URL** y la **anon key** al `.env`.
2. `supabase/config.toml` → `project_id = "<ref>"`, luego `supabase link --project-ref <ref>`.
3. **Vault** (lo usan las tareas programadas; sin esto los crons no saben a qué URL llamar).
   En el SQL Editor:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<anon key>', 'anon_key');
   ```

## 6. Migraciones, secretos y funciones
```bash
supabase db push                       # aplica supabase/migrations en orden
supabase secrets set \
  BRAND_NAME="Mi Tienda" ASSISTANT_NAME="Ángela" \
  VAPID_CONTACT_EMAIL="admin@midominio.com" VAPID_PRIVATE_KEY="..." VITE_VAPID_PUBLIC_KEY="..." \
  RESEND_API_KEY="..." RESEND_FROM_EMAIL="Mi Tienda <no-reply@midominio.com>"
  # + las claves de IA que usa ai-assistant
supabase functions deploy
BRAND_NAME="Mi Tienda" SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> \
  node supabase/emails/update_templates.js   # emails de Auth con la marca
```
Claves VAPID para notificaciones push: `npx web-push generate-vapid-keys`.
Después, crea el primer usuario admin desde Auth y ejecuta los *advisors* de seguridad en el dashboard.

## 7. Vercel
1. Importa el repo y en **Settings → Environment Variables** pega el contenido del `.env`.
2. **Settings → Domains** → agrega el dominio de la tienda.
3. En Supabase → Auth → URL Configuration, pon el dominio como *Site URL* y en *Redirect URLs*.

---

## ✅ Checklist antes de entregar
- [ ] `grep -rniE "manojitos|einashopv" src public index.html` no muestra nada propio de otra tienda
- [ ] Título, logo y favicon correctos en el navegador
- [ ] Login y registro funcionan, y el email de confirmación sale con la marca
- [ ] Compra de prueba de punta a punta; aparece en el panel admin
- [ ] Notificaciones push y chat con la asistente funcionan
- [ ] Textos legales (Términos, Privacidad, Envíos) revisados por el cliente
- [ ] Tasa BCV se actualiza (cron `invoke-get-bcv-rate`)

## ⚠️ Límites conocidos
- Los **textos legales, métodos de pago y la moneda** asumen Venezuela (Bs, pago móvil, tasa BCV)
  y venta a crédito. Para otro país hay que adaptar el negocio, no solo la marca.
- Un arreglo en la plantilla se lleva a cada tienda con `git merge plantilla/main`.
