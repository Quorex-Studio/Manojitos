// Perfil de ESTA tienda para la asistente. Es lo único propio de cada marca: el motor
// (index.ts, actions.ts) es el mismo en todas las tiendas de la plantilla.
// Manojitos · Ángela

/** Recargo sobre la tasa BCV en pagos en bolívares (0 = precios referenciales sin recargo). */
export const EXTRA_PERCENTAGE = 10.7;

/** Lo que la asistente debe saber de la tienda (políticas, envíos, crédito). */
export const STORE_PROFILE = `LO QUE OFRECE LA TIENDA:
- Boutique: ropa para damas y caballeros, ropa interior y lencería, ropa de playa y deportiva, calzado, accesorios y perfumes.
- Precios en USD con su equivalente en Bs a tasa BCV del día.
- Compra a crédito: una inicial y el resto en cuotas (por lo general 2 cuotas quincenales, según el plan del producto). Necesita cuenta verificada (cédula y selfie). Las cuotas se pueden adelantar o abonar por partes.
- Delivery en la Isla de Margarita: gratis en compras de más de $30 y en Marcano; $2 en Gómez y Díaz; $4 en el resto de los municipios. Envíos nacionales por MRW, Zoom o Tealca: el envío lo cobra la agencia al recibir.
- Cambios o errores en la factura: escribir a atención al cliente dentro de las primeras 24 a 48 horas de recibido el pedido.
- Tallas: cada prenda muestra sus tallas disponibles. Si la clienta duda, pregúntale la talla que suele usar o sus medidas y para qué ocasión es.
- Tono de marca: cercano, alegre y elegante; la clienta es "amiga".`;

/** Ejemplos de categorías y de pedido para las instrucciones (vocabulario de la tienda). */
export const CATEGORY_EXAMPLES = '"Ropa", "Ropa Interior", "Perfumes"';
export const CART_EXAMPLE = 'agrégame la blusa';
/** Forma de una buena recomendación (solo el formato: los productos reales salen de las herramientas). */
export const RECOMMENDATION_EXAMPLE = `Para una salida de noche te quedan muy bien:
- **<producto 1>** — $<precio> (Bs <precio en Bs>) · tallas <disponibles> · <por qué le queda>
- **<producto 2>** — $<precio> · <dato útil: combina con…, último disponible…>
- **<producto 3>** — $<precio> · <dato útil>
¿Qué talla usas? Así te confirmo cuál tienes disponible.`;
