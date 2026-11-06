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

Desde una misma conexión se pueden registrar hasta 20 negocios por día; pasado ese tope, `POST /businesses` responde 429 y hay que probar al día siguiente. El @ `linvy` (el agente oficial de Linkvia) no se puede usar, igual que los de bancos, billeteras y organismos (ver la tilde de verificado, en la sección 6).

Conviene registrar el negocio con el mail del dueño (`ownerEmail` y `ownerCode`, ver "Entrar con el mail del dueño" en la sección 6): así el dueño entra al panel sin la clave, y lo sensible (cambiar la clave, el secreto o el webhook) queda protegido aunque la clave se filtre.

**Rubros prohibidos:** no se registra un negocio cuyo @, nombre o descripción sea de un rubro de la sección 1 de las Reglas de contenido (armas, apuestas, vapeadores, drogas, falsificaciones…), ni se le cambia después el nombre, la descripción o el nombre del agente a uno de esos: `POST /businesses` y `PATCH /business` responden 400 citando las reglas. Es un filtro por palabras; lo que no agarra lo revisa el equipo.

**Datos sensibles (Ley 25.326):** si tu agente pide o guarda datos de **salud, religión, opinión política o afiliación sindical**, tenés que declararlo: `"sensitiveData": "health" | "religion" | "politics" | "union"` y `"sensitivePurpose"` (para qué los usa, en palabras del negocio, de 10 a 280 caracteres), al registrar o después con `PATCH /business` (en el panel, **Perfil → Mi agente pide o guarda datos de…**). Con eso, antes del primer mensaje el usuario lee el "para qué" en una pantalla de Linkvia y acepta o no; hasta que acepte, no te puede escribir y vos no le podés escribir (`POST /bot/v0/messages` responde 400). En los eventos que traen `user.sharedData` (mensajes, `consent`, `start`, `handback`, `reaction`, `notice`, `buttonTap`) te llega además `user.consents.sensitive: { type, acceptedAt }`. Si cambiás el tipo o el texto, se le vuelve a pedir (y, si el negocio tiene dueño, cambiarlo pide su sesión, como el webhook). El usuario puede borrar sus datos con tu agente desde la info del contacto (ver `dataDeletion`, en la sección 2), y vos tenés que borrarlos de tus sistemas. Pedí lo mínimo; nunca el origen étnico ni datos de la vida sexual.

Al registrarlo, el responsable del negocio acepta los [Términos para negocios](https://www.linkvia.com.ar/terminos-negocios), las [Reglas de contenido](https://www.linkvia.com.ar/reglas-de-contenido) y la [Política de privacidad](https://www.linkvia.com.ar/privacidad): mandá `"acceptTerms": true` en `POST /businesses`. Si no lo mandás, el alta igual funciona, pero el panel va a pedir aceptarlos la primera vez que se entre (o se aceptan con `POST /business/terms`, con la clave de API o la sesión del dueño). La respuesta de `GET /business` dice si están aceptados en `termsAccepted`.

## 2. Recibir eventos

Linkvia hace `POST` al webhook con un JSON y espera la respuesta en menos de 10 segundos.

**Mensaje del usuario** (`type: "message"`): trae el texto, un id de usuario seudónimo (distinto para cada negocio) y en `user.sharedData` solo los datos que el usuario aceptó compartir: `name`, `phone`, `email` y `address`. El historial de pedidos (`orderHistory`) todavía no se completa. Si el usuario respondió citando un mensaje anterior, `message.replyTo` trae ese mensaje: `{ id, from: "user" | "bot", text }`. Los mensajes que no son texto (catálogo, pedido de datos) llegan resumidos en `text`.

**Agentes privados:** si el negocio hizo privado a su agente (panel → **Acceso**), cada evento trae además `user.membership` con cómo entró esa persona: `{ via: "link", link: "Socios 2026" }` (el nombre interno del link de invitación) o `{ via: "list", link: "Padrón", reference: "Socio 1234" }` (la referencia que el negocio cargó para ese celular en su lista; la persona la vio antes de tocar Unirme). No viene en agentes públicos ni para quienes ya tenían el agente cuando pasó a privado. Nunca trae el teléfono.

**Invitados del widget:** salvo que el negocio apague "Chatear sin cuenta" (panel → **Compartir**, o `PATCH /business` con `{"guestChat": false}`; viene prendido), quien escribe desde el widget de su web sin entrar con el celular llega con `user.guest: true` y `sharedData` vacío. No puede compartir datos, mandar fotos, videos, audios, archivos ni ubicación, ni aceptar avisos: si le mandás `requestConsent` o `notice`, le aparece que entre con su celular y a vos no te llega respuesta. Si entra con su celular, la charla sigue con el mismo `conversation.id`, pero `user.id` pasa a ser el seudónimo de su cuenta (sin `guest`): guardá el estado por `conversation.id`. Un invitado que no vuelve en 90 días se borra con su charla. Los agentes privados nunca tienen invitados.

**Registro de accesos:** por la Ley 25.326, Linkvia anota (solo para su equipo) cuándo alguien que no es el usuario ve sus datos personales: el bot cuando recibe el nombre o el teléfono compartidos (una vez por día por usuario y dato), el negocio o el bot cuando baja un archivo que mandó el usuario, y el panel cuando una persona de Atención ve la bandeja o una charla. No cambia nada de lo que recibe o manda el bot.

**Fotos:** si el usuario manda una foto, `message.image` trae `{ url, mimeType, width, height }` y `text` es el comentario que escribió con la foto (o `📷 Foto` si no escribió nada). La foto se descarga con un `GET` a `url`, sin clave: el link está firmado y vence a las 48 horas, así que funciona como un link privado y no conviene publicarlo. Para bajarla más tarde, pedí un link nuevo con el historial (abajo) o mandá tu clave de API en `Authorization: Bearer` al hacer el `GET` a la misma dirección sin `?exp=…&sig=…`; un usuario o un negocio que no son de esa charla reciben 404. Un link vencido o un pedido sin firma ni clave responde 401: es la señal para pedir uno nuevo. Por eso no guardes la `url` para usarla días después: guardá el archivo o pedí el link cuando lo necesites. Llega en JPG (a veces PNG, WebP o GIF) y pesa como mucho 2 MB. Un bot que solo lee `text` sigue funcionando.

**Archivos vencidos:** en el plan Free, las fotos, videos, audios y archivos de las charlas se borran a los 90 días, y antes si el negocio pasa de 1 GB (primero los más viejos). En Pro y Enterprise se guardan. El mensaje queda: el usuario y Atención ven "Archivo vencido" en su lugar, el historial lo sigue trayendo con su `url`, y el `GET` a esa `url` (o a `GET /wa/v21.0/{id}`) responde 404. Si tu bot necesita un archivo por más tiempo, bajalo y guardalo apenas llega.

**Archivos:** si el usuario manda un archivo, `message.document` trae `{ url, mimeType, filename }` y `text` es el comentario que escribió (o `📄 nombre.pdf` si no escribió nada). Puede ser PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), PowerPoint (`.ppt`, `.pptx`), OpenOffice (`.odt`, `.ods`) o texto (`.txt`, `.csv`), de hasta 3 MB. Se descarga igual que las fotos, con un `GET` a `url`.

