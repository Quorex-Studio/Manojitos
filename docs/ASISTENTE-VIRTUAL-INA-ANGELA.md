# Asistente virtual: Ina (EINA) ↔ Ángela (Manojitos)

Guía para llevar a **Manojitos** las mejoras que se le hicieron al asistente con inteligencia
artificial en **EINA**. Es el mismo asistente: EINA se copió de Manojitos y aquí se hizo configurable.

> **Nombres — importante**
>
> | Tienda | Nombre del asistente | Repositorio | Dominio |
> |---|---|---|---|
> | **Manojitos** (original) | **Ángela** | Manojitos | — |
> | **EINA** (copia mejorada) | **Ina** | `quorex-studio/einashopv` | einashopv.com |
>
> En el **código** el asistente se sigue llamando `Angela` en los dos proyectos (archivos
> `AngelaChat.tsx`, `AngelaMascot.tsx`, funciones `angela-cron-alerts`, `angela-proactive`,
> tabla `angela_alerts`, RPC `angela_register_sale`, evento `angela:open`). **No hay que
> renombrar nada de eso**: son nombres internos. Lo que ve la clienta (“Ina” o “Ángela”)
> sale de la configuración de cada tienda.

Fecha de corte de esta guía: 25 sep 2026. Commit base de Manojitos del que salió EINA: `c8e6571`.

---

## 1. Resumen: qué cambió

| # | Mejora | Tipo | ¿Llevar a Manojitos? |
|---|---|---|---|
| 1 | Nombre del asistente y de la tienda configurables (ya no escritos a mano) | Plantilla | ✅ Sí |
| 2 | WhatsApp y horario de la tienda configurables | Plantilla | ✅ Sí |
| 3 | Recargo sobre la tasa BCV configurable (EINA: 0 %, Manojitos: 10,7 %) | Plantilla | ✅ Sí (manteniendo 10,7) |
| 4 | Memoria del cliente: se guarda a nombre del admin o del propio cliente, nunca de un perfil al azar | **Seguridad** | ✅ Sí, prioritario |
| 5 | Alertas automáticas (`angela-cron-alerts`): secreto del cron en Vault y alertas solo para administradores | **Seguridad** | ✅ Sí, prioritario |
| 6 | Chat: se puede abrir desde cualquier botón (evento `angela:open`) | Funcional | ✅ Sí |
| 7 | Chat: en el panel (móvil) el botón flotante se oculta y el acceso va en la barra superior | UX | ✅ Sí |
| 8 | Chat: el botón flotante respeta la barra inferior del móvil | UX | ✅ Sí |
| 9 | Textos accesibles (`aria-label`) con el nombre configurable | Accesibilidad | ✅ Sí |
| 10 | Conocimiento de la tienda (qué vende, envíos, pagos, política de cambios, lema) | Contenido | ⚠️ Solo la estructura; el texto es propio de cada tienda |
| 11 | Respuestas de respaldo (sin IA) adaptadas a belleza | Contenido | ⚠️ Solo la estructura |
| 12 | Mapa de estilos (“fiesta”, “piel grasa”, “playa”…) de maquillaje/skincare | Contenido | ❌ No (Manojitos conserva el suyo de ropa y perfumes) |
| 13 | Avatar: isotipo de EINA en círculo vino, en vez de la mascota rosa | Marca | ❌ No (Manojitos conserva su mascota) |
| 14 | Se quitó la variable sin uso `HUGGING_FACE_ACCESS_TOKEN` | Limpieza | ✅ Sí |
| 15 | **Acciones con confirmación**: la clienta compra desde el chat y la administración registra ventas, compras, abonos y entradas de stock escribiéndole | Funcional | ✅ Sí, prioritario |
| 16 | La tasa BCV del asistente se filtra por `currency = 'USD'` (antes podía tomar la del euro) | **Bug** | ✅ Sí, prioritario |
| 17 | “Quiero esto” en la ficha de un producto: el chat envía la página y la IA sabe qué producto está en pantalla | Funcional | ✅ Sí |
| 18 | Variantes: `preparar_carrito`, `preparar_venta` y `preparar_entrada_stock` aceptan `variant` (talla, tono o presentación); si falta, devuelven las opciones para que la IA pregunte | Funcional | ✅ Sí, junto con la tabla `product_variants` |
| 19 | **Reporte de cuentas por cobrar en PDF**: al pedir “el reporte”, “el PDF” o “el estado de cuenta de María”, la asistente responde con una tarjeta PDF (Imprimir · Enviar · PDF), el mismo que el botón de Por cobrar | Funcional | ✅ Sí (redesplegar `ai-assistant`) |

