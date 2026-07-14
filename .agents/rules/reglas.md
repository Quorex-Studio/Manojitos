---
trigger: always_on
---

2. NO dupliques código. Si modificas una función, reemplázala completa. Nunca dejes una versión vieja y una nueva coexistiendo "por si acaso".

3. NO agregues nada que no esté explícitamente pedido en la fase actual. Si crees que algo hace falta, dilo, no lo implementes por tu cuenta.

4. NO inventes nombres de archivos, columnas, tablas o funciones que no aparezcan en este documento. Si necesitas un dato que no está aquí (ej: nombre exacto de una columna), usa `view`/`grep` sobre el código real para confirmarlo antes de escribir — no asumas ni recuerdes de memoria.

5. Si tienes disponible un MCP/herramienta de Supabase (consultas SQL directas, gestión de tablas), ÚSALA en vez de construir llamadas REST manuales con curl. Es menos propenso a error.


6. "Terminado" no es válido sin evidencia. Cada fase tiene un checklist de verificación — muestra el resultado REAL (query, diff, respuesta HTTP), no una descripción de lo que "debería" pasar.

7. Si algo pedido no se puede hacer tal cual está escrito, dilo ANTES de improvisar una alternativa distinta. No reinterpretes el pedido.

8. Sé conciso en tus respuestas. No expliques de más, no repitas el contexto que ya tienes. Ve directo a los cambios y a la evidencia.