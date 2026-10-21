# Linkvia y Telegram

Telegram tiene la mejor API de bots que existe y es gratis. Si ya hiciste un bot ahí, sabés lo bien que anda. Esta página explica qué le suma Linkvia a un negocio argentino y cómo llevar un bot de Telegram sin empezar de cero.

## ¿Por qué elegir Linkvia en vez de Telegram?

**Porque los clientes del negocio no tienen que instalar ni pagar nada.**

- **El alta en Telegram puede costar plata.** En Argentina, para mandar el código de verificación por SMS, la app le pide al usuario que pague una semana de Telegram Premium con tarjeta desde Google Play. Mucha gente abandona en ese paso. En Linkvia el cliente entra desde el link o el QR del negocio, pone su teléfono y el código le llega gratis.
- **Se usa igual que WhatsApp.** Es la app que usa casi todo el mundo en Argentina, así que no hay nada que aprender. Telegram tiene otra interfaz y, para muchos clientes, es "otra app más".
- **Es un lugar solo para negocios.** No hay grupos, canales ni mensajes de desconocidos. El cliente tiene ahí los negocios con los que habla, como contactos.
- **Confianza y datos personales.** Cada negocio se verifica con su CUIT y su `@handle` queda protegido. El bot recibe un id distinto para cada negocio, así que la pizzería no puede cruzar datos con la heladería. Los datos del cliente (nombre, teléfono, dirección) llegan solo con su permiso, dato por dato, como pide la Ley 25.326. En Telegram el bot recibe un id que es el mismo para todos los bots, y el consentimiento lo resuelve cada uno.
- **Servicio al negocio.** Linkvia vigila el bot cada 5 minutos y avisa si deja de responder. El negocio tiene un panel con las conversaciones del mes y soporte en español.

## Lo que Telegram hace mejor (por ahora)

Es gratis, mucha gente ya lo tiene instalado y tiene más años de API: mini apps, cobros dentro del chat, app nativa con notificaciones muy confiables. Linkvia hoy es web (se puede agregar a la pantalla del celular) y la app para Android y iPhone viene después del piloto.

No son excluyentes: el mismo agente puede atender en los dos lados.

## Llevar un bot de Telegram a Linkvia

La lógica del bot (el modelo de IA, los prompts, el catálogo, la base de datos) queda igual. Cambia solo la capa que habla con el mensajero:

| En Telegram | En Linkvia |
| --- | --- |
| `setWebhook` con `secret_token` | Webhook registrado en el panel, con firma HMAC (`whsec_…`) |
| `update.message.text` | evento `message` con `text` |
| `sendMessage` | acción `text` en la respuesta del webhook, o `POST /bot/v0/messages` con la clave `lv_…` para escribir por su cuenta |
| `reply_markup` con `inline_keyboard` | acciones `buttons` (hasta 3), `list` o `carousel` |
| `sendPhoto` / `sendDocument` | acciones `image` y `document` |
| `sendChatAction("typing")` | `POST /bot/v0/typing`, o la respuesta de a partes con `POST /bot/v0/stream` |
| `chat.id` y `from.id` | id seudónimo del usuario, distinto para cada negocio |
| `t.me/tu_bot?start=...` | `https://linkvia.optis.site/@tu_handle?text=...` |

Los detalles de cada evento y acción están en [conectar-un-bot.md](conectar-un-bot.md). Si querés que una IA te haga la adaptación, pasale [linkvia-para-tu-ia.md](linkvia-para-tu-ia.md) junto con el código de tu bot.
