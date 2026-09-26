---
version: 2
name: EINA-beauty
description: |
  Tienda de maquillaje, skincare y accesorios importados (Isla de Margarita) con venta a crédito.
  Sistema "la foto manda" sobre la identidad EINA: vino como único acento de acción, nude para
  detalles, crema para superficies cálidas y el oscuro de marca como texto y base del modo oscuro.
  Motivo gráfico: la estrella de cuatro puntas con cola. Referencias: disciplina retail de Nike
  y calidez redondeada de Airbnb (getdesign.md).

colors:
  wine: "#78293c"           # primario en claro: CTA, estado activo, marca
  nude: "#e1ae9d"           # detalles; primario en modo oscuro (texto oscuro encima)
  cream: "#f4e7d7"          # superficies secundarias, texto sobre vino
  dark: "#252024"           # texto (claro) · tarjetas (oscuro)
  canvas: "#fcf8f3"         # fondo de página en claro
  canvas-dark: "#181517"    # fondo de página en oscuro
  studio: "#f5ebe0"         # fondo de la foto de producto (oscuro: #2a2629)
  copper: "#9b5a3f"         # token "gold": avisos y pendientes (AA sobre blanco)
  sale: "#bf2626"           # SOLO precio en oferta / agotado
  success: "#1d7249"        # en stock, pedido confirmado

typography:
  display: { fontFamily: "Constantia, Crimson Pro, Georgia, serif", weight: 500, size: "40–64px", lineHeight: 1.05 }
  heading: { fontFamily: "Constantia, Crimson Pro, Georgia, serif", weight: 500, size: "24–32px", lineHeight: 1.2 }
  body:    { fontFamily: "Source Sans 3", weight: 400, size: 15px, lineHeight: 1.55 }
  label:   { fontFamily: "Source Sans 3", weight: 600, size: 12px, letterSpacing: 0.08em, textTransform: uppercase }
  price:   { fontFamily: "Source Sans 3", weight: 700, size: 16px, fontVariant: tabular-nums }

rounded: { card-image: 16px, panel: 20px, pill: 9999px }
spacing: { base: 8px, card-gap: 16px, section: 64px (desktop) / 40px (móvil), tabbar: 64px }
elevation: { none: "0", hover: "0 8px 24px -12px rgb(37 32 36 / .18)" }
---

## Principios

1. **La foto es la tarjeta.** El producto va a sangre (`object-cover`, 4:5) sobre `studio`.
   Sin bordes, sin sombras en reposo. El nombre y el precio van **siempre visibles** debajo.
2. **Un acento, una acción.** El vino `primary` (nude en modo oscuro) es para la acción principal de cada vista
   (Agregar, Pagar, Registrarse) y para estados activos. Nunca como fondo decorativo.
3. **Nude = detalle, no bloque.** Estrella de marca, etiquetas y líneas finas. Bloques de
   marca (footer, crédito) en vino con texto crema.
4. **Rojo solo para dinero en riesgo.** Precio en oferta y "Agotado". Nada más.
5. **Pastillas para acciones.** Todo botón es `pill` (o círculo para íconos). Altura mínima
   44px en móvil (objetivo táctil).
6. **Sin brillos.** Nada de glow, shimmer, text-shadow ni gradientes en texto o botones.
   El movimiento es corto (≤250ms) y respeta `prefers-reduced-motion`.
7. **Precio doble, jerarquía clara.** USD en `foreground` (price), Bs debajo en `muted`. Si no hay
   tasa, se oculta el Bs (nunca "0,00 Bs").
8. **Logo intocable.** Siempre `<BrandLogo />` (PNG oficial: vino en claro, crema en oscuro).
   Nunca estirar, recolorear ni aplicar degradados.
9. **Móvil primero.** Barra inferior (Inicio, Tienda, Carrito, Favoritos, Cuenta) en < 768px;
   el header móvil solo lleva logo, búsqueda, moneda y menú. La ficha de producto muestra una
   barra de compra fija cuando el botón principal sale de pantalla.

## Componentes

- **ProductCard**: imagen 4:5 `rounded-card-image` sobre `studio`; una etiqueta máx. arriba-izq
  (Más vendido > Nuevo; "Quedan N" va en texto junto a la categoría); corazón de favoritos
  44px arriba-der; botón circular 44px abajo-der para agregar (o "Elegir talla" → ficha). Debajo: categoría (`label`, muted) · nombre (body 600, 2 líneas) ·
  precio. Hover: la imagen escala 1.03; nada más.
- **Botón primario**: pill `primary`, texto `primary-foreground` 600, h-12 (móvil) / h-11 (desktop).
- **Botón secundario**: pill `card` con borde `border`, texto `foreground`.
- **Chips de categoría**: pill h-10; activo = `primary`; inactivo = `card` + borde; `aria-pressed`.
- **Hero**: texto a la izquierda + collage de 2–3 productos reales a la derecha (móvil: foto
  arriba, texto abajo). Un solo CTA primario + un enlace secundario.
- **Estado vacío**: ícono lineal 48px en círculo `studio`, título heading, 1 línea muted,
  1 CTA primario.

## Qué no hacer

- No usar `bg-gold` en botones ni `btn-shimmer`. `text-gradient-gold` hoy es texto sólido `primary`.
- No ocultar nombre/precio del producto detrás de un hover.
- No usar colores Tailwind sueltos (`pink-*`, `amber-*`): siempre tokens.
- No bajar `text-muted-foreground` con opacidad (`/40`) en texto: rompe el contraste AA.
- No usar clases Tailwind inexistentes (p. ej. `h-8.5`): el control colapsa.

---

# Registro de mejoras del front (checklist para portar a Manojitos)

Todo lo que se mejoró en EINA, agrupado por área. Cada punto dice **qué** cambió, **por qué**
y **dónde** está en el código, para replicarlo en Manojitos (misma base de código). Lo que es
propio de la marca EINA (colores vino/nude/crema, logos, textos de belleza) va marcado
**[marca]**: en Manojitos se reemplaza por su propia identidad; todo lo demás aplica tal cual.

## 1. Bugs que bloqueaban a clientes (portar primero)