---

## 2. Cambios que conviene llevar a Manojitos

### 2.1 Nombre, marca y contacto configurables (backend)

**Archivo:** `supabase/functions/ai-assistant/index.ts` (al inicio del archivo)

Antes (Manojitos) el nombre “Ángela”, “Manojitos” y el WhatsApp `+58 426-3863042` estaban
escritos en muchos lugares. Ahora salen de secretos de Supabase, con un valor por defecto:

```ts
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "EINA";          // Manojitos: "Manojitos"
const ASSISTANT_NAME = Deno.env.get("ASSISTANT_NAME") ?? "Ina";    // Manojitos: "Ángela"
const BRAND_WHATSAPP = Deno.env.get("BRAND_WHATSAPP") ?? "";       // Manojitos: "+58 426-3863042"
const STORE_HOURS = Deno.env.get("STORE_HOURS") ?? "Lunes a Viernes: 8:00 AM - 6:00 PM · Sábados: 9:00 AM - 1:00 PM";
const CONTACT_LINE = BRAND_WHATSAPP
  ? `nuestro WhatsApp **${BRAND_WHATSAPP}**`
  : "la sección de **Atención al Cliente** de la web";
```

Y se reemplazaron todas las apariciones fijas:

| Dónde | Antes (Manojitos) | Ahora |
|---|---|---|
| Prompt principal | `Eres Ángela, asistente inteligente de Manojitos` | `Eres ${ASSISTANT_NAME}, asistente inteligente de ${BRAND_NAME}` |
| Historial de la conversación | `'Ángela'` | `ASSISTANT_NAME` |
| Cierre del prompt | `Respuesta de Ángela:` | `Respuesta de ${ASSISTANT_NAME}:` |
| Limpieza de la respuesta | `/^Respuesta de Ángela:\s*/i` | `new RegExp(\`^Respuesta de ${ASSISTANT_NAME}:\\s*\`, "i")` |
| Recordatorio de crédito | `... - Manojitos 🩷` | `... - ${BRAND_NAME} 🩷` |
| Saludos de respaldo | `Soy **Ángela**, tu asistente de Manojitos` | `Soy **${ASSISTANT_NAME}**, tu asistente de ${BRAND_NAME}` |
| Ubicación, envíos, tonos/tallas | WhatsApp fijo `+58 426-3863042` | `${CONTACT_LINE}` |
| Horario | texto fijo | `${STORE_HOURS}` |
| Crédito del cliente | `Tu crédito en Manojitos` | `Tu crédito en ${BRAND_NAME}` |

Además se agregó al prompt una instrucción de contacto:

```
- Para contacto con la tienda remite a ${BRAND_WHATSAPP ? `el WhatsApp ${BRAND_WHATSAPP}` : 'la sección de Atención al Cliente de la web'}. Horario: ${STORE_HOURS}.
```

**En Manojitos**, después de copiar el archivo, cargar los secretos:

```bash
supabase secrets set BRAND_NAME="Manojitos" ASSISTANT_NAME="Ángela" \
  BRAND_WHATSAPP="+58 426-3863042" \
  STORE_HOURS="Lunes a Viernes: 8:00 AM - 6:00 PM · Sábados: 9:00 AM - 1:00 PM"
```

### 2.2 Recargo sobre la tasa BCV

En Manojitos el recargo era `extraPercentage: 10.7` fijo. En EINA se puso en `0` porque sus
precios son referenciales a tasa BCV sin recargo, y se simplificaron los textos (fórmula,
“tasa efectiva”, “si pagas en USD ahorras…”).

