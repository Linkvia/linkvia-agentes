# Linkvia: contexto para tu asistente de IA

> Pasale este archivo a tu asistente (Claude, ChatGPT, Cursor, Copilot…) y pedile, por ejemplo: "Con esto, armame en Node un bot de Linkvia para mi pizzería que muestre el menú con una lista y tome pedidos". Tiene lo necesario para escribir el bot completo.

## Qué es Linkvia

Una app de chat igual a WhatsApp en la que del otro lado contesta el agente (bot) de un negocio. El negocio conecta su propio bot por **webhook**. Linkvia le manda cada evento por `POST` y el bot contesta con un JSON de acciones.

- App del cliente: `https://app.linkvia.com.ar`.
- Panel del negocio (registro, claves, bandeja **Atención**): `https://negocios.linkvia.com.ar`. Guía para desarrolladores: `https://negocios.linkvia.com.ar/#/desarrolladores`.
- API: `https://app.linkvia.com.ar/api`.
- Link al chat de un negocio: `https://app.linkvia.com.ar/@<handle>` (con `?text=` opcional para dejar un texto escrito, o `?start=<campaña>` para un link de campaña).
- Versión del contrato: `"0"`. Va en `contractVersion` de todo lo que se manda y se recibe.

## Credenciales (las da el registro, una sola vez)

- `LINKVIA_WEBHOOK_SECRET` (`whsec_…`): para verificar la firma de los eventos.
- `LINKVIA_API_KEY` (`lv_…`): para llamar a la API con `authorization: Bearer <clave>`.

## Reglas que el bot tiene que cumplir

1. El webhook es `https` público. Responde `200` con `content-type: application/json` en **menos de 10 segundos**.
2. **Verificar la firma de cada evento** y responder `401` si no es válida. Encabezado `linkvia-signature: t=<unix segundos>,v1=<hex>`. `v1 = HMAC-SHA256(LINKVIA_WEBHOOK_SECRET, "<t>.<cuerpo crudo>")`, calculado sobre el cuerpo **tal como llegó, antes de parsearlo**. Rechazar si `|ahora - t| > 300` segundos. Comparar en tiempo constante.
3. Si una entrega falló, Linkvia la reintenta una vez con el mismo `eventId`: ignorar los `eventId` ya procesados.
4. Si el bot falla dos veces seguidas, Linkvia lo marca caído y avisa al negocio. Los mensajes que no pudo entregar quedan en una cola (hasta 24 horas) y llegan cuando el bot vuelve, en orden, con el mismo `eventId` y `redelivered: true`. Usar `message.sentAt` para saber cuándo los escribió el cliente.
5. Nunca pedir ni guardar datos del cliente sin `requestConsent`. Si llega `consent.revoked`, dejar de usar esos datos.
6. Los links de fotos, audios y archivos están firmados y vencen a las 48 horas: no guardar la `url` para después. Guardar el archivo o pedir un link nuevo con el historial.
7. Mandar siempre links completos: los acortados (bit.ly, tinyurl.com, t.co…) no se aceptan si el negocio no está verificado, y los links marcados como phishing o virus (Google Web Risk) no llegan. Nunca pedirle al cliente un código, un PIN, una clave o los datos de la tarjeta.

## Eventos que llegan al webhook

Campos comunes: `contractVersion`, `type`, `eventId`, `business: { handle }`; `redelivered: true` si el mensaje esperó en la cola porque el bot estaba caído. Salvo `ping`, traen también `conversation: { id, channel: "app" | "widget" }` y `user: { id, sharedData }`.

- `user.id`: id seudónimo, distinto para cada negocio. No es el teléfono.
- `user.sharedData`: solo los datos que el cliente aceptó compartir: `name`, `phone`, `email`, `address`.

### `type: "message"`

```json
{
  "contractVersion": "0", "type": "message", "eventId": "evt_1",
  "business": { "handle": "donluis" },
  "conversation": { "id": "conv_1", "channel": "app" },
  "user": { "id": "usr_1", "sharedData": { "name": "Ana" } },
  "message": { "id": "msg_1", "text": "hola", "sentAt": "2026-10-21T20:41:00.000Z" }
}
```

