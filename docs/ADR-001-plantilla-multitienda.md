# ADR-001: Plantilla multitienda (un repo por tienda y un proyecto Supabase por tienda)

## Contexto
El código de Manojitos se copió para crear EINA (einashopv.com). Antes de esto la marca estaba
escrita a mano en ~150 lugares. Hace falta montar tiendas nuevas rápido y sin mezclar datos.

## Decisión
- **Un solo código base, configurado por entorno.** La marca sale de `src/config/brand.ts`
  (variables `VITE_BRAND_*`) y las edge functions usan el secreto `BRAND_NAME`.
- **Un repo (o fork) por tienda** y **un proyecto Supabase por tienda**. No se usa un esquema
  multi-tenant con `store_id`.

## Consecuencias
### Positivas
- Datos 100 % aislados: un error de RLS no expone clientes de otra tienda.
- Cero cambios de esquema; las migraciones actuales sirven tal cual.
- Cada tienda escala, factura y se respalda por separado.

### Negativas
- Los arreglos hay que portarlos a cada repo (se mitiga con `git remote add plantilla` + merge).
- Cada proyecto Supabase tiene su propio costo.

### Alternativas consideradas
- **Multi-tenant (`store_id` en cada tabla + RLS por tienda):** un solo deploy, pero implica
  reescribir ~50 migraciones y toda la RLS, y un error filtra datos entre tiendas. Se descarta
  mientras haya pocas tiendas.
- **Monorepo con paquetes por tienda:** es más complejo que lo que hoy hace falta.

## Deuda de plantilla pendiente (ordenada por riesgo)
| # | Qué | Riesgo | Arreglo propuesto |
|---|-----|--------|-------------------|
| 1 | `.env` versionado apunta a la DB de Manojitos | **Alto**: EINA escribiría en la DB de Manojitos | Sacar `.env` de git, crear `.env.example` y poner las variables en Vercel |
| 2 | Migraciones cron (`20251228000153_*`, `20260715_setup_exchange_rate_cron`) con la URL y la anon key de Manojitos | **Alto**: los crons de EINA llamarían a Manojitos | Leer la URL y la clave desde `vault.decrypted_secrets` |
| 3 | `supabase/config.toml` con el `project_id` de Manojitos | Medio | Cambiarlo al conectar la DB nueva |
| 4 | Logo/favicon importados de rutas fijas (`@/assets/logo.jpeg`) | Bajo | Reemplazar los archivos (misma ruta) |
| 5 | Colores de marca en `src/index.css` y hex sueltos (`#D69729`) | Bajo | Tokens CSS en lugar de hex |
| 6 | Asistente "Ángela" fija (4 componentes + prompt de IA) | Bajo | `VITE_ASSISTANT_NAME` / secreto `ASSISTANT_NAME` |
| 7 | Textos legales asumen Venezuela + crédito | Negocio | Revisión legal por tienda |

## Estado
Aceptada. Fecha: 2026-09-24.