**Recomendación para Manojitos:** no copiar el `0`. Hacerlo configurable y conservar sus textos
de recargo cuando sea mayor que 0:

```ts
const EXTRA_PERCENTAGE = Number(Deno.env.get("BCV_EXTRA_PERCENTAGE") ?? "0"); // Manojitos: 10.7
// ...
extraPercentage: EXTRA_PERCENTAGE,
```

Y en el prompt y en las respuestas de respaldo mostrar la línea del recargo solo si
`extraPercentage > 0` (en Manojitos se ve igual que hoy; en EINA no aparece).

### 2.3 Seguridad: dueño de la memoria del cliente

**Archivo:** `supabase/functions/ai-assistant/index.ts` (al final, donde se guarda la memoria)

Antes, si quien escribía era una clienta, la memoria se guardaba a nombre del **primer perfil
que devolviera la tabla `profiles`**, que podía ser cualquier persona:

```ts
// ANTES (Manojitos) — no usar
let memoryAdminId: string = isAdmin ? authenticatedUserId : '';
if (!memoryAdminId) {
  const { data: adminData } = await supabase.from('profiles').select('user_id').limit(1);
  memoryAdminId = adminData?.[0]?.user_id || customerId;
}
```

Ahora el dueño es el admin autenticado o la propia clienta:

```ts
// AHORA (EINA)
// Dueño del registro de memoria: el admin autenticado o el propio cliente
// (nunca un perfil arbitrario).
const memoryAdminId: string = isAdmin ? authenticatedUserId : customerId;
```

### 2.4 Seguridad: alertas automáticas (`angela-cron-alerts`)

**Archivos:** `supabase/functions/angela-cron-alerts/index.ts` y la migración
`supabase/migrations/20260924000100_cron_secret.sql`

Dos problemas corregidos:

1. **El cron no tenía cómo autenticarse sin configurar a mano `CRON_SECRET`.** Ahora el secreto
   se genera solo en el Vault (`cron_secret`) y la función lo valida con la RPC
   `verify_cron_secret` (solo `service_role`). Si existe la variable `CRON_SECRET`, se sigue
   usando esa. Los dos trabajos de `pg_cron` (`angela-hourly-alerts` cada hora y
   `angela-stock-check` cada 4 horas) envían el secreto en el header `x-cron-secret`.
   La URL del proyecto también se lee del Vault (`project_url`).
2. **Las alertas (con deudas y nombres de clientes) se enviaban a todos los perfiles.** Antes
   se hacía `from('profiles').select('user_id')`. Ahora solo van a los administradores:

```ts
const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
const adminUsers = (usersPage?.users ?? [])
  .filter((u) => u.app_metadata?.is_super_admin === true)
  .map((u) => ({ user_id: u.id }));
```

**En Manojitos:** copiar la función y aplicar la migración. La migración necesita que en el
Vault de Manojitos existan `project_url` (URL del proyecto de Supabase de Manojitos) y crea
`cron_secret` sola si no existe.

### 2.5 Chat en la web (`src/components/AngelaChat.tsx`)

| Cambio | Detalle |
|---|---|
| Nombre configurable | Todos los textos usan `BRAND.assistantName` y `BRAND_NAME` (de `src/config/brand.ts`): bienvenida, burbuja “¡Hola! Soy …”, cabecera, “… está pensando…”, `aria-label` del botón, del chat y del campo de texto. |
| Abrir desde cualquier botón | Nuevo `src/lib/events.ts` con `OPEN_ANGELA_EVENT = 'angela:open'`. El chat escucha el evento; cualquier botón lo abre con `window.dispatchEvent(new Event(OPEN_ANGELA_EVENT))`. Sirve porque el chat se carga en diferido (`lazy` en `App.tsx`). |
| Acceso en el panel móvil | En `src/components/layout/AdminMobileNav.tsx` hay un botón con el nombre del asistente en la barra superior que dispara ese evento. En las rutas del panel, el botón flotante se oculta en móvil (`hidden md:flex`) para no tapar contenido, y no aparece la burbuja de saludo. |
| Posición sobre la barra inferior | El botón flotante sube lo que mida la barra de navegación inferior: `bottom: calc(var(--mobile-tabbar, 0px) + 1rem + env(safe-area-inset-bottom))`. |
| Capa | `z-50` → `z-40`, para que los diálogos y menús queden por encima del botón. |