**Reenviados:** si el usuario reenvía un mensaje de otro chat (por ejemplo, la dirección que le pasó otro negocio), llega con `message.forwarded: true`. El contenido viene igual que un mensaje común. Si reenvía un PDF que le mandó otro negocio, `message.document` trae `{ url, mimeType, filename }` y `text` es `📄 nombre.pdf`. Un archivo reenviado es una copia para este chat: llega con otro id y otra `url`.

**Ubicación:** si el usuario comparte dónde está (por ejemplo, para el delivery), `message.location` trae `{ latitude, longitude }` y `text` viene `📍 Ubicación`.

**Mensajes de voz:** si el usuario manda un audio, `message.audio` trae `{ url, mimeType, durationMs }` y `text` viene `🎤 Mensaje de voz`. Se descarga igual que las fotos. Suele llegar en `audio/webm` (Opus) desde Chrome y Android, o en `audio/mp4` desde iPhone y Safari; dura como mucho 5 minutos. `durationMs` puede venir en 0 si no se conoce (un audio de otro agente que el usuario reenvió). Si tu bot no transcribe audio, conviene que le pida al usuario que lo escriba.

**Videos:** si el usuario manda un video, `message.video` trae `{ url, mimeType, width, height, durationMs }` y `text` es su comentario, o `🎥 Video` si no escribió nada. Es MP4, WebM o MOV (`video/quicktime`, lo que graba el iPhone), de hasta 16 MB y 10 minutos. `width`, `height` y `durationMs` pueden venir en 0 si no se conocen (por ejemplo, un video de otro agente que el usuario reenvió). Se descarga igual que las fotos.

**Respuesta a un pedido de datos** (`type: "consent"`): llega apenas el usuario toca **Compartir** o **No compartir**, sin esperar a que vuelva a escribir. Trae la conversación, el usuario con su `sharedData` ya actualizado y `consent: { granted, declined, purpose }`. También llega cuando el usuario deja de compartir un dato desde "Mis datos": en ese caso `granted` y `declined` vienen vacíos y `revoked` trae los tipos de dato que ya no comparte. Si guardaste ese dato, dejá de usarlo. Cuando el usuario borra su cuenta de Linkvia llega igual, con todo lo que compartía en `revoked` y `sharedData` vacío; después de eso la charla deja de existir y lo que respondas no se muestra. Borrá lo que tengas guardado de ese usuario. Lo que respondas se muestra en el chat. Es de mejor esfuerzo: si tu bot falla o no lo conoce, Linkvia no se lo muestra al usuario ni lo cuenta como falla, así que un bot que no lo usa puede responder `actions: []`.

**Reacción** (`type: "reaction"`): llega cuando el usuario reacciona con un emoji a un mensaje, tuyo o suyo, como en WhatsApp. Trae la conversación, el usuario y `reaction: { messageId, emoji }`. Si sacó la reacción, `emoji` viene vacío. Un 👍 a tu "¿Te confirmo el pedido?" puede servir como un sí. Es de mejor esfuerzo, como `consent`: lo que respondas se muestra en el chat, y si tu bot falla o no lo conoce, no pasa nada.

**Empezar y links de campaña** (`type: "start"`): llega cuando el usuario abre el chat con un link de campaña (`/@tu-negocio?start=qr-mesa5`) o toca **Empezar** en el chat vacío, como el `/start` de Telegram. Trae la conversación, el usuario y `start: { payload, firstTime }`: `payload` es lo que vino en `?start=` (letras, números, `-` y `_`, hasta 64; vacío si tocó Empezar) y `firstTime` dice si el usuario no tenía al negocio en sus chats. Sirve para saludar solo y distinto según de dónde vino ("¡Bienvenido a la mesa 5!"). Lo que respondas se muestra en el chat. **Llega solo si lo activás** en el panel ("Que mi bot salude solo") o con `PATCH /business` `{"startEvent": true}`; mientras tanto, el chat vacío no muestra el botón Empezar. Es de mejor esfuerzo, como `consent`: si tu bot falla, no cuenta como caída (queda en el registro de entregas). Los links de campaña se cuentan aunque no lo actives: `GET /business/campaigns` y el panel dicen cuántas personas abrieron el chat con cada uno.

**Devuelta al bot** (`type: "handback"`): llega cuando una persona del negocio atendió la charla desde el panel (**Atención**) y se la devuelve al bot. Trae la conversación, el usuario y `handback: { agentName, since }`. Mientras atendía la persona, los mensajes del usuario no le llegaron al bot: para ponerse al día, leé el historial (lo que escribió la persona viene con `agentName`). Lo que respondas se muestra en el chat. **Llega solo si lo activás** en el panel ("Avisarle a mi bot cuando le devuelvo una charla") o con `PATCH /business` `{"handbackEvent": true}`. Es de mejor esfuerzo, como `start`.

**Lo que el usuario hace con la charla** (`contact`, `cleared` y `streamStopped`, como el `my_chat_member` de Telegram). **Llegan solo si los activás** en el panel ("Avisarle lo que el cliente hace con la charla") o con `PATCH /business` `{"chatEvents": true}`. Traen solo `user: { id }` (el seudónimo, sin datos personales) y son de mejor esfuerzo: lo que respondas **no** se muestra y, si tu bot falla, no cuenta como caída.

