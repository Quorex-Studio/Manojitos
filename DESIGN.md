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