`message` puede traer además:
- `choice: { id, title, kind }`: el cliente tocó un botón u opción. Decidir por `choice.id`.
- `replyTo: { id, from: "user" | "bot", text }`: citó un mensaje.
- `image: { url, mimeType, width, height }`, `audio: { url, mimeType, durationMs }`, `document: { url, mimeType, filename }`: se bajan con `GET url` sin clave (el link está firmado y vence a las 48 horas; después, `GET` a la misma dirección sin `?exp=…&sig=…` con `authorization: Bearer <LINKVIA_API_KEY>`, o un link nuevo desde el historial; un link vencido responde 401). En ese caso `text` es el comentario o un resumen ("📷 Foto", "🎤 Mensaje de voz", "📄 nombre.pdf").
- `location: { latitude, longitude }` (`text` = "📍 Ubicación").
- `forwarded: true`: lo reenvió de otro chat.

### Los otros eventos

- `ping`: prueba de conexión y monitoreo cada 5 minutos. Responder `{"contractVersion":"0","actions":[]}`.
- `consent`: el cliente respondió un `requestConsent`. Trae `consent: { granted: [], declined: [], revoked?: [], purpose }` y `user.sharedData` ya actualizado. Lo que se responda se muestra en el chat.
- `reaction`: trae `reaction: { messageId, emoji }`. `emoji` vacío significa que la sacó.
- `start`: el cliente abrió el chat con un link de campaña (`/@<handle>?start=qr-mesa5`) o tocó **Empezar** en el chat vacío, como el `/start` de Telegram. Trae `start: { payload, firstTime }`: `payload` es lo que vino en `?start=` (letras, números, `-` y `_`, hasta 64; vacío si tocó Empezar) y `firstTime` dice si no tenía al negocio en sus chats. Sirve para saludar solo. Llega solo si el negocio lo activó (`PATCH /business` `{"startEvent": true}`).
- `handback`: una persona del negocio atendió la charla desde el panel y se la devolvió al bot. Trae `handback: { agentName, since }`. Mientras tanto el bot no recibió los mensajes: leer el historial para ponerse al día. Llega solo si el negocio lo activó (`PATCH /business` `{"handbackEvent": true}`).

`consent`, `reaction`, `start` y `handback` son de mejor esfuerzo: si el bot falla o no los conoce, no cuenta como caída. Un bot que no los usa puede responder `actions: []`.

## Respuesta del webhook

```json
{ "contractVersion": "0", "actions": [ { "type": "text", "text": "¡Hola!" } ] }
```

## Acciones