| # | Problema | Causa | Arreglo | Archivo |
|---|----------|-------|---------|---------|
| 1 | `/cliente/auth` se rompía al cargar: nadie podía registrarse ni entrar | un `useEffect` usaba `handleGetLocationClick` antes de declararlo (TDZ) | mover el `useEffect` debajo del `useCallback` | `src/pages/CustomerAuth.tsx` |
| 2 | El carrito se vaciaba al recargar la página | el efecto de guardado escribía `[]` antes de que `getSession()` cargara el carrito | bandera `loaded`: no guardar hasta cargar; estado inicial = carrito invitado | `src/contexts/CartContext.tsx` |
| 3 | El carrito desaparecía al iniciar sesión para pagar | el carrito de invitado y el de la cuenta eran claves distintas | al iniciar sesión se **fusiona** el de invitado en la cuenta y se borra el de invitado; `useRef` para no recargar dos veces | `src/contexts/CartContext.tsx` |
| 4 | Visitantes veían "0,00 Bs" | `exchange_rates` solo era legible con sesión | política RLS de lectura pública (migración `20260924000200_public_exchange_rates_read`) + `PriceDisplay` oculta Bs si la tasa es 0 | BD + `src/components/ui/PriceDisplay.tsx` |
| 5 | La búsqueda del catálogo se borraba al escribir | dos efectos URL↔estado se pisaban en cada tecla | la **URL es la única fuente de verdad** (`?search=&category=a,b&sort=`); el input tiene estado local con debounce 300 ms que escribe en la URL | `src/pages/StoreCatalog.tsx` |
| 6 | No se podían combinar categorías | la URL guardaba solo la primera y el efecto revertía la segunda | `category` separado por comas | `src/pages/StoreCatalog.tsx` |
| 7 | "Destacados" del header mostraba 0 productos | filtraba por una categoría inexistente `destacados` | enlace a `/tienda?sort=popular` ("Más vendidos") | `src/components/store/StoreHeader.tsx` |
| 8 | No se podía buscar "FPS 50", "30ml" | el input borraba todo lo que no fuera letra | solo se limita a 60 caracteres; búsqueda sin acentos (`normalize('NFD')`) y por palabras | `StoreCatalog.tsx`, `StoreHeader.tsx` |
| 9 | Después de iniciar sesión siempre iba al inicio | header y menú mandaban `state.from`, pero el login lee `?redirect=` | todos los accesos usan `/cliente/auth?redirect=<ruta actual>` | `StoreHeader.tsx`, `ui/user-menu.tsx`, `MobileTabBar.tsx` |
| 10 | Riesgo de bucle / redirección externa en login | `redirect` sin validar | solo rutas que empiezan con `/`, nunca `//` ni `/cliente/auth` | `src/pages/CustomerAuth.tsx` |
| 11 | La pestaña "Favoritos" existía pero no había cómo agregar favoritos | faltaba el botón | componente `FavoriteButton` (ver §4) | `src/components/store/FavoriteButton.tsx` |
| 12 | Botón de agregar de la tarjeta colapsado | clase inexistente `h-8.5` | reescritura de `ProductCard`; en Tailwind se añadieron `spacing['4.5']` y `spacing['13']` porque se usaban `h-4.5`/`h-13` sin existir | `ProductCard.tsx`, `tailwind.config.ts` |
| 13 | El inicio usaba una tarjeta sin nombre ni precio | `premium/product-card` ocultaba datos | usar `store/ProductCard` en todas las grillas | `src/pages/StoreFront.tsx` |
| 14 | Build de Vercel fallaba con "URI malformed" | `%VITE_*%` en `index.html` sin valor cuando no hay `.env` | `applyBrandEnvDefaults()` en `vite.config.ts` + variables en Vercel | `scripts/vite-brand-files.ts` |

## 2. Sistema visual (tokens y tema)

- **Tokens nuevos** en `src/index.css` y `tailwind.config.ts`: `studio` (fondo de foto),
  `sale` (solo ofertas/agotado), `success` (stock/confirmado) y, en EINA, `wine`/`nude`/`cream`
  **[marca]**. En Manojitos: definir los mismos nombres con su paleta.
- **Alias heredados** `--gold`/`--rose` apuntan a la paleta de marca; `--gold` es un tono con
  contraste AA sobre blanco porque se usa como color de "pendiente/aviso" en muchas pantallas.
- **Sin brillos**: `.btn-gold` = fondo `primary` sólido; `.btn-shimmer::after` y
  `.text-glow-*` anulados; `.text-gradient-gold` = color sólido `primary` (se usa en ~40 lugares
  del panel, por eso se redefine la clase en vez de tocar cada archivo).
- **Contraste AA**: se reemplazó `text-muted-foreground/20…/50` por `text-muted-foreground` en
  texto; los íconos decorativos grandes quedan en `/40`.
- **Colores Tailwind sueltos** (`pink-*`, `rose-*`, `amber-*`) cambiados por tokens en
  Atención, Privacidad, Términos, Nosotros y Favoritos.
- **Modo oscuro sin destello**: script en `<head>` de `index.html` que lee cualquier clave
  `*-theme` de `localStorage` (o `prefers-color-scheme`) y pone `.dark` antes del primer pintado;
  fondo oscuro también en el CSS crítico inline. `meta theme-color` para claro y oscuro.
- **Modo oscuro de marca** **[marca]**: el primario pasa a nude (el vino no llega a AA como
  texto sobre oscuro); el vino queda como `accent` y superficie.
- **Tipografía** **[marca]**: Constantia (local) → Crimson Pro → Georgia en títulos; Source Sans 3
  en texto. En Manojitos se mantiene su par de fuentes, pero con el mismo mecanismo.
- `prefers-reduced-motion`: bloque global en `index.css` + `useReducedMotion()` en tarjetas,
  barra inferior y animaciones de entrada.
- `-webkit-tap-highlight-color: transparent` en `body` (sin destello azul al tocar en móvil).

## 3. Marca en el código (plantilla)

- `src/config/brand.ts`: todo lo de la marca sale de variables `VITE_BRAND_*`. Añadidos:
  `BRAND.category` (rubro corto para recibos, `VITE_BRAND_CATEGORY`), `BRAND.color`
  (`VITE_BRAND_THEME_COLOR`) y `BRAND_COLOR_RGB` para jsPDF. Recibos y reportes PDF usan estos
  valores en vez de "Boutique & Lifestyle" y dorado fijo.
- `src/components/brand/BrandLogo.tsx`: `variant="logotipo" | "shop" | "isotipo"`, `onDark`.
  Muestra el PNG claro con `dark:hidden` y el oscuro con `hidden dark:block`. Usado en header,
  sidebar del panel (isotipo si está colapsado), login de clientes, login admin y footer.
- `src/config/brand-assets.ts`: un solo lugar para importar logos/isotipo/estrella.
- `generate_icons.py`: genera favicons, íconos PWA y `og-image.jpg` desde `src/assets/brand/`
  (`python generate_icons.py --bg "#78293c" --og-bg "#f4e7d7"`).
- `AngelaMascot`: círculo de color de marca con el isotipo (sin imagen de mascota externa).

## 4. Componentes nuevos o reescritos

- **`MobileTabBar`** (`src/components/store/MobileTabBar.tsx`): barra inferior solo en móvil
  (Inicio, Tienda, Carrito con contador, Favoritos, Cuenta/Entrar). Indicador animado con
  `layoutId`, `aria-current`, `safe-area-inset-bottom`. Se monta en `StoreLayout`, que añade
  `pb-[calc(4rem+env(safe-area-inset-bottom))]` en móvil. La variable CSS `--mobile-tabbar`
  (vía `body:has(.mobile-tabbar)`) eleva el botón flotante del chat para que no se tapen.
- **Header móvil**: solo logo, buscar, moneda y menú (botones 44px con `aria-label` y
  `aria-expanded`); tema, notificaciones, cuenta y carrito viven en el menú y la barra inferior.
- **`FavoriteButton`** (`src/components/store/FavoriteButton.tsx`): corazón `overlay` (tarjeta)
  u `outline` (ficha). Con sesión alterna favorito (ícono `weight="Filled"`); sin sesión muestra
  un toast con acción "Entrar" que vuelve a la misma página. `aria-pressed`, `whileTap`.
- **`ProductCard`** reescrita (ver Componentes arriba). `memo` + `forwardRef`; "Quedan N" en
  texto rojo junto a la categoría; badge "N en tu carrito".
- **Etiquetas automáticas** (`src/hooks/useProductLabels.tsx`): prioridad Más vendido > Nuevo
  (14 días) > Últimas unidades; sin emojis; se eliminó "Premium" (solo significaba precio alto).
  `AutoProductLabels` acepta `exclude` para no duplicar información.
