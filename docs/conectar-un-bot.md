# Conectar el bot de un negocio

Guía para quien programa el agente de un negocio. Linkvia no construye el agente: el negocio trae el suyo y lo conecta por webhook. Si es la primera vez, empezá por [Conectá tu agente en 5 minutos](empezar-en-5-minutos.md).

Si el bot ya está hecho para la API de WhatsApp, no hace falta reescribirlo: ver [Traer un bot hecho para WhatsApp](whatsapp.md).

## 1. Registrar el negocio

Desde la app, en **¿Tenés un negocio? Conectá tu agente** (`/#/negocios`), o por API:

```bash
curl -X POST https://linkvia.optis.site/api/businesses -H 'content-type: application/json' -d '{
  "handle": "pizzeria",
  "name": "Pizzería Don Luis",
  "description": "Pizzas a la piedra",
  "webhookUrl": "https://tu-bot.com/linkvia",
  "cuit": "20-12345678-6"
}'
```

La respuesta trae dos credenciales que **solo se muestran esta vez**:

| Credencial | Para qué |
| --- | --- |
| `apiKey` (`lv_…`) | Autenticar al negocio en el panel y al bot cuando escribe por su cuenta |
| `webhookSecret` (`whsec_…`) | Verificar que los eventos que llegan al webhook vienen de Linkvia |

El webhook tiene que ser `https`. Para desarrollo se acepta `http://localhost` o `http://127.0.0.1`.

## 2. Recibir eventos

Linkvia hace `POST` al webhook con un JSON y espera la respuesta en menos de 10 segundos.

**Mensaje del usuario** (`type: "message"`): trae el texto, un id de usuario seudónimo (distinto para cada negocio) y en `user.sharedData` solo los datos que el usuario aceptó compartir: `name`, `phone`, `email` y `address`. El historial de pedidos (`orderHistory`) todavía no se completa. Si el usuario respondió citando un mensaje anterior, `message.replyTo` trae ese mensaje: `{ id, from: "user" | "bot", text }`. Los mensajes que no son texto (catálogo, pedido de datos) llegan resumidos en `text`.

**Fotos:** si el usuario manda una foto, `message.image` trae `{ url, mimeType, width, height }` y `text` es el comentario que escribió con la foto (o `📷 Foto` si no escribió nada). La foto se descarga con un `GET` a `url`, sin clave: el link es largo y al azar, así que funciona como un link privado y no conviene publicarlo. Llega en JPG (a veces PNG, WebP o GIF) y pesa como mucho 2 MB. Un bot que solo lee `text` sigue funcionando.

**Archivos:** si el usuario manda un archivo, `message.document` trae `{ url, mimeType, filename }` y `text` es el comentario que escribió (o `📄 nombre.pdf` si no escribió nada). Puede ser PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), PowerPoint (`.ppt`, `.pptx`), OpenOffice (`.odt`, `.ods`) o texto (`.txt`, `.csv`), de hasta 3 MB. Se descarga igual que las fotos, con un `GET` a `url`.

**Reenviados:** si el usuario reenvía un mensaje de otro chat (por ejemplo, la dirección que le pasó otro negocio), llega con `message.forwarded: true`. El contenido viene igual que un mensaje común. Si reenvía un PDF que le mandó otro negocio, `message.document` trae `{ url, mimeType, filename }` y `text` es `📄 nombre.pdf`.

**Ubicación:** si el usuario comparte dónde está (por ejemplo, para el delivery), `message.location` trae `{ latitude, longitude }` y `text` viene `📍 Ubicación`.

**Mensajes de voz:** si el usuario manda un audio, `message.audio` trae `{ url, mimeType, durationMs }` y `text` viene `🎤 Mensaje de voz`. Se descarga igual que las fotos. Suele llegar en `audio/webm` (Opus) desde Chrome y Android, o en `audio/mp4` desde iPhone y Safari; dura como mucho 5 minutos. Si tu bot no transcribe audio, conviene que le pida al usuario que lo escriba.

**Respuesta a un pedido de datos** (`type: "consent"`): llega apenas el usuario toca **Compartir** o **No compartir**, sin esperar a que vuelva a escribir. Trae la conversación, el usuario con su `sharedData` ya actualizado y `consent: { granted, declined, purpose }`. También llega cuando el usuario deja de compartir un dato desde "Mis datos": en ese caso `granted` y `declined` vienen vacíos y `revoked` trae los tipos de dato que ya no comparte. Si guardaste ese dato, dejá de usarlo. Lo que respondas se muestra en el chat. Es de mejor esfuerzo: si tu bot falla o no lo conoce, Linkvia no se lo muestra al usuario ni lo cuenta como falla, así que un bot que no lo usa puede responder `actions: []`.

