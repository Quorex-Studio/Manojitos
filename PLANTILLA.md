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
| 6 | Migraciones, funciones, secretos y primer admin | Supabase CLI + SQL |
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
3. **Vault**: lo usan las tareas programadas para saber a qué URL llamar.
   En el SQL Editor:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<anon key>', 'anon_key');
   ```
   (El secreto `cron_secret` del cron de alertas lo genera sola la migración `20260924000100_cron_secret`.)

## 6. Migraciones, funciones, secretos y admin
```bash
supabase db push            # aplica supabase/migrations en orden (incluye reconciliación y hardening)
supabase functions deploy   # las 8 funciones (verify_jwt según config.toml)
```

**Secretos de las edge functions** (Dashboard → Edge Functions → Secrets, o `supabase secrets set`):

| Secreto | Para qué | ¿Obligatorio? |
|---|---|---|
| `BRAND_NAME`, `ASSISTANT_NAME` | Nombre en correos, push y en la asistente IA | Recomendado |
| `BRAND_WHATSAPP`, `STORE_HOURS` | Contacto y horario que da la asistente | Opcional |
| `GEMINI_API_KEY` | Respuestas con IA (sin esto la asistente usa respuestas predefinidas) | Opcional |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Correos de recibo, KYC y recordatorios de crédito | Para correos |
| `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_CONTACT_EMAIL` | Notificaciones push (`npx web-push generate-vapid-keys`) | Para push |

**Primer admin**: regístrate en la tienda con el correo del dueño y luego, en el SQL Editor:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'::jsonb
WHERE email = 'correo-del-dueño@dominio.com';
```
Cierra sesión y vuelve a entrar para que el panel admin aparezca.

**Emails de Auth con la marca** (opcional):
`BRAND_NAME="Mi Tienda" SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> node supabase/emails/update_templates.js`

Luego revisa **Advisors → Security** en el dashboard.

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
