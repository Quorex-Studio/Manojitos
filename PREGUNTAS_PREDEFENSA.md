# Guía de Preparación: Pre-defensa de Mesa Técnica (Manojitos)

Este documento recopila las posibles preguntas técnicas que el jurado podría realizar durante la pre-defensa del sistema, junto con respuestas sugeridas basadas en la arquitectura real del proyecto.

---

## 1. Relación de la Base de Datos con el Sistema y Arquitectura

**Pregunta: ¿Cuál es la relación de la base de datos con el sistema?**
**Respuesta:** El sistema utiliza una arquitectura Cliente-Servidor moderna (Backend-as-a-Service) apoyada en Supabase. El frontend está desarrollado en React (Vite) usando TypeScript, manejando la UI y validaciones. La base de datos es PostgreSQL (alojada en Supabase). 
El frontend no se conecta directamente a la BD con credenciales raíz, sino que utiliza una API REST (PostgREST). Para garantizar la integridad en procesos complejos (como una venta que descuenta stock y registra finanzas), el sistema delega esa responsabilidad a la base de datos mediante **RPCs (Remote Procedure Calls)**, asegurando que las transacciones sean "atómicas".

---

## 2. Estructura de la Base de Datos

**Pregunta: ¿Cómo estructuraste tu base de datos?**
**Respuesta:** La base de datos está estructurada de forma modular para asegurar escalabilidad:
1. **Catálogo:** `products` (gestiona precios y control de stock).
2. **Perfiles y KYC:** `customer_profiles` (gestiona información personal y documentos para normativas).
3. **Transaccional (Ventas):** `orders` y `order_items` (encabezado y detalle de los productos vendidos).
4. **Finanzas y Contabilidad:** `ledger_entries` (libro mayor de ingresos, egresos o reversiones) y `exchange_rates`.
5. **Créditos:** `credits`, `credit_transactions` y `payment_promises` (límites de crédito, abonos, recargos y promesas de pago).
6. **Reglas de Negocio:** `business_rules` (motor de reglas para descuentos y lealtad).

---

## 3. Conexiones Relacionales

**Pregunta: Si es relacional, ¿cómo conectaste tus tablas centrales?**
**Respuesta:** Sí, es estrictamente relacional (PostgreSQL). Las tablas se conectan mediante claves foráneas (Foreign Keys). Por ejemplo:
* **Ventas y Clientes:** `orders` se conecta con el perfil mediante `user_id`.
* **Créditos:** `credits` tiene relación 1:N con `credit_transactions` (cada abono apunta al ID del crédito).
* **Auditoría (Ledger):** Cualquier movimiento genera un registro en `ledger_entries`, la cual usa un esquema polimórfico (`reference_id` y `reference_type`) para conectarse dinámicamente a la venta, crédito o ajuste que originó el movimiento de dinero.

---

## 4. Tipos de Datos

**Pregunta: ¿Qué tipos de datos tienen los campos (string, float, etc.)?**
**Respuesta:** Utilizamos tipos nativos de PostgreSQL mapeados a TypeScript:
* **String (UUID, text, varchar):** Identificadores únicos (`id`), nombres, correos y estados (ej. 'pagado').
* **Number (Float/Decimal e Integer):** Floats o decimales para cantidades financieras (ej. `total_usd`, tasas de cambio). Enteros para inventario (ej. `stock`).
* **Boolean:** Banderas lógicas (ej. `is_active`, `is_blocked`).
* **JSON/JSONB:** Para estructuras dinámicas, como guardar el carrito de compras congelado en una orden (`items`), o las condiciones dinámicas del motor de reglas (`conditions`).

---

## 5. Concurrencia e Inventario

**Pregunta: Si dos vendedores venden el mismo producto exactamente al mismo tiempo, ¿cómo evitas que el inventario quede en negativo?**
**Respuesta:** Las restas de inventario no se hacen matemáticamente en el frontend. Usamos funciones RPC en la base de datos (ej. `process_checkout`). PostgreSQL aplica bloqueos transaccionales a nivel de fila y chequea las restricciones (*check constraints*) de stock antes de confirmar. Si no hay stock suficiente, la base de datos rechaza la transacción entera y el frontend atrapa el error.

---

## 6. Prevención de Inyección de Código (Seguridad)

**Pregunta: ¿Qué pasa si un cliente intenta inyectar código malicioso en los campos de texto?**
**Respuesta:** El sistema cuenta con prevención XSS (Cross-Site Scripting) en el frontend. Todos los campos de texto libre pasan por una función de sanitización estricta (`sanitizeText`) y validaciones con la librería Zod antes de enviarse al backend o guardarse en la base de datos.

---

## 7. Inmutabilidad Histórica

**Pregunta: Si el precio de un producto cambia mañana, ¿las ventas de ayer cambian su total?**
**Respuesta:** No. La tabla `orders` congela los datos al momento de la compra guardando el carrito exacto en el campo JSON `items` y almacenando el total calculado en ese instante. Además, el historial en el libro mayor (`ledger_entries`) es inmutable, garantizando que las auditorías cuadren.

---

## 8. Seguridad y Control de Acceso (RLS)

**Pregunta: ¿Cómo garantizas que un cliente no pueda ver las compras de otro, o modificar el catálogo?**
**Respuesta:** Mediante Políticas de Seguridad a Nivel de Fila (RLS) en PostgreSQL. La seguridad no depende solo de ocultar botones en React; la propia base de datos verifica la identidad (JWT) del usuario en cada consulta. Un cliente común solo tiene permisos `SELECT` sobre sus propias órdenes. Tablas sensibles como `products` tienen políticas que solo permiten operaciones de escritura a usuarios con rol de Administrador.

