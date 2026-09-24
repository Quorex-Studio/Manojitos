---
name: nueva-tienda
description: Crear o rebrandear una tienda a partir de esta plantilla (EINA). Úsalo cuando el usuario pida "copiar la tienda para X", "vender la plataforma a un cliente", "cambiar la marca", "nueva tienda", "conectar la base de datos de la tienda" o cambiar el dominio, los correos, el logo, los colores o el nombre de la asistente.
---

# Nueva tienda desde la plantilla

Guía humana completa: `PLANTILLA.md`. Arquitectura: `docs/ADR-001-plantilla-multitienda.md`
(un repo y un proyecto Supabase por tienda).

## Dónde vive cada cosa (no se escribe la marca a mano en ningún otro lado)
| Qué | Archivo |
|---|---|
| Nombre, dominio, correos, Instagram, asistente IA, prefijo de localStorage | `src/config/brand.ts` ← `.env` (`VITE_BRAND_*`, `VITE_ASSISTANT_NAME`) |
| Logos / mascota | `src/config/brand-assets.ts` (reemplazar archivos en `src/assets/` y `public/`) |
| `<title>`, SEO, GTM | `index.html` con `%VITE_*%` |
| Manifest y robots.txt | los genera `scripts/vite-brand-files.ts` (no existen en `public/`) |
| Colores | `src/index.css` (`--primary`, `--gold`, en `:root` y `.dark`) |
| Edge functions | secretos `BRAND_NAME`, `ASSISTANT_NAME`, `VAPID_CONTACT_EMAIL`, `RESEND_FROM_EMAIL` |
| Crons | leen `project_url` y `anon_key` del Vault de Supabase |

## Flujo
1. Datos del cliente: nombre, dominio, correos, Instagram, nombre de la asistente, logos,
   GTM y Supabase. Si falta algo se usa el valor por defecto y se avisa. No hay que bloquearse.
2. `.env`: `npm run nueva-tienda` (acepta respuestas por pipe) o se copia `.env.example`.
   El `.env` está en `.gitignore`: **nunca** se hace commit.
3. Logos: se reemplazan con el mismo nombre y se corre `python generate_icons.py` para los favicons.
4. Supabase (MCP: `get_project_url`, `get_publishable_keys`):
   - `supabase/config.toml` → `project_id`.
   - Vault **antes** de las migraciones: `vault.create_secret(url,'project_url')` y
     `vault.create_secret(anon,'anon_key')`.
   - Aplicar migraciones en orden → `get_advisors` (security) → secretos → desplegar funciones.
   - `BRAND_NAME=… SUPABASE_PROJECT_REF=… node supabase/emails/update_templates.js`.
5. Vercel: las mismas variables del `.env`, el dominio, y el Site URL en Supabase Auth.

## Verificación obligatoria antes de push
```bash
grep -rniE "manojitos|utfoempgdbhhikpvbvir" --exclude-dir={node_modules,.git,dist,docs,.agents,.claude} . | grep -v "\.md:"   # vacío
git ls-files .env                                       # vacío (no versionado)
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "^src"   # no sube respecto a main (hoy hay 130 errores heredados)
npx vite build && grep -o "<title>[^<]*</title>" dist/index.html && cat dist/site.webmanifest
```

## Reglas para código nuevo
- Texto con la marca → `BRAND_NAME` / `BRAND.*` desde `@/config/brand`.
- Imagen de marca → `@/config/brand-assets`.
- localStorage → `storageKey('x')`.
- Colores → `hsl(var(--primary))` / `hsl(var(--gold))`. No se usan hex.
- URL del proyecto en SQL → Vault. No se usa la URL literal.
