# Conectar el bot de un negocio

Guía para quien programa el agente de un negocio. Linkvia no construye el agente: el negocio trae el suyo y lo conecta por webhook. Si es la primera vez, empezá por [Conectá tu agente en 5 minutos](empezar-en-5-minutos.md).

Si el bot ya está hecho para la API de WhatsApp, no hace falta reescribirlo: ver [Traer un bot hecho para WhatsApp](whatsapp.md).

## 1. Registrar el negocio

Desde el panel de negocios ([negocios.linkvia.com.ar](https://negocios.linkvia.com.ar/)), o por API:

```bash
curl -X POST https://app.linkvia.com.ar/api/businesses -H 'content-type: application/json' -d '{
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

**Fotos:** si el usuario manda una foto, `message.image` trae `{ url, mimeType, width, height }` y `text` es el comentario que escribió con la foto (o `📷 Foto` si no escribió nada). La foto se descarga con un `GET` a `url`, sin clave: el link está firmado y vence a las 48 horas, así que funciona como un link privado y no conviene publicarlo. Para bajarla más tarde, pedí un link nuevo con el historial (abajo) o mandá tu clave de API en `Authorization: Bearer` al hacer el `GET` a la misma dirección sin `?exp=…&sig=…`; un usuario o un negocio que no son de esa charla reciben 404. Un link vencido o un pedido sin firma ni clave responde 401: es la señal para pedir uno nuevo. Por eso no guardes la `url` para usarla días después: guardá el archivo o pedí el link cuando lo necesites. Llega en JPG (a veces PNG, WebP o GIF) y pesa como mucho 2 MB. Un bot que solo lee `text` sigue funcionando.

**Archivos:** si el usuario manda un archivo, `message.document` trae `{ url, mimeType, filename }` y `text` es el comentario que escribió (o `📄 nombre.pdf` si no escribió nada). Puede ser PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), PowerPoint (`.ppt`, `.pptx`), OpenOffice (`.odt`, `.ods`) o texto (`.txt`, `.csv`), de hasta 3 MB. Se descarga igual que las fotos, con un `GET` a `url`.

**Reenviados:** si el usuario reenvía un mensaje de otro chat (por ejemplo, la dirección que le pasó otro negocio), llega con `message.forwarded: true`. El contenido viene igual que un mensaje común. Si reenvía un PDF que le mandó otro negocio, `message.document` trae `{ url, mimeType, filename }` y `text` es `📄 nombre.pdf`. Un archivo reenviado es una copia para este chat: llega con otro id y otra `url`.

**Ubicación:** si el usuario comparte dónde está (por ejemplo, para el delivery), `message.location` trae `{ latitude, longitude }` y `text` viene `📍 Ubicación`.

**Mensajes de voz:** si el usuario manda un audio, `message.audio` trae `{ url, mimeType, durationMs }` y `text` viene `🎤 Mensaje de voz`. Se descarga igual que las fotos. Suele llegar en `audio/webm` (Opus) desde Chrome y Android, o en `audio/mp4` desde iPhone y Safari; dura como mucho 5 minutos. Si tu bot no transcribe audio, conviene que le pida al usuario que lo escriba.

**Respuesta a un pedido de datos** (`type: "consent"`): llega apenas el usuario toca **Compartir** o **No compartir**, sin esperar a que vuelva a escribir. Trae la conversación, el usuario con su `sharedData` ya actualizado y `consent: { granted, declined, purpose }`. También llega cuando el usuario deja de compartir un dato desde "Mis datos": en ese caso `granted` y `declined` vienen vacíos y `revoked` trae los tipos de dato que ya no comparte. Si guardaste ese dato, dejá de usarlo. Lo que respondas se muestra en el chat. Es de mejor esfuerzo: si tu bot falla o no lo conoce, Linkvia no se lo muestra al usuario ni lo cuenta como falla, así que un bot que no lo usa puede responder `actions: []`.

**Reacción** (`type: "reaction"`): llega cuando el usuario reacciona con un emoji a un mensaje, tuyo o suyo, como en WhatsApp. Trae la conversación, el usuario y `reaction: { messageId, emoji }`. Si sacó la reacción, `emoji` viene vacío. Un 👍 a tu "¿Te confirmo el pedido?" puede servir como un sí. Es de mejor esfuerzo, como `consent`: lo que respondas se muestra en el chat, y si tu bot falla o no lo conoce, no pasa nada.

**Empezar y links de campaña** (`type: "start"`): llega cuando el usuario abre el chat con un link de campaña (`/@tu-negocio?start=qr-mesa5`) o toca **Empezar** en el chat vacío, como el `/start` de Telegram. Trae la conversación, el usuario y `start: { payload, firstTime }`: `payload` es lo que vino en `?start=` (letras, números, `-` y `_`, hasta 64; vacío si tocó Empezar) y `firstTime` dice si el usuario no tenía al negocio en sus chats. Sirve para saludar solo y distinto según de dónde vino ("¡Bienvenido a la mesa 5!"). Lo que respondas se muestra en el chat. **Llega solo si lo activás** en el panel ("Que mi bot salude solo") o con `PATCH /business` `{"startEvent": true}`; mientras tanto, el chat vacío no muestra el botón Empezar. Es de mejor esfuerzo, como `consent`: si tu bot falla, no cuenta como caída (queda en el registro de entregas). Los links de campaña se cuentan aunque no lo actives: `GET /business/campaigns` y el panel dicen cuántas personas abrieron el chat con cada uno.

**Devuelta al bot** (`type: "handback"`): llega cuando una persona del negocio atendió la charla desde el panel (**Atención**) y se la devuelve al bot. Trae la conversación, el usuario y `handback: { agentName, since }`. Mientras atendía la persona, los mensajes del usuario no le llegaron al bot: para ponerse al día, leé el historial (lo que escribió la persona viene con `agentName`). Lo que respondas se muestra en el chat. **Llega solo si lo activás** en el panel ("Avisarle a mi bot cuando le devuelvo una charla") o con `PATCH /business` `{"handbackEvent": true}`. Es de mejor esfuerzo, como `start`.

**Lo que el usuario hace con la charla** (`contact`, `cleared` y `streamStopped`, como el `my_chat_member` de Telegram). **Llegan solo si los activás** en el panel ("Avisarle lo que el cliente hace con la charla") o con `PATCH /business` `{"chatEvents": true}`. Traen solo `user: { id }` (el seudónimo, sin datos personales) y son de mejor esfuerzo: lo que respondas **no** se muestra y, si tu bot falla, no cuenta como caída.

- `contact`: `contact: { status }` con `added` (te agregó a sus chats), `removed` (te sacó), `blocked` (te bloqueó: tus mensajes ya no le llegan) o `unblocked`. Trae `conversation` si ya habían hablado. Con `removed` o `blocked`, dejá de escribirle.
- `cleared`: vació el chat. Si tu agente guarda memoria de la charla, borrala: el usuario ya no ve esos mensajes.
- `streamStopped`: tocó **Detener** en una respuesta que escribías de a partes. Trae `stream: { messageId, text }` con el texto con el que quedó. Cortá el modelo para no gastar. Aunque no lo actives, lo que sigas mandando a ese `messageId` se descarta sin error y `POST /bot/v0/stream/<messageId>` devuelve `stopped: true`.

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
- **Menú de atajos** (como los comandos de Telegram, pero sin `/`): el negocio carga de 1 a 10 atajos en el panel (**Tu bot → Menú de atajos**) o con `PUT /business/shortcuts`. En el chat aparece un botón al lado del campo de texto que los muestra con su descripción; tocar uno manda un mensaje común con `text` igual al título y `message.choice: { id, title, kind: "shortcut" }`, sin `replyTo`. Así el bot no aprende nada nuevo: si ya decide por `choice.id`, conviene usar los mismos ids que en sus botones (por ejemplo `menu` o `humano`). Con el formato de WhatsApp llega como `button_reply`.
- `link` abre `url` (https) en el navegador y `copyCode` copia `code` (hasta 64 caracteres). Ninguno de los dos le avisa al bot.
- **Links y estafas:** debajo de cada botón o tarjeta con link el usuario ve el dominio real (por ejemplo `mercadopago.com.ar`). Si tu negocio no está verificado, antes de abrir un link le avisamos a dónde lleva, y no se aceptan links acortados (bit.ly, tinyurl.com, t.co…) ni en botones ni en el texto: mandá el link completo. Si escribís por tu cuenta la respuesta es un error 400; en una respuesta al webhook, el usuario ve un aviso en lugar del mensaje. Y si un mensaje pide un código, un PIN, una clave o datos de la tarjeta, el usuario ve debajo "Linkvia nunca te pide tu código ni tu PIN en un chat" y el equipo de Linkvia lo revisa. Los links de todos los negocios se revisan además contra la lista de sitios peligrosos de Google (Web Risk): uno marcado como phishing o virus no llega, igual que un link acortado.
- Los `id` de las opciones de un mismo mensaje tienen que ser distintos (hasta 200 caracteres).
- **Cada botón acepta además** `style: "primary"` (verde) o `"danger"` (rojo), `disabled: true` (gris, no se puede tocar, como "Sin stock") y `silent: true`. Los botones de un mensaje `buttons` **se eligen una vez**: después de tocar uno se ven grises y otra elección devuelve error, para evitar el doble pedido. Si editás el mensaje, se pueden volver a elegir.
- **Botones que no escriben** (`silent: true`, como los `callback` de Telegram): tocarlo no escribe nada en el chat. Tu bot recibe el evento `buttonTap` con `buttonTap: { messageId, id, title }` y puede contestar `{"contractVersion":"0","actions":[],"toast":"Agregado ✓"}`: el `toast` (hasta 200 caracteres) se ve un momento abajo, y las `actions` se muestran en el chat. Lo normal es editar el mensaje del botón (por ejemplo, el carrito con la cantidad nueva). Si tu bot no contesta, el usuario ve "no respondió, probá de nuevo" (no cuenta como caída). Solo en el contrato de Linkvia. El bot de ejemplo lo hace con "carrito".

`requestConsent` le muestra al usuario los datos que se van a compartir y los botones **Compartir** y **No compartir**. Si le falta cargar alguno (por ejemplo la dirección), lo completa ahí mismo y queda guardado en su perfil. Si acepta, el bot recibe enseguida un evento `consent` y, desde ese momento, los datos llegan en `user.sharedData` de cada mensaje.

## 4. Escribir después (handoff, avisos de pedido)

**Pasar a una persona:** con la acción `handoff` la charla aparece arriba en la bandeja **Atención** del panel del negocio, marcada "Pide una persona". Ahí alguien del negocio la toma, le contesta con su nombre (el usuario ve "Te atiende Laura, de Pizzería" y el nombre arriba de cada mensaje) y, al terminar, se la devuelve al bot. Mientras la atiende una persona, los mensajes del usuario no le llegan al bot (tampoco a la cola si el bot está caído); hasta que alguien la toma, le siguen llegando. Una persona también puede tomar cualquier charla aunque el bot no haya pedido el pase. La bandeja también se maneja por API: ver la tabla del panel, más abajo.

Si el agente tarda, el bot puede escribir cuando quiera en una conversación existente:

```bash
curl -X POST https://app.linkvia.com.ar/api/bot/v0/messages \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","conversationId":"<conversation.id del evento>","actions":[{"type":"text","text":"Tu pedido salió"}]}'
```

Solo funciona en conversaciones del propio negocio, mientras el usuario lo tenga en su lista de contactos y no lo haya bloqueado. Si lo quitó o lo bloqueó, la respuesta es un error 400 y no se te dice cuál de las dos.

**Editar y borrar tus mensajes** (como en Telegram; la API de WhatsApp no lo permite). `POST /bot/v0/messages` devuelve los mensajes con su `id` (también están en el historial). Con ese id, durante 48 horas:

```bash
# Editar: una acción de texto, botones, lista, link o código. El usuario ve "Editado" y no le llega aviso.
curl -X PATCH https://app.linkvia.com.ar/api/bot/v0/messages/<id> \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","action":{"type":"text","text":"Tu pedido salió 🛵"}}'

# Borrar: queda "Se eliminó este mensaje", sin el contenido.
curl -X DELETE https://app.linkvia.com.ar/api/bot/v0/messages/<id> -H "authorization: Bearer $LINKVIA_API_KEY"
```

Sirve para un pedido que cambia de estado en la misma burbuja o un carrito con + y −. Las fotos, archivos, carruseles y respuestas de a partes que se están escribiendo no se editan. Con el SDK: `bot.edit(id, action)` y `bot.delete(id)`.

**Tope a lo que mandás sin que te escriban:** mientras el usuario te haya escrito en las últimas 24 horas no hay tope. Si no (una promo, un recordatorio), por chat podés mandar hasta 5 mensajes por día (cada acción cuenta como un mensaje, y empezar una respuesta de a partes cuenta como uno). Pasado el tope la respuesta es un error 429 y no se manda nada del envío; el día se cuenta en hora UTC. Apenas el usuario te escribe, el tope deja de correr. Contestar tarde algo que el usuario hizo tampoco cuenta: durante 24 horas después de que toca Empezar (`start`), reacciona (`reaction`), contesta un pedido de datos (`consent`), la persona del panel te devuelve la charla (`handback`) o te llega un mensaje que esperaba en la cola (`redelivered`), podés escribirle sin tope. Un envío que se rechaza por otra cosa (por ejemplo, una foto que no se pudo bajar) igual cuenta para el tope.

Mientras prepara una respuesta que tarda, el bot puede avisar que está escribiendo. El usuario ve "escribiendo…" hasta que llega el mensaje o pasan 15 segundos (si tarda más, que vuelva a avisar):

```bash
curl -X POST https://app.linkvia.com.ar/api/bot/v0/typing \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
```

**Tildes:** cada mensaje del usuario muestra un tilde gris cuando queda en Linkvia y dos grises cuando le llega a tu webhook. Pasan a dos azules cuando el bot lo lee: cuando responde algo, avisa que está escribiendo o escribe por su cuenta. Si tu bot lee y no contesta enseguida (o no contesta), puede marcar la charla como leída:

```bash
curl -X POST https://app.linkvia.com.ar/api/bot/v0/read \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
```

Arriba de la charla el usuario ve el nombre de tu agente (si le pusiste uno en **Perfil**, por ejemplo "Fatty"; si no, el del negocio) y abajo "en línea" mientras el bot responde bien, o "últ. vez hoy a las 14:32" si está caído.

**Historial:** para que el agente tenga el contexto sin guardarlo, `GET /bot/v0/conversations/<conversation.id>/messages?limit=50` (con la clave de API) devuelve los últimos mensajes de la charla: `{ id, from, sentAt, type, text, url?, replyTo?, agentName? }`. `agentName` viene en lo que escribió una persona del negocio desde el panel. `text` es el texto completo o un resumen ("📷 Foto") si no es texto; `url` es dónde bajar la foto, el audio o el archivo (un link nuevo, firmado, que dura 48 horas).

**Reintentos:** si la entrega de un mensaje falla rápido (el bot no está, responde 5xx), Linkvia la reintenta una vez al segundo con el mismo `eventId`: si tu bot ya lo había procesado, ignoralo. Si el bot tardó más de 10 segundos no se reintenta, para no hacer esperar más al usuario. Cada intento queda en `GET /business/deliveries` y en el panel.

**Bot caído:** si el reintento también falla, el mensaje no se pierde: queda en una cola y el usuario ve "no está respondiendo ahora. Tu mensaje le va a llegar apenas vuelva" (una vez por caída). Los mensajes que siga mandando a esa charla van detrás. Cuando el bot vuelve a responder (el monitoreo lo prueba cada 5 minutos, o el usuario escribe de nuevo), Linkvia le entrega la cola en orden, con el mismo `eventId` del primer intento y `redelivered: true`; `message.sentAt` dice cuándo lo escribió el usuario, para que el bot no conteste "buen día" a la noche. Lo que el bot responda llega al chat y al celular. Lo que espera más de 24 horas se descarta y queda en el registro de entregas. Si el bot tardó más de 10 segundos no se encola: puede que lo haya recibido. `GET /business/health` devuelve en `pendingEvents` cuántos mensajes esperan.

## 5. Agentes de IA: contestar más tarde y de a partes

Un agente con un modelo de lenguaje suele tardar más de los 10 segundos que Linkvia espera la respuesta del webhook. Para eso hay un **modo asíncrono**: el webhook contesta enseguida sin acciones y la respuesta llega después por la API.

1. Al recibir el mensaje, respondé `{"contractVersion":"0","actions":[]}` en el momento. El usuario ve dos tildes grises.
2. Mientras el agente piensa, avisá que estás escribiendo (`POST /bot/v0/typing`, se repite cada 15 segundos si hace falta).
3. Mandá la respuesta cuando la tengas: entera con `POST /bot/v0/messages`, o **de a partes** como sigue.

**Respuestas de a partes (streaming).** El usuario ve la burbuja escribirse a medida que el agente genera el texto, como en ChatGPT (WhatsApp no lo permite):

```bash
# Empezar: devuelve el id de la respuesta
curl -X POST https://app.linkvia.com.ar/api/bot/v0/stream \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"conversationId":"<conversation.id del evento>"}'
# → {"messageId":"..."}

# Sumar texto, las veces que haga falta (se agrega al final)
curl -X POST https://app.linkvia.com.ar/api/bot/v0/stream/<messageId> \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"text":"Hola, "}'

# Terminar. Con "text", ese reemplaza todo (por ejemplo, la respuesta final del modelo)
curl -X POST https://app.linkvia.com.ar/api/bot/v0/stream/<messageId>/end \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' -d '{}'
```

- No hace falta mandar cada token: juntalos y mandá cada 100–300 ms.
- El aviso al celular sale una sola vez, al terminar.
- Si no llega nada durante 60 segundos, la respuesta se da por terminada con lo que haya, y ya no se le puede sumar texto.
- Una respuesta puede tener hasta 20.000 caracteres y no puede terminar vacía.
- Funciona en conversaciones del propio negocio y mientras el usuario lo tenga en sus contactos, igual que `POST /bot/v0/messages`.
- El usuario puede tocar **Detener** mientras se escribe: la respuesta queda con lo que tenía, lo que sigas mandando se descarta (sin error) y cada `POST /bot/v0/stream/<messageId>` devuelve `"stopped": true`. Con el SDK, `reply.stopped` pasa a `true`: cortá ahí el modelo. Con `chatEvents` llega además el evento `streamStopped`.

## 6. Panel del negocio

En `https://app.linkvia.com.ar/api`, con `authorization: Bearer <apiKey>`, o con la sesión del panel (`lvp_…`) si el dueño entró con su mail:

| Ruta | Qué hace |
| --- | --- |
| `GET /business` | Perfil y webhook |
| `PATCH /business` | Cambia nombre, nombre del agente (`agentDisplayName`, el que ve el cliente en la charla), descripción, webhook o email de alertas |
| `POST /business/test-connection` | Manda un `ping` firmado y devuelve si el bot respondió y en cuánto |
| `GET /business/incidents` | Últimas caídas del bot, la más reciente primero |
| `GET /business/usage` | Conversaciones de este mes y del anterior |
| `PUT /business/shortcuts` | Reemplaza el menú de atajos del agente: `{"shortcuts":[{"id":"menu","title":"Ver la carta","description":"Pizzas y empanadas"}]}`. De 0 a 10; `title` hasta 24 caracteres (es lo que se manda), `description` hasta 72 y `id` hasta 64 (letras, números, `-`, `_` o `.`; si no viene, se arma con el título). Una lista vacía saca el botón del chat |
| `GET /business/stats?days=30` | Estadísticas de los últimos días: mensajes por día y por hora, tiempo de respuesta del bot y charlas atendidas por una persona |
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
| `POST /business/owner` | Agrega o cambia el mail del dueño: `{"email","code"}` con el código que le llegó a ese mail. Las sesiones abiertas con el mail anterior dejan de servir |
| `DELETE /business/session` | Cierra la sesión del panel abierta con el mail |
| `POST /business/verification` | Pide la tilde de verificado. Hace falta el mail del dueño: por ahí te escribimos |

**Entrar con el mail del dueño** (sin clave): `POST /business/owner/code` con `{"email","purpose":"ingresar"}` manda un código de 6 números al mail (solo si es dueño de algún negocio; la respuesta es igual en los dos casos). Después, `POST /business/login` con `{"email","code"}` devuelve `{ businesses: [{ handle, name, token }] }`: un token de sesión por cada negocio de ese mail, que dura 30 días. Para el alta o para agregar el dueño, el código se pide con `"purpose":"verificar"` y se manda en `POST /businesses` (`ownerEmail`, `ownerCode`) o en `POST /business/owner`. Cuando cambian la clave de API, el secreto o el webhook, Linkvia le avisa al dueño por mail.

**La tilde de verificado** la da solo el equipo de Linkvia, después de revisar a mano la constancia de CUIT de ARCA, tu web o un mail de tu dominio, y un contacto. Un CUIT válido no alcanza (`verification: "light"`): solo `"strong"` muestra la tilde. Sin la tilde tu bot funciona igual, pero el usuario ve un aviso de negocio sin verificar y no aparecés en el directorio. Si un negocio verificado cambia el nombre, pierde la tilde hasta que lo revisemos de nuevo. Los nombres y @ de bancos, billeteras y organismos (por ejemplo `banco`, `mercadopago`, `uala`, `anses`) no se pueden usar sin verificación, y un nombre parecido al de un negocio verificado queda en revisión.

## 7. Link a tu chat

Como wa.me en WhatsApp, `https://app.linkvia.com.ar/@tu_handle` abre el chat con tu agente; si la persona no tenía tu negocio en sus chats, se agrega solo, y si no había entrado a Linkvia, entra primero. Con `?text=` el chat se abre con ese texto ya escrito, sin mandarlo: `https://app.linkvia.com.ar/@pizzeria?text=Quiero%20hacer%20un%20pedido`. Si ya había algo escrito, no se pisa. Tu link está en el panel del negocio, con un botón para copiarlo.

## Probarlo con el bot de ejemplo

Los bots mínimos [bot.mjs](../ejemplos/node/bot.mjs) y [bot.py](../ejemplos/python/bot.py) verifican la firma y contestan con texto y botones. La guía [Conectá tu agente en 5 minutos](empezar-en-5-minutos.md) explica cómo levantarlos y probarlos.