- `contact`: `contact: { status }` con `added` (te agregó a sus chats), `removed` (te sacó), `blocked` (te bloqueó: tus mensajes ya no le llegan) o `unblocked`. Trae `conversation` si ya habían hablado. Con `removed` o `blocked`, dejá de escribirle.
- `cleared`: vació el chat. Si tu agente guarda memoria de la charla, borrala: el usuario ya no ve esos mensajes.
- `streamStopped`: tocó **Detener** en una respuesta que escribías de a partes. Trae `stream: { messageId, text }` con el texto con el que quedó. Cortá el modelo para no gastar. Aunque no lo actives, lo que sigas mandando a ese `messageId` se descarta sin error y `POST /bot/v0/stream/<messageId>` devuelve `stopped: true`.

**Llegó y leído** (`type: "status"`, como los `statuses` de WhatsApp): los tildes, pero para tu bot. Trae `status: { messageIds, status, at }`: `delivered` cuando la app del usuario trajo tus mensajes, `read` cuando abrió la charla y los vio. `messageIds` son los ids que te devolvió `POST /bot/v0/messages` (o los del historial), del más viejo al más nuevo. **Llega solo si lo activás** en el panel ("Avisarle cuando sus mensajes llegan y se leen") o con `PATCH /business` `{"statusEvents": true}`. Trae solo `user: { id }`, lo que respondas no se muestra, y si tu bot falla no cuenta como caída. Sirve para no insistir con un recordatorio que ya se leyó, o para saber que un pedido de datos no llegó todavía. Al activarlo, el primer `delivered` de cada charla arranca desde lo último que el usuario había leído, no desde el principio de la charla.

**Respuesta a un aviso** (`type: "notice"`): llega cuando el usuario acepta, rechaza o cancela un aviso que le ofreciste. Está explicado en "Avisos con permiso", abajo.

En todos los eventos que traen `user.sharedData`, `user.adsOptOut: true` dice que la persona pidió no ver publicidad de tu agente (ver "Publicidad marcada", en la sección 4).

**El usuario borró sus datos** (`type: "dataDeletion"`): tocó **Borrar mis datos con este agente** en la info del contacto. Linkvia borró la charla entera (mensajes, archivos, avisos con permiso) y dejó de compartirte los datos de su perfil; si tu agente pide datos sensibles, tiene que volver a aceptar para escribirte. Trae `user: { id }` (el seudónimo) y `conversations` (las charlas borradas, la de la app y la del widget si la hubo: esos ids no vuelven a usarse). **Borrá lo que guardaste de ese `user.id`**: es su derecho de supresión (Ley 25.326). No te llega un `consent` con `revoked` por cada dato: este evento lo reemplaza. Llega siempre, sin activarlo, de mejor esfuerzo y una sola vez por borrado: lo que respondas no se muestra, si tu bot falla no cuenta como caída, y queda anotado en `GET /business/deliveries` (si tu bot estaba caído, revisá ahí qué te perdiste). El chat sigue en su lista, vacío.

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

**En Python o en n8n** hay SDK y nodos listos, sin dependencias: [sdks/python](../sdks/python) (`LinkviaBot`: verifica la firma, contesta, `send`, `edit`, `typing`, `stream`…) y [sdks/n8n](../sdks/n8n) (un trigger que verifica la firma y un nodo para escribir; en prueba). Cómo instalarlos, en el README de cada uno. Todavía no están en PyPI ni en npm.

## 3. Responder

La respuesta es `{"contractVersion":"0","actions":[...]}`:

| Acción | Ejemplo |
| --- | --- |
| `text` | `{"type":"text","text":"¡Hola!"}` |
| `catalog` | `{"type":"catalog","items":[{"id":"muzza","title":"Muzzarella","priceCents":1200000,"currency":"ARS"}]}` |
| `requestConsent` | `{"type":"requestConsent","dataTypes":["phone"],"purpose":"Avisarte cuando sale tu pedido"}` |
| `handoff` | `{"type":"handoff","reason":"Pidió hablar con una persona"}` |
| `notice` | `{"type":"notice","id":"pedido-1042","title":"Cuando salga tu pedido","text":"¿Te aviso cuando salga tu pedido?","days":1}` |
| `image` | `{"type":"image","url":"https://tu-bot.com/fotos/muzza.jpg","caption":"La muzza de hoy"}` |
| `document` | `{"type":"document","url":"https://tu-bot.com/tickets/1042.pdf","filename":"ticket-1042.pdf"}` |
| `audio` | `{"type":"audio","url":"https://tu-bot.com/voz/respuesta.ogg","durationMs":4200}` |
| `video` | `{"type":"video","url":"https://tu-bot.com/videos/horno.mp4","caption":"Así sale del horno"}` |
| `location` | `{"type":"location","latitude":-34.5889,"longitude":-58.4306,"name":"Pizzería Don Luis","address":"Gurruchaga 1234"}` |
| `location` en tiempo real | `{"type":"location","latitude":-34.5889,"longitude":-58.4306,"name":"Tu repartidor","live":30}` |
| `buttons` | `{"type":"buttons","text":"¿Delivery o retiro?","buttons":[{"id":"delivery","title":"Delivery"},{"id":"retiro","title":"Retiro"}]}` |
| `list` | `{"type":"list","text":"Elegí tu pizza","button":"Ver el menú","sections":[{"title":"Pizzas","rows":[{"id":"napo","title":"Napolitana","description":"$14.000"}]}]}` |
| `link` | `{"type":"link","text":"Tu pedido está en camino","label":"Seguir mi pedido","url":"https://tu-bot.com/pedidos/1042"}` |
| `copyCode` | `{"type":"copyCode","text":"Tu cupón de descuento:","code":"PIZZA10"}` |
| `requestLocation` | `{"type":"requestLocation","text":"Mandame tu ubicación y te digo si llegamos"}` |
| `carousel` | `{"type":"carousel","text":"Promos","cards":[{"title":"Napolitana","description":"$14.000","imageUrl":"https://tu-bot.com/fotos/napo.jpg","buttons":[{"id":"napo","title":"Pedir"}]}]}` |

**Formato del texto:** como en WhatsApp, `*negrita*`, `_cursiva_`, `~tachado~` y ```` ```monoespaciado``` ```` (puede ocupar varias líneas); se pueden combinar, como `*_así_*`. Vale en `text`, en los `caption` y en el texto de botones, listas y tarjetas. Un mensaje de 1 a 3 emojis solos se ve grande.

