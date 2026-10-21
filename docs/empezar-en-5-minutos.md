# Conectá tu agente a Linkvia en 5 minutos

Linkvia es un chat igual a WhatsApp donde del otro lado contesta el agente de un negocio. Vos traés tu bot y Linkvia le manda cada mensaje del cliente. El negocio paga por conversación y no por cada mensaje que manda el bot.

Esta guía arma un bot que saluda, muestra botones y pasa a una persona. Después le ponés tu lógica o tu modelo de IA.

## Lo que necesitás

- Node 18 o más nuevo, o Python 3.9 o más nuevo. No hay que instalar ningún paquete.
- Una dirección `https` pública para tu bot. Para probar desde tu compu alcanza con un túnel gratis (paso 3).

## 1. Registrá el negocio

Entrá a [linkvia.optis.site/#/negocios](https://linkvia.optis.site/#/negocios) y completá:

- **Nombre** y **@handle**: el `@handle` es la dirección del chat, por ejemplo `@donluis`.
- **CUIT** del negocio: es opcional, pero le da al negocio la marca de verificado.
- **Webhook**: la dirección donde va a escuchar tu bot. Si todavía no la tenés, poné cualquiera y la cambiás en el panel.
- **Tu bot está hecho para**: dejá **Linkvia**. Si ya tenés un bot para la API de WhatsApp, elegí esa opción y mirá [Traer un bot hecho para WhatsApp](whatsapp.md): anda sin reescribirlo.

Al registrarte te aparecen dos claves **una sola vez**. Guardalas:

| Clave | Para qué |
|---|---|
| `whsec_…` (secreto del webhook) | Que tu bot compruebe que los mensajes vienen de Linkvia |
| `lv_…` (clave de API) | Que tu bot escriba por su cuenta, más tarde (paso 6) |

## 2. Copiá el bot

Elegí uno y guardalo en una carpeta vacía:

- **Node:** [ejemplos/node/bot.mjs](../ejemplos/node/bot.mjs)
- **Python:** [ejemplos/python/bot.py](../ejemplos/python/bot.py)

Arrancalo con tu secreto:

```bash
LINKVIA_WEBHOOK_SECRET=whsec_... node bot.mjs
# o
LINKVIA_WEBHOOK_SECRET=whsec_... python3 bot.py
```

Queda escuchando en `http://localhost:4000`.

## 3. Hacelo público

Para probar desde tu compu, abrí un túnel en otra terminal. Por ejemplo, con [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (gratis y sin cuenta):

```bash
cloudflared tunnel --url http://localhost:4000
```

Te da una dirección como `https://algo-al-azar.trycloudflare.com`. Ponela como **Webhook** en el panel del negocio.

Para dejarlo andando de verdad, subí el bot a cualquier servicio que corra Node o Python (Render, Railway, Fly.io, tu propio servidor) y poné esa dirección.

## 4. Probá la conexión

En el panel tocá **Probar conexión**. Linkvia le manda un `ping` a tu bot y te muestra si respondió y en cuánto tiempo. Desde ese momento lo revisa cada 5 minutos: si tu bot deja de contestar, le avisa al negocio.

## 5. Chateá con tu agente

Abrí `https://linkvia.optis.site/@tu_handle` desde el celular y escribí "hola". Tu bot contesta con dos botones: **Ver el menú** y **Hablar con alguien**.

Ese mismo link es el que el negocio comparte con sus clientes o pone en un QR, como el wa.me de WhatsApp. Con `?text=` el chat se abre con un texto ya escrito: `https://linkvia.optis.site/@donluis?text=Quiero%20hacer%20un%20pedido`.

## Cómo funciona

Linkvia hace un `POST` a tu webhook por cada mensaje:

```json
{
  "contractVersion": "0",
  "type": "message",
  "eventId": "evt_…",
  "business": { "handle": "donluis" },
  "conversation": { "id": "conv_…", "channel": "app" },
  "user": { "id": "usr_…", "sharedData": {} },
  "message": { "id": "msg_…", "text": "hola", "sentAt": "2026-10-21T20:41:00.000Z" }
}
```

Tu bot contesta en menos de 10 segundos con las acciones a mostrar:

```json
{ "contractVersion": "0", "actions": [{ "type": "text", "text": "¡Hola! ¿Qué te preparamos?" }] }
```

- `user.id` es un id distinto para cada negocio, no el teléfono. Los datos del cliente (nombre, teléfono, email, dirección) llegan en `user.sharedData` solo si el cliente aceptó compartirlos con tu negocio. Para pedirlos usá la acción `requestConsent`.
- Cuando el cliente toca un botón, llega un mensaje con `message.choice.id`, el `id` que le pusiste al botón.
- Además de `message`, pueden llegar `ping`, `consent` y `reaction`. Si no los usás, contestá `"actions": []`.
- Cada pedido trae el encabezado `linkvia-signature: t=<unix>,v1=<hex>`, con `v1 = HMAC-SHA256(secreto, "<t>.<cuerpo tal como llegó>")`. Los bots de ejemplo ya lo verifican. No lo saques: sin eso, cualquiera podría hacerse pasar por Linkvia.

### Lo que tu bot puede mandar

| Acción | Para qué |
|---|---|
| `text` | Un mensaje. Acepta `*negrita*`, `_cursiva_` y `~tachado~` como WhatsApp |
| `buttons` | Hasta 3 botones de respuesta rápida |
| `list` | Una lista de hasta 10 opciones, por ejemplo el menú |
| `carousel` | Tarjetas con foto que se deslizan |
| `catalog` | Productos con precio |
| `image`, `document`, `location` | Una foto, un PDF o una ubicación |
| `link`, `copyCode` | Un botón que abre una página o copia un código (cupón, alias) |
| `requestConsent` | Pedirle al cliente un dato (teléfono, dirección…) con su permiso |
| `handoff` | Pasarle la charla a una persona del negocio |

Los campos de cada una están en la [guía completa](conectar-un-bot.md#3-responder).

## 6. Si tu agente usa IA y tarda

Un modelo de lenguaje suele tardar más de 10 segundos. En ese caso:

1. Contestá el webhook enseguida con `"actions": []`.
2. Avisá que estás escribiendo: `POST https://linkvia.optis.site/api/bot/v0/typing` con `{"conversationId": "…"}`.
3. Mandá la respuesta cuando la tengas: `POST https://linkvia.optis.site/api/bot/v0/messages` con `{"contractVersion":"0","conversationId":"…","actions":[…]}`.

Las dos llamadas llevan el encabezado `authorization: Bearer lv_…`. También podés mandar la respuesta de a partes, para que el cliente la vea escribirse como en ChatGPT, y pedir el historial de la charla para darle contexto a tu modelo. Está todo en la [guía completa](conectar-un-bot.md#5-agentes-de-ia-contestar-más-tarde-y-de-a-partes).

## ¿Lo armás con una IA?

Pasale a tu asistente (Claude, ChatGPT, Cursor…) el archivo [linkvia-para-tu-ia.md](linkvia-para-tu-ia.md) junto con lo que querés que haga tu agente. Tiene todo lo que necesita para escribir el bot.

## ¿Dudas?

Escribinos a hello@taskia.site.