**Reacción** (`type: "reaction"`): llega cuando el usuario reacciona con un emoji a un mensaje, tuyo o suyo, como en WhatsApp. Trae la conversación, el usuario y `reaction: { messageId, emoji }`. Si sacó la reacción, `emoji` viene vacío. Un 👍 a tu "¿Te confirmo el pedido?" puede servir como un sí. Es de mejor esfuerzo, como `consent`: lo que respondas se muestra en el chat, y si tu bot falla o no lo conoce, no pasa nada.

**Devuelta al bot** (`type: "handback"`): llega cuando una persona del negocio atendió la charla desde el panel (**Atención**) y se la devuelve al bot. Trae la conversación, el usuario y `handback: { agentName, since }`. Mientras atendía la persona, los mensajes del usuario no le llegaron al bot: para ponerse al día, leé el historial (lo que escribió la persona viene con `agentName`). Lo que respondas se muestra en el chat. **Llega solo si lo activás** en el panel ("Avisarle a mi bot cuando le devuelvo una charla") o con `PATCH /business` `{"handbackEvent": true}`. Es de mejor esfuerzo, como `consent`: si tu bot falla, no cuenta como caída.

**Prueba de conexión** (`type: "ping"`): llega cuando el negocio toca "Probar conexión" y, además, cada 5 minutos desde el monitoreo de Linkvia. Respondé `{"contractVersion":"0","actions":[]}`. Si el bot falla dos veces seguidas (en pings o mensajes), Linkvia lo marca como caído y le avisa al negocio.

### Verificar la firma

Cada evento trae el encabezado `linkvia-signature: t=<unix>,v1=<hex>`, con `v1 = HMAC-SHA256(webhookSecret, "<t>.<cuerpo crudo>")`. Rechazá el evento si la firma no coincide o si `t` tiene más de 5 minutos. En Node:

```ts
import { SIGNATURE_HEADER, verifySignature } from "@linkvia/bot-contract/signature";

if (!verifySignature(process.env.LINKVIA_WEBHOOK_SECRET!, rawBody, req.headers[SIGNATURE_HEADER])) {
  return res.writeHead(401).end();
}
```

En otro lenguaje alcanza con calcular el mismo HMAC sobre el cuerpo **tal como llegó**, antes de parsearlo.

## 3. Responder

La respuesta es `{"contractVersion":"0","actions":[...]}`:

| Acción | Ejemplo |
| --- | --- |
| `text` | `{"type":"text","text":"¡Hola!"}` |
| `catalog` | `{"type":"catalog","items":[{"id":"muzza","title":"Muzzarella","priceCents":1200000,"currency":"ARS"}]}` |
| `requestConsent` | `{"type":"requestConsent","dataTypes":["phone"],"purpose":"Avisarte cuando sale tu pedido"}` |
| `handoff` | `{"type":"handoff","reason":"Pidió hablar con una persona"}` |
| `image` | `{"type":"image","url":"https://tu-bot.com/fotos/muzza.jpg","caption":"La muzza de hoy"}` |
| `document` | `{"type":"document","url":"https://tu-bot.com/tickets/1042.pdf","filename":"ticket-1042.pdf"}` |
| `location` | `{"type":"location","latitude":-34.5889,"longitude":-58.4306,"name":"Pizzería Don Luis","address":"Gurruchaga 1234"}` |
| `buttons` | `{"type":"buttons","text":"¿Delivery o retiro?","buttons":[{"id":"delivery","title":"Delivery"},{"id":"retiro","title":"Retiro"}]}` |
| `list` | `{"type":"list","text":"Elegí tu pizza","button":"Ver el menú","sections":[{"title":"Pizzas","rows":[{"id":"napo","title":"Napolitana","description":"$14.000"}]}]}` |
| `link` | `{"type":"link","text":"Tu pedido está en camino","label":"Seguir mi pedido","url":"https://tu-bot.com/pedidos/1042"}` |
| `copyCode` | `{"type":"copyCode","text":"Tu cupón de descuento:","code":"PIZZA10"}` |
| `carousel` | `{"type":"carousel","text":"Promos","cards":[{"title":"Napolitana","description":"$14.000","imageUrl":"https://tu-bot.com/fotos/napo.jpg","buttons":[{"id":"napo","title":"Pedir"}]}]}` |

**Formato del texto:** como en WhatsApp, `*negrita*`, `_cursiva_`, `~tachado~` y ```` ```monoespaciado``` ```` (puede ocupar varias líneas); se pueden combinar, como `*_así_*`. Vale en `text`, en los `caption` y en el texto de botones, listas y tarjetas. Un mensaje de 1 a 3 emojis solos se ve grande.