- **Ficha de producto**: imagen 4:5 sobre `studio`; CTA pill + corazón al lado; **barra de
  compra fija en móvil** (`useInView` sobre el CTA principal) sobre la barra inferior; si falta
  talla hace scroll al selector.
- **Footer**: bloque de marca con estrella como motivo, enlaces en dos columnas en móvil
  (objetivo táctil 32px+), Instagram/WhatsApp reales (sin enlaces `#`), `mailto:` real.
- **Inicio**: hero con texto + collage de productos reales, franja de beneficios, categorías con
  foto de su producto más vendido (scroll horizontal con `snap` en móvil), "Lo más nuevo",
  bloque de crédito. Textos **[marca]**.
- **Estados vacíos**: ícono en círculo `studio`, título, una línea, un CTA.

## 5. Lógica e interacción

- **Catálogo** (`StoreCatalog.tsx`): URL como fuente de verdad (compartir el link o "atrás"
  muestra lo mismo); orden `newest` (por `created_at`, explícito), `popular` (por
  `sold_count`), precio y nombre; conteo por categoría; botón "x" para borrar búsqueda; badge
  con número de filtros activos; en móvil el panel de filtros cierra con "Ver N productos";
  paginación de 12 que se reinicia al cambiar filtros y dice cuántos quedan; se quitó la vista
  "lista" (mostraba la misma tarjeta gigante). Singular/plural correcto.
- **Carrito** (`CartContext.tsx`): guardado solo después de cargar, fusión invitado→cuenta,
  sincronización entre pestañas (evento `storage`), `try/catch` en `localStorage` (modo
  privado), `getItemQuantity(id)` sin talla suma todas las tallas.
- **Login** (`CustomerAuth.tsx`): `?redirect=` validado y `?modo=registro` abre el formulario de
  registro ("Crear mi cuenta" del inicio lo usa). Las rutas protegidas ya redirigen con
  `?redirect=`, por eso la barra inferior enlaza directo a `/cliente/favoritos`.
- **Checkout** (`Checkout.tsx`): Pago Móvil se valida antes de habilitar "Confirmar" (banco,
  referencia ≥4 dígitos, teléfono ≥10) y se lista lo que falta; si el servidor rechaza el
  pedido por stock/precio se muestra el motivo real y se aclara que el carrito sigue guardado;
  el contacto de pago sale de `BRAND.whatsapp` y se oculta si está vacío; se quitó una consulta
  de perfil que no se usaba.
- **Precios** (`PriceDisplay`, `formatBS`): formato `Bs 1.234,56` y `€x.xx`; sin línea Bs si la
  tasa es 0.
- **Asistente** (`supabase/functions/ai-assistant`): palabras clave y respuestas de respaldo
  según el rubro **[marca]** (en EINA: maquillaje/skincare; en Manojitos: ropa/perfumes).

## 6. Accesibilidad y táctil

- Objetivo táctil mínimo 44px en botones de ícono (buscar, menú, corazón, agregar, chips 40px).
- `aria-label` en todos los botones de solo ícono; `aria-pressed` en chips y favoritos;
  `aria-current="page"` en la barra inferior; `aria-label` en navegaciones del footer.
- `focus-visible:ring-2 ring-ring` en tarjetas, enlaces de logo, footer y barra inferior.
- `enterKeyHint="search"` en el buscador del catálogo.

## 7. Verificación usada (repetir en Manojitos)

Recorrido automatizado en móvil (Playwright con `/opt/pw-browsers`, productos simulados con
`page.route('**/rest/v1/products**')`): catálogo muestra todo · búsqueda conserva el texto ·
sin acentos · con números · borrar búsqueda · dos categorías · "Más vendidos" · agregar desde
tarjeta sube el contador de la barra · el carrito sobrevive a recargar · menú móvil abre ·
búsqueda del header filtra el catálogo · favorito sin sesión invita a entrar · la invitación
vuelve a la página · `/cliente/favoritos` sin sesión redirige con regreso · `?modo=registro`.
Más capturas en claro y oscuro (clave `<storageKey>-theme` en `localStorage`) a 390 px y 1366 px.

## 8. Panel de gestión (admin)

Mismo sistema visual que la tienda. Skill del repo para aplicarlo: `.claude/skills/diseno/`.

| Área | Cambio | Por qué | Archivo |
|------|--------|---------|---------|
| Navegación | Menú único en `adminNav.ts` agrupado (Día a día / Gestión / Sistema); se agregó Reglas de negocio | Antes Reglas no tenía acceso y el menú estaba duplicado | `src/components/layout/adminNav.ts` |
| Navegación | Barra lateral con etiquetas, colapsable con botón (se recuerda), tooltips, alto completo | Expandir con hover empujaba el contenido; colapsada no se sabía qué era cada ícono | `AppSidebar.tsx` |
| Navegación | Móvil: barra superior (título, asistente, avisos) + barra inferior (Panel, Ventas, Productos, Créditos, Más) + hoja "Más" | Antes solo un botón flotante de menú | `AdminMobileNav.tsx`, `AppLayout.tsx` |
| Encabezados | `.page-header` oculto en móvil (el título vive en la barra), `.page-subtitle` compacto | Título duplicado y estilos distintos por página | `src/index.css` |
| KPIs | `StatCard` sin glow, detalle siempre visible, 2 columnas en móvil, enlaces con filtro | En táctil el detalle (solo en hover) no se veía; 5 tarjetas llenaban la pantalla | `ui/stat-card.tsx`, `Dashboard.tsx` |
| Productos | Editar/Eliminar siempre visibles; filas compactas en móvil; chips Por reponer/Agotados; categoría y stock en la URL; `AlertDialog` | Las acciones solo aparecían con hover: imposible editar desde el teléfono | `Products.tsx`, `src/lib/stock.ts` |
| Pestañas | `.admin-tabs`: una fila deslizable (móvil) / segmentada (escritorio); contadores en línea | Se apilaban en columna o se cortaban (`justify-center` de la base) | `index.css`, `Sales.tsx`, `Credits.tsx`, `Providers.tsx` |
| Ventas | Pestaña activa en la URL (`?tab=cuentas-cobrar`), "CxC" → "Por cobrar" | El KPI "Abonos" debía abrir cuentas por cobrar | `Sales.tsx` |
| Reportes | Rangos rápidos (Hoy, 7 días, 30 días, Este mes, Mes pasado), lista en móvil, fechas locales | Tabla de 6 columnas ilegible; ventas de la noche caían al día siguiente | `Reports.tsx` |
| Clientes | Tabla → tarjetas en móvil solo con clases (la lógica del diálogo KYC no cambia) | La tabla de 800 px se cortaba | `Customers.tsx` |
| Asistente | En el panel móvil se abre desde la barra superior (evento `angela:open`); sin saludo emergente | El botón flotante tapaba contenido en cada pantalla | `AngelaChat.tsx`, `src/lib/events.ts` |
| Fechas | `localDateISO()` en pagos, compras, créditos y reportes | `toISOString()` es UTC: después de las 8 p. m. (UTC-4) se registraba el día siguiente | `src/lib/dates.ts` |
| Inputs | `.input-glass` sin `backdrop-blur` | Creaba un contexto de apilamiento que tapaba el ícono de búsqueda | `index.css` |

