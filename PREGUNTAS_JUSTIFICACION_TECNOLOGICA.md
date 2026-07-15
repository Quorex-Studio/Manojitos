# Guía de Preparación: Justificación Tecnológica (Manojitos)

Este documento te preparará para defender el **"por qué"** de tus decisiones tecnológicas frente al jurado. En una tesis de ingeniería, es tan importante saber programar como saber justificar por qué elegiste una herramienta en lugar de otra.

---

## 1. El Frontend: React + Vite vs Angular/Vue

**Pregunta: ¿Por qué elegiste React para el frontend en lugar de Angular, Vue o usar HTML/JS puro?**

**Respuesta a dar:** 
Elegí React porque su arquitectura basada en componentes reutilizables me permitió construir el sistema de forma más modular (por ejemplo, reutilizar tarjetas de productos y modales). A diferencia de HTML/JS puro, React maneja un "Virtual DOM" que actualiza solo las partes de la pantalla que cambian, haciendo que la aplicación sea mucho más rápida y fluida (una Single Page Application - SPA).
No elegí Angular porque tiene una curva de aprendizaje excesivamente alta y es muy "pesado" para el alcance de este proyecto, que requería agilidad. Tampoco usé "Create React App" (el estándar viejo), sino **Vite**, porque Vite compila el código casi instantáneamente gracias a que usa módulos nativos de ES (ECMAScript), mejorando drásticamente el tiempo de desarrollo.

---

## 2. El Backend y Base de Datos: Supabase (PostgreSQL) vs Firebase (NoSQL)

**Pregunta: ¿Por qué usaste Supabase y PostgreSQL en lugar de Firebase (que es muy popular) o MongoDB?**

**Respuesta a dar:**
Elegí Supabase apoyado en **PostgreSQL (relacional)** porque este es un sistema de ventas e inventario. En sistemas financieros y de inventario, la consistencia de los datos (garantizar que el dinero y el stock cuadren) es crítica. PostgreSQL garantiza propiedades **ACID** (Atomicidad, Consistencia, Aislamiento y Durabilidad) y me permite usar llaves foráneas estrictas.
Si hubiera usado **Firebase o MongoDB (NoSQL)**, los datos se guardarían como documentos separados (tipo JSON). Eso es bueno para un chat o redes sociales, pero terrible para un inventario, porque si vendo un producto, tendría que actualizar a mano el documento del producto, el de la venta y el del usuario, arriesgándome a que la red falle a mitad de camino y genere inconsistencia de datos (por ejemplo, cobrar el dinero pero no descontar el stock).

---

## 3. Seguridad de Datos: Row Level Security (RLS) vs Backend en Node.js

**Pregunta: Veo que no construiste un servidor tradicional en Node.js (Express) o Python (Django) para tu API. ¿Cómo proteges los datos si el frontend habla casi directo con la base de datos?**

**Respuesta a dar:**
Supabase provee una arquitectura Backend-as-a-Service. En lugar de construir un "servidor intermediario" que ralentiza las peticiones, apliqué seguridad directamente en la base de datos usando **Row Level Security (RLS)** de PostgreSQL y **RPCs (Remote Procedure Calls)**.
RLS permite que la base de datos lea el token (JWT) del usuario conectado. Así, aunque alguien intercepte la conexión de red, la base de datos rechazará cualquier operación si el usuario no tiene los permisos (ej. `is_admin()`). Esto es más seguro que un backend en Node.js, porque la seguridad está programada al nivel más bajo posible (el motor de base de datos) y es imposible de saltar.

---

## 4. Tipado Fuerte: TypeScript vs JavaScript

**Pregunta: Tu código está en TypeScript en lugar del clásico JavaScript. ¿Por qué agregarle esa complejidad extra?**

**Respuesta a dar:**
Porque JavaScript es un lenguaje de tipado débil, lo que significa que un error de tipo (como sumar un número con una letra) solo se descubre cuando el sistema está corriendo y el sistema "se cae" frente al cliente.
Elegí **TypeScript** porque añade "tipos estáticos". Si intento enviarle un texto a una función que espera un número (por ejemplo, para calcular un pago), TypeScript bloquea el programa y no me deja compilarlo. En un sistema que maneja pagos, inventarios y finanzas, TypeScript me obligó a escribir código libre de errores lógicos desde el editor, reduciendo drásticamente los errores en producción.

---

## 5. Diseño e Interfaz: Tailwind CSS + Shadcn/ui vs CSS Tradicional / Bootstrap

**Pregunta: ¿Cómo manejaste los estilos y la interfaz? ¿Por qué no usar simplemente Bootstrap o archivos CSS normales?**

**Respuesta a dar:**
No usé archivos CSS tradicionales porque a medida que un sistema crece, el código CSS se vuelve inmanejable y propenso a errores (clases que chocan entre sí). No usé Bootstrap porque sus diseños se ven muy anticuados y rígidos.
Elegí **Tailwind CSS** porque me permite estilizar directamente en el código del componente usando clases de utilidad, reduciendo el tamaño del archivo final (Tailwind purga el CSS que no se usa). Además, me apoyé en la biblioteca **Radix UI / Shadcn**, la cual me proveyó componentes (modales, menús) pre-hechos que son 100% accesibles (soportan navegación por teclado y lectores de pantalla) pero que yo podía personalizar totalmente a la imagen de marca de Manojitos.

---

## 6. Validación de Datos: Zod + React Hook Form

**Pregunta: ¿Cómo te aseguras de que el cliente no ingrese datos basura o caracteres maliciosos en los formularios?**

**Respuesta a dar:**
Para el manejo de formularios no usé el estado nativo de React (`useState`), ya que eso causa que toda la pantalla se recargue cada vez que el usuario teclea una letra. En su lugar, utilicé **React Hook Form**, que maneja los campos sin re-renderizar la pantalla, mejorando el rendimiento.
Para validar la información, integré **Zod**. Zod es una librería que me permite crear un "esquema" (por ejemplo: "El nombre debe ser solo letras, mínimo 3 caracteres, y el email debe tener arroba"). Si el usuario viola el esquema, Zod bloquea el envío al instante. Adicionalmente, creé un filtro propio con "Regex" (Expresiones Regulares) en el frontend y en la base de datos que destruye cualquier carácter prohibido, como `<`, `>`, para mitigar inyecciones XSS.

---

## 7. Manejo de Estado Asíncrono: React Query

**Pregunta: ¿Cómo hace el sistema para cargar los productos y saber cuándo mostrar el spinner (ruedita) de carga sin que se trabe la app?**

**Respuesta a dar:**
Usé **TanStack Query (React Query)**. Si lo hubiera hecho manualmente con `useEffect` y `fetch`, habría tenido que escribir cientos de líneas de código para manejar la carga, los errores y la memoria caché.
React Query automatiza todo esto. Cuando un cliente entra a ver los productos, React Query hace la petición, muestra el spinner automáticamente y guarda los productos en caché. Si el cliente va a otra pantalla y vuelve, los productos cargan instantáneamente desde la memoria en vez de volver a gastar internet, logrando que el sistema se sienta ultrarrápido y consuma menos ancho de banda.