Configuración del nombre en la web (`src/config/brand.ts`):

```ts
assistantName: env.VITE_ASSISTANT_NAME || 'Ina',   // Manojitos: VITE_ASSISTANT_NAME=Ángela
```

En Vercel (o en el `.env`) de Manojitos: `VITE_ASSISTANT_NAME=Ángela`.

> Los cambios de esta sección dependen de otras piezas de la plantilla EINA: `src/config/brand.ts`,
> `src/components/layout/adminNav` (`ADMIN_NAV_FLAT`, `isAdminPathActive`) y la variable CSS
> `--mobile-tabbar` de la barra inferior. Si Manojitos no las tiene todavía, copiar primero
> `brand.ts` y `adminNav`, o adaptar esas líneas (ver §4).

### 2.6 Limpieza

Se quitó `const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');`: no se usaba. El
asistente usa solo Gemini (`GEMINI_API_KEY`).

### 2.7 Acciones: preparar → confirmar (`ai-assistant/actions.ts`)

La asistente pasa de solo consultar a **trabajar**, sin perder seguridad. Regla de oro: la IA
**nunca escribe** en la base de datos.

1. Gemini recibe herramientas `preparar_*` además de las de lectura:

   | Herramienta | Quién | Ejemplo | Al confirmar |
   |---|---|---|---|
   | `preparar_carrito` | Clienta y admin | “quiero 2 de esos sérums” | Se agrega al carrito en el navegador (`addItem`); luego paga en el checkout |
   | `preparar_venta` | Solo admin | “vendí 2 bases a María por pago móvil” / “…fiado, abonó $10” | Filas `sales` en estado `pending` con un `sale_group_id` → `confirm_pos_sale` (descuenta stock y registra el pago) → `process_group_abono` si hay abono inicial |
   | `preparar_compra` | Solo admin | “compré $80 en YesStyle” | Crea el proveedor si no existe y guarda la compra `paid` |
   | `preparar_abono` | Solo admin | “María abonó $20 por Zelle” | `process_group_abono` repartido desde la deuda fiada más antigua |
   | `preparar_entrada_stock` | Solo admin | “llegaron 10 protectores” | Suma unidades al producto |

2. Cada `preparar_*` **valida con datos reales** (producto único, stock, método de pago, deuda
   pendiente). Si algo falta responde `ambiguo`, `no_encontrado`, `sin_stock`, `falta_dato`,
   `excede` o `sin_deuda`, y la IA pregunta en vez de inventar.
3. Si todo está bien devuelve `propuesta_lista` y la respuesta del chat trae `proposals[]`. El
   chat muestra una tarjeta con el detalle y los botones **Confirmar / Cancelar**. El prompt
   prohíbe decir “ya lo registré” antes de que la persona confirme.
4. Confirmar envía `{ action: { type, data } }`. El servidor **vuelve a comprobar que es admin**
   (token verificado, no el cuerpo de la petición), revalida el stock y escribe con el **token de
   la persona** (`createClient(url, anonKey, { Authorization })`): RLS e `is_admin()` siguen
   aplicando. La clienta no puede confirmar nada de administración (403).
5. Las ventas creadas llevan la nota `[Registrada por la asistente]` para identificarlas.
6. **Variantes** (migración `product_variants`): si el producto tiene tallas, tonos o presentaciones, cada ítem lleva `variant`. Con una sola variante se usa sola; con varias y sin `variant`, la herramienta responde `falta_dato` con `options` (etiqueta, stock y precio). La venta guarda `variant_id`/`variant_label` y `confirm_pos_sale` descuenta esa variante.