**Bugs que rompían pantallas (portar a Manojitos):** import duplicado `Gallery` (Clientes no
abría) · `ToggleRight/Left` sin importar (Reglas) · `React.useMemo` sin importar React
(perfil de crédito) · ícono `Mail` inexistente (centro de notificaciones) · `i` en vez de `idx`
(Importar productos se colgaba tras el primer lote) · `retail_multiplier` inexistente (el precio
detal ignoraba el recargo configurado).

## 9. Ventanas flotantes, avisos y correos

| Área | Cambio | Por qué | Archivo |
|------|--------|---------|---------|
| Ventanas | `Dialog`/`AlertDialog`: hoja inferior en móvil (sube desde abajo, asa, `max-h-[92dvh]`, scroll interno, safe-area) y modal centrado con zoom en PC; reglas `max-sm:!` para que ninguna pantalla lo rompa | Los formularios largos (Nueva venta, Nuevo producto) no cabían en el teléfono | `ui/dialog.tsx`, `ui/alert-dialog.tsx` |
| Ventanas | Cerrar de 40 px, título en serif, botones del pie a ancho completo en móvil; ventanas siempre opacas | Objetivo táctil y legibilidad | `ui/dialog.tsx`, `index.css` |
| Confirmaciones | `useConfirm()` reemplaza los 10 `confirm()` nativos con título, consecuencia y botón rojo si es destructivo | El cuadro del navegador no dice qué pasa después ni se ve en la marca | `ui/confirm-dialog.tsx` |
| Avisos | `notifyCustomer()`: aviso interno + push + correo en un lugar, respetando las preferencias de la clienta | Había avisos duplicados, un push a una ruta inexistente y preferencias que nadie leía | `src/lib/notify.ts` |
| Correos | Plantillas de marca con texto escapado; correos de pedido confirmado/rechazado/enviado/entregado y aviso a la administración | Solo existía el recibo, con colores de otra marca | `supabase/functions/send-email/` |
| Precios | `PriceDisplay amountBs`: un recibo muestra los Bs que se pagaron, no los de la tasa de hoy | Los pedidos viejos cambiaban de monto al cambiar la tasa | `ui/PriceDisplay.tsx` |
| Fluidez | Transición corta entre páginas de la tienda (respeta "reducir movimiento") | Continuidad al navegar | `StoreLayout.tsx` |


## 10. Importar, nueva venta y clientes

| Área | Cambio | Por qué | Dónde |
|---|---|---|---|
| Importar | Lector flexible: xlsx/xls/ods/csv/tsv/txt/json, detecta separador, codificación, hoja y fila de títulos; mapea columnas por sinónimos (Treinta, Shopify, español/inglés) y deja corregirlas; precios en Bs → USD con la tasa | Cada app exporta distinto; la dueña no debe editar el Excel | `src/lib/productImport.ts`, `ImportProducts.tsx` |
| Nueva venta | Diálogo tipo punto de venta: productos en mosaico compacto (foto 56px + precio + stock), carrito con +/−, cliente en 3 modos (mostrador / buscar / nuevo), modalidad en tarjetas, método en pastillas, vuelto con montos rápidos, total fijo en el pie y mensaje de "lo que falta" | El formulario anterior era un select por producto y 800 líneas en la página | `components/sales/NewSaleDialog.tsx` |
| Clientes | Tarjetas en vez de tabla; filtros-pastilla por verificación con conteo; buscar sin tildes por nombre/teléfono/cédula/correo; un solo diálogo de ficha (Resumen · Verificación · Compras · Cuenta) con WhatsApp/llamar/correo arriba y la decisión Aprobar/Rechazar fija abajo | La tabla se leía mal en móvil y había un diálogo por fila | `pages/Customers.tsx`, `components/customers/` |
| Diálogos anchos | `DialogContent` con `grid-cols-[minmax(0,1fr)]` y secciones `min-w-0`; pie fijo con `max-sm:!pb-0` + `pb-[calc(1rem+env(safe-area-inset-bottom))]` | Sin esto un texto `truncate` o una fila `nowrap` ensanchan la hoja móvil y aparece scroll horizontal | ambos diálogos |
| Listas en grid | Usar `grid-cols-1` explícito (Tailwind = `minmax(0,1fr)`) | `grid` sin columnas crece al ancho del texto más largo | `Customers.tsx` |

## 11. Contenido de marca, pagos y panel guiado