| `type` | Campos |
|---|---|
| `text` | `text` (formato WhatsApp: `*negrita*`, `_cursiva_`, `~tachado~`, ```` ``` ````) |
| `buttons` | `text`, `buttons: [{ id, title }]` (1 a 3), opcional `header`, `footer` |
| `list` | `text`, `button` (lo que dice el botón que la abre), `sections: [{ title?, rows: [{ id, title, description? }] }]` (hasta 10 filas en total), opcional `header`, `footer` |
| `carousel` | `text?`, `cards: [{ title, description?, imageUrl?, buttons?: [{ id, title }] (hasta 2) o link?: { label, url } }]` (1 a 10) |
| `catalog` | `items: [{ id, title, description?, priceCents?, currency?, imageUrl? }]` (`priceCents` en centavos) |
| `image` | `url` (https, JPG/PNG/WebP/GIF, hasta 4 MB), `caption?` |
| `document` | `url` (https, PDF, hasta 4 MB), `filename`, `caption?` |
| `location` | `latitude`, `longitude`, `name?`, `address?` |
| `link` | `text`, `label`, `url` (https), opcional `header`, `footer` |
| `copyCode` | `text`, `code` (hasta 64 caracteres) |
| `requestConsent` | `dataTypes: ["name" \| "phone" \| "email" \| "address"]`, `purpose` (para qué, en palabras del cliente) |
| `handoff` | `reason?`: pasa la charla a una persona del negocio. Aparece arriba en la bandeja **Atención** del panel; mientras una persona la atiende, el bot no recibe los mensajes del cliente |

Límites: 24 caracteres en títulos de botones y opciones, 72 en descripciones de opciones, 60 en `header` y `footer`, 1024 en `text`. Los `id` de un mismo mensaje tienen que ser distintos.

## API (para escribir por iniciativa propia)

Base `https://app.linkvia.com.ar/api`, encabezados `authorization: Bearer <LINKVIA_API_KEY>` y `content-type: application/json`. Solo en conversaciones del propio negocio, mientras el cliente lo tenga en sus chats y no lo haya bloqueado (si no, error 400).

**Tope sin que te escriban:** si el cliente escribió en las últimas 24 horas, no hay tope. Si no (promos, recordatorios), hasta 5 mensajes por día y por chat (cada acción cuenta como uno; el día va en hora UTC); pasado el tope, error 429 y no se manda nada. Durante 24 horas después de un `start`, `reaction`, `consent`, `handback` o un mensaje `redelivered` tampoco hay tope.

| Método y ruta | Cuerpo | Para qué |
|---|---|---|
| `POST /bot/v0/messages` | `{ contractVersion: "0", conversationId, actions: [...] }` | Mandar un mensaje después (respuesta de IA, aviso de pedido) |
| `POST /bot/v0/typing` | `{ conversationId }` | Mostrar "escribiendo…" durante 15 segundos |
| `POST /bot/v0/read` | `{ conversationId }` | Marcar la charla como leída (tildes azules) |
| `GET /bot/v0/conversations/{id}/messages?limit=50` | | Historial: `[{ id, from, sentAt, type, text, url?, replyTo?, agentName? }]` (`agentName` = lo escribió una persona del negocio; `url` es un link nuevo que dura 48 horas) |
| `POST /bot/v0/stream` | `{ conversationId }` | Empezar una respuesta de a partes. Devuelve `{ messageId }` |
| `POST /bot/v0/stream/{messageId}` | `{ text }` | Sumar texto al final (mandar cada 100 a 300 ms, no por token) |
| `POST /bot/v0/stream/{messageId}/end` | `{}` o `{ text }` | Terminarla. Con `text`, ese reemplaza todo. Sin nada en 60 s se cierra sola |

## Patrón para agentes de IA que tardan más de 10 segundos

1. Al llegar el `message`, responder el webhook al instante con `actions: []`.
2. En segundo plano: `POST /bot/v0/typing`, pedir el historial si hace falta, llamar al modelo.
3. Mandar la respuesta con `POST /bot/v0/messages` o de a partes con `/bot/v0/stream`.

## Bot mínimo de referencia (Node 18+, sin dependencias)

```js
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.LINKVIA_WEBHOOK_SECRET;

function firmaValida(cuerpo, encabezado = "") {
  const p = Object.fromEntries(encabezado.split(",").map((x) => x.trim().split("=", 2)));
  const t = Number(p.t);
  if (!t || !p.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const esperada = createHmac("sha256", SECRET).update(`${t}.${cuerpo}`).digest();
  const recibida = Buffer.from(p.v1, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

createServer(async (req, res) => {
  let cuerpo = "";
  for await (const parte of req) cuerpo += parte;
  if (req.method !== "POST" || !firmaValida(cuerpo, req.headers["linkvia-signature"])) return res.writeHead(401).end();
  const evento = JSON.parse(cuerpo);
  const actions = evento.type === "message" ? [{ type: "text", text: `Recibí: ${evento.message.text}` }] : [];
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ contractVersion: "0", actions }));
}).listen(process.env.PORT || 4000);
```

## Si el bot ya está hecho para la API de WhatsApp

No hace falta reescribirlo. En el panel se elige "La API de WhatsApp" y en el bot se cambia la base `https://graph.facebook.com/v21.0` por `https://app.linkvia.com.ar/api/wa/v21.0`, el `phone_number_id` por el handle, el token por `LINKVIA_API_KEY` y el app secret y el verify token por `LINKVIA_WEBHOOK_SECRET`. Linkvia manda el mismo JSON y la misma firma `X-Hub-Signature-256` que Meta.
