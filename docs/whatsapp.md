# Traer un bot hecho para WhatsApp

Un bot que ya funciona con la API de WhatsApp (la Cloud API de Meta) anda en Linkvia sin reescribirlo: Linkvia le manda los mensajes con el mismo JSON y la misma firma que Meta, y acepta las respuestas en el mismo `POST /messages`.

## Qué cambiar en el bot

1. Registrá el negocio en el [panel de negocios](https://negocios.linkvia.com.ar/) y en **Tu bot está hecho para** elegí **La API de WhatsApp**. Si ya estaba registrado, cambialo en el panel (o `PATCH /business` con `{"webhookFormat":"whatsapp"}`).
2. En el bot:

| En WhatsApp | En Linkvia |
| --- | --- |
| `https://graph.facebook.com/v21.0` | `https://app.linkvia.com.ar/api/wa/v21.0` (la versión puede ser cualquiera) |
| `phone_number_id` | el `@handle` del negocio, sin la arroba |
| Token de acceso | la clave del bot (`lvb_…`, sirve solo para mandar y recibir mensajes: es la que conviene darle a una plataforma de afuera), la clave de API (`lv_…`) o la de tu cuenta de gestor (`lvg_…`) con el encabezado `linkvia-agent`; la sesión del panel no sirve (401, code 190) |
| App secret (firma `X-Hub-Signature-256`) | el secreto del webhook (`whsec_…`) |
| Verify token del webhook | el secreto del webhook (`whsec_…`) |

3. Tocá **Probar conexión**: Linkvia hace la misma verificación que Meta (`GET` con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`) y espera que el bot devuelva el `hub.challenge`. Con **Probar un ejemplo** le llega un mensaje de prueba con `wa_id` `simulador`: lo que tu bot conteste por `POST /messages` a ese `wa_id` (y el `status: "read"`) durante los 2 minutos siguientes (hasta 10 mensajes) sale bien, se ve en el panel y no va a ningún chat.

## Si tu agente vive en una plataforma (Prometheo, B2Chat, Cliengo, Botmaker…)

Muchas empresas tienen el agente de IA armado en una plataforma de atención por WhatsApp. Para que ese mismo agente conteste en Linkvia hay tres caminos, del más simple al que más trabajo lleva. Preguntale a tu proveedor cuál ofrece:

1. **Cambiar la dirección de la API de WhatsApp.** Si la plataforma deja conectar un número propio de la Cloud API escribiendo la dirección, el `phone_number_id` y el token (algunas lo llaman "API propia", "número externo" o "BSP propio"), cargá los datos de la tabla de arriba y listo: es el caso de este documento. Como token, dale la **clave del bot** (`lvb_…`, la crea el dueño en Seguridad y claves): sirve solo para mandar y recibir mensajes, así la plataforma no tiene acceso a tu panel.
2. **Usar su API y sus webhooks.** Si la plataforma avisa cada mensaje por webhook y deja contestar por API, un puente chico los une: lo que llega de Linkvia se le pasa a la plataforma y lo que contesta el agente vuelve por `POST /bot/v0/messages` (con la clave del bot, `lvb_…`). Se arma sin programar con n8n o Make (ver [sdks/n8n](../sdks/n8n) y [sdks/make](../sdks/make)) o con unas líneas del SDK. Si el agente pasa la charla a una persona, mandá un `handoff` con el área (`team`) y la atiende tu equipo en Atención.
3. **Un canal personalizado.** Algunas plataformas tienen "canal propio" o "canal por API" para sumar canales que no son WhatsApp. Ahí Linkvia es un canal más, con el mismo puente del punto 2.

Si tu proveedor no ofrece ninguno, escribinos a hola@linkvia.com.ar con el nombre de la plataforma y lo vemos juntos.

## Lo que llega al webhook

El mismo sobre que manda Meta: `object: "whatsapp_business_account"` → `entry[].changes[].value` con `messaging_product`, `metadata`, `contacts` y `messages`. El webhook solo tiene que contestar 200: las respuestas van después por `POST /messages`, como en WhatsApp.

- `wa_id` y `from` no son el teléfono del usuario: son el id de la conversación, distinto para cada negocio. Se usan igual, como `to` al contestar.
- `contacts[].profile.name` trae el nombre solo si el usuario aceptó compartirlo con el negocio; si no, viene vacío.
- `statuses` con `delivered` y `read` para los mensajes del bot, como los manda Meta, si el negocio lo activa en el panel ("Avisarle cuando sus mensajes llegan y se leen") o con `PATCH /business` `{"statusEvents": true}`. `recipient_id` es el id de la conversación.
- Tipos: `text`, `image`, `video`, `audio` (`voice: true`), `document`, `location`, `interactive` (`button_reply` o `list_reply` cuando el usuario toca un botón o elige de una lista; un atajo del menú del agente también llega como `button_reply`, sin `context`) y `reaction`. Las citas y los reenvíos van en `context`.
- Fotos, videos, audios y archivos traen un `id`: con `GET /api/wa/v21.0/{id}` (y la clave de API o la del bot) se pide su `url` y después se baja con un `GET` a esa `url`. La `url` está firmada y vence a las 48 horas (como la de WhatsApp, que vence a los 5 minutos): si venció, se pide de nuevo. También se baja mandando la clave de API (o la del bot) en `Authorization: Bearer`, como hacen los bots de WhatsApp, aunque el link haya vencido. Sin clave, un link vencido responde 401. En el plan Free los archivos de las charlas se borran a los 90 días (y antes si el negocio pasa de 1 GB): ahí `GET /api/wa/v21.0/{id}` y la `url` responden 404, y el usuario ve "Archivo vencido". Si el bot necesita el archivo, que lo baje apenas llega.
- Lo que no tiene equivalente en WhatsApp no se manda, como la respuesta a un pedido de datos del contrato de Linkvia, `user.membership` (cómo entró una persona a un agente privado), `user.guest` (escribe sin cuenta desde el widget), `user.autoMessagesOff` (apagó tus mensajes automáticos: te enterás con el 131050), `user.consents` (el permiso para datos sensibles), `message.source` (desde qué página del widget y qué `data-ref` escriben), el evento `orderFollowUp` (retomar un pedido sin pagar), el evento `broadcast` (qué pasó con una difusión) o el evento `dataDeletion` (el usuario borró sus datos con el agente; si tu negocio declaró datos sensibles, usá el formato de Linkvia para enterarte y borrar lo tuyo). Si los necesitás, usá el formato de Linkvia ([Conectar el bot de un negocio](conectar-un-bot.md)).

## Lo que el bot puede mandar

Con `POST /api/wa/v21.0/{handle}/messages`:

- `text`
- `image`, `video`, `document` y `audio` con `link` (https público, con un dominio y sin usuario ni clave adentro; lo mismo vale para la `url` de un `cta_url`, ver "Cómo tiene que ser un link" en [Conectar el bot de un negocio](conectar-un-bot.md)) o con el `id` de un archivo subido (abajo). Un `video` puede ser MP4, WebM o MOV de hasta 16 MB, con `caption`. Un `document` puede ser PDF, Word, Excel, PowerPoint, OpenOffice, TXT o CSV, según la extensión de `filename` (si no viene, se toma la del `link` o el nombre con que se subió), y un `audio`, OGG/Opus, MP3, M4A o WebM; se ve como un mensaje de voz.
- `sticker` (con `link` o `id`): se ve como una foto, porque Linkvia todavía no tiene stickers.
- `location`
- `interactive` de tipo `button` (hasta 3 botones de respuesta), `list`, `cta_url` (botón con link) y `location_request_message` (botón "Mandar mi ubicación", con `action.name: "send_location"`; la respuesta llega como `location` con `context`). El encabezado solo puede ser de texto.
- `reaction` con `reaction: {"message_id":"wamid…","emoji":"👍"}` para reaccionar a un mensaje del usuario (de las últimas 48 horas); `emoji: ""` la saca. El usuario la ve colgando de su burbuja, sin aviso. No mientras la charla la atiende una persona; hasta 30 por minuto en cada charla (después, 429 con `131056`). Como en Meta, la respuesta trae un id propio de la reacción.
- `status: "read"` con `message_id` para marcar leído, y con `typing_indicator: {"type":"text"}` para mostrar "escribiendo…".
- Las mini apps (`webApp`: una página tuya adentro del chat, con token firmado) son del formato de Linkvia; con este formato mandá un `cta_url`, que abre el link en otra pestaña y sin token.
- Los pedidos con pago (`order`: la tarjeta con renglones, total, estado y botón Pagar) son del formato de Linkvia; los `order_details` de WhatsApp no se aceptan. Con este formato mandá el link de pago con un `cta_url`.
- La publicidad marcada (`sponsored`, #87) no existe en WhatsApp: con este formato no se puede mandar publicidad (las Reglas de contenido la exigen marcada). Si la necesitás, usá el formato de Linkvia.

La respuesta es la misma que la de Meta: `{"messaging_product":"whatsapp","contacts":[...],"messages":[{"id":"wamid.…"}]}`. Los errores también: `{"error":{"message","type","code"}}`.

**Subir archivos (`POST /api/wa/v21.0/{handle}/media`):** igual que en WhatsApp, `multipart/form-data` con `file`, `type` (el tipo, como `image/jpeg`) y `messaging_product: "whatsapp"`. Devuelve `{"id":"…"}`, que se manda como `image.id`, `video.id`, `audio.id`, `document.id` o `sticker.id` las veces que haga falta. Como en WhatsApp, vence a los 30 días y solo lo usa tu negocio. Hasta 16 MB un video y 4 MB lo demás; 200 subidas por día, 30 por minuto y hasta 200 MB guardados entre todos (pasado el tope, 429 o 400). Un `id` que no es de los que devuelve `/media` da 400.

**Datos del número (`GET /api/wa/v21.0/{handle}`):** algunas librerías lo piden al arrancar. Devuelve `id` (el `@handle` sin arroba: no es un número), `display_phone_number` (el `@handle`), `verified_name` (el nombre del negocio), `code_verification_status` (`VERIFIED` si el negocio está verificado), `quality_rating` (siempre `GREEN`), `platform_type` (`CLOUD_API`) y `throughput`.

**Pasar a una persona:** la API de WhatsApp no tiene cómo pedir que atienda alguien del negocio. Cuando tu bot dice "te paso con alguien", hacé además una llamada a la API de Linkvia con la misma clave y el `wa_id` como `conversationId`, y la charla aparece arriba en **Atención** marcada "Pide una persona" (si no, nadie del local se entera):

```http
POST https://app.linkvia.com.ar/api/bot/v0/messages
Authorization: Bearer lv_…
Content-Type: application/json

{"contractVersion":"0","conversationId":"<wa_id>","actions":[{"type":"handoff","reason":"Pidió hablar con una persona"}]}
```

Si el negocio armó áreas en **Equipo**, sumá `"team":"ventas"` (el id del área) para que la charla vaya a esa área; ver "A qué área" en [Conectar el bot de un negocio](conectar-un-bot.md). Hasta que alguien la toma, los mensajes del cliente le siguen llegando a tu bot; mientras la atiende una persona, no. Una persona del negocio igual puede tomar cualquier charla desde Atención aunque el bot no lo pida.

**Plantillas:** no hacen falta. En Linkvia la charla no se cierra a las 24 horas: el bot puede escribir cuando quiera en una conversación existente, mientras el usuario lo tenga en sus contactos (y, en un agente privado, mientras siga siendo miembro: si no, responde 400 con `code: 100`). Si el usuario no le escribió en las últimas 24 horas, puede mandarle hasta 5 mensajes por día en ese chat; pasado el tope responde 429 con el código `131056`, el mismo que usa WhatsApp para el límite entre un negocio y un usuario. Fuera de esas 24 horas, una promo se frena con 400 y el código `131049` (mandala como difusión), y si el usuario apagó los mensajes automáticos de tu negocio responde 400 con el código `131050`, como cuando alguien deja de recibir marketing en WhatsApp (ver "Promos por tu cuenta, no" en [Conectar el bot de un negocio](conectar-un-bot.md)). Si el negocio no está verificado, un mensaje con un link acortado (bit.ly, tinyurl.com…) responde 400: mandá el link completo (ver "Links y estafas" en [Conectar el bot de un negocio](conectar-un-bot.md)). Un `type: "template"` devuelve un error que lo explica. Si el negocio tiene mail del dueño, cambiar la URL del webhook, la clave o el secreto pide entrar al panel con ese mail: con la clave sola, 403. Los planes y sus topes están en "Planes y topes" de [Conectar el bot de un negocio](conectar-un-bot.md).

**Claves de otras cuentas:** un mensaje que pide la clave o el código de otra cuenta del usuario (home banking, WhatsApp, mail, billetera, tarjeta) responde 400 con `code: 100` y no le llega al usuario (no se le muestra nada en su lugar). Si se repite en 3 charlas distintas en 30 días, el agente queda suspendido hasta que Linkvia lo revise y `POST /messages` responde 403 con `code: 10`. Detalle en "Claves de otras cuentas, nunca", en [Conectar el bot de un negocio](conectar-un-bot.md).

**Todavía no:** el estado `sent` y contactos. Los avisos con permiso (`notice`, en [Conectar el bot de un negocio](conectar-un-bot.md)) no tienen equivalente en WhatsApp: con este formato no se ofrecen ni se mandan.