| Área | Cambio | Por qué | Dónde |
|---|---|---|---|
| Frase de portada | Titular con la parte emocional en vino e itálica ("tu mejor versión") y el resto en el color del texto | Una sola idea fuerte; el color guía la lectura | `StoreFront.tsx` |
| Beneficios | 4 promesas concretas (asesoría GRATIS, tasa BCV, delivery en la Isla, MRW) + franja de métodos de pago en pastillas | La clienta decide comprar por confianza, no por adjetivos | `StoreFront.tsx`, `AboutUs.tsx` |
| Sin fotos | Panel de marca (vino + logo) en vez de cajas vacías mientras no haya productos con foto | Una tienda nueva no debe verse rota | `StoreFront.tsx` |
| Datos de pago | Nunca fijos en el código: salen de `payment_methods.config`, con nombres legibles (`paymentMethodFields.ts`) y un solo panel (`PaymentInfoPanel`) | En la copia venían los datos de pago de otra persona | `components/payments/`, `lib/paymentMethodFields.ts` |
| Configuración | Pestañas; "Pagos" primero con estado por método (completo / faltan N) y aviso global | Lo que bloquea vender va arriba | `Settings.tsx` |
| Reglas en palabras | Precios explicados con un ejemplo en vivo | Nadie entiende "factor USD→EUR" | `Settings.tsx` |
| Panel guiado | Saludo, accesos rápidos en pastillas y "Primeros pasos" que desaparece al completarse | La dueña sabe qué hacer el primer día | `Dashboard.tsx` |
| Resúmenes | Un número principal ("Por cobrar") + filtros-pastilla con conteo en vez de 6 tarjetas | En móvil las tarjetas empujan el contenido fuera de la pantalla | `Credits.tsx`, `BusinessRules.tsx` |
| Gráficos vacíos | Mensaje con ícono en vez de una línea plana en cero | Una línea en cero parece un error | `Dashboard.tsx` |
| Móvil tienda | Sin menú hamburguesa: la barra inferior cubre la navegación; la pestaña de cuenta es "Panel" para la administradora | No duplicar navegación; el panel a un toque | `StoreHeader.tsx`, `MobileTabBar.tsx` |
| Mis pedidos | Tarjeta por pedido con barra de progreso real (Recibido → Entregado) y 3 acciones (Seguir, Recibo, Repetir); el seguimiento sale del estado real | El seguimiento fijo mentía; los botones tipo Amazon no eran de la marca | `CustomerOrders.tsx` |
| Títulos en la cuenta | Clase `store-page-title`: las páginas de la clienta no usan `page-header` (que el panel oculta en móvil) | El título desaparecía en el teléfono | `index.css`, `Customer*.tsx` |
| Mi cuenta | Menú en filas agrupadas (Compras / Mi cuenta / Ayuda) con descripciones completas; resumen tocable | Los mosaicos cortaban los textos y había accesos duplicados | `customer/CustomerDashboard.tsx` |
| Configuración de la clienta | Contraseña: se verifica la actual antes de cambiarla; "¿La olvidaste?" envía el enlace ahí mismo. Avisos: si no hay perfil se explica, y si falla el guardado se revierte. Cerrar sesión sin rojo | Un campo que se pide y no se usa es un bug de seguridad; un interruptor que no guarda engaña | `CustomerSettings.tsx` |
| Recibos | Un solo recibo (`lib/receipt.ts` + `receipts/ReceiptDialog.tsx`) para la clienta y el panel: misma vista, PDF de 80 mm con la marca y texto de WhatsApp. En fiado muestra abonado y saldo; el total en Bs solo si se registró | Antes el recibo usaba el dorado de otra marca y mostraba "Bs 0.00"; el panel no tenía recibo | `lib/receipt.ts`, `CustomerOrders.tsx`, `Sales.tsx` |
| Acciones en el teléfono | Eliminar una línea de una venta ya no depende de `:hover` | En el teléfono no hay hover: el botón no existía | `Sales.tsx` |
| Asistente que trabaja | Ina prepara compras, ventas, compras a proveedor, abonos y stock; la persona ve una tarjeta con el detalle y confirma. Nunca dice "listo" antes de confirmar | Un asistente que solo informa obliga a repetir el trabajo en otra pantalla; confirmar evita errores de la IA | `AngelaChat.tsx`, `ai-assistant/actions.ts` |
| Categorías del inventario | Se configuran en Configuración → Categorías (orden, nombre y qué detalle piden: contenido en ml/g, medidas, tallas o tonos). El formulario de producto usa un desplegable y muestra solo el campo que pide la categoría | Texto libre creaba categorías duplicadas ("skincare" / "Skincare") y las tallas de ropa no tienen sentido en un sérum | `settings/CategoriesSettings.tsx`, `products/CategoryDetailFields.tsx`, `lib/productCategories.ts` |
| Talla o tono en la tienda | La ficha lee las opciones del producto (no adivina por el nombre): con una sola se elige sola, con varias es obligatorio elegir; carrito y pago dicen "Tono" o "Talla" según la categoría | La regla heredada de otra tienda (jeans, bodys) nunca aplicaba a belleza | `ProductDetail.tsx`, `store/ProductCard.tsx`, `Cart.tsx`, `Checkout.tsx` |
| Ficha en el teléfono | La cuadrícula de la ficha usa `grid-cols-1` y `min-w-0`; el botón dice "Agregar — $X" en móvil | La columna se ensanchaba con su contenido y cortaba texto y el botón de favoritos | `ProductDetail.tsx` |
| Catálogo completo | El panel carga hasta 1000 productos (antes 200) y la tienda hasta 1000 con stock (antes 100) | Había 255 productos: 55 no aparecían en el panel y 74 con stock no aparecían en la tienda | `useProducts.tsx`, `usePublicProducts.tsx` |
| Stock por variante | Tallas, tonos y presentaciones (30 ml, 50 ml) se cargan como filas con sus unidades y un precio opcional; el stock del producto es la suma y no se edita a mano. La tienda muestra "Desde $X" si los precios varían y tacha lo agotado; el POS pide elegir la variante | Un mismo producto puede venir en varias tallas o tamaños con existencias distintas: un solo número de stock mentía | `CategoryDetailFields.tsx`, `Products.tsx`, `ProductDetail.tsx`, `NewSaleDialog.tsx`, migración `product_variants` |
| Imágenes desde Drive | Un enlace de Google Drive (`/file/d/…/view`) o Dropbox (`dl=0`) se convierte solo en la imagen directa, al guardar y al mostrar; el formulario enseña la vista previa y avisa si no carga | Esos enlaces abren una página, no la foto: el producto quedaba sin imagen sin explicación | `lib/imageUrl.ts`, `validations.ts`, `Products.tsx` |
| Por cobrar por clienta | Una tarjeta por clienta con la deuda total, la fecha de su última factura y un contador de facturas; al tocarla se ven sus facturas (de la más antigua a la más reciente) con abonar y marcar pagado. El contador de la pestaña cuenta clientas, no líneas | Con una tarjeta por factura, la misma clienta aparecía repetida y no se veía cuánto debe en total | `Sales.tsx` |
| Marcar pagado pide cómo pagó | "Marcar pagado" abre el mismo formulario del abono con el saldo completo fijo y exige elegir el método de pago (también en los abonos). El historial muestra el método con su nombre | Antes saldaba la cuenta con el método de la venta ("fiado") o Pago Móvil sin preguntar, y el cierre de caja no cuadraba | `Sales.tsx` |
| Envío nacional MRW en el checkout | Nueva opción "Otra ciudad de Venezuela (MRW)" junto a los municipios de Margarita: pide ciudad, estado y agencia, y el envío sale como "Lo cobra MRW". Si el perfil trae dirección sin municipio, la tarjeta de entrega avisa y abre el formulario | La portada y la política prometían envíos nacionales, pero el checkout solo aceptaba municipios de Margarita; y "Faltan campos: Ciudad" no decía dónde completarlo | `Checkout.tsx` |
| Métodos de pago según Configuración | Portada, Nosotros, Atención y FAQ muestran los métodos activos en Configuración (`useStorePaymentLabels`); la lista de marca queda solo como respaldo | Se anunciaban Zelle y Binance aunque estaban desactivados | `usePaymentMethods.tsx` |
| FAQ, Atención y 404 de EINA | FAQ reescrita para una tienda de belleza (compras, envíos, cambios, crédito, cuenta); Atención ofrece Instagram cuando no hay WhatsApp; 404 en español dentro de la tienda | La FAQ describía una plataforma de cuotas, Atención decía "Próximamente" y el 404 estaba en inglés | `FAQ.tsx`, `Atencion.tsx`, `NotFound.tsx` |
| Estructura de costos → precio de venta | Configuración → Precios guarda la planilla de costos (tasa de reposición, comisiones, gastos fijos ÷ meta, empaque, envío y margen por defecto). En el producto: costo base, envío y margen propios, desglose y "Usar $X". En Productos, "Precios sugeridos" compara y aplica en lote solo lo que elijas | La calculadora heredada usaba un factor EUR que no corresponde a EINA y pisaba precios; ahora el precio cubre reposición a tasa Binance y deja el margen | `lib/costStructure.ts`, `CostStructureSettings.tsx`, `CostStructurePanel.tsx`, `SuggestedPricesDialog.tsx` |
| Costos a la vista en Configuración | Pestaña "Costos y precios" en segundo lugar (antes "Precios", cortada al borde en el teléfono) y la tasa de reposición (Binance) también en la pestaña Tasa, junto a la del BCV | Los datos de la estructura de costos no se encontraban; la tasa de Binance se cambia a diario igual que la del BCV | `Settings.tsx`, `CostStructureSettings.tsx` (`ReplacementRateCard`) |
| Abonos en el recibo y orden de listas | El recibo de una venta por cobrar lista cada abono (fecha, método, Bs y monto) en pantalla, PDF y WhatsApp; los abonos anulados no salen; cuenta saldada dice "Pagada". Las tarjetas de Por cobrar tienen botón de recibo. Ventas se ordenan por fecha, monto o clienta; Por cobrar por deuda, antigüedad, última compra, número de facturas o clienta (orden en la URL) | El recibo solo decía el total abonado y las listas tenían un único orden fijo | `lib/receipt.ts` (+ test), `ReceiptDialog.tsx`, `Sales.tsx` |
| Compras en tienda en "Mis pedidos" | Las ventas del panel vinculadas a la clienta (por teléfono, disparador `trg_sales_autolink_customer`) salen como una sola "Compra en tienda" por venta, entregada, con "Por pagar · debes $X" si es fiada; su recibo es de venta y lista los abonos | Antes cada producto salía como un pedido aparte, las fiadas decían "Pago por confirmar" y el recibo no traía abonos | `useCustomerOrders.tsx`, `CustomerOrders.tsx`, `types/index.ts` |
| Correos automáticos: notificaciones y facturas | Cada notificación (campana) sale también por correo, a la clienta (si no los desactivó) o a la administración; la factura se envía sola al confirmar una venta (una sola por venta aunque tenga varios productos) y al registrar cada abono, con el detalle de abonos. Cola `email_outbox` sin duplicados ni reintentos perdidos | Antes solo algunos avisos llegaban por correo y las facturas nunca | `20260927010000_email_outbox.sql`, `send-email/outbox.ts`, `send-email/templates.ts`, `lib/notify.ts` |
| Editar precios | El precio escrito manda: la calculadora solo propone precios cuando se cargan datos de compra; editar ya no abre la calculadora ni suma el stock otra vez, y se conserva el costo guardado. Los errores dicen qué campo falla | La calculadora recalculaba y pisaba el precio, borraba el costo (quedaba en $0) y podía volver a sumar el stock | `Products.tsx`, `validations.ts` |
| Cuentas únicas | Una cédula, un correo y un teléfono por cuenta, aunque se escriban distinto (+58 414…, 0414…); si la venta del panel creó un perfil suelto con esos datos, la clienta igual puede registrarse y se queda con él | Un perfil creado desde el panel bloqueaba el registro real, y "0414…" y "+58414…" contaban como distintos | `20260927020000_customer_uniqueness.sql`, `useCustomerProfile.tsx` |
| Notificaciones | Al tocarla se abre en grande con su mensaje completo, la fecha y un botón a donde se atiende (venta, pedido, crédito, producto); el panel tiene su página de notificaciones con filtro "Sin leer" | Tocar una notificación no hacía nada y "Ver todas" llevaba a la página de clientas | `NotificationDetailDialog.tsx`, `notificationLinks.ts`, `AdminNotifications.tsx` |
| Compra lista (checkout) | La clienta ve la misma factura que en el resto de la tienda, con más datos (entrega, dirección, banco, referencia, inicial y financiado) y puede descargarla, compartirla o imprimirla | Era un resumen distinto sin descarga | `Checkout.tsx`, `receipt.ts`, `ReceiptDialog.tsx` |
| Aviso de ventas a la dueña | Cada venta del panel y cada pedido de la tienda le llega por correo y, si lo activa, por WhatsApp (CallMeBot, gratis) | Las ventas del panel no avisaban a nadie | `outbox.ts`, `OwnerAlertsSettings.tsx` |
| "Lo quiero" | En un producto agotado la clienta toca "Lo quiero" y la dueña ve en **Productos pedidos** qué quieren y cuántas; al reponer, les llega el aviso solo | El botón decía "Producto agotado" y no hacía nada | `RequestProductButton.tsx`, `ProductRequests.tsx`, `20260927040000_product_requests.sql` |

