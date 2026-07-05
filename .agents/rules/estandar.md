---
trigger: always_on
---

# Estándar de trabajo para este proyecto



1. Antes de explorar el código, lee INDEX.md en la raíz — ahí está el mapa

de archivos, esquema real de base de datos, RPCs y convenciones. Úsalo

como punto de partida; abre completos solo los archivos que vayas a tocar.



2. No reportes nada como "confirmado", "resuelto" o "listo" sin pegar la

evidencia real (output exacto de la query/comando que lo prueba).



3. Si un paso de verificación se puede ejecutar (vía MCP, curl, script),

ejecútalo tú mismo en la sesión — no lo dejes como instrucción pendiente

para el humano, salvo que genuinamente no lo puedas hacer (ej. requiere

navegador). En ese caso dilo explícitamente.



4. No agregues nada fuera de lo pedido explícitamente (botones, archivos,

"mejoras" de cortesía). Si ves algo que valdría la pena arreglar aparte,

anótalo al final como sugerencia separada, sin implementarlo.



5. Si algo no coincide con lo que la tarea asume (función que no existe,

resultado inesperado), DETENTE y repórtalo — no improvises una solución

alterna por tu cuenta.



6. Al terminar una tarea que cambie esquema, RPCs, convenciones o

arquitectura documentada en INDEX.md, actualiza INDEX.md antes de cerrar

y muéstrame el diff.



7. Da siempre un resumen final: qué encontraste, qué aplicaste, qué queda

pendiente de mi decisión.