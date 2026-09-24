---
version: 1
name: EINA-boutique
description: |
  Boutique de moda venezolana (ropa, lencería, perfumes, accesorios) con venta a crédito.
  Sistema "la foto manda": fotografía de producto sobre un estudio neutro cálido, chrome
  sobrio de tinta + blanco cálido, un solo acento de marca (rosa) para acciones y un
  toque dorado reservado a detalles premium. Inspirado en la disciplina retail de Nike
  (getdesign.md/nike) y la calidez redondeada de Airbnb (getdesign.md/airbnb).

colors:
  ink: "#1c1517"            # texto y CTA oscuro (hsl 340 20% 8%)
  canvas: "#faf8f5"         # fondo de página, blanco cálido
  surface: "#ffffff"        # tarjetas / paneles
  studio: "#f3eee9"         # fondo de la foto de producto (el "estudio")
  hairline: "#e4ddd6"       # divisores 1px
  muted: "#6f6166"          # texto secundario (contraste AA sobre canvas)
  primary: "#d4708a"        # rosa EINA — CTA principal, estado activo, favoritos
  primary-foreground: "#ffffff"
  gold: "#c2922e"           # solo detalles premium (etiqueta, estrella, línea fina)
  sale: "#c62828"           # SOLO precio en oferta / agotado
  success: "#1f7a4d"        # en stock, pedido confirmado

typography:
  display: { fontFamily: Playfair Display, weight: 500, size: "40–64px", lineHeight: 1.05 }
  heading: { fontFamily: Playfair Display, weight: 500, size: "24–32px", lineHeight: 1.2 }
  body:    { fontFamily: Quicksand, weight: 500, size: 15px, lineHeight: 1.55 }
  label:   { fontFamily: Quicksand, weight: 600, size: 12px, letterSpacing: 0.08em, textTransform: uppercase }
  price:   { fontFamily: Quicksand, weight: 700, size: 16px, fontVariant: tabular-nums }

rounded: { card-image: 16px, panel: 20px, pill: 9999px }
spacing: { base: 8px, card-gap: 16px, section: 64px (desktop) / 40px (móvil) }
elevation: { none: "0", hover: "0 8px 24px -12px rgb(28 21 23 / .18)" }
---

## Principios

1. **La foto es la tarjeta.** El producto va a sangre (`object-cover`, 4:5) sobre `studio`.
   Sin bordes, sin sombras en reposo. El nombre y el precio van **siempre visibles** debajo.
2. **Un acento, una acción.** El rosa `primary` es para la acción principal de cada vista
   (Agregar, Pagar, Registrarse) y para estados activos. Nunca como fondo decorativo.
3. **Dorado = detalle, no bloque.** Solo en etiquetas premium, estrellas y líneas finas.
   Nunca en botones grandes ni en fondos.
4. **Rojo solo para dinero en riesgo.** Precio en oferta y "Agotado". Nada más.
5. **Pastillas para acciones.** Todo botón es `pill` (o círculo para íconos). Altura mínima
   44px en móvil (objetivo táctil).
6. **Sin brillos.** Nada de glow, shimmer, text-shadow ni gradientes en texto o botones.
   El movimiento es corto (≤250ms) y respeta `prefers-reduced-motion`.
7. **Precio doble, jerarquía clara.** USD en `ink` (price), Bs debajo en `muted`. Si no hay
   tasa, se oculta el Bs (nunca "0,00 Bs").

## Componentes

- **ProductCard**: imagen 4:5 `rounded-card-image` sobre `studio`; una etiqueta máx. arriba-izq
  (Nuevo / Más vendido / Últimas unidades); botón circular 44px arriba-der para agregar
  (o "Elegir talla" → ficha). Debajo: categoría (`label`, muted) · nombre (body 600, 2 líneas) ·
  precio. Hover: la imagen escala 1.03; nada más.
- **Botón primario**: pill `primary`, texto blanco 600, h-12 (móvil) / h-11 (desktop).
- **Botón secundario**: pill `surface` con borde `hairline`, texto `ink`.
- **Chips de categoría**: pill; activo = `ink` con texto blanco; inactivo = `surface` + borde.
- **Hero**: texto a la izquierda + collage de 2–3 productos reales a la derecha (móvil: foto
  arriba, texto abajo). Un solo CTA primario + un enlace secundario.
- **Estado vacío**: ícono lineal 48px en círculo `studio`, título heading, 1 línea muted,
  1 CTA primario.

## Qué no hacer

- No usar `bg-gold` en botones ni `btn-shimmer`.
- No ocultar nombre/precio del producto detrás de un hover.
- No mezclar rosa y dorado en el mismo control.
- No usar clases Tailwind inexistentes (p. ej. `h-8.5`): el control colapsa.