## 12. Guía de portado a Manojitos, cambio por cambio

Lista **completa** de lo que se cambió en EINA, en orden (commit en `main` de EINA). Manojitos
tiene la misma base de código, así que casi todo se porta con `git cherry-pick`:

```bash
# en el repo de Manojitos
git remote add eina https://github.com/Quorex-Studio/EinaShopV.git && git fetch eina main
git cherry-pick <commit>          # uno por uno, en este orden
# conflictos: quedarse con la lógica de EINA y con la marca de Manojitos ([marca])
```

Reglas al portar:
- **[marca]** = propio de EINA (colores, logos, textos de belleza, Isla de Margarita, "Ina").
  En Manojitos se conserva su identidad y su asistente **Ángela** (ver `docs/ASISTENTE-VIRTUAL-INA-ANGELA.md`).
- **BD** = trae migración: aplicarla en el Supabase de Manojitos (`supabase db push` o el SQL tal cual).
  Todas son idempotentes (`if not exists`, `create or replace`, `on conflict`).
- **EF** = cambia una edge function: volver a desplegarla en el proyecto de Manojitos.
- **Secretos** (Resend, hook de Auth, cron): cada tienda los crea en **su** Vault; nunca van en el repo.
- Después de cada commit: `npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run`, `npx vite build`.

### 12.1 Plantilla, infraestructura y seguridad

| Commit | Cambio | Archivos clave | BD / EF | Portar |
|---|---|---|---|---|
| `f3c4f8b` | Tienda convertida en plantilla: nombre, dominio, correos, asistente y colores salen de `config/brand.ts` + variables `VITE_BRAND_*` | `config/brand.ts`, header/footer, páginas legales | — | Sí; poner los `VITE_BRAND_*` de Manojitos en `.env` y en Vercel [marca] |
| `4777cac` | Plantilla vendible: script `scripts/nueva-tienda.mjs`, `PLANTILLA.md`, skill `nueva-tienda`, íconos/manifest generados desde la marca | `scripts/`, `config/brand-assets.ts`, `vite-brand-files.ts` | — | Sí |
| `1e7e146` | Migraciones reproducibles (renombradas con fecha completa, sin duplicados) | `supabase/migrations/*` | BD | Sí, revisar que el historial de Manojitos coincida antes de `db push` |
| `83493b5` | Edge functions desplegables por proyecto; `cron_secret` en Vault para `angela-cron-alerts` | `supabase/functions/*`, `20260924000100_cron_secret.sql` | BD + EF | Sí |
| `1e7e146` | Endurecimiento de seguridad: funciones `SECURITY DEFINER` sin acceso anónimo, `pg_net` fuera de `public` | `20260924000000_security_hardening.sql` | BD | **Sí, prioridad** |
| `1f930f3` | El build no falla si faltan variables de marca | `vite.config.ts`, `scripts/vite-brand-files.ts` | — | Sí |
| `ed7cb33` / `f6e47c4` | **Malware** en `postcss.config.js` (código ofuscado que ejecutaba un script remoto al compilar). Archivo limpio = 81 bytes | `postcss.config.js`, `docs/SEGURIDAD-2026-09-incidente-postcss.md` | — | **Revisar Manojitos YA**: `wc -c postcss.config.js` debe dar 81 y `grep -rE "global\['r'\]=require" .` no debe encontrar nada |
| `03092e1` | "not a valid JavaScript MIME type" tras cada despliegue: la app recarga una vez cuando falla un chunk viejo; `vercel.json` no reescribe `/assets/*` a `index.html` | `lib/chunkReload.ts`, `main.tsx`, `App.tsx`, `vercel.json` | — | Sí |
| `3fe76f9` / `5ddcdc6` | Correos con Resend (pedido recibido, aprobado, enviado, entregado, abonos a crédito) y hook de Auth para los correos de registro/recuperación | `supabase/functions/send-email/*`, `send-credit-notifications`, `lib/notify.ts`, `20260925010000_email_secrets_reader.sql` | BD + EF | Sí; plantillas y remitente [marca]; cargar `resend_api_key` y `resend_from_email` en el Vault de Manojitos |
| `4c39767` | La tasa BCV se lee sin sesión (visitantes veían "0,00 Bs") | `20260924000200_public_exchange_rates_read.sql` | BD | Sí |

### 12.2 Tienda (lo que ve la clienta)