**Para Manojitos:** copiar `actions.ts` tal cual. En `index.ts`, importar sus exportaciones,
agregar el bloque `ADMIN_EXECUTABLE` antes del manejo de `action` antiguo, sumar
`ACTION_TOOL_DECLARATIONS` a las herramientas (la clienta solo `preparar_carrito`), enrutar
`isActionTool` a `prepareAction` y devolver `proposals`. En `AngelaChat.tsx`, copiar
`ProposalCard` y `confirmProposal`. Revisar que `PAYMENT_LABELS` tenga los métodos de
Manojitos. Verificado en EINA: las cuatro escrituras corrieron como admin dentro de una
transacción que se deshizo al final (stock, pago, abono parcial y compra correctos).

### 2.9 Reportes en PDF como adjunto (`generar_reporte_cxc`)

Pedido de la dueña: que al pedirle el reporte a Ina (o a Ángela) lo entregue **en PDF**.

1. **Herramienta** `generar_reporte_cxc` (solo admin, en `ADMIN_ONLY_TOOLS`), con `client_name`
   opcional y `agrupar` (`clienta` o `categoria`: "mándame el reporte por categoría"). Resuelve la clienta con `resolveClientName` (si hay varias, la IA pregunta), calcula
   el resumen con `receivablesSummary` —misma regla que el módulo Por cobrar: toda venta no anulada
   con saldo, agrupada por venta y por clienta— y empuja un **adjunto** a `ctx.attachments`:
   `{ id, type: 'CXC_REPORT_PDF', title, lines, client_name }`. Al modelo le devuelve el total,
   las clientas, las facturas, quién debe más y la instrucción de decir que el PDF está abajo.
2. **Respaldo por intención**: si la administradora pide un reporte/PDF/estado de cuenta de
   cuentas por cobrar (`wantsCxcReport`) y el modelo no llamó la herramienta (o no hay IA), el
   servidor adjunta el PDF general igual y, si no hay texto útil, redacta el total.
3. **Respuesta**: el JSON trae `attachments` junto a `proposals`.
4. **Chat** (`AngelaChat.tsx` → `ReportAttachmentCard`): tarjeta con banda de marca, total y
   conteos, y botones Imprimir · Enviar · PDF. El PDF **se arma en el navegador** con
   `loadReceivablesReport` (sesión de la administradora; RLS protege los datos) y el mismo
   `buildReceivablesPdf` del botón: ambos PDF son idénticos. Los datos se precargan al aparecer la
   tarjeta para que compartir/imprimir corran dentro del clic, y el generador se importa en
   diferido (la tienda no descarga jsPDF).
5. El prompt dice: “Si piden un REPORTE, INFORME, PDF, ESTADO DE CUENTA… usa generar_reporte_cxc.
   Nunca digas que no puedes generar PDF.”

**Para Manojitos:** copiar los cambios de `index.ts` (tipo `Attachment`, `wantsCxcReport`,
`receivablesSummary`, `pushCxcAttachment`, la herramienta, `activeOnly` en `loadSaleGroups`,
`attachments` en la respuesta y la línea del prompt), `ReportAttachmentCard` en `AngelaChat.tsx`
y los archivos de `src/lib` que lista `docs/REPORTES-PDF.md` §7. Redesplegar `ai-assistant`.
Probar como admin: “mándame el reporte de cuentas por cobrar en PDF” y “estado de cuenta de <clienta>”.

### 2.8 Bug de la tasa

`buildBusinessContext` leía la última fila de `exchange_rates` sin filtrar la moneda. Como la
tabla guarda también el euro, la asistente podía calcular precios en Bs con la tasa del euro.
Ahora usa `.eq('currency', 'USD')`, igual que la confirmación de acciones.

---

### 2.10 Respuestas más inteligentes y organizadas (04-10-2026)

**Problema:** respuestas genéricas y desordenadas. El chat mostraba texto plano (los `**` y las
viñetas salían como asteriscos) y el modelo recibía todo en un solo bloque, sin el historial real
de la conversación ni reglas de estilo. Si Gemini fallaba, salían menús de plantilla.

**Cambios** (el motor es el mismo en todas las tiendas; solo cambia `store-profile.ts`):

