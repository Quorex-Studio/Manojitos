# Auditoría de lógica e interacción

Lista de cosas que en esta plantilla ya rompieron pantallas. Revísalas en cada pasada.

## Errores que el build no detecta
| Síntoma | Cómo encontrarlo | Ejemplo real |
|---|---|---|
| Pantalla en blanco / "Algo salió mal" | `tsc … \| grep -E "TS2304\|TS2552\|TS2686"` | `ToggleRight` sin importar en Reglas; `React.useMemo` sin importar React en CreditProfile |
| Módulo no carga | buscar nombres importados dos veces | `Gallery, Image as Gallery` en Clientes |
| Proceso colgado | variable inexistente en un bucle async | `i` en vez de `idx` al importar productos |
| Cálculo silenciosamente mal | `TS2339` (propiedad inexistente) | `retail_multiplier` → siempre 15 % |
| Clase sin efecto | clases Tailwind que no existen (`h-8.5`, `h-13` sin extender) | botón colapsado |
| Tu clase no gana | clases base del componente (`justify-center`) | pestañas cortadas a la izquierda; subir especificidad (`.x.x`) o pasar la utilidad directo |

## Interacción
- Toda acción alcanzable sin hover y con objetivo ≥ 44 px.
- Todo botón de solo ícono con `aria-label`; chips con `aria-pressed`; nav con `aria-current`.
- Enlaces: comparar `to=`/`navigate()` con las rutas de `App.tsx` y los filtros que la página
  destino realmente entiende.
- Login y redirección: `?redirect=` validado (solo rutas internas, nunca `/cliente/auth`).
- Singular/plural, estados vacíos con una acción, errores del servidor mostrados si ayudan.

## Datos
- Fechas: `localDateISO()`; nunca `toISOString().split('T')[0]`.
- Dinero: sin "0,00 Bs" si no hay tasa; `formatBS` → `Bs 1.234,56`.
- Persistencia (localStorage): cargar antes de guardar; `try/catch`.

## Recorrido automatizado (Playwright)
Patrón: `page.route('**/rest/v1/products**', …)` con datos de muestra, sesión admin simulada
con `localStorage['sb-<ref>-auth-token']` y `page.route('**/auth/v1/**')`. Cada paso imprime
`OK`/`FAIL` con el valor observado; al final lista `pageerror` y errores de consola. Un paso
que falla es un bug hasta demostrar lo contrario.