**Fotos y PDF:** `image` acepta JPG, PNG, WebP o GIF y `document` acepta PDF, de hasta 4 MB cada uno; `caption` es opcional. Linkvia baja el archivo de `url` en el momento y lo guarda, así que el link tiene que ser `https`, público y responder en menos de 10 segundos; después puede vencer. Si no se puede bajar o no es del tipo que dice, el usuario ve un aviso en su lugar. Cuando el bot escribe por su cuenta (`POST /bot/v0/messages`), en cambio, la respuesta es un error 400 que dice qué pasó.

**Botones, listas y tarjetas**, como los mensajes interactivos de WhatsApp Business:

- `buttons` lleva de 1 a 3 botones de respuesta rápida. `list` abre una lista de hasta 10 opciones en total, agrupadas en `sections`; `button` es lo que dice el botón que la abre. `carousel` lleva de 1 a 10 tarjetas que se deslizan, cada una con `title`, y opcionalmente `description`, `imageUrl` (se baja como las fotos; si falla, la tarjeta va sin foto) y hasta 2 `buttons` o un `link`.
- `buttons`, `list` y `link` aceptan además `header` (título en negrita) y `footer` (nota gris). Los textos largos se recortan: 24 caracteres los botones y opciones, 72 la descripción de una opción, 60 el header y el footer, 1024 el texto.
- Cuando el usuario toca un botón o elige una opción, llega un mensaje común con `text` igual al título de la opción, `replyTo` con el mensaje de los botones y `message.choice: { id, title }` con el `id` que le pusiste. Conviene decidir por `choice.id` y no por el texto. Abrir la lista no manda nada.
- `link` abre `url` (https) en el navegador y `copyCode` copia `code` (hasta 64 caracteres). Ninguno de los dos le avisa al bot.
- Los `id` de las opciones de un mismo mensaje tienen que ser distintos (hasta 200 caracteres).

`requestConsent` le muestra al usuario los datos que se van a compartir y los botones **Compartir** y **No compartir**. Si le falta cargar alguno (por ejemplo la dirección), lo completa ahí mismo y queda guardado en su perfil. Si acepta, el bot recibe enseguida un evento `consent` y, desde ese momento, los datos llegan en `user.sharedData` de cada mensaje.

## 4. Escribir después (handoff, avisos de pedido)

**Pasar a una persona:** con la acción `handoff` la charla aparece arriba en la bandeja **Atención** del panel del negocio, marcada "Pide una persona". Ahí alguien del negocio la toma, le contesta con su nombre (el usuario ve "Te atiende Laura, de Pizzería" y el nombre arriba de cada mensaje) y, al terminar, se la devuelve al bot. Mientras la atiende una persona, los mensajes del usuario no le llegan al bot (tampoco a la cola si el bot está caído); hasta que alguien la toma, le siguen llegando. Una persona también puede tomar cualquier charla aunque el bot no haya pedido el pase. La bandeja también se maneja por API: ver la tabla del panel, más abajo.

Si el agente tarda, el bot puede escribir cuando quiera en una conversación existente:

```bash
curl -X POST https://linkvia.optis.site/api/bot/v0/messages \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","conversationId":"<conversation.id del evento>","actions":[{"type":"text","text":"Tu pedido salió"}]}'
```

Solo funciona en conversaciones del propio negocio y mientras el usuario lo tenga en su lista de contactos.

Mientras prepara una respuesta que tarda, el bot puede avisar que está escribiendo. El usuario ve "escribiendo…" hasta que llega el mensaje o pasan 15 segundos (si tarda más, que vuelva a avisar):

```bash
curl -X POST https://linkvia.optis.site/api/bot/v0/typing \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
```

**Tildes:** cada mensaje del usuario muestra un tilde gris cuando queda en Linkvia y dos grises cuando le llega a tu webhook. Pasan a dos azules cuando el bot lo lee: cuando responde algo, avisa que está escribiendo o escribe por su cuenta. Si tu bot lee y no contesta enseguida (o no contesta), puede marcar la charla como leída:

```bash
curl -X POST https://linkvia.optis.site/api/bot/v0/read \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
```

Abajo del nombre del negocio, el usuario ve "en línea" mientras el bot responde bien, y "últ. vez hoy a las 14:32" si está caído.

**Historial:** para que el agente tenga el contexto sin guardarlo, `GET /bot/v0/conversations/<conversation.id>/messages?limit=50` (con la clave de API) devuelve los últimos mensajes de la charla: `{ id, from, sentAt, type, text, url?, replyTo?, agentName? }`. `agentName` viene en lo que escribió una persona del negocio desde el panel. `text` es el texto completo o un resumen ("📷 Foto") si no es texto; `url` es dónde bajar la foto, el audio o el archivo.

**Reintentos:** si la entrega de un mensaje falla rápido (el bot no está, responde 5xx), Linkvia la reintenta una vez al segundo con el mismo `eventId`: si tu bot ya lo había procesado, ignoralo. Si el bot tardó más de 10 segundos no se reintenta, para no hacer esperar más al usuario. Cada intento queda en `GET /business/deliveries` y en el panel.

