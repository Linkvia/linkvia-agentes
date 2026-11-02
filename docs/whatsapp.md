# Traer un bot hecho para WhatsApp

Un bot que ya funciona con la API de WhatsApp (la Cloud API de Meta) anda en Linkvia sin reescribirlo: Linkvia le manda los mensajes con el mismo JSON y la misma firma que Meta, y acepta las respuestas en el mismo `POST /messages`.

## Qué cambiar en el bot

1. Registrá el negocio en el [panel de negocios](https://negocios.linkvia.com.ar/) y en **Tu bot está hecho para** elegí **La API de WhatsApp**. Si ya estaba registrado, cambialo en el panel (o `PATCH /business` con `{"webhookFormat":"whatsapp"}`).
2. En el bot:

| En WhatsApp | En Linkvia |
| --- | --- |
| `https://graph.facebook.com/v21.0` | `https://app.linkvia.com.ar/api/wa/v21.0` (la versión puede ser cualquiera) |
| `phone_number_id` | el `@handle` del negocio, sin la arroba |
| Token de acceso | la clave de API (`lv_…`) |
| App secret (firma `X-Hub-Signature-256`) | el secreto del webhook (`whsec_…`) |
| Verify token del webhook | el secreto del webhook (`whsec_…`) |

3. Tocá **Probar conexión**: Linkvia hace la misma verificación que Meta (`GET` con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`) y espera que el bot devuelva el `hub.challenge`.

## Lo que llega al webhook

El mismo sobre que manda Meta: `object: "whatsapp_business_account"` → `entry[].changes[].value` con `messaging_product`, `metadata`, `contacts` y `messages`. El webhook solo tiene que contestar 200: las respuestas van después por `POST /messages`, como en WhatsApp.

- `wa_id` y `from` no son el teléfono del usuario: son el id de la conversación, distinto para cada negocio. Se usan igual, como `to` al contestar.
- `contacts[].profile.name` trae el nombre solo si el usuario aceptó compartirlo con el negocio; si no, viene vacío.
- Tipos: `text`, `image`, `audio` (`voice: true`), `document`, `location`, `interactive` (`button_reply` o `list_reply` cuando el usuario toca un botón o elige de una lista) y `reaction`. Las citas y los reenvíos van en `context`.
- Fotos, audios y archivos traen un `id`: con `GET /api/wa/v21.0/{id}` (y la clave de API) se pide su `url` y después se baja con un `GET` a esa `url`. La `url` está firmada y vence a las 48 horas (como la de WhatsApp, que vence a los 5 minutos): si venció, se pide de nuevo. También se baja mandando la clave de API en `Authorization: Bearer`, como hacen los bots de WhatsApp, aunque el link haya vencido. Sin clave, un link vencido responde 401.
- Lo que no tiene equivalente en WhatsApp no se manda, como la respuesta a un pedido de datos del contrato de Linkvia.

## Lo que el bot puede mandar

Con `POST /api/wa/v21.0/{handle}/messages`:

- `text`
- `image` y `document` con `link` (https público). Los archivos subidos por `id` todavía no.
- `location`
- `interactive` de tipo `button` (hasta 3 botones de respuesta), `list` y `cta_url` (botón con link). El encabezado solo puede ser de texto.
- `status: "read"` con `message_id` para marcar leído, y con `typing_indicator: {"type":"text"}` para mostrar "escribiendo…".

La respuesta es la misma que la de Meta: `{"messaging_product":"whatsapp","contacts":[...],"messages":[{"id":"wamid.…"}]}`. Los errores también: `{"error":{"message","type","code"}}`.

**Plantillas:** no hacen falta. En Linkvia la charla no se cierra a las 24 horas: el bot puede escribir cuando quiera en una conversación existente, mientras el usuario lo tenga en sus contactos. Si el usuario no le escribió en las últimas 24 horas, puede mandarle hasta 5 mensajes por día en ese chat; pasado el tope responde 429 con el código `131056`, el mismo que usa WhatsApp para el límite entre un negocio y un usuario. Si el negocio no está verificado, un mensaje con un link acortado (bit.ly, tinyurl.com…) responde 400: mandá el link completo (ver "Links y estafas" en [Conectar el bot de un negocio](conectar-un-bot.md#3-responder)). Un `type: "template"` devuelve un error que lo explica.

**Todavía no:** estados `sent/delivered/read` de los mensajes del bot por webhook, reacciones del bot, stickers, contactos y videos.

