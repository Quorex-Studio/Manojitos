# Índice de Guías de Estudio — Manojitos

## 📚 Documentación Creada

| Archivo | ¿Qué cubre? | Prioridad |
|---------|------------|-----------|
| [ARQUITECTURA-COMPLETA.md](./ARQUITECTURA-COMPLETA.md) | Visión general del proyecto, stack, estructura, patrones, flujo de checkout, sistema de créditos, optimizaciones | 🔴 EMPEZAR AQUÍ |
| [GUIA-APPTSX.md](./GUIA-APPTSX.md) | Routing, lazy loading, protected routes, provider tree, ErrorBoundary | 🔴 |
| [GUIA-CARTCONTEXT.md](./GUIA-CARTCONTEXT.md) | Carrito de compras, useCallback, useMemo, localStorage, auth-aware | 🔴 |
| [GUIA-USEPRODUCTS-USESALES.md](./GUIA-USEPRODUCTS-USESALES.md) | TanStack Query, useQuery, useMutation, realtime, checkout transaccional | 🔴 |
| [GUIA-CHECKOUT.md](./GUIA-CHECKOUT.md) | Flujo de compra, validación de stock, formularios, dual pricing | 🟡 |
| [GUIA-PRODUCTCARD.md](./GUIA-PRODUCTCARD.md) | React.memo, animaciones, optimizaciones de rendimiento | 🟡 |
| [GUIA-STOREFRONT-CATALOG.md](./GUIA-STOREFRONT-CATALOG.md) | Homepage, catálogo, debounce, filtros, CSS animations | 🟡 |

## 🎯 Ruta de Estudio Recomendida

### Paso 1: Entender la arquitectura (30 min)
1. Lee `ARQUITECTURA-COMPLETA.md` — da la visión general de TODO
2. Entiende el stack tecnológico y la estructura de carpetas

### Paso 2: Entender el routing (20 min)
3. Lee `GUIA-APPTSX.md` — cómo se organizan las rutas
4. Entiende: lazy loading, Suspense, ProtectedRoute, Provider tree

### Paso 3: Entender el estado (30 min)
5. Lee `GUIA-CARTCONTEXT.md` — cómo funciona el carrito
6. Lee `GUIA-USEPRODUCTS-USESALES.md` — cómo se fetchean los datos
7. Entiende: useCallback, useMemo, TanStack Query, invalidación

### Paso 4: Entender el flujo principal (20 min)
8. Lee `GUIA-CHECKOUT.md` — cómo funciona la compra
9. Entiende: validación de stock, RPC transaccional

### Paso 5: Entender los componentes clave (20 min)
10. Lee `GUIA-PRODUCTCARD.md` — optimizaciones de rendimiento
11. Lee `GUIA-STOREFRONT-CATALOG.md` — debounce, filtros

## 💡 Conceptos MÁS IMPORTANTES para defender

### React (imprescindible)
- ¿Qué es un componente y por qué se re-renderiza?
- ¿Qué hace `React.memo` y cuándo usarlo?
- ¿Qué es Context API y por qué la usamos?
- ¿Qué es `useCallback` y `useMemo`?

### TypeScript
- ¿Qué es un tipo union (`string | null`)?
- ¿Qué es un generic (`<T>`)?
- ¿Por qué usamos strict mode?

### TanStack Query
- ¿Qué es `useQuery` y qué problema resuelve?
- ¿Qué es `queryKey`?
- ¿Qué es `invalidateQueries`?
- ¿Diferencia entre `useQuery` y `useMutation`?

### Supabase
- ¿Qué es Supabase y qué servicios nos da?
- ¿Qué es Realtime?
- ¿Qué es un RPC y por qué usamos `process_checkout` como RPC?

### Performance
- ¿Qué es code splitting y por qué lo implementamos?
- ¿Qué es debounce y dónde lo usamos?
- ¿Por qué las animaciones CSS son más eficientes que framer-motion para loops infinitos?

### Negocio
- ¿Cómo funciona el checkout transaccional?
- ¿Cómo funciona el sistema de créditos (trust score, restricciones)?
- ¿Qué métodos de pago ofrecemos?
- ¿Cómo funciona la tasa BCV?

## 📝 Preguntas Frecuentes de Examen

**P: ¿Por qué usaste TanStack Query en vez de fetch manual?**
R: Porque caché automático, deduplica requests, reintentos en errores de red, y invalidación de caché después de mutaciones. Con fetch manual tendríamos que implementar todo eso a mano.

**P: ¿Qué problema resuelve React.memo?**
R: Evita que un componente se re-renderice cuando sus props no han cambiado. Sin memo, agregar un producto al carrito causaría que TODAS las tarjetas se re-rendericen.

**P: ¿Por qué el checkout usa un RPC en vez de hacer las queries desde el cliente?**
R: Porque el RPC es transaccional — todo o nada. Si algo falla (stock insuficiente), hace rollback automático. Con queries del cliente podrías tener un estado inconsistente (venta creada pero stock no decrementado).

**P: ¿Qué es el debounce y por qué lo necesitabas?**
R: Retrasa la ejecución hasta que el usuario deja de escribir. Sin debounce, cada keystroke causaría un re-filter de todos los productos — lag perceptible al escribir rápido.

**P: ¿Cómo funciona la protección de rutas?**
R: Con componentes wrapper que verifican autenticación antes de renderizar los hijos. Si no está autenticado, redirige al login con la ruta original como parámetro para volver después.

**P: ¿Qué es code splitting?**
R: Dividir el bundle de JavaScript en chunks separados. Cada página se descarga solo cuando el usuario navega a ella. Sin esto, TODA la app (31 páginas) se descargaría de una vez.