## 5. Agentes de IA: contestar más tarde y de a partes

Un agente con un modelo de lenguaje suele tardar más de los 10 segundos que Linkvia espera la respuesta del webhook. Para eso hay un **modo asíncrono**: el webhook contesta enseguida sin acciones y la respuesta llega después por la API.

1. Al recibir el mensaje, respondé `{"contractVersion":"0","actions":[]}` en el momento. El usuario ve dos tildes grises.
2. Mientras el agente piensa, avisá que estás escribiendo (`POST /bot/v0/typing`, se repite cada 15 segundos si hace falta).
3. Mandá la respuesta cuando la tengas: entera con `POST /bot/v0/messages`, o **de a partes** como sigue.

**Respuestas de a partes (streaming).** El usuario ve la burbuja escribirse a medida que el agente genera el texto, como en ChatGPT (WhatsApp no lo permite):

```bash
# Empezar: devuelve el id de la respuesta
curl -X POST https://linkvia.optis.site/api/bot/v0/stream \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
# → {"messageId":"..."}

# Sumar texto, las veces que haga falta (se agrega al final)
curl -X POST https://linkvia.optis.site/api/bot/v0/stream/<messageId> \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"text":"Hola, "}'

# Terminar. Con "text", ese reemplaza todo (por ejemplo, la respuesta final del modelo)
curl -X POST https://linkvia.optis.site/api/bot/v0/stream/<messageId>/end \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' -d '{}'
```

- No hace falta mandar cada token: juntalos y mandá cada 100–300 ms.
- El aviso al celular sale una sola vez, al terminar.
- Si no llega nada durante 60 segundos, la respuesta se da por terminada con lo que haya, y ya no se le puede sumar texto.
- Una respuesta puede tener hasta 20.000 caracteres y no puede terminar vacía.
- Funciona en conversaciones del propio negocio y mientras el usuario lo tenga en sus contactos, igual que `POST /bot/v0/messages`.


## 6. Panel del negocio

En `https://linkvia.optis.site/api`, con `authorization: Bearer <apiKey>`:

| Ruta | Qué hace |
| --- | --- |
| `GET /business` | Perfil y webhook |
| `PATCH /business` | Cambia nombre, descripción, webhook o email de alertas |
| `POST /business/test-connection` | Manda un `ping` firmado y devuelve si el bot respondió y en cuánto |
| `GET /business/incidents` | Últimas caídas del bot, la más reciente primero |
| `GET /business/usage` | Conversaciones de este mes y del anterior |
| `GET /business/health` | Últimos éxitos y fallas del bot |
| `POST /business/rotate-api-key` | Cambia la clave de API y devuelve la nueva (una sola vez). La anterior deja de servir en el momento |
| `POST /business/rotate-webhook-secret` | Cambia el secreto del webhook y devuelve el nuevo. Los eventos siguientes se firman con él |
| `GET /business/deliveries` | Últimas entregas al webhook: evento, si respondió, cuánto tardó y el error |
| `GET /business/conversations` | La bandeja de atención: las charlas con su último mensaje, primero las que pidieron una persona |
| `GET /business/conversations/<id>` | Una charla con todos sus mensajes (la marca como leída en el panel) |
| `POST /business/conversations/<id>/take` | Una persona toma la charla: `{"agentName":"Laura"}`. El bot deja de recibir los mensajes |
| `POST /business/conversations/<id>/messages` | Contesta como persona: `{"agentName","text"}`, o con `image` o `document`. Si no la había tomado, la toma |
| `POST /business/conversations/<id>/release` | Se la devuelve al bot (con `handbackEvent`, el bot recibe `handback`) |
| `GET /business/events` | Avisos en el momento de qué charla cambió (Server-Sent Events), para la bandeja |

## 7. Link a tu chat

Como wa.me en WhatsApp, `https://linkvia.optis.site/@tu_handle` abre el chat con tu agente; si la persona no tenía tu negocio en sus chats, se agrega solo, y si no había entrado a Linkvia, entra primero. Con `?text=` el chat se abre con ese texto ya escrito, sin mandarlo: `https://linkvia.optis.site/@pizzeria?text=Quiero%20hacer%20un%20pedido`. Si ya había algo escrito, no se pisa. Tu link está en el panel del negocio, con un botón para copiarlo.

## Probarlo con el bot de ejemplo

Los bots mínimos [bot.mjs](../ejemplos/node/bot.mjs) y [bot.py](../ejemplos/python/bot.py) verifican la firma y contestan con texto y botones. La guía [Conectá tu agente en 5 minutos](empezar-en-5-minutos.md) explica cómo levantarlos y probarlos.