| Qué | Dónde |
|---|---|
| Chat con formato: negritas, listas, títulos, tablas y enlaces internos (sin HTML inyectado) | `src/lib/chatMarkdown.ts` (+ test), `src/components/chat/ChatMarkdown.tsx`, `AngelaChat.tsx` |
| Reglas de estilo como `systemInstruction`: respuesta directa primero, detalle ordenado, precios USD y Bs, un siguiente paso concreto; nada de "puedo ayudarte con…" | `ai-assistant/index.ts` (INSTRUCCIONES DEL SISTEMA) |
| Conversación real: turnos alternados clienta/asistente (16 últimos), no un resumen de 300 caracteres | `index.ts` (`conversation`) |
| Contexto más rico: 30 productos con tallas y presentación, categorías configuradas, métodos de pago activos, fecha en Venezuela | `buildBusinessContext` |
| Herramientas nuevas: `detalle_producto`, `recomendar_productos` (ocasión, talla, presupuesto), `analisis_ventas` y `resumen_negocio` (admin); `buscar_producto` busca también por categoría y descripción y devuelve tallas y enlace | `executeReadOnlyTool` |
| Perfil de la tienda separado del motor: qué vende, envíos, crédito, cambios, ejemplos de categorías y de recomendación | `ai-assistant/store-profile.ts` |
| Modelo configurable (`GEMINI_MODEL`) con respaldo; la última vuelta de herramientas obliga a redactar; el log dice qué motor respondió (`Assistant engine: gemini:<modelo>` o `fallback`) y la respuesta lo trae en `engine` | `index.ts` |

**Para portar a otra tienda:** copiar `index.ts`, `actions.ts`, `chatMarkdown.ts`, `ChatMarkdown.tsx`
y el cambio de `AngelaChat.tsx`; escribir su propio `store-profile.ts`; desplegar `ai-assistant`.

**Si siguen saliendo respuestas de plantilla:** buscar en los logs de la función
`Assistant engine: fallback` o `Gemini API error`: significa que falta `GEMINI_API_KEY` o que el
modelo no existe; fijar uno válido con el secreto `GEMINI_MODEL`.

### 2.11 Memoria de la asistente (04-10-2026)

**Antes:** al cerrar el chat se perdía la conversación, y la memoria de cada persona
(`customer_memory`) nunca se guardaba: el upsert usaba `onConflict (customer_user_id, memory_key)`
y el único índice único era parcial. Además, el filtro que la leía no devolvía nada nunca.

| Qué | Cómo | Dónde |
|---|---|---|
| 1. Memoria de comportamiento | Índice único completo; la lectura filtra bien por vencimiento; "productos vistos" solo guarda nombres del catálogo (no montos ni títulos en negrita) | migración `20261004010000_assistant_memory.sql`, `ai-assistant/index.ts` |
| 2. Conversación guardada | Tabla `assistant_conversations` (una por persona, últimos 40 mensajes con sus adjuntos). La escribe la función; el chat la restaura al cargar, en cualquier dispositivo. Botón **Nueva conversación** en el encabezado | `AngelaChat.tsx`, `index.ts` |
| 3. Lo que importa | Herramientas `recordar` (dato, preferencia o recordatorio con fecha) y `olvidar` (borra o marca hecho). Lo guardado va en las instrucciones ("LO QUE RECUERDAS…") y los recordatorios de hoy o vencidos se mencionan al saludar. Máximo 40 notas activas | tabla `assistant_memories`, `index.ts` |
| 4. Control y privacidad | Cada persona ve y borra solo lo suyo (RLS). **Configuración → "Lo que {asistente} recuerda"** en Mi cuenta y en el panel (Preferencias): borrar una nota o **Borrar todo** (notas, conversación y memoria de comportamiento). Nunca se guardan contraseñas, cédulas, tarjetas ni números largos | `components/assistant/AssistantMemoryCard.tsx`, `CustomerSettings.tsx`, `Settings.tsx` |

**Para portar:** aplicar la migración, copiar `AssistantMemoryCard.tsx`, los cambios de
`AngelaChat.tsx` y de `index.ts`, agregar las dos tablas a `types.ts` y desplegar `ai-assistant`.

## 3. Cambios propios de EINA (no copiar el contenido)

Estos cambios adaptan a Ina a una tienda de belleza. En Manojitos hay que **mantener la
estructura** y poner el contenido de Manojitos.

