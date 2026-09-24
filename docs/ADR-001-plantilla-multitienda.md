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

## Deuda de plantilla
| # | Qué | Estado |
|---|-----|--------|
| 1 | `.env` versionado apuntando a la DB de otra tienda | ✅ Fuera de git; `.env.example` + `npm run nueva-tienda` |
| 2 | Migraciones cron con la URL y la anon key de Manojitos | ✅ Leen `project_url` / `anon_key` del Vault |
| 3 | `supabase/config.toml` con el ref de Manojitos | ✅ Placeholder; se cambia al hacer `link` |
| 4 | Logos importados en 5 archivos | ✅ Centralizados en `src/config/brand-assets.ts` |
| 5 | Hex de marca sueltos | ✅ Recibo usa `--gold`/`--primary` |
| 6 | Asistente "Ángela" fija | ✅ `VITE_ASSISTANT_NAME` / secreto `ASSISTANT_NAME` |
| 7 | Manifest / robots / SW estáticos | ✅ Generados desde el `.env` (plugin Vite); el SW es genérico |
| 8 | Textos legales asumen Venezuela + crédito | ⏳ Negocio: revisión por tienda |

## Estado
Aceptada. Fecha: 2026-09-24.
