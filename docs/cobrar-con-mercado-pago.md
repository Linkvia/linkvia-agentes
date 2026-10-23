# Cobrar con Mercado Pago desde tu agente

Tu agente puede cobrar señas, pedidos, cuotas o suscripciones con la cuenta de Mercado Pago **del negocio**. La plata va directo a esa cuenta: Linkvia no interviene y no cobra comisión.

Las [plantillas](../plantillas/) ya traen todo esto en [`comun/mercadopago.mjs`](../plantillas/comun/mercadopago.mjs).

## Modo 1: link fijo (sin programar nada)

1. El negocio crea un link de pago en Mercado Pago (Tu negocio → Link de pago) y lo pone en `config.json` como `linkDePago`.
2. El agente lo manda con un botón:

   ```json
   { "type": "link", "text": "Pagá la seña con Mercado Pago:", "label": "Pagar seña", "url": "https://link.mercadopago.com.ar/tu-negocio" }
   ```

3. El cliente manda el comprobante por el chat y el negocio marca el pago en el panel del agente.

Es lo más simple para arrancar, pero alguien tiene que revisar los pagos a mano.

## Modo 2: cobro automático

El agente crea un link con el monto exacto para cada cobro y Mercado Pago le avisa cuando se pagó.

1. **Credenciales:** en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) de Mercado Pago, el negocio crea una aplicación y copia el **Access Token de producción**. Va en `MP_ACCESS_TOKEN`. Es secreto: nunca en el código ni en un repositorio.
2. **Dirección pública:** `URL_PUBLICA=https://tu-agente.com`. Mercado Pago avisa los pagos en `https://tu-agente.com/mercadopago`.
3. **Crear el cobro** (Checkout Pro):

   ```js
   const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
     method: "POST",
     headers: { authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "content-type": "application/json" },
     body: JSON.stringify({
       items: [{ title: "Seña corte vie 23/10 16:00", quantity: 1, unit_price: 3600, currency_id: "ARS" }],
       external_reference: "TBVSZ",                       // tu código de reserva o pedido
       notification_url: `${process.env.URL_PUBLICA}/mercadopago`,
     }),
   });
   const { init_point } = await r.json();                // el link para pagar
   ```

4. **Mandar el link** con una acción `link`, como en el modo 1.
5. **Recibir el aviso:** Mercado Pago hace `POST /mercadopago` con el id del pago. **No confíes en el aviso:** consultá el pago con `GET https://api.mercadopago.com/v1/payments/{id}` y tu token. Si `status` es `approved`, buscá tu reserva por `external_reference`, confirmala y avisale al cliente con `POST /bot/v0/messages`.
6. **Una sola vez:** Mercado Pago puede repetir el aviso. Confirmá solo si la reserva todavía estaba pendiente.

## Suscripciones mensuales

Para una cuota mensual, lo más simple es mandar un link nuevo cada mes (como hace la [plantilla de clases](../plantillas/clases/)). Mercado Pago también tiene suscripciones con débito automático; si las usás, guardá el estado de cada suscriptor y cortá el servicio cuando el pago se cancela.

Si vendés suscripciones a consumidores, tenés que mostrar un **botón de arrepentimiento** y una forma simple de **darse de baja**, según las normas de defensa del consumidor.

## Lo que viene en Linkvia

Linkvia está preparando un botón de pago integrado en el chat: el negocio conecta su Mercado Pago una vez y el agente solo pide "cobrá $5.000". Hasta entonces, usá cualquiera de los dos modos de esta página.
