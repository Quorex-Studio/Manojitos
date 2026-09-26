# Crédito modalidad Cashea — análisis y plan (EINA y Manojitos)

Estado: **borrador para decidir**. Aplica a las dos tiendas (misma base de código). Lo que es
propio de una marca va marcado **[marca]**.

> **Decisión (26/09/2026):** por ahora sigue el **Crédito EINA** propio (lo que describe la
> sección 1). **Cashea** se usará más adelante: EINA está gestionando la afiliación. Cuando esté
> aprobada, Cashea entra como **método de pago** (la clienta paga su inicial y Cashea financia el
> resto; la tienda cobra completo), sin reemplazar el Crédito EINA hasta que se decida lo contrario.

## 1. Cómo funciona hoy el crédito

| Pieza | Qué hace hoy | Dónde |
|---|---|---|
| Línea de crédito | Una fila por clienta en `credits`: límite, saldo, día de corte, días de gracia, bloqueo, puntaje de confianza (`trust_score`, `trust_level`), pagos a tiempo/tarde | `credits`, `Credits.tsx`, `CustomerCredit.tsx` |
| Compra a crédito (tienda) | Método "Crédito" en el checkout: **50 % de inicial fija** y el resto en **2 cuotas quincenales** | `Checkout.tsx` (monto inicial y cuota calculados en pantalla) |
| Cuotas | **No existen como registros**: se deducen de los movimientos de financiamiento en `credit_transactions` | `CustomerCredit.tsx` ("Mis cuotas") |
| Abonos | La clienta reporta el pago (pedido con `[ABONO_CREDITO]`); la administración lo aprueba y baja el saldo | `Sales.tsx`, `Credits.tsx` |
| Ventas fiadas del panel | Otro circuito: `sales.is_credit` + `sale_payments` (abonos por venta) | `Sales.tsx` → Por cobrar |
| Recordatorios | `send-credit-notifications` y `credit_reminders` por fecha de corte | edge function |
| Verificación | KYC (cédula, rostro, selfie) antes de poder comprar a crédito | `customer_profiles`, bucket `customer-kyc` |

Limitaciones para una modalidad tipo Cashea:
1. El porcentaje de inicial y el número de cuotas están **fijos en el código** (50 % / 2).
2. Las cuotas no tienen fecha, monto ni estado propios: no se puede marcar "cuota 2 pagada",
   calcular mora por cuota ni mostrar un calendario exacto.
3. Hay **dos sistemas de deuda** (línea `credits` y ventas fiadas `sale_payments`).
4. No hay **niveles** que cambien la inicial o el límite según el comportamiento de pago.

## 2. Dos caminos posibles

### Camino A — Afiliarse a Cashea (Cashea financia y asume el riesgo)
La clienta paga con su cuenta Cashea; la tienda recibe el pago de Cashea y no cobra cuotas.
- En la tienda: nuevo método de pago **"Cashea"**. En el punto de venta se registra como pago
  recibido; en la tienda online, según lo que Cashea ofrezca a comercios afiliados
  (enlace, QR o integración). **Hay que confirmar con Cashea qué integración dan al comercio.**
- Ventaja: sin riesgo de cobranza, sin módulo propio de cuotas.
- Costo: comisión de Cashea por venta (entra en "Comisiones y pasarelas" de la estructura de costos).

### Camino B — Crédito propio al estilo Cashea (la tienda financia)
Se mejora el módulo actual con las reglas de Cashea:
- **Niveles** (p. ej. 1 a 5): cada nivel define % de inicial, límite de la línea y número de cuotas.
- **Cuotas reales** en una tabla `credit_installments` (compra, número, monto, vence, pagada,
  fecha de pago, días de atraso).
- **Subir o bajar de nivel** automáticamente: sube tras N compras pagadas a tiempo; baja o se
  bloquea con atrasos.
- **Sin intereses** si paga a tiempo; recargo opcional por mora [marca].
- Recordatorios por cuota (antes del vencimiento, el día y en atraso) por la app, push y correo
  (la cola `email_outbox` ya los envía).
- Unificar las ventas fiadas del panel con la misma lógica de cuotas.

Se pueden combinar: **Cashea como método de pago** para quien lo tenga y el **crédito propio**
para clientas de confianza.

## 3. Diseño propuesto para el Camino B (si se elige)

```
credit_levels        (nivel, nombre, inicial_pct, limite_usd, cuotas, dias_entre_cuotas,
                      compras_para_subir, atrasos_para_bajar)            ← Configuración [marca]
credits              + level, level_updated_at                            ← ya existe
credit_purchases     (credit_id, order_id|sale_group_id, total, inicial, financiado, nivel_aplicado)
credit_installments  (purchase_id, numero, monto, vence, estado: pendiente|pagada|vencida,
                      pagada_el, abono_id)
```
- La inicial y las cuotas se calculan **en la base de datos** al confirmar la compra (no en el
  navegador), con los datos del nivel de la clienta.
- Cada abono se aplica a la cuota más antigua pendiente; la mora se calcula por cuota.
- Un cron diario marca cuotas vencidas, bloquea la línea si corresponde y ajusta niveles.
- Pantallas: Configuración → Crédito (niveles), Créditos (cartera por cuota y mora),
  Mi crédito de la clienta (calendario de cuotas, nivel y cómo subir), checkout (inicial y
  cuotas según su nivel).

## 4. Preguntas para decidir

1. ¿Van a **afiliarse a Cashea** (camino A), a **replicar el modelo** con crédito propio (camino B)
   o a **ambos**?
2. Si hay crédito propio: ¿cuántos **niveles**, qué **% de inicial** y qué **límite** por nivel?
3. ¿Cuántas **cuotas** y cada cuántos **días** (Cashea usa cuotas quincenales)?
4. ¿Se cobra **recargo por mora**? ¿Cuántos días de gracia?
5. ¿Qué pasa con las **ventas fiadas del panel**: pasan a cuotas o siguen como abonos libres?
6. ¿Mismas reglas para EINA y Manojitos, o cada tienda con las suyas? (el diseño lo permite) [marca]
