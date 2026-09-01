# Reglas Globales y de Negocio (Manojitos)

## Regla de Negocio: Cálculo de Precios "Manojitos"

Siempre que se implemente una calculadora de costos o se hable sobre precios de venta, se debe seguir estrictamente esta fórmula matemática provista por el dueño del negocio:

**1. Cálculo de Costo Unitario:**
- `Costo Total = Costo Mercancía (USD) + Costo de Envío (USD)`
- `Costo Real Unitario = Costo Total / Cantidad de Unidades`
- `Costo Redondeado Unitario = Math.ceil(Costo Real Unitario)` (Siempre redondear hacia arriba)

**2. Precio Venta Base (EUR):**
- `Precio Venta EUR = Costo Redondeado Unitario * Multiplicador` (El multiplicador es dinámico según la configuración del sistema, generalmente x2).

**3. Precio Dólares (Referencial en Tienda):**
- *Conversión cruzada según tasas BCV (Banco Central de Venezuela).*
- `Precio Venta USD = Precio Venta EUR * (Tasa EUR / Tasa USD)`

**4. Precio Dólares para pagos en Bolívares (Precio Protegido):**
- Se aplica un margen extra de protección (Ej. 13% o 15%) al pagar en Bs.
- `Precio Protegido USD = Precio Venta USD * (1 + Recargo Bolivares % / 100)`
- Este `Precio Protegido USD` debe guardarse como `price_bs_usd` en la base de datos (junto con el `price_usd` regular) para que el módulo de ventas facture el equivalente correcto en bolívares.