También se entiende el Markdown que escriben los modelos de IA, así no hace falta convertirlo: `**negrita**`, `~~tachado~~`, `` `código` ``, títulos con `#`, listas con `-` o `1.` (con un segundo nivel usando sangría), citas con `>`, bloques de código entre ```` ``` ```` en su línea, líneas `---` y tablas simples (`| a | b |` con la línea `|---|---|` abajo del encabezado). Un `[texto](https://...)` se ve como link y muestra al lado el dominio real, para que el texto no pueda disfrazar el destino. Un `*` solo sigue siendo negrita, como en WhatsApp. No se aceptan HTML ni imágenes dentro del texto.

**Fotos, archivos, audios y videos:** `image` acepta JPG, PNG, WebP o GIF; `document` acepta PDF, Word, Excel, PowerPoint, OpenOffice, TXT y CSV (el tipo sale de la extensión de `filename` y se comprueba con el contenido: un `.xlsx` que no es un Excel no pasa); `audio` acepta OGG/Opus, MP3, M4A o WebM y se ve como un mensaje de voz (sirve para un agente que contesta hablando; `durationMs` es opcional, en milisegundos enteros y de hasta 15 minutos; si no viene, la app la lee del archivo). `video` acepta MP4, WebM o MOV de hasta 16 MB y se reproduce en la burbuja (el tamaño y la duración los saca la app del archivo). Los demás, de hasta 4 MB; `caption` es opcional en fotos, archivos y videos. Linkvia baja el archivo de `url` en el momento y lo guarda, así que el link tiene que ser `https`, público y responder en menos de 10 segundos (20 si es un video); después puede vencer. Linkvia mira los primeros bytes: si no se puede bajar o no tiene la forma del tipo que dice, el usuario ve un aviso en su lugar. Cuando el bot escribe por su cuenta (`POST /bot/v0/messages`), en cambio, la respuesta es un error 400 que dice qué pasó.

**Botones, listas y tarjetas**, como los mensajes interactivos de WhatsApp Business:

- `buttons` lleva de 1 a 3 botones de respuesta rápida. `list` abre una lista de hasta 10 opciones en total, agrupadas en `sections`; `button` es lo que dice el botón que la abre. `carousel` lleva de 1 a 10 tarjetas que se deslizan, cada una con `title`, y opcionalmente `description`, `imageUrl` (se baja como las fotos; si falla, la tarjeta va sin foto) y hasta 2 `buttons` o un `link`.
- `buttons`, `list` y `link` aceptan además `header` (título en negrita) y `footer` (nota gris). Los textos largos se recortan: 24 caracteres los botones y opciones, 72 la descripción de una opción, 60 el header y el footer, 1024 el texto.
- Cuando el usuario toca un botón o elige una opción, llega un mensaje común con `text` igual al título de la opción, `replyTo` con el mensaje de los botones y `message.choice: { id, title }` con el `id` que le pusiste. Conviene decidir por `choice.id` y no por el texto. Abrir la lista no manda nada.
- **Menú de atajos** (como los comandos de Telegram, pero sin `/`): el negocio carga de 1 a 10 atajos en el panel (**Tu bot → Menú de atajos**) o con `PUT /business/shortcuts`. En el chat aparece un botón al lado del campo de texto que los muestra con su descripción; tocar uno manda un mensaje común con `text` igual al título y `message.choice: { id, title, kind: "shortcut" }`, sin `replyTo`. Así el bot no aprende nada nuevo: si ya decide por `choice.id`, conviene usar los mismos ids que en sus botones (por ejemplo `menu` o `humano`). Con el formato de WhatsApp llega como `button_reply`.
- `link` abre `url` (https) en el navegador y `copyCode` copia `code` (hasta 64 caracteres). Ninguno de los dos le avisa al bot.
- `requestLocation` muestra el texto (hasta 1024 caracteres) con el botón **Mandar mi ubicación**, como el `location_request_message` de WhatsApp. Si la persona lo toca y el navegador le da permiso, te llega un mensaje con `message.location: { latitude, longitude }` y `replyTo` con el pedido. Si no quiere, puede escribir la dirección: no la obligues. Un invitado del widget ve que tiene que entrar con su celular.
- **Links y estafas:** debajo de cada botón o tarjeta con link el usuario ve el dominio real (por ejemplo `mercadopago.com.ar`). Si tu negocio no está verificado, antes de abrir un link le avisamos a dónde lleva, y no se aceptan links acortados (bit.ly, tinyurl.com, t.co…) ni en botones ni en el texto: mandá el link completo. Si escribís por tu cuenta la respuesta es un error 400; en una respuesta al webhook, el usuario ve un aviso en lugar del mensaje. Y si un mensaje pide un código, un PIN, una clave o datos de la tarjeta, el usuario ve debajo "Linkvia nunca te pide tu código ni tu PIN en un chat" y el equipo de Linkvia lo revisa. Los links de todos los negocios se revisan además contra la lista de sitios peligrosos de Google (Web Risk): uno marcado como phishing o virus no llega, igual que un link acortado.
- Los `id` de las opciones de un mismo mensaje tienen que ser distintos (hasta 200 caracteres).
- **Cada botón acepta además** `style: "primary"` (verde) o `"danger"` (rojo), `disabled: true` (gris, no se puede tocar, como "Sin stock") y `silent: true`. Los botones de un mensaje `buttons` **se eligen una vez**: después de tocar uno se ven grises y otra elección devuelve error, para evitar el doble pedido. Si editás el mensaje, se pueden volver a elegir.
- **Botones que no escriben** (`silent: true`, como los `callback` de Telegram): tocarlo no escribe nada en el chat. Tu bot recibe el evento `buttonTap` con `buttonTap: { messageId, id, title }` y puede contestar `{"contractVersion":"0","actions":[],"toast":"Agregado ✓"}`: el `toast` (hasta 200 caracteres) se ve un momento abajo, y las `actions` se muestran en el chat. Lo normal es editar el mensaje del botón (por ejemplo, el carrito con la cantidad nueva). Si tu bot no contesta, el usuario ve "no respondió, probá de nuevo" (no cuenta como caída). Solo en el contrato de Linkvia.

`requestConsent` le muestra al usuario los datos que se van a compartir y los botones **Compartir** y **No compartir**. Si le falta cargar alguno (por ejemplo la dirección), lo completa ahí mismo y queda guardado en su perfil. Si acepta, el bot recibe enseguida un evento `consent` y, desde ese momento, los datos llegan en `user.sharedData` de cada mensaje.

## 4. Escribir después (handoff, avisos de pedido)

**Pasar a una persona:** con la acción `handoff` la charla aparece arriba en la bandeja **Atención** del panel, marcada "Pide una persona". Ahí alguien del negocio la toma, le contesta con su nombre (el usuario lo ve arriba de cada mensaje) y, al terminar, se la devuelve al bot. Mientras la atiende una persona, los mensajes del usuario no le llegan al bot (tampoco a la cola si el bot está caído); hasta que alguien la toma, le siguen llegando. Una persona también puede tomar cualquier charla aunque el bot no haya pedido el pase. La bandeja también se maneja por API: ver la tabla del panel, abajo.

Si el agente tarda, el bot puede escribir cuando quiera en una conversación existente:

```bash
curl -X POST https://app.linkvia.com.ar/api/bot/v0/messages \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","conversationId":"<conversation.id del evento>","actions":[{"type":"text","text":"Tu pedido salió"}]}'
```

Solo funciona en conversaciones del propio negocio, mientras el usuario lo tenga en su lista de contactos y no lo haya bloqueado. Si lo quitó o lo bloqueó, la respuesta es un error 400 y no se te dice cuál de las dos. En un agente privado, si sacaste a esa persona (de Miembros, de la lista o al revocar su link), la respuesta también es 400: "El usuario ya no es miembro de este agente privado".

**Tope a lo que mandás sin que te escriban:** mientras el usuario te haya escrito en las últimas 24 horas no hay tope. Si no (una promo, un recordatorio), por chat podés mandar hasta 5 mensajes por día (cada acción cuenta como un mensaje, y empezar una respuesta de a partes cuenta como uno). Pasado el tope la respuesta es un error 429 y no se manda nada del envío; el día se cuenta en hora UTC. Apenas el usuario te escribe, el tope deja de correr. Contestar tarde algo que el usuario hizo tampoco cuenta: durante 24 horas después de que toca Empezar (`start`), reacciona (`reaction`), contesta un pedido de datos (`consent`), la persona del panel te devuelve la charla (`handback`) o te llega un mensaje que esperaba en la cola (`redelivered`), podés escribirle sin tope. Un envío que se rechaza por otra cosa (por ejemplo, una foto que no se pudo bajar) igual cuenta para el tope.

**Editar y borrar tus mensajes** (como en Telegram; la API de WhatsApp no lo permite). `POST /bot/v0/messages` devuelve los mensajes con su `id` (también están en el historial). Con ese id, durante 48 horas:

```bash
# Editar: una acción de texto, botones, lista, link o código (o una location en tiempo real, ver abajo). El usuario ve "Editado" y no le llega aviso.
curl -X PATCH https://app.linkvia.com.ar/api/bot/v0/messages/<id> \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","action":{"type":"text","text":"Tu pedido salió 🛵"}}'

# Borrar: queda "Se eliminó este mensaje", sin el contenido.
curl -X DELETE https://app.linkvia.com.ar/api/bot/v0/messages/<id> -H "authorization: Bearer $LINKVIA_API_KEY"
```

Sirve para un pedido que cambia de estado en la misma burbuja o un carrito con + y −. Las fotos, archivos, carruseles y respuestas de a partes que se están escribiendo no se editan. Con el SDK: `bot.edit(id, action)` y `bot.delete(id)`.

**Ubicación en tiempo real (el repartidor en camino).** Mandá una `location` con `live`: los minutos que dura, de 1 a 480. El usuario ve un punto azul que late y "Ubicación en tiempo real hasta las 14:30". Para moverla necesitás su id: mandala con `POST /bot/v0/messages`, que lo devuelve (con el SDK, `const [rider] = await bot.send(...)`), o buscala en el historial si fue en la respuesta del webhook. Editá ese mensaje con otra `location` (con el mismo `PATCH`): cambia el punto sin que se vea "Editado" y sin aviso nuevo. `name` y `address` que no mandes quedan los de antes; si los cambiás, sí se ve "Editado". Se revisan los links y los pedidos de códigos igual que en un mensaje nuevo. Como mucho una vez cada 5 segundos (si no, 429); cada 10 a 30 segundos alcanza. Con `"live": 0` la terminás (por ejemplo, al entregar) y con otro número la dejás en esos minutos desde ahora, hasta 8 horas desde que la mandaste. Al mandarla, `live: 0` es un error. Cuando vence, se ve "Terminó la ubicación en tiempo real" con el último punto, y ya no se mueve. Si alguien la reenvía, sale fija. La API de WhatsApp no la tiene: es solo del contrato de Linkvia.

```bash
curl -X PATCH https://app.linkvia.com.ar/api/bot/v0/messages/<id> \
  -H "authorization: Bearer $LINKVIA_API_KEY" -H 'content-type: application/json' \
  -d '{"contractVersion":"0","action":{"type":"location","latitude":-34.5901,"longitude":-58.4290,"name":"Tu repartidor"}}'
```

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

**Historial:** para que el agente tenga el contexto sin guardarlo, `GET /bot/v0/conversations/<conversation.id>/messages?limit=50` (con la clave de API) devuelve los últimos mensajes de la charla: `{ id, from, sentAt, type, text, url?, replyTo?, agentName? }`. `agentName` viene en lo que escribió una persona del negocio desde el panel. `text` es el texto completo o un resumen ("📷 Foto") si no es texto; `url` es dónde bajar la foto, el video, el audio o el archivo (un link nuevo, firmado, que dura 48 horas).

**Reintentos:** si la entrega de un mensaje falla rápido (el bot no está, responde 5xx), Linkvia la reintenta una vez al segundo con el mismo `eventId`: si tu bot ya lo había procesado, ignoralo. Si el bot tardó más de 10 segundos no se reintenta, para no hacer esperar más al usuario. Cada intento queda en `GET /business/deliveries` y en el panel.

**Bot caído:** si el reintento también falla, el mensaje no se pierde: queda en una cola y el usuario ve "no está respondiendo ahora. Tu mensaje le va a llegar apenas vuelva" (una vez por caída). Los mensajes que siga mandando a esa charla van detrás. Cuando el bot vuelve a responder (el monitoreo lo prueba cada 5 minutos, o el usuario escribe de nuevo), Linkvia le entrega la cola en orden, con el mismo `eventId` del primer intento y `redelivered: true`; `message.sentAt` dice cuándo lo escribió el usuario, para que el bot no conteste "buen día" a la noche. Lo que el bot responda llega al chat y al celular. Lo que espera más de 24 horas se descarta y queda en el registro de entregas. Si el bot tardó más de 10 segundos no se encola: puede que lo haya recibido. `GET /business/health` devuelve en `pendingEvents` cuántos mensajes esperan.

### Avisos con permiso

Para escribirle a alguien que no te escribió hay un tope (arriba). La excepción son los **avisos que el usuario pidió**: "¿Te aviso cuando salga tu pedido?", "¿Te aviso cuando haya turnos?". Es como el permiso de notificaciones de una app, pero por aviso y por charla, y el usuario lo da con un toque.

1. **Ofrecelo** con la acción `notice`, en una respuesta o por `POST /bot/v0/messages`: `{"type":"notice","id":"pedido-1042","title":"Cuando salga tu pedido","text":"¿Te aviso cuando salga tu pedido?","days":1}`. `id` identifica el aviso en esa charla (letras, números, `-`, `_` y `.`, hasta 64; podés repetir el mismo `id` en varias charlas); `title` es lo que el usuario ve en la burbuja y en la info del contacto (hasta 80 caracteres); `text` es el mensaje (si no viene, va el título); `days` cuántos días vale el permiso (de 1 a 90; si no viene, 30). El usuario ve el mensaje con los botones **Avisame** y **No, gracias**.
2. **Te llega el evento `notice`** apenas toca, con `notice: { id, title, status, expiresAt? }`: `accepted` (y `expiresAt` dice hasta cuándo), `declined` o, más tarde, `cancelled` si lo canceló desde la info del contacto. Lo que respondas se muestra en el chat ("Listo, te aviso cuando salga 🛵"). Es de mejor esfuerzo, como `consent`.
3. **Mandá el aviso** con `notice` en `POST /bot/v0/messages`: `{"contractVersion":"0","conversationId":"…","notice":"pedido-1042","actions":[{"type":"text","text":"Tu pedido salió 🛵"}]}`. No cuenta para el tope y el usuario ve el mensaje marcado con el nombre del aviso. Con el SDK: `bot.send(conversationId, "Tu pedido salió 🛵", { notice: "pedido-1042" })`.

Si el usuario no lo aceptó, lo rechazó, lo canceló o venció, la respuesta es un error 400 que dice cuál de las cuatro, y no se manda nada. Un aviso aceptado vale hasta que vence o el usuario lo cancela; podés volver a ofrecer el mismo `id` cuando quieras (si lo acepta de nuevo, el plazo empieza de cero; si ya lo tenía aceptado y toca "No, gracias", el permiso que tenía sigue y no te llega ningún evento). Cuando el usuario cancela, te llega `notice` con `cancelled`: dejá de mandar ese aviso. Un aviso es un permiso para ese tema, no para promos: mandá por `notice` lo que el usuario pidió. Si el usuario te saca de sus chats o te bloquea, los avisos se pierden con la charla.

### Publicidad marcada

Un agente puede ser gratis para el usuario y cobrarle a otro negocio por mostrar su publicidad (las ofertas del súper en un agente de lista de compras). Para que no sea spam y por la ley de defensa del consumidor, **la publicidad tiene que verse como tal**:

- Cualquier acción puede llevar `"sponsored": { "by": "Súper El Barrio" }` (el anunciante, hasta 60 caracteres). La app la muestra con la etiqueta **Publicidad · Súper El Barrio** arriba del mensaje, en gris, como en las redes.
- **Tope: 1 mensaje de publicidad por persona, por agente y por semana.** Si te pasás, `POST /bot/v0/messages` responde 429 (y no cuenta para el tope diario); si vino en la respuesta a un evento, esa acción se descarta sin aviso al usuario y queda contada en Estadísticas del panel ("Publicidad descartada por el tope"). Dentro de una misma respuesta sale solo la primera. Cuentan las charlas de la app y del widget con esa persona, y también una publicidad que después borraste. Una edición (`PATCH /bot/v0/messages/:id`) no lleva `sponsored`: la marca queda la del mensaje original.
- **El usuario puede ocultarla:** en la info del contacto tiene "Ocultar publicidad de este agente". Te llega `user.adsOptOut: true` en los eventos, `POST /bot/v0/messages` con `sponsored` responde 400, y en una respuesta la acción se descarta.
- Mandar publicidad sin `sponsored` va contra las [Reglas de contenido](https://www.linkvia.com.ar/reglas-de-contenido) y el usuario puede reportarte. El panel muestra cuántos mensajes de publicidad salieron en el período.

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
| `PATCH /business` | Cambia nombre, nombre del agente (`agentDisplayName`, el que ve el cliente en la charla), descripción, webhook o email de alertas. Si el negocio tiene dueño, cambiar el webhook pide la sesión del dueño (con la clave sola: 403) |
| `PUT /business/shortcuts` | Reemplaza el menú de atajos del agente: `{"shortcuts":[{"id":"menu","title":"Ver la carta","description":"Pizzas y empanadas"}]}`. De 0 a 10; `title` hasta 24 caracteres (es lo que se manda), `description` hasta 72 y `id` hasta 64 (letras, números, `-`, `_` o `.`; si no viene, se arma con el título). Una lista vacía saca el botón del chat. El menú se ve fijo, sin el aviso anti-estafas de los mensajes, así que un atajo no puede llevar links, pedir códigos, claves o datos de la tarjeta, ni tener caracteres que no se ven (responde `400`). En un agente privado, el menú lo ven solo los miembros |
| `POST /business/test-connection` | Manda un `ping` firmado y devuelve si el bot respondió y en cuánto |
| `GET /business/incidents` | Últimas caídas del bot, la más reciente primero |
| `GET /business/usage` | Conversaciones y personas activas (`activePeople`) de este mes y del anterior, el tipo de agente (`kind`), el plan (`free`, `pro` o `enterprise`) con sus topes, el espacio que ocupan los archivos y quiénes atienden ahora en Atención. Ver "Planes y topes", abajo |
| `GET /business/stats?days=30` (o `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`, hasta 90 días) | Estadísticas del período, solo números: mensajes por día y por hora, tiempo de respuesta del bot, charlas atendidas por una persona, personas nuevas y que vuelven, y errores del webhook por día y por motivo. Con menos de 3 personas no van el reparto ni las horas. 120 consultas por hora |
| `GET /business/health` | Últimos éxitos y fallas del bot |
| `POST /business/rotate-api-key` | Cambia la clave de API y devuelve la nueva (una sola vez). La anterior deja de servir en el momento. Si el negocio tiene dueño, pide la sesión del dueño (con la clave sola: 403) |
| `POST /business/rotate-webhook-secret` | Cambia el secreto del webhook y devuelve el nuevo. Los eventos siguientes se firman con él. Si el negocio tiene dueño, pide la sesión del dueño (con la clave sola: 403) |
| `GET /business/changes` | Últimos cambios sensibles (nombre, webhook, claves, dueño, ingresos al panel, baja): qué, quién (`owner` con su mail, `api_key` o `linkvia`), desde qué IP y cuándo. Con la clave sola no vienen la IP ni los mails del dueño: solo con la sesión del dueño |
| `GET /business/deliveries` | Últimas entregas al webhook: evento, si respondió, cuánto tardó y el error |
| `GET /business/conversations` | La bandeja de atención: las charlas con su último mensaje, primero las que pidieron una persona |
| `GET /business/conversations/<id>` | Una charla con todos sus mensajes (la marca como leída en el panel) |
| `POST /business/conversations/<id>/take` | Una persona toma la charla: `{"agentName":"Laura"}`. El bot deja de recibir los mensajes |
| `POST /business/conversations/<id>/messages` | Contesta como persona: `{"agentName","text"}`, o con `image` o `document`. Si no la había tomado, la toma |
| `POST /business/conversations/<id>/release` | Se la devuelve al bot (con `handbackEvent`, el bot recibe `handback`) |
| `GET /business/events` | Avisos en el momento de qué charla cambió (Server-Sent Events), para la bandeja |
| `GET`, `POST /business/team`, `PATCH` y `DELETE /business/team/<id>` | El equipo del negocio, solo con la sesión del dueño: `{"email","name","role":"empleado"|"gestor","canSeeChats"}`. Un empleado entra con su mail y solo ve Atención; un gestor administra el agente (perfil, bot, estadísticas) sin tocar claves, webhook ni equipo, y ve los chats solo con `canSeeChats: true` (`PATCH` lo cambia) |
| `GET /business/agents` | "Mis agentes": todos los agentes que abre el mail de la sesión (los suyos, los que administra como gestor y los equipos en que está), con `role`, si el bot responde, el plan, el tipo y el uso del mes, más cuántos administra (`managed`) y la cuota del gestor (`feeUsd`: hasta 5, 0; de 6 a 25, 15; más de 25, 39; todavía no se cobra). Solo con la sesión del mail (con la clave: 403) |
| `POST /business/agents/<handle>/session` | Abre una sesión del panel de otro de mis agentes sin volver a entrar: devuelve `{ handle, role, token }`. Queda en el registro de cambios como un ingreso |
| `POST /business/agents` | Crea un agente desde mi plantilla: `{"handle","name","cuit","acceptTerms":true}`. Copia el bot (webhook, formato, eventos, atajos), el tipo y el perfil del negocio de la sesión; el dueño del nuevo es el mail de la sesión y tiene su propia clave y secreto (se devuelven una sola vez). Con la clave de API: 403 |
| `POST /business/owner` | Agrega o cambia el mail del dueño: `{"email","code"}` con el código que le llegó a ese mail. Las sesiones abiertas con el mail anterior dejan de servir |
| `DELETE /business/session` | Cierra la sesión del panel abierta con el mail |
| `POST /business/delete` | Da de baja el negocio: `{"handle":"pizzeria"}` para confirmar. Solo con la sesión del dueño (con la clave: 403). Ver "Dar de baja", abajo |
| `POST /business/undelete` | Deshace la baja, dentro de los 30 días. Solo con la sesión del dueño |
| `POST /business/verification` | Pide la tilde de verificado. Hace falta el mail del dueño: por ahí te escribimos |
| `PUT /business/access` | Quién puede chatear con el agente (panel → **Acceso**): `{"visibility":"public"}`, `"link"` o `"list"`. Al pasar a privado, los que ya lo tenían quedan como miembros (con `keepCurrent: false`, solo para leer). Con dueño, pide su sesión (con la clave sola: 403) |
| `GET` y `POST /business/invitations` | Los links de invitación de un agente privado; para crear uno: `{"name","expiresAt","maxUses"}` (los dos últimos, opcionales). El link es `https://app.linkvia.com.ar/@tu_handle?invitacion=<code>`. Con dueño, crear pide su sesión y con la clave sola la lista viene sin `code` |
| `POST /business/invitations/<id>/revoke` | Revoca un link; con `{"removeMembers":true}` saca también a los que entraron por él |
| `POST /business/invitations/<id>/regenerate` | Le cambia el código a un link: el anterior deja de servir. Con dueño, pide su sesión |
| `GET /business/members` | Los miembros del agente privado. `DELETE /business/members/<id>` saca a uno |
| `GET` y `POST /business/member-list` | La lista de celulares del modo "privado con lista": `{"entries":[{"phone","reference"}],"authorized":true}` o `{"csv","authorized":true}`. Linkvia guarda solo un hash del número y lo muestra enmascarado. Con dueño, cargar pide su sesión. `DELETE /business/member-list/<id>` saca uno |

**Entrar con el mail del dueño** (sin clave): `POST /business/owner/code` con `{"email","purpose":"ingresar"}` manda un código de 6 números al mail (solo si es dueño de algún negocio; la respuesta es igual en los dos casos). Después, `POST /business/login` con `{"email","code"}` devuelve `{ businesses: [{ handle, name, token }] }`: un token de sesión por cada negocio de ese mail, que dura 30 días. Para el alta o para agregar el dueño, el código se pide con `"purpose":"verificar"` y se manda en `POST /businesses` (`ownerEmail`, `ownerCode`) o en `POST /business/owner`. Cuando cambian la clave de API, el secreto o el webhook, Linkvia le avisa al dueño por mail. Cada vez que alguien entra al panel con el mail del dueño, también le llega un aviso ("Entraron al panel de tu negocio en Linkvia") con la IP desde donde entró.

**Lo que pide al dueño:** si el negocio tiene mail del dueño, cambiar la clave de API (`rotate-api-key`), el secreto del webhook (`rotate-webhook-secret`) o la URL del webhook (`PATCH /business` con `webhookUrl`), y lo que decide quién entra a un agente privado (`PUT /business/access`, crear o regenerar links de invitación, cargar la lista de celulares) solo se puede con la sesión del dueño (`lvp_…`). Con la clave de API sola, la respuesta es 403 ("Para cambiar la clave de API, entrá al panel con el mail del dueño: con la clave de API sola no se puede"). Así, quien consiga la clave no puede dejar afuera al dueño. Los negocios sin mail del dueño siguen pudiendo todo con la clave hasta que lo agregan, y mientras la API no pueda mandar mails también alcanza la clave (queda anotado en `GET /business/changes`). Con la clave sola, `GET /business/invitations` trae los links sin su código. El resto (perfil, Atención, estadísticas, ver y sacar miembros, revocar links) anda igual con la clave.

**Dar de baja:** `POST /business/delete` (solo con la sesión del dueño) saca al negocio de Linkvia en el momento: deja de aparecer, lo que le escriban no le llega al bot y la clave de API responde 401 ("Este negocio está dado de baja"), así que el bot tampoco puede escribir. A los 30 días se borran sus chats, archivos y contactos; hasta entonces, el dueño la deshace con `POST /business/undelete`. El @ queda reservado.

**La tilde de verificado** la da solo el equipo de Linkvia, después de revisar a mano la constancia de CUIT de ARCA, tu web o un mail de tu dominio, y un contacto. Un CUIT válido no alcanza (`verification: "light"`): solo `"strong"` muestra la tilde. Sin la tilde tu bot funciona igual, pero el usuario ve un aviso de negocio sin verificar y no aparecés en el directorio. Si un negocio verificado cambia el nombre, pierde la tilde hasta que lo revisemos de nuevo. Los nombres y @ de bancos, billeteras y organismos (por ejemplo `banco`, `mercadopago`, `uala`, `anses`) no se pueden usar sin verificación, y un nombre parecido al de un negocio verificado queda en revisión.

### Planes y topes

Cada negocio tiene un plan: Free (el de todos al empezar), Pro o Enterprise. Todavía no se cobra: el equipo de Linkvia cambia el plan a pedido. `GET /business/usage` dice cuál tiene y cuánto usó, y el panel avisa desde el 80 %.

| | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Conversaciones por mes | 300 | 2.000 | 20.000 |
| Espacio para archivos | 1 GB | 20 GB | 200 GB |
| Archivos de las charlas | Se borran a los 90 días (y los más viejos si pasa de 1 GB) | Se guardan | Se guardan |
| Personas atendiendo a la vez en Atención | 1 | 3 | Sin límite |
| Links de invitación activos | 1, sin vencimiento ni límite de usos | Los que quieras, con vencimiento y límite de usos | Igual que Pro |
| Modo "privado con lista" | No | Hasta 500 celulares | Hasta 50.000 celulares |

Lo que puede encontrarse quien programa contra la API:

- **Conversaciones:** pasar el tope no corta nada. El bot sigue recibiendo y mandando mensajes; el panel lo avisa.
- **Atención:** tomar o contestar una charla (`/take`, `/messages`) cuando ya atienden tantas personas como permite el plan responde 400 con quién está atendiendo. Devolvé alguna charla al bot (`/release`) o pasá a un plan con más personas.
- **Acceso:** en Free, un segundo link de invitación activo, un link con `expiresAt` o `maxUses`, o `PUT /business/access` con `"visibility":"list"` responden 400 con lo que hace falta.
- **Archivos:** en Free, la `url` de un archivo vencido responde 404 (ver "Archivos vencidos" en la sección 2).

**Agentes de creadores.** Un agente que la gente usa todos los días (practicar inglés, vencimientos, gastos) abre unas 30 conversaciones por persona al mes, y cobrarlo por conversación lo castiga. Por eso cada agente tiene un tipo: `kind: "business"` (por defecto, se mide por conversación) o `kind: "creator"` (se mide por **persona activa**: cada usuario distinto que le escribió al agente en el mes, hora de Argentina; lo que manda el bot por su cuenta no cuenta). Se elige en el alta (`POST /businesses`) o después con `PATCH /business`, una vez por mes calendario (si ya lo cambiaste este mes, 400). `GET /business/usage` trae `kind` y `activePeople` (`thisMonth`, `lastMonth`) siempre, sea cual sea el tipo. El plan Creador se publica en la web ("Para creadores"): 0,08 USD por persona activa al mes, mínimo 15 USD, con hasta 100 conversaciones por persona; usuarios nuevos y espacio como en Pro. Free es igual para los dos tipos. Por ahora solo se mide y se muestra: el cobro y los topes del plan Creador llegan con el cobro.

## 7. Link a tu chat

Como wa.me en WhatsApp, `https://app.linkvia.com.ar/@tu_handle` abre el chat con tu agente; si la persona no tenía tu negocio en sus chats, se agrega solo, y si no había entrado a Linkvia, entra primero. Con `?text=` el chat se abre con ese texto ya escrito, sin mandarlo: `https://app.linkvia.com.ar/@pizzeria?text=Quiero%20hacer%20un%20pedido`. Si ya había algo escrito, no se pisa. Se puede combinar con `?start=` (los links de campaña de la sección 2).

En el panel, en **Compartir**, está tu link con un botón para copiarlo, el código QR para imprimir y la línea del widget para tu web (ver [Widget para tu web](widget.md)). Si escribís un "mensaje que queda escrito", el link, el QR y el widget abren el chat con ese texto. Cuando se pega el link en WhatsApp, Instagram o Telegram, la vista previa puede mostrar el nombre y la descripción de tu negocio (en un agente privado, la genérica de Linkvia; depende de cómo esté configurado el servidor; sin eso el link anda igual).

En un agente privado, el link común no deja entrar a quien no es miembro: hace falta un link de invitación (`?invitacion=<code>`, panel → **Acceso**). La persona ve el agente, toca **Unirme** y recién ahí chatea.

## Probarlo con el bot de ejemplo

Los bots mínimos [bot.mjs](../ejemplos/node/bot.mjs) y [bot.py](../ejemplos/python/bot.py) verifican la firma y contestan con texto y botones. La guía [Conectá tu agente en 5 minutos](empezar-en-5-minutos.md) explica cómo levantarlos y probarlos.
