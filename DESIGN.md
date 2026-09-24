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
  (Nuevo / Más vendido / Últimas unidades); botón circular 44px arriba-der para agregar
  (o "Elegir talla" → ficha). Debajo: categoría (`label`, muted) · nombre (body 600, 2 líneas) ·
  precio. Hover: la imagen escala 1.03; nada más.
- **Botón primario**: pill `primary`, texto `primary-foreground` 600, h-12 (móvil) / h-11 (desktop).
- **Botón secundario**: pill `surface` con borde `hairline`, texto `ink`.
- **Chips de categoría**: pill; activo = `ink` con texto blanco; inactivo = `surface` + borde.
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