| Commit | Cambio | Archivos clave | BD / EF | Portar |
|---|---|---|---|---|
| `4c39767` | Rediseño con DESIGN.md: tarjetas de producto, precios, ficha, login; arreglos críticos (§1) | `ProductCard`, `PriceDisplay`, `ProductDetail`, `StoreFront`, `CustomerAuth` | — | Sí |
| `2f222cf` | Identidad visual (paleta, logos, modo oscuro, móvil) | `index.css`, `tailwind.config.ts`, `assets/brand/*`, `public/*` | — | Solo la estructura de tokens; colores y logos [marca] |
| `b7b7b7e` | Catálogo, carrito, favoritos y login: estado en la URL, carrito que no se vacía al recargar, barra inferior móvil | `MobileTabBar`, `CartContext`, `StoreCatalog`, `Cart`, `FavoriteButton` | — | Sí |
| `5cf436e` | Contenido: frase, beneficios, franja de métodos de pago, menú móvil sin hamburguesa | `StoreFront`, `StoreHeader`, `MobileTabBar`, `PaymentInfoPanel`, `paymentMethodFields.ts` | EF (ai-assistant) | Estructura sí; textos [marca] |
| `2ff94b0` | Teléfono y cédula con prefijos de Venezuela (0412/0414/…, V/E/J) en todos los formularios | `components/ui/ve-inputs.tsx`, `lib/venezuela.ts` (+ test) | — | Sí |
| `ce77b7c` | Mis pedidos: progreso real (Recibido → Entregado) y seguimiento por estado | `CustomerOrders.tsx` | — | Sí |
| `a839bf0` | Títulos visibles en móvil en toda la cuenta (`store-page-title`); Mi crédito más claro | `index.css`, páginas `Customer*` | — | Sí |
| `5637884` | Mi cuenta: menú en filas agrupadas y resumen tocable | `CustomerDashboard.tsx` | — | Sí |
| `f4d5c00` | Checkout: encabezado compacto, teléfono de pago legible | `Checkout.tsx`, `PaymentInfoPanel.tsx` | — | Sí |
| `7cf6d7c` | Política de cambios: 72 horas; maquillaje/skincare abiertos sin cambio | `FAQ.tsx`, `ShippingPolicy.tsx`, ai-assistant | EF | Plazo y rubro [marca]: usar la política de Manojitos |
| `4eea1e4` | Configuración de la clienta: verifica la contraseña actual, "¿La olvidaste?" envía el enlace, avisos que se guardan de verdad | `CustomerSettings.tsx` | — | Sí |
| `aed6d32` | Un solo recibo para clienta y panel, PDF de 80 mm con la marca y envío por WhatsApp | `lib/receipt.ts` (+ test), `components/receipts/ReceiptDialog.tsx` | — | Sí; logo del PDF [marca] |
| `ebc9802` | **Foto de perfil**: no existía el bucket y toda subida fallaba. Se crean `customer-avatars` (público) y `customer-kyc` (privado, enlaces firmados); la foto se comprime en el navegador | `lib/customerFiles.ts`, `hooks/useKycUrl.ts`, `CustomerProfile.tsx`, `CustomerDetailDialog.tsx`, `20260925040000_customer_storage_buckets.sql` | BD | **Sí, prioridad**: comprobar en Manojitos que los buckets existan |
| `2ae60a3` | Envío nacional **MRW** en el checkout ("Otra ciudad de Venezuela (MRW)", lo cobra MRW); aviso cuando falta el municipio; métodos de pago anunciados = los activos en Configuración (`useStorePaymentLabels`); FAQ propia; Atención ofrece Instagram si no hay WhatsApp; 404 en español | `Checkout.tsx`, `usePaymentMethods.tsx`, `FAQ.tsx`, `Atencion.tsx`, `NotFound.tsx`, `StoreFront.tsx`, `AboutUs.tsx` | — | Lógica sí; municipios, tarifas y textos de la FAQ [marca] (Manojitos usa sus zonas) |

### 12.3 Panel de gestión

