# Patrones resueltos (reutilizar, no reinventar)

## Contenido
1. Estructura del panel
2. Encabezado de página
3. KPIs
4. Listas y tablas
5. Pestañas de sección
6. Filtros y chips
7. Tienda: barra inferior, tarjeta de producto, favoritos
8. Diálogos y confirmaciones
9. Marca y logo

## 1. Estructura del panel
- `src/components/layout/adminNav.ts`: única fuente del menú (secciones "Día a día",
  "Gestión", "Sistema"), `ADMIN_TABS` (las 4 de la barra inferior) y `adminPageTitle()`.
  Para agregar una pantalla: añádela aquí y en `App.tsx`; aparece en barra lateral, hoja "Más"
  y título móvil a la vez.
- `AppSidebar` (md+): etiquetas visibles, colapsable con botón (se guarda en localStorage),
  tooltips si está colapsada, `sticky top-0 h-screen`. No usar hover para expandir: mueve el
  contenido.
- `AdminMobileNav` (<md): barra superior (isotipo, título, asistente, avisos) + barra inferior
  con `.mobile-tabbar` (la variable `--mobile-tabbar` eleva cualquier flotante).
- `AppLayout` deja `pb` para la barra inferior en móvil y `md:pb-24` para el botón flotante.

## 2. Encabezado de página
```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="page-header">Productos</h1>          {/* oculto en móvil */}
    <p className="page-subtitle">8 productos registrados</p>
  </div>
  <Button className="h-11 w-full rounded-full sm:w-auto">Nuevo producto</Button>
</div>
```
No añadas clases de display (`flex`) al `h1`: anulan el `hidden` de `.page-header`.

## 3. KPIs
`<StatCard title value subtitle tertiaryText icon href />` (`src/components/ui/stat-card.tsx`):
detalle siempre visible, `href` con filtro (`/products?stock=bajo`). Rejilla:
`grid grid-cols-2 lg:grid-cols-… gap-3 md:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2`.

## 4. Listas y tablas
- Menos de ~5 columnas o datos para decidir rápido → lista de filas en móvil (`md:hidden`) y
  tabla en escritorio (`hidden md:block`). Ejemplo: `Reports.tsx`.
- Tabla con lógica pesada dentro de cada fila → convertir filas en tarjetas solo con clases:
  `TableHeader hidden md:table-header-group`, `TableRow grid … md:table-row`,
  `TableCell p-0 md:table-cell`. Ejemplo: `Customers.tsx`.
- Tarjetas de producto del panel: fila compacta (miniatura 80 px) en móvil, tarjeta en `sm+`,
  acciones **siempre visibles**. Ejemplo: `Products.tsx`.

## 5. Pestañas de sección
`<TabsList className="admin-tabs">` con `TabsTrigger` sin clases propias. Contadores como
`<span>` en línea (los absolutos se recortan al deslizar). La pestaña activa en la URL
(`?tab=`) si otra pantalla necesita abrirla.

## 6. Filtros y chips
- Estado en la URL con un helper `setParam(key, value)` que usa
  `setSearchParams(prev => …, { replace: true })`.
- Chips: `h-9 rounded-full border px-4`, activo `border-primary bg-primary
  text-primary-foreground`, `aria-pressed`. Contenedor `-mx-4 flex overflow-x-auto px-4
  scrollbar-hide md:mx-0 md:px-0`.
- Búsqueda: ícono con `pointer-events-none`; nunca `backdrop-blur` en el input (tapa el ícono).
- Reglas de negocio compartidas en `src/lib` (p. ej. `needsRestock()` en `src/lib/stock.ts`)
  para que el KPI y la lista cuenten lo mismo.

## 7. Tienda
- `MobileTabBar`, `ProductCard` (4:5, nombre y precio visibles, corazón arriba-der, agregar
  abajo-der), `FavoriteButton` (sin sesión: toast con "Entrar" y `?redirect=`), barra de
  compra fija en la ficha con `useInView`.
- Catálogo con la URL como fuente de verdad (`?search=&category=a,b&sort=`).

## 8. Diálogos y confirmaciones
`AlertDialog` en vez de `confirm()`: título con la acción, descripción con la consecuencia,
botón destructivo con `bg-destructive`. Formularios largos en `Dialog` con
`max-h-[90vh] overflow-y-auto`.

## 9. Marca y logo
`<BrandLogo variant="logotipo|shop|isotipo" onDark />`; nunca `<img>` suelto ni texto con
degradado. Colores de marca para PDF/recibos: `BRAND.color` y `BRAND_COLOR_RGB`.
