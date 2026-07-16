# Respuestas Técnicas - Defensa de Tesis Manojitos

Este documento recopila las justificaciones arquitectónicas, medidas de seguridad y decisiones técnicas clave implementadas en el sistema Manojitos. Está estructurado para responder a un jurado calificador sobre cómo se construyeron los módulos críticos del sistema.

---

## 1. Validación de Inputs y Formularios (Frontend y Backend)

**Concepto Clave:** Validación en Capas (Defense in Depth) e Integridad de Datos.

**Respuesta Técnica:**
No se confió exclusivamente en el frontend para validar datos, ya que un atacante puede interceptar las peticiones HTTP. Se aplicó una estrategia de **Validación en Dos Capas**:

1. **Frontend (React / TypeScript):**
   - **Restricción en Tiempo Real:** Se utilizaron Expresiones Regulares (RegEx) controladas por el estado de React. Por ejemplo, en el Checkout, el campo de "N° de Referencia Bancaria" restringe dinámicamente cualquier carácter no numérico (`replace(/\D/g, '')`). 
   - **Estandarización:** En el formulario KYC, el DNI fuerza automáticamente el prefijo "V-" o "E-" seguido de números, garantizando un formato limpio antes de tocar la red.
2. **Backend (PostgreSQL / Supabase):**
   - **Índices Únicos (Unique Constraints):** Para evitar fallos lógicos (como que un mismo usuario reciba múltiples créditos infinitos), se crearon índices únicos a nivel de base de datos (`idx_credits_unique_client_user_id`). Si el cliente intenta saltarse la validación del frontend y envía una petición directa, la base de datos aborta la transacción instantáneamente con un error de restricción.
   - **Data Types:** Uso estricto de tipos (`UUID`, `numeric(10,2)`, `timestamp`) que rechazan formatos maliciosos por defecto.

---

## 2. Prevención de Ataques XSS (Cross-Site Scripting)

**Concepto Clave:** Sanitización en Renderizado y Escaneo del DOM.

**Respuesta Técnica:**
Al permitir que los clientes envíen "Notas" o "Referencias", la plataforma era susceptible a que un atacante inyectara código JavaScript (ej. `<script>alert('hack')</script>`). 

1. **Sanitización Activa (`sanitizeText`):** Se desarrolló una utilidad en el frontend que utiliza `DOMParser` nativo del navegador. Antes de renderizar cualquier entrada de texto libre proveniente de la base de datos (como el Historial de Movimientos), esta función analiza el string, extrae puramente el `textContent` seguro y descarta cualquier etiqueta HTML o script ejecutable.
2. **Protección Pasiva (React):** Por defecto, React escapa las variables en JSX, pero para el texto enriquecido o referencias complejas que el administrador visualiza, la sanitización manual garantizó un ecosistema libre de ejecuciones remotas.

---

## 3. ¿Cómo se automatizó la API de la Tasa del BCV?

**Concepto Clave:** Arquitectura *Serverless* y Caché en Base de Datos.

**Respuesta Técnica:**
Para evitar depender de un administrador que actualice manualmente el valor del dólar, o de un servidor encendido 24/7 consumiendo recursos, se implementó un microservicio mediante **Supabase Edge Functions** (escrito en Deno/TypeScript).

1. **El Gatillo (Trigger):** El sistema no bombardea la API externa en cada recarga de página. En el frontend (React), el custom hook `useExchangeRate` verifica la marca de tiempo (`updated_at`) de la tasa guardada en la tabla global de configuraciones.
2. **Invocación:** Si detecta que la tasa tiene más de 24 horas de antigüedad (considerada *stale* o caducada), invoca bajo demanda la función *serverless* `get-bcv-rate`.
3. **Ejecución y Persistencia:** Esta Edge Function hace *web scraping* seguro a la página oficial, obtiene el valor vigente, lo actualiza en la base de datos de Supabase y devuelve el nuevo valor al cliente.
4. **Beneficio:** Esta arquitectura garantiza alta disponibilidad, latencia mínima (gracias al caché de 24h) y cero costos de mantenimiento en servidores dedicados.

---

## 4. Gestión de Estados Críticos: Bloqueo y Desbloqueo de Créditos

**Concepto Clave:** Operaciones Atómicas y Single Source of Truth (SSOT).

**Respuesta Técnica:**
El sistema de crédito requiere precisión absoluta para bloquear clientes morosos y liberarlos cuando pagan.
- **Actualización Atómica:** Cuando el administrador aprueba un pago, el sistema calcula el nuevo balance. Si el saldo restante es cero (`0.00`), la lógica no solo actualiza el balance, sino que, en la misma transacción, limpia campos críticos como `next_due_date` y desactiva la bandera `is_blocked`.
- **Prevención de Estados Fantasma:** Esto garantiza que un cliente sin deuda jamás quede bloqueado por un "residuo" en la fecha de vencimiento. Todo sucede en una operación consolidada, evitando inconsistencias entre la UI y el estado real del servidor.

---

## 5. ¿Cómo funciona la importación masiva de inventario vía Excel?

**Concepto Clave:** *Client-Side Parsing* y *Bulk Upsert*.