| Commit | Cambio | Archivos clave | BD / EF | Portar |
|---|---|---|---|---|
| `b410969` | Navegación móvil del panel, diseño responsive y bugs que rompían pantallas (imports faltantes, fechas UTC) | `AdminMobileNav`, `AppLayout`, `adminNav.ts`, `lib/dates.ts`, `lib/stock.ts`, varias páginas | — | **Sí, prioridad** |
| `d12edc0` | Ventanas flotantes responsive (hoja inferior en móvil), confirmaciones propias en vez de `confirm()`, avisos que respetan preferencias | `ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/confirm-dialog.tsx`, `lib/notify.ts` | — | Sí |
| `4c2e52c` | Importar productos desde Treinta, Excel, CSV y más | `lib/productImport.ts` (+ test), `ImportProducts.tsx` | — | Sí |
| `22929e6` | Nueva venta como punto de venta (buscador, carrito, cliente, pago) | `NewSaleDialog.tsx` | — | Sí |
| `7339b4f` | Clientes: tarjetas, filtros con conteo y ficha única | `Customers.tsx`, `CustomerDetailDialog.tsx`, `customerUi.tsx` | — | Sí |
| `3869d74` / `b4dec77` | Panel guiado, Configuración por pestañas (Pagos primero), Créditos, Reglas, Reportes y Productos más claros | `Dashboard`, `Settings`, `Credits`, `BusinessRules`, `Reports`, `Products` | — | Sí |
| `08bfac1` | Proveedores: compras por mes, resumen y crear proveedor al vuelo | `Providers.tsx`, `useProviders.tsx` | — | Sí |
| `b25d6f9` | Créditos: tarjeta de ventas fiadas por cobrar | `Credits.tsx` | — | Sí |
| `8e55f19` | Asistente con acciones: prepara compras (clienta) y ventas, compras a proveedor, abonos y stock (admin), siempre con confirmación | `supabase/functions/ai-assistant/actions.ts`, `index.ts`, `AngelaChat.tsx` | EF | Sí; nombre y tono del asistente [marca] (Ángela) |
| `a742820` | Categorías configurables (Configuración → Categorías) con el detalle que pide cada una (ml/g, medidas, tallas, tonos) | `lib/productCategories.ts` (+ test), `CategoriesSettings.tsx`, `CategoryDetailFields.tsx`, `useProductCategories.ts`, `20260925020000_product_categories.sql` | BD | Sí; las categorías iniciales del seed [marca] (Manojitos carga las suyas) |
| `f1344f9` | Variantes con stock propio (talla, tono, 30 ml/50 ml): `products.stock` = suma de variantes por trigger; checkout, POS, devoluciones y el asistente descuentan la variante | `20260925030000_product_variants.sql`, `useProducts`, `useSales`, `NewSaleDialog`, `ProductDetail`, `Checkout`, `CartContext`, ai-assistant | BD + EF | **Sí, completo** (sin la migración el checkout falla) |
| `2647bd5` | Enlaces de Google Drive o Dropbox se convierten solos en imagen directa; vista previa en el formulario | `lib/imageUrl.ts` (+ test), `useProducts`, `usePublicProducts`, `Products.tsx` | — | Sí |
| `0add239` | **Por cobrar por clienta** (una tarjeta con deuda total, fecha y contador de facturas). **Editar precios**: la calculadora ya no pisa el precio, no borra el costo ni suma stock; errores de validación en español (`validateFriendly`) | `Sales.tsx`, `Products.tsx`, `lib/validations.ts`, `useProducts.tsx` | — | **Sí, prioridad** (el bug de precios también está en Manojitos) |
| `2a37eb2` | **Marcar pagado** pide cómo pagó (mismo formulario del abono, saldo fijo, método obligatorio); los abonos ya no traen Pago Móvil por defecto | `Sales.tsx` | — | Sí |
| `da1ce30` | **Estructura de costos** (misma fórmula que la planilla de EINA, con pruebas): precio = (costo + envío + empaque + gastos fijos/meta) × (1 + brecha) × (1 + comisiones) / (1 − margen). Reemplaza la calculadora de factor EUR del formulario; "Precios sugeridos" en Productos | `lib/costStructure.ts` (+ test), `hooks/useCostStructure.tsx`, `components/settings/CostStructureSettings.tsx`, `components/products/CostStructurePanel.tsx`, `components/products/SuggestedPricesDialog.tsx`, `Products.tsx`, `Settings.tsx`, `lib/validations.ts`, `20260926010000_product_cost_structure.sql` | BD | Sí. Los parámetros (`business_rules` → `cost_structure`) los carga cada tienda en Configuración → Precios [marca]; si Manojitos prefiere su factor EUR, conservar su calculadora y portar solo la lógica |
| `82461d6` | Configuración: pestaña "Costos y precios" en segundo lugar y tasa de reposición (Binance) también en la pestaña Tasa | `Settings.tsx`, `components/settings/CostStructureSettings.tsx` | — | Sí |
| `313faf4` | Recibo con el detalle de cada abono (`ReceiptPayment`, `paymentDetail`) y botón de recibo en Por cobrar; selector de orden en Ventas (`?orden=`) y Por cobrar (`?orden_cxc=`) | `lib/receipt.ts` (+ test), `components/receipts/ReceiptDialog.tsx`, `pages/Sales.tsx` | — | Sí |
| `017b7d0` | "Mis pedidos" de la clienta: ventas del panel agrupadas por `sale_group_id`, estado de deuda y recibo con abonos (la clienta lee `sale_payments` por la política "Customers can view own sale payments") | `hooks/useCustomerOrders.tsx`, `pages/CustomerOrders.tsx`, `types/index.ts` | — | Sí (verificar que la política exista en Manojitos) |
| `64cb8cf` | **Correos automáticos**: tabla `email_outbox` + disparadores en `notifications`, `sales` (al confirmar, con 45 s de espera para juntar las líneas) y `sale_payments`; pg_cron cada 20 s llama a `send-email` con `x-cron-secret` (flujo 3, `outbox.ts`). Notificaciones con `metadata.email_sent` o `reminder_type` no se repiten. El aviso de pedido nuevo a la administración sale de la cola (se quitó `notifyAdminNewOrder` del checkout) | `supabase/migrations/20260927010000_email_outbox.sql`, `supabase/functions/send-email/{index,outbox,templates}.ts`, `src/lib/notify.ts`, `src/hooks/useCustomers.tsx`, `src/hooks/useSales.tsx`, `supabase/config.toml` | BD + EF | Sí, prioridad. Requiere en Vault `project_url` y `cron_secret` (ya existen si se portó `20260924000100_cron_secret.sql`) y Resend configurado [marca] |
| `fc62d66` | Análisis del crédito modalidad Cashea (niveles, inicial, cuotas, preguntas abiertas) para EINA y Manojitos | `docs/CREDITO-CASHEA.md`, `docs/INDICE.md` | — | Sí (documento compartido) |
| _(este PR)_ | **Cuentas sin duplicados**: `check_unique_customer_data` compara solo dígitos (teléfono: últimos 10; cédula) y correo en minúsculas contra cuentas reales; `handle_new_user` borra el perfil huérfano que dejó una venta del panel con esa cédula/teléfono antes de crear el real. Se quitan las restricciones repetidas `unique_dni_per_customer`/`unique_phone_per_customer` (quedan los índices parciales). El perfil muestra "Ese teléfono/cédula ya pertenece a otra cuenta" | `20260927020000_customer_uniqueness.sql`, `hooks/useCustomerProfile.tsx` | BD | Sí |
| _(este PR)_ | **Notificaciones que se abren**: al tocar una (campana del panel, de la tienda, página de notificaciones) se abre completa con botón a su pantalla (`notificationAction`); nueva página del panel `/notificaciones` (antes "Ver todas" llevaba a la de clientas) | `lib/notificationLinks.ts`, `components/notifications/NotificationDetailDialog.tsx`, `pages/AdminNotifications.tsx`, `NotificationBell.tsx`, `NotificationCenter.tsx`, `StoreHeader.tsx`, `CustomerNotifications.tsx`, `App.tsx`, `adminNav.ts` | — | Sí |
| _(este PR)_ | **Recibo del checkout = factura**: la pantalla de compra lista usa `ReceiptView`/`ReceiptActions` (PDF, compartir, imprimir) con detalles extra (`ReceiptData.details`: entrega, dirección, banco, referencia, inicial y financiado) que también salen en el PDF y en WhatsApp | `pages/Checkout.tsx`, `lib/receipt.ts`, `components/receipts/ReceiptDialog.tsx`, `hooks/useSales.tsx` (`orderId`) | — | Sí |
| _(este PR)_ | **Aviso a la dueña de cada venta**: al confirmar una venta del panel se encola `sale_admin` (45 s); `send-email` crea la notificación "Venta registrada · $X" (clienta, productos, método, factura) que sale por correo. Ventas y pedidos también por **WhatsApp** con CallMeBot si se activa en Configuración → Preferencias (`business_rules.owner_alerts`: número, apikey, activo) con botón de prueba (`owner_whatsapp_test`) | `20260927030000_owner_sale_alerts.sql`, `send-email/{outbox,index,templates}.ts`, `components/settings/OwnerAlertsSettings.tsx`, `Settings.tsx` | BD + EF | Sí; la dueña de Manojitos activa su propio CallMeBot [marca] |
| _(este PR)_ | **"Lo quiero" en productos agotados**: botón en la ficha (con cuenta, un toque; sin cuenta, nombre + WhatsApp + detalle); `request_product` valida, evita duplicados, frena abusos y avisa a la dueña; al reponer stock (`trg_products_restock_requests`) a las clientas con cuenta les llega "¡Volvió lo que querías!" por campana y correo. Panel **Productos pedidos** (`/solicitudes`): agrupado por producto con foto, stock, cuántas lo quieren, orden (más pedidos, recientes, agotados, nombre), filtros por estado, WhatsApp a cada clienta, marcar atendidas; Productos acepta `?q=` | `20260927040000_product_requests.sql`, `hooks/useProductRequests.tsx`, `components/store/RequestProductButton.tsx`, `pages/ProductRequests.tsx`, `ProductDetail.tsx`, `Products.tsx`, `App.tsx`, `adminNav.ts` | BD (+ EF por los enlaces del correo) | Sí |

### 12.4 Datos que NO se portan (propios de EINA)

- Importación de Treinta (productos, clientas, ventas y compras de EINA): `docs/IMPORTACION-TREINTA.md`.
- Correcciones de datos puntuales hechas por SQL (p. ej. costo y precio de K SECRET SUNCREAM).
- Datos de pago de `payment_methods.config`, secretos del Vault y el dominio.

> **Regla:** cada cambio nuevo en EINA agrega su fila aquí (commit, qué, archivos, BD/EF, cómo
> portarlo) además de la fila de §11. Si no está en esta sección, no se ha anotado.