---

## 9. Sesiones y Autenticación

**Pregunta: ¿Cómo manejas las sesiones de los usuarios?**
**Respuesta:** Usamos Supabase Auth (basado en JSON Web Tokens - JWT). En el frontend, el estado se maneja de forma global con un `AuthContext` en React, permitiendo que la aplicación reaccione instantáneamente al estado del usuario y proteja las rutas privadas.

---

## 10. Auditoría y Trazabilidad

**Pregunta: Si hay un descuadre en caja, ¿cómo rastreas quién hizo qué?**
**Respuesta:** Todo movimiento financiero queda asentado en `ledger_entries`. Si se cancela una venta, no se borra, se crea un asiento de reversión (`is_reversal: true`). Adicionalmente, contamos con `audit_logs` que registra acciones críticas (quién lo hizo, qué acción tomó y sobre qué recurso), asegurando trazabilidad completa.

---

## 11. Tareas en Segundo Plano (Edge Functions)

**Pregunta: ¿Cómo envías correos sin que el sistema se quede congelado esperando respuesta?**
**Respuesta:** Utilizamos Edge Functions (funciones serverless en Supabase, como `send-email`). El frontend o la base de datos invocan la función de manera asíncrona; esta se ejecuta en un servidor aislado comunicándose con el proveedor de correo, sin afectar la experiencia del usuario en la aplicación.

---

## 12. Arquitectura del Frontend (React)

**Pregunta: ¿Por qué usaste React y cómo compartes datos entre pantallas (como el carrito)?**
**Respuesta:** React (con Vite) permite construir una SPA rápida y reactiva. Para evitar pasar propiedades manualmente por muchos componentes (prop drilling), usamos la API de Contexto (`CartContext`). Así, si un usuario agrega un producto en el catálogo, el ícono del carrito en la barra de navegación (Layout) se actualiza al instante en toda la aplicación.

---

## 13. Motor de Reglas de Negocio

**Pregunta: ¿Por qué tienes una tabla de reglas de negocio en lugar de programar los descuentos en el código?**
**Respuesta:** Por escalabilidad y mantenibilidad. Al abstraer la lógica en la tabla `business_rules` (guardando condiciones y acciones en JSON), el sistema puede evaluar promociones de manera dinámica. Esto permite al administrador activar o modificar descuentos desde un panel, sin necesidad de que un programador modifique y re-despliegue el código fuente.

---

## 14. Validación de Entradas (Frontend vs Backend)

**Pregunta: ¿Por qué validas los datos tanto en el frontend como en el backend? ¿No es redundante?**
**Respuesta:** No. La validación en el frontend (React) se hace por **"Experiencia de Usuario" (UX)**, para darle indicaciones rápidas al cliente sin esperar al servidor (por ejemplo, evitar que escriba números en su nombre). Sin embargo, el frontend es inherentemente inseguro y puede ser manipulado. Por ende, el backend (Base de datos/RPC) tiene que validar obligatoriamente todo de nuevo por **"Seguridad e Integridad"**.

---

## 15. Adaptabilidad y Diseño (Responsive Design)

**Pregunta: ¿El sistema se puede usar en teléfonos móviles o tabletas?**
**Respuesta:** Sí. La interfaz del sistema fue construida siguiendo principios de diseño adaptativo (Responsive Design). Esto asegura que los elementos (tablas, botones, barras de navegación) se acomoden automáticamente al tamaño de la pantalla, brindando una buena experiencia tanto a los clientes comprando desde su celular como a los administradores operando desde una computadora de escritorio.

---

## 16. Manejo de Errores (Error Handling)

**Pregunta: ¿Qué ocurre si hay un error inesperado de conexión al procesar una compra? ¿El usuario pierde su dinero o se cobra a medias?**
**Respuesta:** El sistema maneja esto mediante **Transacciones Atómicas**. Si ocurre una falla en cualquier paso intermedio (ej. se descuenta el stock pero se cae la red antes de registrar el pago), la base de datos hace un *Rollback* (cancela todo el proceso y devuelve los datos a su estado original de forma instantánea). El frontend captura este error y muestra un mensaje amigable al usuario, garantizando que nunca queden cobros a medias.

---

## 17. Seguridad en las Contraseñas

**Pregunta: Si logran acceder a tu base de datos, ¿pueden ver las contraseñas de todos tus clientes?**
**Respuesta:** No. El sistema nunca almacena las contraseñas en texto plano. Supabase Auth (nuestro proveedor de identidad) se encarga de procesarlas con un *Hash criptográfico* avanzado de una vía (agregando un *salt*). Esto significa que las contraseñas reales se destruyen y se convierten en cadenas de caracteres indescifrables.

---

## 18. Control Financiero a simple vista

**Pregunta: ¿Cómo controla el sistema que un cliente no compre infinitamente a crédito?**
**Respuesta:** El sistema implementa un límite de crédito (`credit_limit`). Este límite no se evalúa solamente ocultando el botón de compra en el frontend, sino que el propio motor de base de datos interviene. Al intentar cobrar, la función RPC revisa estrictamente que el *(Balance Actual + Compra Nueva)* no sobrepase el límite asignado al cliente. Si lo pasa, la operación aborta.