**Respuesta Técnica:**
En sistemas tradicionales, subir un archivo de Excel implica enviarlo al backend, sobrecargar la memoria RAM del servidor para procesarlo, y devolver los errores. En Manojitos implementamos **Client-Side Parsing** (procesamiento del lado del cliente) utilizando la librería **SheetJS (xlsx)**.

1. **Lectura en Memoria Local:** Utilizamos la API nativa de HTML5 (`FileReader`) para leer el archivo `.xlsx` directamente en la RAM del navegador del administrador.
2. **Transformación y Validación Asíncrona:** SheetJS convierte instantáneamente las filas del Excel a un objeto JSON. Un script valida en tiempo real reglas estrictas (precios mayores a cero, SKUs requeridos).
3. **Inserción Masiva (Bulk Insert):** Una vez validado, se envía en una única petición de red hacia Supabase (mediante `.upsert()`), insertando cientos de productos en milisegundos. Ahorra ancho de banda, reduce costos de computación en la nube y hace la experiencia instantánea.

---

## 6. ¿Cómo se verifica la identidad (KYC) para la apertura de Créditos?

**Concepto Clave:** Auditoría Híbrida, Seguridad a Nivel de Fila (RLS) y Almacenamiento Cifrado.

**Respuesta Técnica:**
El sistema KYC utiliza una arquitectura híbrida de *captura segura* combinada con *auditoría manual* (Visual Matching).

1. **Captura Estricta:** El usuario sube evidencias fotográficas obligatorias (DNI y Selfie con código dinámico para *proof of presence*).
2. **Privacidad de Datos (RLS):** Las imágenes no viajan a una base de datos pública. Se almacenan en un **Supabase Storage Bucket** protegido mediante políticas **RLS (Row Level Security)**. Solo el dueño de la imagen o el administrador pueden descargarla.
3. **Proceso de Aprobación:** Tras la verificación visual en el panel administrativo, el sistema cambia el estado a `approved` en la tabla `customer_profiles`, disparando la asignación del límite de crédito de forma segura.

---

## 7. Resolución de Anomalías Visuales: Desbordamiento CSS (Responsive)

**Concepto Clave:** Unidades Fraccionales (fr) en CSS Grid y Flex-Wrap.

**Respuesta Técnica:**
Se detectó desbordamiento horizontal (scroll) en vistas de escritorio debido a cálculos matemáticos inexactos de CSS en componentes pesados (como el detalle del producto).

1. **Grid Layout (Vista PC/Tablet):** El contenedor sumaba porcentajes fijos (`55%` y `45%`) más un margen (`gap-8`), superando el 100% del ancho de pantalla. Se migró a **Unidades Fraccionales (`fr`)** (`grid-cols-[5.5fr_4.5fr]`). El motor CSS ahora resta el espacio del `gap` primero y divide el sobrante exactamente, garantizando un ajuste perfecto.
2. **Flexbox Layout (Móvil):** Los elementos en línea (breadcrumbs o etiquetas de productos) desbordaban el ancho en móviles. Se solucionó inyectando `flex-wrap`, forzando el reflujo del DOM hacia nuevas líneas sin romper la maquetación.

---

## 8. Justificación del Stack Tecnológico: ¿Por qué React.js?

**Concepto Clave:** Virtual DOM, Arquitectura Basada en Componentes y Ecosistema SPA (Single Page Application).

**Respuesta Técnica:**
La elección de React sobre otros lenguajes clásicos (como PHP, Java JSP) o frameworks tradicionales (como Angular o Vue) se justifica por los siguientes pilares de rendimiento y escalabilidad:

1. **Virtual DOM vs Real DOM (Diferencia clave con Vanilla JS / PHP):**
   - Tradicionalmente, actualizar una página web requiere recargar el documento entero (ej. PHP) o re-renderizar ramas completas del DOM real, lo cual es lento y costoso computacionalmente. 
   - **React** utiliza un *Virtual DOM* (una representación en memoria de la UI). Cuando un estado cambia (como agregar un producto al carrito), React compara el Virtual DOM nuevo con el viejo (*Diffing Algorithm*) y actualiza **exclusivamente** el nodo que cambió en el DOM real. Esto permite que Manojitos sea extremadamente veloz, sintiéndose como una app nativa en el teléfono sin pantallas blancas de carga.
2. **Arquitectura Basada en Componentes:**
   - A diferencia de escribir archivos monolíticos de HTML/JS, React nos permitió construir "piezas de lego" encapsuladas (botones, tarjetas de producto, modales). Esta reutilización de código redujo el tamaño de la base de código dramáticamente y facilita el mantenimiento. Si hay un bug en el botón de pago, se arregla en un solo componente y se replica en toda la app.
3. **Flujo de Datos Unidireccional:**
   - A diferencia del *two-way data binding* de frameworks como Angular, React usa un flujo descendente (Top-Down). El estado dicta cómo se ve la UI, haciendo que la depuración de errores sea predecible. Sabes exactamente qué variable causó el cambio visual.
4. **Sinergia con TypeScript:**
   - A diferencia del JavaScript tradicional, la integración estricta de React con TypeScript permitió capturar el 90% de los errores (como pasar un String en vez de un Número a la base de datos) durante la *fase de compilación* (mientras se escribía el código), antes de que el error llegara siquiera al servidor en producción.