### 3.1 Bloque “LO QUE OFRECE LA TIENDA” en el prompt (desde 2.10 vive en `store-profile.ts`)

Se agregó un bloque fijo con los datos del negocio para que la IA no invente políticas.
Contenido actual de EINA:

```
LO QUE OFRECE LA TIENDA:
- Maquillaje, skincare y accesorios importados, en la Isla de Margarita.
- Asesoría personalizada GRATIS (tono de base, rutina de skincare).
- Precios referenciales a tasa BCV del día.
- Delivery en toda la Isla de Margarita y envíos nacionales por MRW.
- Cambios: por higiene, el maquillaje y el skincare abiertos o usados no tienen cambio. Si el producto llegó equivocado o defectuoso, la clienta debe escribir dentro de las primeras 72 horas (3 días) desde que lo recibe.
- Métodos de pago: Pago Móvil, Transferencia Bs, Zelle, Binance, Zinli y Wally.
- Lema: "No es gasto, es inversión en tu mejor versión".
```

**Para Manojitos**, el mismo bloque con sus datos, por ejemplo: ropa para damas y caballeros,
perfumes y accesorios; tienda virtual con envíos a toda Venezuela y entregas personales
coordinadas; sus métodos de pago (Pago Móvil, efectivo USD/Bs, Zelle, transferencias); el
recargo del 10,7 %; y su política de cambios (tallas, prendas sin usar, plazo). **Los datos
exactos los debe confirmar la dueña de Manojitos**: esta guía no los inventa.

### 3.2 Categorías de ejemplo en las instrucciones

| Manojitos | EINA |
|---|---|
| `("Ropa", "Ropa Interior", "Perfume", etc.)` | `("Maquillaje", "Skincare", "Accesorios", etc.)` |

### 3.3 Respuestas de respaldo (cuando Gemini no responde)

La función `generateFallbackResponse` responde sin IA a preguntas frecuentes. En EINA se
reescribieron los textos:

| Tema | Manojitos | EINA |
|---|---|---|
| Niños | “no tenemos prendas infantiles… ropa para caballeros, damas, perfumes” | “no tenemos productos infantiles… maquillaje, skincare y accesorios” |
| Ubicación | tienda virtual, envíos a toda Venezuela | tienda virtual en Margarita, delivery en la Isla y MRW |
| Envíos | envíos nacionales + entregas personales | delivery en la Isla + envíos nacionales por MRW |
| Pagos | Pago Móvil, efectivo, Zelle, transferencias + 10,7 % | Pago Móvil, Transferencia Bs, Zelle, Binance, Zinli, Wally |
| Tasa BCV / precios | muestra tasa efectiva con recargo y el ahorro en USD | solo tasa BCV (sin recargo) |
| Colores / tallas | “tallas y colores… medidas de una prenda” | “tonos… asesoría personalizada GRATIS” |
| Detección de categorías | `ropa`, `perfume`, `interior`, `pantalon`, `playa` | `maquillaje`, `skincare`, `accesorio`, `bolso` |

Lo portable es que todos usan `${BRAND_NAME}`, `${CONTACT_LINE}` y `${STORE_HOURS}` en vez de
textos fijos (§2.1). **En Manojitos, conservar sus textos** y solo cambiar los valores fijos
por esas variables.

### 3.4 Mapa de estilos

`styleMap` relaciona palabras de la clienta con productos. Manojitos tenía `playero`, `gym`,
`fiesta → vestido/body/perfume`, `hombre`, `dama`, `perfume`… EINA lo cambió a belleza:
`fiesta → labial/sombra/iluminador`, `piel grasa`, `acné`, `sol/playa → protector`, `ojos`,
`labios`, `regalo`, `brochas`… **Manojitos debe conservar el suyo.**

### 3.5 Avatar (`src/components/AngelaMascot.tsx`)

- **Manojitos:** mascota rosa (`src/assets/stitch-rosa-mascot.png`) sobre un fondo degradado
  rosa, con `mix-blend-mode: multiply` y animación de balanceo.
- **EINA:** isotipo de la marca (crema) sobre un círculo del color principal (vino), sin
  degradados, porque la guía de marca de EINA prohíbe recolorear el logo. Se importa desde
  `src/config/brand-assets.ts` (`BRAND_MASCOT`) y la animación es más sobria.

**Recomendación para Manojitos:** mantener su mascota. Si se quiere la misma estructura
configurable, exportar `BRAND_MASCOT` desde un `brand-assets.ts` que apunte a
`stitch-rosa-mascot.png` y dejar el estilo del círculo como estaba.

---

## 4. Checklist para aplicar en Manojitos

Hacerlo en una rama nueva y con un PR, igual que en EINA.

**Backend (Supabase de Manojitos)**
1. [ ] Copiar `supabase/functions/ai-assistant/index.ts` de EINA.
2. [ ] Volver a poner el contenido propio de Manojitos (§3): bloque “LO QUE OFRECE LA TIENDA”,
       categorías de ejemplo, respuestas de respaldo y `styleMap`.
3. [ ] Hacer configurable el recargo (§2.2) con `BCV_EXTRA_PERCENTAGE=10.7`.
4. [ ] Cargar los secretos `BRAND_NAME`, `ASSISTANT_NAME`, `BRAND_WHATSAPP`, `STORE_HOURS` y
       `BCV_EXTRA_PERCENTAGE` (§2.1).
5. [ ] Confirmar que `GEMINI_API_KEY` ya está cargado. `HUGGING_FACE_ACCESS_TOKEN` se puede borrar.
6. [ ] Copiar `supabase/functions/angela-cron-alerts/index.ts`.
7. [ ] Verificar que en el Vault exista `project_url`. Aplicar la migración
       `20260924000100_cron_secret.sql`.
8. [ ] Desplegar las dos funciones. `ai-assistant` va con `verify_jwt = false`: la función
       valida el usuario por su cuenta (bloque “AUTHENTICATION GATE (A-01)”) y responde 401 sin sesión.

**Web (Vercel de Manojitos)**
9. [ ] Si falta, copiar `src/config/brand.ts` y configurar `VITE_ASSISTANT_NAME=Ángela`,
       `VITE_BRAND_NAME=Manojitos`, etc.
10. [ ] Crear `src/lib/events.ts` (§2.5).
11. [ ] Copiar los cambios de `src/components/AngelaChat.tsx`. Si Manojitos no tiene
        `adminNav`, reemplazar la detección del panel por una comprobación de ruta, por ejemplo
        `pathname.startsWith('/dashboard')` y las demás rutas del panel.
12. [ ] (Opcional) Agregar el botón con el nombre del asistente en la barra superior del panel móvil.
13. [ ] Mantener la mascota rosa en `AngelaMascot.tsx` (§3.5).

**Pruebas**
14. [ ] Sin sesión: la función responde 401.
15. [ ] Con sesión de clienta: “Hola” debe responder “Soy **Ángela**, tu asistente de Manojitos”.
16. [ ] Preguntar “¿cuál es la tasa?”: debe mostrar el recargo del 10,7 %.
17. [ ] Preguntar por envíos y por pagos: deben salir los datos de Manojitos y su WhatsApp.
18. [ ] Como admin: “¿a quién debo cobrar?” debe listar las ventas fiadas reales.
19. [ ] Revisar en la tabla `angela_alerts` / `notifications` que las alertas solo lleguen al admin.

---

## 5. Estado en EINA (referencia)

| Pieza | Estado |
|---|---|
| `ai-assistant` | Desplegada (v4): política de 72 horas, acciones con confirmación, tasa USD y variantes. |
| `angela-cron-alerts` | Desplegada, con el secreto en Vault. |
| `angela-proactive` | Sin cambios respecto a Manojitos (no tiene nombres de marca). |
| Nombre en la web | `VITE_ASSISTANT_NAME=Ina` en Vercel. |
| Secretos del asistente en Supabase | No hace falta cargarlos: los valores por defecto del código ya son los de EINA. |

Mantener esta guía al día: cada vez que se mejore a Ina, agregar la fila en §1 y el detalle
en §2 o §3, indicando si se lleva a Manojitos.
